import { LOCAL_RJ_PRECEDENCE, getSouthAmericaSource } from './south-america-meteorology.mjs';
import { findRjMunicipality } from './rio-municipalities.mjs';

export const WEATHER_TRANSITION_SCHEMA_VERSION = 1;
export const WEATHER_TRANSITION_HORIZONS = Object.freeze([24, 48]);
export const SOUTHEAST_AREAS = Object.freeze({
  SP: 'São Paulo',
  MG: 'Minas Gerais',
  RJ: 'Rio de Janeiro',
  ES: 'Espírito Santo',
});

export const WEATHER_TRANSITION_POLICY = Object.freeze({
  role: 'probabilistic_guidance_only',
  confidenceLevelPercent: 90,
  requiresAtLeastIndependentModelSources: 2,
  historicalCalibrationRequiredForProductionConfidenceLabel: true,
  mayOverrideLocalRjOfficialAlert: false,
  mayOverrideLocalRjOfficialObservation: false,
  mayTriggerP0: false,
});

const HORIZON_SET = new Set(WEATHER_TRANSITION_HORIZONS);
const AREA_SET = new Set(Object.keys(SOUTHEAST_AREAS));
const MAX_FUTURE_SKEW_MILLIS = 5 * 60 * 1000;
const MAX_BOUNDARY_EVIDENCE_AGE_MILLIS = 60 * 60 * 1000;
const MAX_LOCAL_SIGNAL_AGE_MILLIS = 60 * 60 * 1000;
const Z_90 = 1.6448536269514722;
const MIN_MODEL_SOURCES = 2;

const PROBABILITY_FLOOR = Object.freeze({
  upstream: Object.freeze({ 24: 0.10, 48: 0.15 }),
  local: Object.freeze({ 24: 0.06, 48: 0.10 }),
});

const METRIC_FLOORS = Object.freeze({
  temperatureDeltaC: Object.freeze({ upstream: Object.freeze({ 24: 1.0, 48: 1.5 }), local: Object.freeze({ 24: 0.75, 48: 1.0 }) }),
  precipitationMm: Object.freeze({ upstream: Object.freeze({ 24: 5, 48: 10 }), local: Object.freeze({ 24: 3, 48: 6 }) }),
  windGustKph: Object.freeze({ upstream: Object.freeze({ 24: 5, 48: 10 }), local: Object.freeze({ 24: 3, 48: 6 }) }),
  pressureDeltaHpa: Object.freeze({ upstream: Object.freeze({ 24: 1.0, 48: 1.5 }), local: Object.freeze({ 24: 0.75, 48: 1.0 }) }),
  arrivalAtMillis: Object.freeze({ upstream: Object.freeze({ 24: 1.5, 48: 3.0 }), local: Object.freeze({ 24: 0.75, 48: 1.5 }) }),
});

export function buildSouthToSoutheastRjEstimate(input, { nowMillis = Date.now() } = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('estimate_input_required');
  const now = epochMillis(nowMillis, 'invalid_now');
  const changeType = boundedString(input.changeType, 1, 80, 'change_type_required');
  const southeastGuidance = normalizeGuidanceArray(input.southeastGuidance ?? [], 'SOUTHEAST', now);
  const rjGuidance = normalizeGuidanceArray(input.rjGuidance ?? [], 'RJ', now);
  const boundary = normalizeBoundaryEvidence(input.rjBoundaryEvidence ?? null, now);
  const localSignals = normalizeLocalSignals(input.rjLocalSignals ?? [], now);
  const boundaryHasFreshLocalEvidence = boundary.confirmed && localSignals.length > 0;

  const southeast = buildSoutheastEstimate(southeastGuidance);
  const rj = buildRjEstimate(rjGuidance, {
    localSignals: boundary.confirmed ? localSignals : [],
    boundary,
  });

  return deepFreeze({
    schemaVersion: WEATHER_TRANSITION_SCHEMA_VERSION,
    generatedAtMillis: now,
    changeType,
    methodology: {
      probability: 'weighted-model/ensemble consensus with finite-ensemble and inter-model spread',
      interval: '90% uncertainty interval with conservative horizon floor',
      calibrationStatus: 'UNCALIBRATED_UNTIL_HISTORICAL_BACKTEST',
      affectedMunicipalityThresholdPercent: 50,
      localEvidenceApplied: boundaryHasFreshLocalEvidence,
    },
    policy: {
      ...WEATHER_TRANSITION_POLICY,
      localRjPrecedence: LOCAL_RJ_PRECEDENCE,
    },
    boundary,
    southeast,
    rj,
  });
}

