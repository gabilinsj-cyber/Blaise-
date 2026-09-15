export const SOUTH_AMERICA_LAYER_ID = 'south-america-wmo-ar3';

export const LOCAL_RJ_PRECEDENCE = Object.freeze({
  role: 'upstream_context_and_cross_border_guidance',
  mayOverrideLocalRjOfficialAlert: false,
  mayOverrideLocalRjOfficialObservation: false,
  modelGuidanceCanBecomeP0: false,
});

export const WIS2_GLOBAL_BROKERS = Object.freeze([
  Object.freeze({
    id: 'br-inmet-global-broker',
    endpoint: 'mqtts://everyone:everyone@globalbroker.inmet.gov.br:8883',
    transportPriority: 100,
  }),
  Object.freeze({
    id: 'fr-meteofrance-global-broker',
    endpoint: 'mqtts://everyone:everyone@globalbroker.meteo.fr:8883',
    transportPriority: 90,
  }),
  Object.freeze({
    id: 'cn-cma-global-broker',
    endpoint: 'mqtts://everyone:everyone@gb.wis.cma.cn:8883',
    transportPriority: 80,
  }),
  Object.freeze({
    id: 'us-noaa-global-broker',
    endpoint: 'mqtts://everyone:everyone@wis2globalbroker.nws.noaa.gov:8883',
    transportPriority: 70,
  }),
]);

export const SOUTH_AMERICA_SOURCES = Object.freeze([
  Object.freeze({
    id: 'wmo-wis2-ar-smn-synop',
    provider: 'Servicio Meteorologico Nacional Argentina',
    centreId: 'ar-smn',
    region: 'WMO_AR_III',
    kind: 'OBSERVATION',
    authority: 'official_observation',
    priority: 95,
    maxAgeMinutes: 120,
    datasetId: 'urn:wmo:md:ar-smn:slt0ci',
    brokerTopic: 'cache/a/wis2/ar-smn/data/core/weather/surface-based-observations/synop',
    discoveryUrl: 'https://wis2-gdc.weather.gc.ca/collections/wis2-discovery-metadata/items/urn%3Awmo%3Amd%3Aar-smn%3Aslt0ci?f=html',
    network: 'WMO_WIS2',
    dataPolicy: 'WMO_CORE',
  }),
  Object.freeze({
    id: 'wmo-wis2-uy-inumet-synop',
    provider: 'Instituto Uruguayo de Meteorologia',
    centreId: 'uy-inumet',
    region: 'WMO_AR_III',
    kind: 'OBSERVATION',
    authority: 'official_observation',
    priority: 94,
    maxAgeMinutes: 120,
    datasetId: 'urn:wmo:md:uy-inumet:surface-based-observations.synop',
    originTopic: 'origin/a/wis2/uy-inumet/data/core/weather/surface-based-observations/synop',
    brokerTopic: 'cache/a/wis2/uy-inumet/data/core/weather/surface-based-observations/synop',
    discoveryUrl: 'https://w2b.inumet.gub.uy/oapi/collections/discovery-metadata/items/urn%3Awmo%3Amd%3Auy-inumet%3Asurface-based-observations.synop?f=html',
    network: 'WMO_WIS2',
    dataPolicy: 'WMO_CORE',
  }),
  Object.freeze({
    id: 'wmo-wis2-uy-inumet-cap',
    provider: 'Instituto Uruguayo de Meteorologia',
    centreId: 'uy-inumet',
    region: 'WMO_AR_III',
    kind: 'ALERT',
    authority: 'official_alert_origin_country',
    priority: 98,
    maxAgeMinutes: 30,
    datasetId: 'urn:wmo:md:uy-inumet:cap-alerts',
    originTopic: 'origin/a/wis2/uy-inumet/data/core/weather/advisories-warnings',
    brokerTopic: 'cache/a/wis2/uy-inumet/data/core/weather/advisories-warnings',
    discoveryUrl: 'https://w2b.inumet.gub.uy/oapi/collections/discovery-metadata/items/urn%3Awmo%3Amd%3Auy-inumet%3Acap-alerts?f=html',
    network: 'WMO_WIS2',
    dataPolicy: 'WMO_CORE',
  }),
  Object.freeze({
    id: 'ecmwf-ifs-open',
    provider: 'ECMWF',
    centreId: 'int-ecmwf',
    region: 'GLOBAL_WITH_AR_III_FOCUS',
    kind: 'MODEL',
    authority: 'numerical_guidance',
    priority: 80,
    maxAgeMinutes: 900,
    endpoint: 'https://data.ecmwf.int/forecasts',
    network: 'ECMWF_OPEN_DATA',
    dataPolicy: 'CC_BY_4_0_ATTRIBUTION_REQUIRED',
  }),
  Object.freeze({
    id: 'noaa-gfs-0p25',
    provider: 'NOAA NCEP',
    centreId: 'us-noaa-ncep',
    region: 'GLOBAL_WITH_AR_III_FOCUS',
    kind: 'MODEL',
    authority: 'numerical_guidance',
    priority: 75,
    maxAgeMinutes: 540,
    endpoint: 'https://nomads.ncep.noaa.gov/',
    dataset: 'GFS_0P25',
    network: 'NOAA_NOMADS',
    dataPolicy: 'NOAA_OPEN_OPERATIONAL_DATA',
  }),
]);

