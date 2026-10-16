export const WEATHER_TRANSITION_CALIBRATION_SCHEMA_VERSION = 1;
export const WEATHER_TRANSITION_CALIBRATION_HORIZONS = Object.freeze([24, 48]);

export const WEATHER_TRANSITION_CALIBRATION_POLICY = Object.freeze({
  minimumSamplesPerHorizon: 200,
  minimumPositiveOutcomesPerHorizon: 25,
  minimumNegativeOutcomesPerHorizon: 25,
  minimumDistinctTargetsPerHorizon: 10,
  maximumBrierScore: 0.22,
  maximumExpectedCalibrationErrorPp: 10,
  minimumBrierSkillScore: 0,
  likelyAffectedThresholdPercent: 50,
  reliabilityBinWidthPp: 10,
  productionConfidenceRequiresHistoricalObservedDataset: true,
  productionConfidenceRequiresVerifiedProvenance: true,
  productionConfidenceRequiresIndependentReview: true,
});

const HORIZONS = new Set(WEATHER_TRANSITION_CALIBRATION_HORIZONS);
const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_TARGET_ID_LENGTH = 120;
const LEAD_TIME_TOLERANCE_HOURS = 4;

export function evaluateWeatherTransitionBacktest(samples, { datasetEvidence = null } = {}) {
  if (!Array.isArray(samples)) throw new TypeError('backtest_samples_array_required');
  const normalized = samples.map((sample, index) => normalizeSample(sample, index));
  const byHorizon = new Map(WEATHER_TRANSITION_CALIBRATION_HORIZONS.map((horizon) => [horizon, []]));
  for (const sample of normalized) byHorizon.get(sample.horizonHours).push(sample);

  const horizons = {};
  for (const horizon of WEATHER_TRANSITION_CALIBRATION_HORIZONS) {
    horizons[String(horizon)] = evaluateHorizon(horizon, byHorizon.get(horizon));
  }

  const horizonResults = Object.values(horizons);
  const statisticalGatePass = horizonResults.every((result) => result.qualityGatePass);
  const evidence = normalizeDatasetEvidence(datasetEvidence);
  const evidenceGatePass = datasetEvidenceEligible(evidence);
  const productionConfidenceLabelAllowed = statisticalGatePass && evidenceGatePass;

  const blockers = [];
  for (const result of horizonResults) {
    for (const blocker of result.blockers) blockers.push(`h${result.horizonHours}:${blocker}`);
  }
  if (!evidenceGatePass) blockers.push(...evidenceBlockers(evidence));

  let calibrationStatus;
  if (productionConfidenceLabelAllowed) {
    calibrationStatus = 'PASS_CALIBRATED_FOR_PRODUCTION_CONFIDENCE_LABEL';
  } else if (!statisticalGatePass) {
    calibrationStatus = horizonResults.some((result) => result.insufficientHistory)
      ? 'BLOCKED_INSUFFICIENT_HISTORY'
      : 'BLOCKED_QUALITY_GATES';
  } else {
    calibrationStatus = 'PASS_STATISTICAL_GATES_BUT_PRODUCTION_LABEL_BLOCKED';
  }

  return deepFreeze({
    schemaVersion: WEATHER_TRANSITION_CALIBRATION_SCHEMA_VERSION,
    calibrationStatus,
    statisticalGatePass,
    evidenceGatePass,
    productionConfidenceLabelAllowed,
    policy: WEATHER_TRANSITION_CALIBRATION_POLICY,
    datasetEvidence: evidence,
    sampleCount: normalized.length,
    horizons,
    blockers: [...new Set(blockers)].sort(),
  });
}