function buildSoutheastEstimate(records) {
  const groups = groupBy(records, (record) => `${record.horizonHours}|${record.areaId}`);
  const horizons = {};
  for (const horizon of WEATHER_TRANSITION_HORIZONS) {
    const areas = [];
    for (const areaId of Object.keys(SOUTHEAST_AREAS)) {
      const bucket = groups.get(`${horizon}|${areaId}`) ?? [];
      areas.push(buildTargetEstimate(bucket, {
        horizon,
        target: { areaId, name: SOUTHEAST_AREAS[areaId] },
        localEntries: [],
      }));
    }
    horizons[String(horizon)] = Object.freeze({ horizonHours: horizon, areas: Object.freeze(areas) });
  }
  return Object.freeze({ horizons: Object.freeze(horizons) });
}

function buildRjEstimate(records, { localSignals, boundary }) {
  const guidanceGroups = groupBy(records, (record) => `${record.horizonHours}|${record.targetIbge}`);
  const subregionByCity = new Map();
  for (const record of records) {
    const current = subregionByCity.get(record.targetIbge);
    if (current && current !== record.subregionId) throw new Error('inconsistent_rj_subregion');
    subregionByCity.set(record.targetIbge, record.subregionId);
  }

  const localByCity = groupBy(localSignals, (signal) => signal.targetIbge);
  const targetIbges = new Set(records.map((record) => record.targetIbge));
  if (boundary.confirmed) {
    for (const signal of localSignals) targetIbges.add(signal.targetIbge);
  }

  const horizons = {};
  for (const horizon of WEATHER_TRANSITION_HORIZONS) {
    const municipalities = [];
    for (const ibge of [...targetIbges].sort()) {
      const city = findRjMunicipality(ibge);
      if (!city) continue;
      const bucket = guidanceGroups.get(`${horizon}|${ibge}`) ?? [];
      const localEntries = boundary.confirmed ? (localByCity.get(ibge) ?? []).map((signal) => localSignalAsEntry(signal, horizon)) : [];
      const subregionId = subregionByCity.get(ibge) ?? localEntries[0]?.subregionId ?? 'UNASSIGNED';
      municipalities.push(buildTargetEstimate(bucket, {
        horizon,
        target: { ibge, name: city.name, subregionId },
        localEntries,
      }));
    }

    horizons[String(horizon)] = Object.freeze({
      horizonHours: horizon,
      municipalities: Object.freeze(municipalities),
      subregions: Object.freeze(buildSubregionSummaries(municipalities)),
    });
  }

  const phase = !boundary.confirmed
    ? 'UPSTREAM_24_48H'
    : localSignals.length > 0
      ? 'RJ_BOUNDARY_RECALCULATED_WITH_LOCAL_EVIDENCE'
      : 'RJ_BOUNDARY_CONFIRMED_AWAITING_LOCAL_EVIDENCE';

  return Object.freeze({ phase, horizons: Object.freeze(horizons) });
}

function buildTargetEstimate(modelRecords, { horizon, target, localEntries }) {
  const uniqueModelSources = new Set(modelRecords.map((record) => record.sourceId));
  if (uniqueModelSources.size < MIN_MODEL_SOURCES) {
    return deepFreeze({
      ...target,
      horizonHours: horizon,
      status: 'INSUFFICIENT_GUIDANCE',
      requiredIndependentModelSources: MIN_MODEL_SOURCES,
      availableIndependentModelSources: uniqueModelSources.size,
      modelSourceIds: [...uniqueModelSources].sort(),
      probabilityPercent: null,
      marginOfErrorPp: null,
      interval90Percent: null,
      southInfluencePercent: null,
      localSignalCount: localEntries.length,
      likelyAffected: null,
      officialAlert: false,
      canTriggerP0: false,
    });
  }

  const modelEntries = modelRecords.map(modelGuidanceAsEntry).filter((entry) => entry.weight > 0);
  if (modelEntries.length === 0) {
    return deepFreeze({
      ...target,
      horizonHours: horizon,
      status: 'INSUFFICIENT_SOUTH_INFLUENCE',
      requiredIndependentModelSources: MIN_MODEL_SOURCES,
      availableIndependentModelSources: uniqueModelSources.size,
      modelSourceIds: [...uniqueModelSources].sort(),
      probabilityPercent: null,
      marginOfErrorPp: null,
      interval90Percent: null,
      southInfluencePercent: 0,
      localSignalCount: localEntries.length,
      likelyAffected: null,
      officialAlert: false,
      canTriggerP0: false,
    });
  }

  const entries = [...modelEntries, ...localEntries];
  const probability = probabilityStats(entries, horizon, localEntries.length > 0);
  const southInfluence = weightedMean(modelEntries.map((entry) => ({ value: entry.southInfluence, weight: entry.weight })));
  const ensembleMembers = modelRecords.reduce((sum, record) => sum + record.ensembleMembers, 0);

  return deepFreeze({
    ...target,
    horizonHours: horizon,
    status: 'ESTIMATED',
    modelSourceIds: [...uniqueModelSources].sort(),
    modelSourceCount: uniqueModelSources.size,
    ensembleMemberCount: ensembleMembers,
    localSignalCount: localEntries.length,
    probabilityPercent: round1(probability.mean * 100),
    marginOfErrorPp: round1(probability.margin * 100),
    interval90Percent: {
      low: round1(probability.low * 100),
      high: round1(probability.high * 100),
    },
    southInfluencePercent: round1(southInfluence * 100),
    likelyAffected: probability.mean >= 0.5,
    arrival: metricStats(entries, 'arrivalAtMillis', horizon, localEntries.length > 0),
    effects: {
      temperatureDeltaC: metricStats(entries, 'temperatureDeltaC', horizon, localEntries.length > 0),
      precipitationMm: metricStats(entries, 'precipitationMm', horizon, localEntries.length > 0),
      windGustKph: metricStats(entries, 'windGustKph', horizon, localEntries.length > 0),
      pressureDeltaHpa: metricStats(entries, 'pressureDeltaHpa', horizon, localEntries.length > 0),
    },
    officialAlert: false,
    canTriggerP0: false,
  });
}

