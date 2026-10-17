import test from 'node:test';
import assert from 'node:assert/strict';
import { createRjMarineBackend } from './rj-marine-backend-integration.mjs';

test('marine backend disabled by default, without invoking readers', () => {
  const backend = createRjMarineBackend({ env: {} });
  assert.equal(backend.enabled, false);
  assert.equal(backend.start(), false);
});
test('enabled marine backend requires Copernicus reader', () => {
  assert.throws(() => createRjMarineBackend({ env: { BLAISE_RJ_MARINE_ENABLED: 'true' } }), /copernicus_reader_required/);
});
test('enabled marine backend does not start automatically', () => {
  const backend = createRjMarineBackend({
    env: { BLAISE_RJ_MARINE_ENABLED: 'true' },
    copernicusReader: async () => { throw Error('not called'); },
  });
  assert.equal(backend.enabled, true);
  assert.equal(backend.status().NOAA.status, 'NOT_CHECKED');
  assert.equal(backend.status().COPERNICUS_MARINE.status, 'NOT_CHECKED');
});