const SOURCE_BY_ID = new Map(SOUTH_AMERICA_SOURCES.map((source) => [source.id, source]));
const BROKER_BY_ID = new Map(WIS2_GLOBAL_BROKERS.map((broker) => [broker.id, broker]));
const MAX_CLOCK_SKEW_MILLIS = 5 * 60 * 1000;

export function getSouthAmericaSource(sourceId) {
  return SOURCE_BY_ID.get(sourceId) ?? null;
}

export function normalizeSouthAmericaRecord(input) {
  if (!input || typeof input !== 'object') throw new TypeError('record_required');
  const source = getSouthAmericaSource(input.sourceId);
  if (!source) throw new Error('unknown_south_america_source');

  const canonicalKey = boundedString(input.canonicalKey, 1, 240, 'canonical_key_required');
  const originRecordId = boundedString(input.originRecordId, 1, 320, 'origin_record_id_required');
  const effectiveAtMillis = epochMillis(input.effectiveAtMillis, 'effective_at_required');
  const receivedAtMillis = epochMillis(input.receivedAtMillis, 'received_at_required');
  const validUntilMillis = input.validUntilMillis == null
    ? null
    : epochMillis(input.validUntilMillis, 'invalid_valid_until');

  if (validUntilMillis != null && validUntilMillis < effectiveAtMillis) {
    throw new Error('invalid_record_validity_window');
  }

  let brokerId = null;
  if (input.brokerId != null) {
    brokerId = boundedString(input.brokerId, 1, 120, 'invalid_broker_id');
    if (source.network !== 'WMO_WIS2' || !BROKER_BY_ID.has(brokerId)) {
      throw new Error('invalid_wis2_broker');
    }
  }

  return Object.freeze({
    sourceId: source.id,
    sourceKind: source.kind,
    provider: source.provider,
    centreId: source.centreId,
    canonicalKey,
    originRecordId,
    effectiveAtMillis,
    receivedAtMillis,
    validUntilMillis,
    brokerId,
    provenanceUrl: boundedOptionalString(input.provenanceUrl, 600),
    payloadDigest: boundedOptionalString(input.payloadDigest, 160),
  });
}