function buildSubregionSummaries(municipalities) {
  const groups = groupBy(municipalities, (item) => item.subregionId ?? 'UNASSIGNED');
  const summaries = [];
  for (const [subregionId, items] of groups) {
    const estimated = items.filter((item) => item.status === 'ESTIMATED');
    const expectedAffectedPercent = estimated.length === 0
      ? null
      : estimated.reduce((sum, item) => sum + item.probabilityPercent, 0) / estimated.length;
    const meanMargin = estimated.length === 0
      ? null
      : estimated.reduce((sum, item) => sum + item.marginOfErrorPp, 0) / estimated.length;
    const likely = estimated.filter((item) => item.likelyAffected);
    summaries.push(deepFreeze({
      subregionId,
      targetMunicipalityCount: items.length,
      estimatedMunicipalityCount: estimated.length,
      expectedAffectedMunicipalityPercent: expectedAffectedPercent == null ? null : round1(expectedAffectedPercent),
      meanProbabilityMarginOfErrorPp: meanMargin == null ? null : round1(meanMargin),
      likelyAffectedMunicipalityCount: likely.length,
      likelyAffectedMunicipalities: likely.map((item) => item.name).sort(),
    }));
  }
  return summaries.sort((a, b) => a.subregionId.localeCompare(b.subregionId));
}

function normalizeGuidanceArray(records, scope, now) {
  if (!Array.isArray(records)) throw new TypeError('guidance_must_be_array');
  return records.map((record) => normalizeGuidanceRecord(record, scope, now)).filter(Boolean);
}

function normalizeGuidanceRecord(input, scope, now) {
  if (!input || typeof input !== 'object') throw new TypeError('guidance_record_required');
  const source = getSouthAmericaSource(input.sourceId);
  if (!source || source.kind !== 'MODEL') throw new Error('guidance_requires_registered_model_source');
  const issuedAtMillis = epochMillis(input.issuedAtMillis, 'guidance_issued_at_required');
  if (issuedAtMillis > now + MAX_FUTURE_SKEW_MILLIS) throw new Error('future_guidance_rejected');
  if (now - issuedAtMillis > source.maxAgeMinutes * 60 * 1000) return null;

  const horizonHours = integerInSet(input.horizonHours, HORIZON_SET, 'unsupported_horizon');
  const probability = probability01(input.probability, 'invalid_probability');
  const southInfluence = probability01(input.southInfluence, 'invalid_south_influence');
  const ensembleMembers = boundedInteger(input.ensembleMembers ?? 1, 1, 1000, 'invalid_ensemble_members');
  const base = {
    sourceId: source.id,
    sourcePriority: source.priority,
    horizonHours,
    probability,
    southInfluence,
    ensembleMembers,
    issuedAtMillis,
    arrivalAtMillis: optionalEpochMillis(input.arrivalAtMillis),
    temperatureDeltaC: optionalFinite(input.temperatureDeltaC, -40, 40, 'invalid_temperature_delta'),
    precipitationMm: optionalFinite(input.precipitationMm, 0, 2000, 'invalid_precipitation'),
    windGustKph: optionalFinite(input.windGustKph, 0, 450, 'invalid_wind_gust'),
    pressureDeltaHpa: optionalFinite(input.pressureDeltaHpa, -80, 80, 'invalid_pressure_delta'),
  };

  if (scope === 'SOUTHEAST') {
    const areaId = boundedString(input.areaId, 2, 2, 'southeast_area_required').toUpperCase();
    if (!AREA_SET.has(areaId)) throw new Error('invalid_southeast_area');
    return Object.freeze({ ...base, areaId });
  }

  const targetIbge = boundedString(input.targetIbge, 7, 7, 'target_ibge_required');
  if (!findRjMunicipality(targetIbge)) throw new Error('unknown_rj_municipality');
  const subregionId = boundedString(input.subregionId, 1, 80, 'subregion_required');
  return Object.freeze({ ...base, targetIbge, subregionId });
}

