import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEATHER_TRANSITION_POLICY,
  buildSouthToSoutheastRjEstimate,
} from '../src/rj-weather-transition-estimator.mjs';

const now = 1_789_424_000_000;

function model(overrides = {}) {
  return {
    sourceId: 'ecmwf-ifs-open',
    horizonHours: 24,
    probability: 0.72,
    southInfluence: 0.9,
    ensembleMembers: 20,
    issuedAtMillis: now - 60_000,
    arrivalAtMillis: now + 12 * 3_600_000,
    temperatureDeltaC: -4.2,
    precipitationMm: 25,
    windGustKph: 55,
    pressureDeltaHpa: -5,
    ...overrides,
  };
}

function gfs(overrides = {}) {
  return model({
    sourceId: 'noaa-gfs-0p25',
    probability: 0.64,
    southInfluence: 0.82,
    ensembleMembers: 15,
    ...overrides,
  });
}

test('computes 24/48h Southeast and RJ probabilities with error bounds', () => {
  const out = buildSouthToSoutheastRjEstimate({
    changeType: 'FRONTAL_PASSAGE',
    southeastGuidance: [
      model({ areaId: 'SP' }), gfs({ areaId: 'SP' }),
      model({ areaId: 'RJ' }), gfs({ areaId: 'RJ' }),
      model({ areaId: 'RJ', horizonHours: 48, probability: 0.78 }),
      gfs({ areaId: 'RJ', horizonHours: 48, probability: 0.68 }),
    ],
    rjGuidance: [
      model({ targetIbge: '3304557', subregionId: 'METROPOLITANA' }),
      gfs({ targetIbge: '3304557', subregionId: 'METROPOLITANA' }),
      model({ targetIbge: '3303302', subregionId: 'METROPOLITANA', probability: 0.68 }),
      gfs({ targetIbge: '3303302', subregionId: 'METROPOLITANA', probability: 0.60 }),
      model({ targetIbge: '3304557', subregionId: 'METROPOLITANA', horizonHours: 48, probability: 0.80 }),
      gfs({ targetIbge: '3304557', subregionId: 'METROPOLITANA', horizonHours: 48, probability: 0.70 }),
    ],
  }, { nowMillis: now });

  const city = out.rj.horizons['24'].municipalities.find((item) => item.ibge === '3304557');
  assert.equal(city.status, 'ESTIMATED');
  assert.ok(city.probabilityPercent > 60 && city.probabilityPercent < 75);
  assert.ok(city.marginOfErrorPp >= 10);
  assert.ok(city.arrival.plusMinusHours >= 1.5);
  assert.equal(out.rj.phase, 'UPSTREAM_24_48H');

  const metro = out.rj.horizons['24'].subregions.find((item) => item.subregionId === 'METROPOLITANA');
  assert.equal(metro.targetMunicipalityCount, 2);
  assert.ok(metro.expectedAffectedMunicipalityPercent > 60);
});

test('recalculates after RJ boundary confirmation using fresh official local evidence', () => {
  const baseInput = {
    changeType: 'FRONTAL_PASSAGE',
    southeastGuidance: [],
    rjGuidance: [
      model({ targetIbge: '3304557', subregionId: 'METROPOLITANA', probability: 0.55 }),
      gfs({ targetIbge: '3304557', subregionId: 'METROPOLITANA', probability: 0.50 }),
    ],
  };
  const before = buildSouthToSoutheastRjEstimate(baseInput, { nowMillis: now });
  const after = buildSouthToSoutheastRjEstimate({
    ...baseInput,
    rjBoundaryEvidence: {
      confirmed: true,
      confidence: 0.95,
      observedAtMillis: now - 30_000,
      sourceIds: ['inea-radar', 'alerta-rio'],
    },
    rjLocalSignals: [{
      targetIbge: '3304557',
      subregionId: 'METROPOLITANA',
      sourceId: 'inea-radar',
      authority: 'OFFICIAL_RADAR',
      observedAtMillis: now - 20_000,
      probability: 0.93,
      confidence: 0.95,
      temperatureDeltaC: -5.1,
    }],
  }, { nowMillis: now });

  const p0 = before.rj.horizons['24'].municipalities[0].probabilityPercent;
  const p1 = after.rj.horizons['24'].municipalities[0].probabilityPercent;
  assert.ok(p1 > p0);
  assert.equal(after.rj.phase, 'RJ_BOUNDARY_RECALCULATED_WITH_LOCAL_EVIDENCE');
  assert.equal(after.methodology.localEvidenceApplied, true);
});