function evaluateHorizon(horizonHours, samples) {
  const sampleCount = samples.length;
  const positiveOutcomes = samples.reduce((sum, sample) => sum + (sample.observedAffected ? 1 : 0), 0);
  const negativeOutcomes = sampleCount - positiveOutcomes;
  const distinctTargets = new Set(samples.map((sample) => sample.targetId)).size;

  const insufficientHistory = sampleCount < WEATHER_TRANSITION_CALIBRATION_POLICY.minimumSamplesPerHorizon
    || positiveOutcomes < WEATHER_TRANSITION_CALIBRATION_POLICY.minimumPositiveOutcomesPerHorizon
    || negativeOutcomes < WEATHER_TRANSITION_CALIBRATION_POLICY.minimumNegativeOutcomesPerHorizon
    || distinctTargets < WEATHER_TRANSITION_CALIBRATION_POLICY.minimumDistinctTargetsPerHorizon;

  const blockers = [];
  if (sampleCount < WEATHER_TRANSITION_CALIBRATION_POLICY.minimumSamplesPerHorizon) blockers.push('minimum_samples_not_met');
  if (positiveOutcomes < WEATHER_TRANSITION_CALIBRATION_POLICY.minimumPositiveOutcomesPerHorizon) blockers.push('minimum_positive_outcomes_not_met');
  if (negativeOutcomes < WEATHER_TRANSITION_CALIBRATION_POLICY.minimumNegativeOutcomesPerHorizon) blockers.push('minimum_negative_outcomes_not_met');
  if (distinctTargets < WEATHER_TRANSITION_CALIBRATION_POLICY.minimumDistinctTargetsPerHorizon) blockers.push('minimum_distinct_targets_not_met');

  if (sampleCount === 0) {
    return deepFreeze({
      horizonHours,
      sampleCount,
      positiveOutcomes,
      negativeOutcomes,
      distinctTargets,
      insufficientHistory: true,
      qualityGatePass: false,
      brierScore: null,
      climatologyBrierScore: null,
      brierSkillScore: null,
      expectedCalibrationErrorPp: null,
      maximumCalibrationErrorPp: null,
      reliabilityBins: [],
      threshold50: emptyThresholdMetrics(),
      blockers,
    });
  }

  const probabilities = samples.map((sample) => sample.probabilityPercent / 100);
  const outcomes = samples.map((sample) => sample.observedAffected ? 1 : 0);
  const eventRate = positiveOutcomes / sampleCount;
  const brierScore = mean(probabilities.map((probability, index) => (probability - outcomes[index]) ** 2));
  const climatologyBrierScore = mean(outcomes.map((outcome) => (eventRate - outcome) ** 2));
  const brierSkillScore = climatologyBrierScore > 0
    ? 1 - (brierScore / climatologyBrierScore)
    : null;
  const reliabilityBins = buildReliabilityBins(samples);
  const expectedCalibrationErrorPp = reliabilityBins.reduce((sum, bin) => (
    sum + (bin.sampleCount / sampleCount) * Math.abs(bin.meanForecastPercent - bin.observedFrequencyPercent)
  ), 0);
  const maximumCalibrationErrorPp = Math.max(...reliabilityBins.map((bin) => Math.abs(bin.meanForecastPercent - bin.observedFrequencyPercent)));
  const threshold50 = thresholdMetrics(samples);

  if (brierScore > WEATHER_TRANSITION_CALIBRATION_POLICY.maximumBrierScore) blockers.push('brier_score_above_limit');
  if (expectedCalibrationErrorPp > WEATHER_TRANSITION_CALIBRATION_POLICY.maximumExpectedCalibrationErrorPp) blockers.push('expected_calibration_error_above_limit');
  if (brierSkillScore === null || brierSkillScore < WEATHER_TRANSITION_CALIBRATION_POLICY.minimumBrierSkillScore) blockers.push('brier_skill_not_better_than_climatology');

  const qualityGatePass = blockers.length === 0;
  return deepFreeze({
    horizonHours,
    sampleCount,
    positiveOutcomes,
    negativeOutcomes,
    distinctTargets,
    observedEventRatePercent: round(eventRate * 100, 3),
    insufficientHistory,
    qualityGatePass,
    brierScore: round(brierScore, 6),
    climatologyBrierScore: round(climatologyBrierScore, 6),
    brierSkillScore: brierSkillScore === null ? null : round(brierSkillScore, 6),
    expectedCalibrationErrorPp: round(expectedCalibrationErrorPp, 3),
    maximumCalibrationErrorPp: round(maximumCalibrationErrorPp, 3),
    reliabilityBins,
    threshold50,
    blockers,
  });
}