function normalizeBoundaryEvidence(input, now) {
  if (input == null) return Object.freeze({ confirmed: false, confidencePercent: 0, observedAtMillis: null, sourceIds: Object.freeze([]) });
  if (typeof input !== 'object') throw new TypeError('boundary_evidence_must_be_object');
  const confirmed = input.confirmed === true;
  const confidence = probability01(input.confidence ?? 0, 'invalid_boundary_confidence');
  if (!confirmed) return Object.freeze({ confirmed: false, confidencePercent: round1(confidence * 100), observedAtMillis: null, sourceIds: Object.freeze([]) });
  const observedAtMillis = epochMillis(input.observedAtMillis, 'boundary_observed_at_required');
  if (observedAtMillis > now + MAX_FUTURE_SKEW_MILLIS) throw new Error('future_boundary_evidence_rejected');
  if (now - observedAtMillis > MAX_BOUNDARY_EVIDENCE_AGE_MILLIS) throw new Error('stale_boundary_evidence_rejected');
  const sourceIds = boundedStringArray(input.sourceIds, 1, 12, 120, 'boundary_sources_required');
  return Object.freeze({
    confirmed: true,
    confidencePercent: round1(confidence * 100),
    observedAtMillis,
    sourceIds: Object.freeze(sourceIds),
  });
}

function normalizeLocalSignals(records, now) {
  if (!Array.isArray(records)) throw new TypeError('local_signals_must_be_array');
  return records.map((input) => {
    if (!input || typeof input !== 'object') throw new TypeError('local_signal_required');
    const targetIbge = boundedString(input.targetIbge, 7, 7, 'local_target_ibge_required');
    if (!findRjMunicipality(targetIbge)) throw new Error('unknown_rj_municipality');
    const observedAtMillis = epochMillis(input.observedAtMillis, 'local_observed_at_required');
    if (observedAtMillis > now + MAX_FUTURE_SKEW_MILLIS) throw new Error('future_local_signal_rejected');
    if (now - observedAtMillis > MAX_LOCAL_SIGNAL_AGE_MILLIS) return null;
    const authority = boundedString(input.authority, 1, 40, 'local_authority_required');
    if (!new Set(['OFFICIAL_OBSERVATION', 'OFFICIAL_RADAR', 'OFFICIAL_ALERT']).has(authority)) {
      throw new Error('unsupported_local_authority');
    }
    return Object.freeze({
      targetIbge,
      subregionId: input.subregionId == null ? null : boundedString(input.subregionId, 1, 80, 'invalid_local_subregion'),
      sourceId: boundedString(input.sourceId, 1, 120, 'local_source_id_required'),
      authority,
      observedAtMillis,
      probability: probability01(input.probability, 'invalid_local_probability'),
      confidence: probability01(input.confidence, 'invalid_local_confidence'),
      arrivalAtMillis: optionalEpochMillis(input.arrivalAtMillis),
      temperatureDeltaC: optionalFinite(input.temperatureDeltaC, -40, 40, 'invalid_temperature_delta'),
      precipitationMm: optionalFinite(input.precipitationMm, 0, 2000, 'invalid_precipitation'),
      windGustKph: optionalFinite(input.windGustKph, 0, 450, 'invalid_wind_gust'),
      pressureDeltaHpa: optionalFinite(input.pressureDeltaHpa, -80, 80, 'invalid_pressure_delta'),
    });
  }).filter(Boolean);
}

