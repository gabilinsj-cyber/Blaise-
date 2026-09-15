import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WEATHER_TRANSITION_CALIBRATION_POLICY,
  evaluateWeatherTransitionBacktest,
} from '../src/rj-weather-transition-calibration.mjs';

const BASE = Date.UTC(2026, 0, 1, 0, 0, 0);

function calibratedSamples(horizonHours) {
  const probabilities = [10, 30, 50, 70, 90];
  const samples = [];
  let sequence = 0;
  for (const probabilityPercent of probabilities) {
    for (let index = 0; index < 100; index += 1) {
      const issuedAtMillis = BASE + (sequence * 60_000);
      samples.push({
        horizonHours,
        probabilityPercent,
        observedAffected: index < probabilityPercent,
        targetId: `target-${sequence % 20}`,
        issuedAtMillis,
        validAtMillis: issuedAtMillis + (horizonHours * 3_600_000),
      });
      sequence += 1;
    }
  }
  return samples;
}

function evidence(overrides = {}) {
  return {
    kind: 'historical_observed',
    datasetSha256: 'a'.repeat(64),
    provenanceVerified: true,
    independentReviewApproved: true,
    observationSourceIds: ['ALERTA_RIO', 'INMET'],
    periodStartMillis: Date.UTC(2024, 0, 1),
    periodEndMillis: Date.UTC(2025, 11, 31),
    ...overrides,
  };
}

test('well calibrated history passes statistical gates but production label stays blocked without evidence', () => {
  const samples = [...calibratedSamples(24), ...calibratedSamples(48)];
  const result = evaluateWeatherTransitionBacktest(samples);

  assert.equal(result.sampleCount, 1000);
  assert.equal(result.statisticalGatePass, true);
  assert.equal(result.evidenceGatePass, false);
  assert.equal(result.productionConfidenceLabelAllowed, false);
  assert.equal(result.calibrationStatus, 'PASS_STATISTICAL_GATES_BUT_PRODUCTION_LABEL_BLOCKED');
  assert.equal(result.horizons['24'].qualityGatePass, true);
  assert.equal(result.horizons['48'].qualityGatePass, true);
  assert.equal(result.horizons['24'].expectedCalibrationErrorPp, 0);
  assert.ok(result.horizons['24'].brierScore <= WEATHER_TRANSITION_CALIBRATION_POLICY.maximumBrierScore);
  assert.ok(result.blockers.includes('dataset:not_historical_observed'));
});

test('production confidence label requires both statistical gates and complete historical evidence', () => {
  const samples = [...calibratedSamples(24), ...calibratedSamples(48)];
  const result = evaluateWeatherTransitionBacktest(samples, { datasetEvidence: evidence() });

  assert.equal(result.statisticalGatePass, true);
  assert.equal(result.evidenceGatePass, true);
  assert.equal(result.productionConfidenceLabelAllowed, true);
  assert.equal(result.calibrationStatus, 'PASS_CALIBRATED_FOR_PRODUCTION_CONFIDENCE_LABEL');
  assert.deepEqual(result.blockers, []);
});

test('insufficient historical coverage fails closed even with complete dataset evidence', () => {
  const samples = [];
  for (const horizonHours of [24, 48]) {
    for (let index = 0; index < 20; index += 1) {
      const issuedAtMillis = BASE + index * 60_000;
      samples.push({
        horizonHours,
        probabilityPercent: 50,
        observedAffected: index % 2 === 0,
        targetId: `target-${index % 5}`,
        issuedAtMillis,
        validAtMillis: issuedAtMillis + horizonHours * 3_600_000,
      });
    }
  }

  const result = evaluateWeatherTransitionBacktest(samples, { datasetEvidence: evidence() });
  assert.equal(result.statisticalGatePass, false);
  assert.equal(result.productionConfidenceLabelAllowed, false);
  assert.equal(result.calibrationStatus, 'BLOCKED_INSUFFICIENT_HISTORY');
  assert.ok(result.blockers.includes('h24:minimum_samples_not_met'));
  assert.ok(result.blockers.includes('h48:minimum_distinct_targets_not_met'));
});

test('miscalibrated history is rejected by Brier and reliability gates', () => {
  const samples = [];
  for (const horizonHours of [24, 48]) {
    for (let index = 0; index < 500; index += 1) {
      const issuedAtMillis = BASE + index * 60_000;
      samples.push({
        horizonHours,
        probabilityPercent: 90,
        observedAffected: index % 10 === 0,
        targetId: `target-${index % 20}`,
        issuedAtMillis,
        validAtMillis: issuedAtMillis + horizonHours * 3_600_000,
      });
    }
  }

  const result = evaluateWeatherTransitionBacktest(samples, { datasetEvidence: evidence() });
  assert.equal(result.statisticalGatePass, false);
  assert.equal(result.calibrationStatus, 'BLOCKED_QUALITY_GATES');
  assert.ok(result.horizons['24'].brierScore > WEATHER_TRANSITION_CALIBRATION_POLICY.maximumBrierScore);
  assert.ok(result.horizons['24'].expectedCalibrationErrorPp > WEATHER_TRANSITION_CALIBRATION_POLICY.maximumExpectedCalibrationErrorPp);
  assert.ok(result.blockers.includes('h24:brier_score_above_limit'));
  assert.ok(result.blockers.includes('h48:expected_calibration_error_above_limit'));
});

test('invalid lead time is rejected instead of silently mixing forecast horizons', () => {
  assert.throws(() => evaluateWeatherTransitionBacktest([{
    horizonHours: 24,
    probabilityPercent: 50,
    observedAffected: true,
    targetId: '3304557',
    issuedAtMillis: BASE,
    validAtMillis: BASE + 48 * 3_600_000,
  }]), /lead_time_horizon_mismatch/);
});

test('dataset evidence cannot unlock production label without provenance and independent review', () => {
  const samples = [...calibratedSamples(24), ...calibratedSamples(48)];
  const result = evaluateWeatherTransitionBacktest(samples, {
    datasetEvidence: evidence({ provenanceVerified: false, independentReviewApproved: false }),
  });

  assert.equal(result.statisticalGatePass, true);
  assert.equal(result.evidenceGatePass, false);
  assert.equal(result.productionConfidenceLabelAllowed, false);
  assert.ok(result.blockers.includes('dataset:provenance_not_verified'));
  assert.ok(result.blockers.includes('dataset:independent_review_not_approved'));
});
