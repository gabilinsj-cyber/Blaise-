import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCUWEATHER_RJ_POLICY as policy, normalizeAccuWeatherQuantity as normalize } from '../src/accuweather-policy.mjs';
test('AccuWeather eligibility includes precisely the canonical 92 RJ municipalities', () => {
  assert.equal(new Set(policy.municipalityIbges).size, 92);
  assert.ok(policy.municipalityIbges.every(code => code.startsWith('33')));
  assert.ok(policy.municipalityIbges.includes('3304557'));
  assert.equal(policy.ingestion, 'NOT_CONNECTED');
});
test('AccuWeather quantities use Celsius and millimeters without inventing absent amounts', () => {
  assert.equal(normalize({Value: 86, Unit: 'F'}, 'temperature'), 30);
  assert.equal(normalize({Value: 1, Unit: 'in'}, 'precipitation'), 25.4);
  assert.equal(normalize({Value: 0, Unit: 'mm'}, 'precipitation'), 0);
  assert.equal(normalize(null, 'precipitation'), null);
  assert.equal(normalize({Value: null, Unit: 'C'}, 'temperature'), null);
  assert.throws(() => normalize({Value: 30, Unit: 'dBZ'}, 'precipitation'));
  assert.throws(() => normalize({Value: -1, Unit: 'mm'}, 'precipitation'));
});