function modelGuidanceAsEntry(record) {
  const priorityWeight = record.sourcePriority / 100;
  const weight = priorityWeight * record.southInfluence * Math.sqrt(record.ensembleMembers);
  return Object.freeze({
    kind: 'MODEL',
    probability: record.probability,
    southInfluence: record.southInfluence,
    sampleSize: record.ensembleMembers,
    weight,
    arrivalAtMillis: record.arrivalAtMillis,
    temperatureDeltaC: record.temperatureDeltaC,
    precipitationMm: record.precipitationMm,
    windGustKph: record.windGustKph,
    pressureDeltaHpa: record.pressureDeltaHpa,
  });
}

function localSignalAsEntry(signal, horizon) {
  const decay = horizon === 24 ? 1 : 0.65;
  return Object.freeze({
    kind: 'LOCAL',
    subregionId: signal.subregionId,
    probability: signal.probability,
    southInfluence: 1,
    sampleSize: 1,
    weight: 2.5 * signal.confidence * decay,
    arrivalAtMillis: signal.arrivalAtMillis,
    temperatureDeltaC: signal.temperatureDeltaC,
    precipitationMm: signal.precipitationMm,
    windGustKph: signal.windGustKph,
    pressureDeltaHpa: signal.pressureDeltaHpa,
  });
}

function probabilityStats(entries, horizon, hasLocal) {
  const usable = entries.filter((entry) => entry.weight > 0);
  const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0);
  const normalized = usable.map((entry) => ({ ...entry, q: entry.weight / totalWeight }));
  const mean = normalized.reduce((sum, entry) => sum + entry.q * entry.probability, 0);
  const measurementVariance = normalized.reduce(
    (sum, entry) => sum + (entry.q ** 2) * entry.probability * (1 - entry.probability) / Math.max(1, entry.sampleSize),
    0,
  );
  const betweenVariance = normalized.reduce((sum, entry) => sum + entry.q * ((entry.probability - mean) ** 2), 0);
  const effectiveSources = 1 / normalized.reduce((sum, entry) => sum + (entry.q ** 2), 0);
  const rawSe = Math.sqrt(measurementVariance + betweenVariance / Math.max(1, effectiveSources));
  const floor = (hasLocal ? PROBABILITY_FLOOR.local : PROBABILITY_FLOOR.upstream)[horizon];
  const margin = Math.min(1, Math.max(floor, Z_90 * rawSe));
  return { mean, margin, low: Math.max(0, mean - margin), high: Math.min(1, mean + margin) };
}

function metricStats(entries, field, horizon, hasLocal) {
  const values = entries
    .filter((entry) => entry.weight > 0 && entry[field] != null)
    .map((entry) => ({ value: entry[field], weight: entry.weight }));
  if (values.length === 0) return null;
  const mean = weightedMean(values);
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  const qs = values.map((item) => item.weight / totalWeight);
  const variance = values.reduce((sum, item, index) => sum + qs[index] * ((item.value - mean) ** 2), 0);
  const effective = 1 / qs.reduce((sum, q) => sum + q ** 2, 0);
  const rawMargin = Z_90 * Math.sqrt(variance / Math.max(1, effective));
  const floor = (hasLocal ? METRIC_FLOORS[field].local : METRIC_FLOORS[field].upstream)[horizon];

  if (field === 'arrivalAtMillis') {
    const HOUR = 60 * 60 * 1000;
    const margin = Math.max(floor * HOUR, rawMargin);
    return Object.freeze({ etaMillis: Math.round(mean), plusMinusHours: round1(margin / HOUR) });
  }
  const margin = Math.max(floor, rawMargin);
  return Object.freeze({ estimate: round1(mean), plusMinus: round1(margin) });
}

function weightedMean(values) {
  const total = values.reduce((sum, item) => sum + item.weight, 0);
  if (!(total > 0)) return 0;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / total;
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return map;
}

function epochMillis(value, errorCode) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(errorCode);
  return parsed;
}

function optionalEpochMillis(value) {
  if (value == null) return null;
  return epochMillis(value, 'invalid_optional_epoch');
}

function probability01(value, errorCode) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(errorCode);
  return parsed;
}

function boundedInteger(value, min, max, errorCode) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(errorCode);
  return parsed;
}

function integerInSet(value, set, errorCode) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || !set.has(parsed)) throw new Error(errorCode);
  return parsed;
}

function optionalFinite(value, min, max, errorCode) {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error(errorCode);
  return parsed;
}

function boundedString(value, min, max, errorCode) {
  if (typeof value !== 'string') throw new Error(errorCode);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new Error(errorCode);
  return trimmed;
}

function boundedStringArray(value, minItems, maxItems, maxLength, errorCode) {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) throw new Error(errorCode);
  return value.map((item) => boundedString(item, 1, maxLength, errorCode));
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