export function classifySouthAmericaRecord(record, { nowMillis = Date.now() } = {}) {
  const normalized = normalizeSouthAmericaRecord(record);
  const now = epochMillis(nowMillis, 'invalid_now');
  const source = getSouthAmericaSource(normalized.sourceId);

  if (normalized.effectiveAtMillis > now + MAX_CLOCK_SKEW_MILLIS) return 'FUTURE';
  if (normalized.validUntilMillis != null && normalized.validUntilMillis < now) return 'EXPIRED';
  const ageMillis = Math.max(0, now - normalized.effectiveAtMillis);
  return ageMillis <= source.maxAgeMinutes * 60 * 1000 ? 'FRESH' : 'STALE';
}

export function deduplicateSouthAmericaRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('records_must_be_array');
  const byOrigin = new Map();

  for (const raw of records) {
    const record = normalizeSouthAmericaRecord(raw);
    const key = `${record.sourceId}|${record.originRecordId}`;
    const current = byOrigin.get(key);
    if (!current || compareTransportCopies(record, current) < 0) byOrigin.set(key, record);
  }

  return Object.freeze([...byOrigin.values()]);
}

export function buildSouthAmericaLayerSnapshot(records, { nowMillis = Date.now() } = {}) {
  const now = epochMillis(nowMillis, 'invalid_now');
  const deduplicated = deduplicateSouthAmericaRecords(records);
  const grouped = new Map();
  const statusCounts = { FRESH: 0, STALE: 0, EXPIRED: 0, FUTURE: 0 };

  for (const record of deduplicated) {
    const status = classifySouthAmericaRecord(record, { nowMillis: now });
    statusCounts[status] += 1;
    const bucket = grouped.get(record.canonicalKey) ?? [];
    bucket.push(Object.freeze({ ...record, status }));
    grouped.set(record.canonicalKey, bucket);
  }

  const reconciled = {};
  for (const [canonicalKey, bucket] of grouped.entries()) {
    const eligible = bucket
      .filter((record) => record.status === 'FRESH')
      .sort(compareAuthorityAndRecency);

    reconciled[canonicalKey] = Object.freeze({
      preferred: eligible[0] ?? null,
      alternates: Object.freeze(eligible.slice(1)),
      unavailableCandidates: Object.freeze(bucket.filter((record) => record.status !== 'FRESH')),
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    layerId: SOUTH_AMERICA_LAYER_ID,
    generatedAtMillis: now,
    localRjPrecedence: LOCAL_RJ_PRECEDENCE,
    sourceCount: SOUTH_AMERICA_SOURCES.length,
    recordCount: records.length,
    deduplicatedRecordCount: deduplicated.length,
    statusCounts: Object.freeze(statusCounts),
    reconciled: Object.freeze(reconciled),
  });
}

function compareTransportCopies(left, right) {
  const leftPriority = brokerPriority(left.brokerId);
  const rightPriority = brokerPriority(right.brokerId);
  if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  if (left.receivedAtMillis !== right.receivedAtMillis) return left.receivedAtMillis - right.receivedAtMillis;
  return left.originRecordId.localeCompare(right.originRecordId);
}

function compareAuthorityAndRecency(left, right) {
  const leftSource = getSouthAmericaSource(left.sourceId);
  const rightSource = getSouthAmericaSource(right.sourceId);
  if (leftSource.priority !== rightSource.priority) return rightSource.priority - leftSource.priority;
  if (left.effectiveAtMillis !== right.effectiveAtMillis) return right.effectiveAtMillis - left.effectiveAtMillis;
  return left.sourceId.localeCompare(right.sourceId);
}

function brokerPriority(brokerId) {
  if (brokerId == null) return 0;
  return BROKER_BY_ID.get(brokerId)?.transportPriority ?? -1;
}

function epochMillis(value, errorCode) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(errorCode);
  return parsed;
}

function boundedString(value, min, max, errorCode) {
  if (typeof value !== 'string') throw new Error(errorCode);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new Error(errorCode);
  return trimmed;
}

function boundedOptionalString(value, max) {
  if (value == null) return null;
  return boundedString(value, 1, max, 'invalid_optional_string');
}
