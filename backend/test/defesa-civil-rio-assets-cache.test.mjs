import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefesaCivilRioAssetsCache,
  DEFESA_CIVIL_RIO_ASSETS_NORMAL_MAX_CACHE_AGE_MS,
  DEFESA_CIVIL_RIO_ASSETS_SEVERE_MAX_CACHE_AGE_MS,
} from '../src/defesa-civil-rio-assets-cache.mjs';
import {
  DEFESA_CIVIL_RIO_ASSETS_HOST,
  DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID,
  DEFESA_CIVIL_RIO_SERVICE_ITEM_ID,
} from '../src/defesa-civil-rio-assets.mjs';

const BASE = Date.parse('2026-09-10T18:00:00.000Z');

function snapshot() {
  return {
    sourceId: DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID,
    sourceHost: DEFESA_CIVIL_RIO_ASSETS_HOST,
    serviceItemId: DEFESA_CIVIL_RIO_SERVICE_ITEM_ID,
    spatialReference: 4326,
    sirens: {
      count: 1,
      sha256: 'a'.repeat(64),
      items: [{ objectId: 1, name: 'Sirene teste' }],
    },
    supportPoints: {
      count: 1,
      sha256: 'b'.repeat(64),
      items: [{ objectId: 2, name: 'Ponto teste' }],
    },
  };
}

test('assets cache is unavailable until a validated snapshot exists', () => {
  const cache = createDefesaCivilRioAssetsCache({ now: () => BASE });
  const reading = cache.read();
  assert.equal(reading.state, 'UNAVAILABLE');
  assert.equal(reading.reason, 'no_snapshot');
  assert.equal(reading.snapshot, null);
});

test('assets cache retains a defensive copy and exposes current snapshot only through read', () => {
  const cache = createDefesaCivilRioAssetsCache({ now: () => BASE });
  const original = snapshot();
  cache.recordSuccess(original, { fetchedAt: BASE });
  original.sirens.items[0].name = 'mutated outside cache';

  const first = cache.read({ at: BASE, mode: 'normal' });
  assert.equal(first.state, 'CURRENT');
  assert.equal(first.snapshot.sirens.items[0].name, 'Sirene teste');

  first.snapshot.sirens.items[0].name = 'mutated returned copy';
  const second = cache.read({ at: BASE, mode: 'normal' });
  assert.equal(second.snapshot.sirens.items[0].name, 'Sirene teste');
});

test('assets cache tightens freshness during severe mode', () => {
  const cache = createDefesaCivilRioAssetsCache({ now: () => BASE });
  cache.recordSuccess(snapshot(), { fetchedAt: BASE });

  assert.equal(DEFESA_CIVIL_RIO_ASSETS_NORMAL_MAX_CACHE_AGE_MS, 60 * 60 * 1000);
  assert.equal(DEFESA_CIVIL_RIO_ASSETS_SEVERE_MAX_CACHE_AGE_MS, 15 * 60 * 1000);

  const at = BASE + 16 * 60 * 1000;
  assert.equal(cache.read({ at, mode: 'normal' }).state, 'CURRENT');
  const severe = cache.read({ at, mode: 'severe' });
  assert.equal(severe.state, 'STALE');
  assert.equal(severe.reason, 'cache_age_exceeded');
  assert.equal(severe.snapshot, null);
});

test('failed refresh keeps a still-current cached map as degraded without leaking error text', () => {
  let now = BASE;
  const cache = createDefesaCivilRioAssetsCache({ now: () => now });
  cache.recordSuccess(snapshot(), { fetchedAt: now });
  now += 60_000;
  cache.recordFailure('defesa_civil_rio_source_contract_timeout', { attemptedAt: now });

  const reading = cache.read({ at: now, mode: 'normal' });
  assert.equal(reading.state, 'CURRENT_DEGRADED');
  assert.equal(reading.reason, 'latest_refresh_failed_using_current_cache');
  assert.equal(reading.lastErrorCode, 'defesa_civil_rio_source_contract_timeout');
  assert.equal(reading.snapshot.sirens.count, 1);
});

test('assets cache rejects source identity drift', () => {
  const cache = createDefesaCivilRioAssetsCache({ now: () => BASE });
  const invalid = snapshot();
  invalid.sourceHost = 'example.com';
  assert.throws(
    () => cache.recordSuccess(invalid, { fetchedAt: BASE }),
    (error) => error.code === 'defesa_civil_rio_assets_cache_invalid_source_host',
  );
});