function buildReliabilityBins(samples) {
  const width = WEATHER_TRANSITION_CALIBRATION_POLICY.reliabilityBinWidthPp;
  const binCount = Math.ceil(100 / width);
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lowerInclusivePercent: index * width,
    upperInclusivePercent: index === binCount - 1 ? 100 : ((index + 1) * width) - Number.EPSILON,
    samples: [],
  }));

  for (const sample of samples) {
    const index = Math.min(binCount - 1, Math.floor(sample.probabilityPercent / width));
    bins[index].samples.push(sample);
  }

  return bins
    .filter((bin) => bin.samples.length > 0)
    .map((bin) => {
      const count = bin.samples.length;
      const meanForecastPercent = mean(bin.samples.map((sample) => sample.probabilityPercent));
      const observedFrequencyPercent = (bin.samples.filter((sample) => sample.observedAffected).length / count) * 100;
      return deepFreeze({
        lowerInclusivePercent: bin.lowerInclusivePercent,
        upperExclusivePercent: bin.upperInclusivePercent === 100 ? null : round(bin.upperInclusivePercent + Number.EPSILON, 6),
        includes100Percent: bin.upperInclusivePercent === 100,
        sampleCount: count,
        meanForecastPercent: round(meanForecastPercent, 3),
        observedFrequencyPercent: round(observedFrequencyPercent, 3),
        absoluteCalibrationErrorPp: round(Math.abs(meanForecastPercent - observedFrequencyPercent), 3),
      });
    });
}

function thresholdMetrics(samples) {
  const threshold = WEATHER_TRANSITION_CALIBRATION_POLICY.likelyAffectedThresholdPercent;
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const sample of samples) {
    const predicted = sample.probabilityPercent >= threshold;
    if (predicted && sample.observedAffected) tp += 1;
    else if (predicted) fp += 1;
    else if (sample.observedAffected) fn += 1;
    else tn += 1;
  }
  return deepFreeze({
    thresholdPercent: threshold,
    truePositive: tp,
    falsePositive: fp,
    trueNegative: tn,
    falseNegative: fn,
    precision: ratioOrNull(tp, tp + fp),
    recall: ratioOrNull(tp, tp + fn),
    specificity: ratioOrNull(tn, tn + fp),
  });
}

function normalizeSample(sample, index) {
  if (!sample || typeof sample !== 'object') throw new TypeError(`invalid_sample:${index}`);
  const horizonHours = integer(sample.horizonHours, `invalid_horizon:${index}`);
  if (!HORIZONS.has(horizonHours)) throw new RangeError(`unsupported_horizon:${index}`);
  const probabilityPercent = finite(sample.probabilityPercent, `invalid_probability:${index}`);
  if (probabilityPercent < 0 || probabilityPercent > 100) throw new RangeError(`probability_out_of_range:${index}`);
  if (typeof sample.observedAffected !== 'boolean') throw new TypeError(`observed_affected_boolean_required:${index}`);
  const targetId = boundedString(sample.targetId, 1, MAX_TARGET_ID_LENGTH, `target_id_required:${index}`);
  const issuedAtMillis = integer(sample.issuedAtMillis, `invalid_issued_at:${index}`);
  const validAtMillis = integer(sample.validAtMillis, `invalid_valid_at:${index}`);
  if (validAtMillis <= issuedAtMillis) throw new RangeError(`invalid_valid_window:${index}`);
  const leadHours = (validAtMillis - issuedAtMillis) / 3_600_000;
  if (Math.abs(leadHours - horizonHours) > LEAD_TIME_TOLERANCE_HOURS) throw new RangeError(`lead_time_horizon_mismatch:${index}`);
  return Object.freeze({ horizonHours, probabilityPercent, observedAffected: sample.observedAffected, targetId, issuedAtMillis, validAtMillis });
}