test('fails closed when only one independent model is available', () => {
  const out = buildSouthToSoutheastRjEstimate({
    changeType: 'RAIN_CHANGE',
    southeastGuidance: [],
    rjGuidance: [model({ targetIbge: '3304904', subregionId: 'METROPOLITANA' })],
  }, { nowMillis: now });
  const item = out.rj.horizons['24'].municipalities[0];
  assert.equal(item.status, 'INSUFFICIENT_GUIDANCE');
  assert.equal(item.probabilityPercent, null);
});

test('rejects invalid city and stale boundary evidence', () => {
  assert.throws(() => buildSouthToSoutheastRjEstimate({
    changeType: 'WIND_CHANGE',
    southeastGuidance: [],
    rjGuidance: [
      model({ targetIbge: '3399999', subregionId: 'X' }),
      gfs({ targetIbge: '3399999', subregionId: 'X' }),
    ],
  }, { nowMillis: now }), /unknown_rj_municipality/);

  assert.throws(() => buildSouthToSoutheastRjEstimate({
    changeType: 'WIND_CHANGE',
    southeastGuidance: [],
    rjGuidance: [],
    rjBoundaryEvidence: {
      confirmed: true,
      confidence: 1,
      observedAtMillis: now - 2 * 3_600_000,
      sourceIds: ['official'],
    },
  }, { nowMillis: now }), /stale_boundary_evidence_rejected/);
});

test('keeps 48h uncertainty floor wider than 24h before local confirmation', () => {
  const out = buildSouthToSoutheastRjEstimate({
    changeType: 'TEMPERATURE_CHANGE',
    southeastGuidance: [],
    rjGuidance: [
      model({ targetIbge: '3304201', subregionId: 'MEDIO_PARAIBA', probability: 0.70 }),
      gfs({ targetIbge: '3304201', subregionId: 'MEDIO_PARAIBA', probability: 0.70 }),
      model({ targetIbge: '3304201', subregionId: 'MEDIO_PARAIBA', horizonHours: 48, probability: 0.70 }),
      gfs({ targetIbge: '3304201', subregionId: 'MEDIO_PARAIBA', horizonHours: 48, probability: 0.70 }),
    ],
  }, { nowMillis: now });
  const h24 = out.rj.horizons['24'].municipalities[0];
  const h48 = out.rj.horizons['48'].municipalities[0];
  assert.ok(h24.marginOfErrorPp >= 10);
  assert.ok(h48.marginOfErrorPp >= 15);
});

test('boundary confirmation alone does not invent a municipal probability adjustment', () => {
  const base = {
    changeType: 'FRONTAL_PASSAGE',
    southeastGuidance: [],
    rjGuidance: [
      model({ targetIbge: '3304557', subregionId: 'METROPOLITANA', probability: 0.61 }),
      gfs({ targetIbge: '3304557', subregionId: 'METROPOLITANA', probability: 0.59 }),
    ],
  };
  const before = buildSouthToSoutheastRjEstimate(base, { nowMillis: now });
  const after = buildSouthToSoutheastRjEstimate({
    ...base,
    rjBoundaryEvidence: {
      confirmed: true,
      confidence: 0.9,
      observedAtMillis: now - 20_000,
      sourceIds: ['official-boundary'],
    },
  }, { nowMillis: now });
  assert.equal(after.rj.phase, 'RJ_BOUNDARY_CONFIRMED_AWAITING_LOCAL_EVIDENCE');
  assert.equal(
    after.rj.horizons['24'].municipalities[0].probabilityPercent,
    before.rj.horizons['24'].municipalities[0].probabilityPercent,
  );
});

test('probabilistic estimator can never produce official P0 by itself', () => {
  assert.equal(WEATHER_TRANSITION_POLICY.mayTriggerP0, false);
  assert.equal(WEATHER_TRANSITION_POLICY.mayOverrideLocalRjOfficialAlert, false);
  assert.equal(WEATHER_TRANSITION_POLICY.mayOverrideLocalRjOfficialObservation, false);
});
