import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateIneaLiveValidation } from '../src/inea-validation-policy.mjs';

test('INEA remains NOT_VALIDATED when no official station endpoint is configured', () => {
  const result = evaluateIneaLiveValidation({
    discoveryAvailable: true,
    stationConfigured: false,
    stationOperationalPass: true,
  });
  assert.deepEqual(result, {
    status: 'NOT_VALIDATED',
    discoveryStatus: 'PASS',
    operationalStatus: 'NOT_RUN_STATION_URL_NOT_CONFIGURED',
    shouldFailWorkflow: false,
  });
});

test('INEA discovery unavailability never promotes live telemetry', () => {
  const result = evaluateIneaLiveValidation({
    discoveryAvailable: false,
    stationConfigured: false,
    stationOperationalPass: false,
  });
  assert.equal(result.status, 'NOT_VALIDATED');
  assert.equal(result.discoveryStatus, 'UNAVAILABLE');
  assert.equal(result.shouldFailWorkflow, false);
});

test('configured INEA station that fails freshness stays fail closed and fails workflow', () => {
  const result = evaluateIneaLiveValidation({
    discoveryAvailable: true,
    stationConfigured: true,
    stationOperationalPass: false,
  });
  assert.equal(result.status, 'NOT_VALIDATED');
  assert.equal(result.operationalStatus, 'UNAVAILABLE');
  assert.equal(result.shouldFailWorkflow, true);
});

test('INEA becomes PASS only with configured and operational live station telemetry', () => {
  const result = evaluateIneaLiveValidation({
    discoveryAvailable: false,
    stationConfigured: true,
    stationOperationalPass: true,
  });
  assert.equal(result.status, 'PASS');
  assert.equal(result.discoveryStatus, 'UNAVAILABLE');
  assert.equal(result.operationalStatus, 'CURRENT');
  assert.equal(result.shouldFailWorkflow, false);
});