function normalizeDatasetEvidence(value) {
  if (!value || typeof value !== 'object') {
    return deepFreeze({
      kind: 'unspecified',
      datasetSha256: null,
      provenanceVerified: false,
      independentReviewApproved: false,
      observationSourceIds: [],
      periodStartMillis: null,
      periodEndMillis: null,
    });
  }
  const kind = boundedString(value.kind ?? 'unspecified', 1, 40, 'invalid_dataset_kind');
  const datasetSha256 = typeof value.datasetSha256 === 'string' && SHA256_RE.test(value.datasetSha256.toLowerCase())
    ? value.datasetSha256.toLowerCase()
    : null;
  const observationSourceIds = Array.isArray(value.observationSourceIds)
    ? [...new Set(value.observationSourceIds.map((item) => boundedString(item, 1, 80, 'invalid_observation_source_id')))].sort()
    : [];
  const periodStartMillis = value.periodStartMillis == null ? null : integer(value.periodStartMillis, 'invalid_period_start');
  const periodEndMillis = value.periodEndMillis == null ? null : integer(value.periodEndMillis, 'invalid_period_end');
  if ((periodStartMillis == null) !== (periodEndMillis == null)) throw new TypeError('dataset_period_pair_required');
  if (periodStartMillis != null && periodEndMillis <= periodStartMillis) throw new RangeError('invalid_dataset_period');
  return deepFreeze({
    kind,
    datasetSha256,
    provenanceVerified: value.provenanceVerified === true,
    independentReviewApproved: value.independentReviewApproved === true,
    observationSourceIds,
    periodStartMillis,
    periodEndMillis,
  });
}

function datasetEvidenceEligible(evidence) {
  return evidence.kind === 'historical_observed'
    && evidence.datasetSha256 !== null
    && evidence.provenanceVerified
    && evidence.independentReviewApproved
    && evidence.observationSourceIds.length > 0
    && evidence.periodStartMillis !== null
    && evidence.periodEndMillis !== null;
}

function evidenceBlockers(evidence) {
  const blockers = [];
  if (evidence.kind !== 'historical_observed') blockers.push('dataset:not_historical_observed');
  if (evidence.datasetSha256 === null) blockers.push('dataset:sha256_missing_or_invalid');
  if (!evidence.provenanceVerified) blockers.push('dataset:provenance_not_verified');
  if (!evidence.independentReviewApproved) blockers.push('dataset:independent_review_not_approved');
  if (evidence.observationSourceIds.length === 0) blockers.push('dataset:observation_sources_missing');
  if (evidence.periodStartMillis === null || evidence.periodEndMillis === null) blockers.push('dataset:historical_period_missing');
  return blockers;
}

function emptyThresholdMetrics() {
  return deepFreeze({
    thresholdPercent: WEATHER_TRANSITION_CALIBRATION_POLICY.likelyAffectedThresholdPercent,
    truePositive: 0,
    falsePositive: 0,
    trueNegative: 0,
    falseNegative: 0,
    precision: null,
    recall: null,
    specificity: null,
  });
}

function ratioOrNull(numerator, denominator) {
  return denominator === 0 ? null : round(numerator / denominator, 6);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function finite(value, error) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(error);
  return value;
}

function integer(value, error) {
  if (!Number.isSafeInteger(value)) throw new TypeError(error);
  return value;
}

function boundedString(value, min, max, error) {
  if (typeof value !== 'string') throw new TypeError(error);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) throw new RangeError(error);
  return normalized;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}
