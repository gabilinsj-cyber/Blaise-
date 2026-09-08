import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OFFICIAL_SOURCE_MAX_DATA_AGE_MS,
  OFFICIAL_SOURCE_NORMAL_REFRESH_MS,
  OFFICIAL_SOURCE_SEVERE_REFRESH_MS,
  OfficialSourceCacheError,
  createAlertaRioRainfallCache,
} from '../src/official-source-cache.mjs';

const BASE_MS = Date.parse('2026-09-07T20:00:00.000Z');

function snapshot({ observedAt = '2026-09-07T20:00:00.000Z' } = {}) {
  return {
    sourceId: 'alerta-rio-rainfall-live',
    sourceHost: 'websempre.rio.rj.gov.br',
    stationCount: 33,
    missingValueCount: 0,
    oldestObservedAt: observedAt,
    freshestObservedAt: observedAt,
    snapshotSha256: 'a'.repeat(64),
    stations: Array.from({ length: 33 }, (_, index) => ({
      code: index + 1,
      name: `Station ${index + 1}`,
      observedAt,
      rain5mMm: 0,
    })),
  };
}

test('fresh snapshot is current and uses separate normal/severe refresh cadences', () => {
  let nowMs = BASE_MS;
  const cache = createAlertaRioRainfallCache({ now: () => nowMs });
  cache.recordSuccess(snapshot());

  nowMs += 30_000;
  const normal = cache.read({ mode: 'normal' });
  const severe = cache.read({ mode: 'severe' });

  assert.equal(normal.state, 'CURRENT');
  assert.equal(normal.snapshot.stationCount, 33);
  assert.equal(normal.refreshIntervalMs, OFFICIAL_SOURCE_NORMAL_REFRESH_MS);
  assert.equal(normal.refreshDue, false);
  assert.equal(severe.refreshIntervalMs, OFFICIAL_SOURCE_SEVERE_REFRESH_MS);
  assert.equal(severe.refreshDue, false);
});

test('severe mode requests a one-minute recheck without expiring valid data early', () => {
  let nowMs = BASE_MS;
  const cache = createAlertaRioRainfallCache({ now: () => nowMs });
  cache.recordSuccess(snapshot());

  nowMs += OFFICIAL_SOURCE_SEVERE_REFRESH_MS + 1;
  const severe = cache.read({ mode: 'severe' });
  const normal = cache.read({ mode: 'normal' });

  assert.equal(severe.state, 'CURRENT');
  assert.equal(severe.refreshDue, true);
  assert.equal(normal.state, 'CURRENT');
  assert.equal(normal.refreshDue, false);
});

test('snapshot older than the operational data window fails closed as stale', () => {
  let nowMs = BASE_MS;
  const cache = createAlertaRioRainfallCache({ now: () => nowMs });
  cache.recordSuccess(snapshot());

  nowMs += OFFICIAL_SOURCE_MAX_DATA_AGE_MS + 1;
  const result = cache.read();

  assert.equal(result.state, 'STALE');
  assert.equal(result.reason, 'observation_age_exceeded');
  assert.equal(result.snapshot, null);
  assert.equal(result.refreshDue, true);
});

test('failed refresh preserves only a still-current cached snapshot and marks degraded state', () => {
  let nowMs = BASE_MS;
  const cache = createAlertaRioRainfallCache({ now: () => nowMs });
  cache.recordSuccess(snapshot());

  nowMs += 2 * 60 * 1000;
  cache.recordFailure('alerta_rio_live_timeout');
  const degraded = cache.read({ mode: 'severe' });

  assert.equal(degraded.state, 'CURRENT_DEGRADED');
  assert.equal(degraded.reason, 'latest_refresh_failed_using_current_cache');
  assert.equal(degraded.lastErrorCode, 'alerta_rio_live_timeout');
  assert.equal(degraded.snapshot.stationCount, 33);

  nowMs = BASE_MS + OFFICIAL_SOURCE_MAX_DATA_AGE_MS + 1;
  const stale = cache.read({ mode: 'severe' });
  assert.equal(stale.state, 'STALE');
  assert.equal(stale.snapshot, null);
});

test('refresh failure without a prior snapshot remains unavailable', () => {
  let nowMs = BASE_MS;
  const cache = createAlertaRioRainfallCache({ now: () => nowMs });
  cache.recordFailure('alerta_rio_live_network_error');

  const result = cache.read();
  assert.equal(result.state, 'UNAVAILABLE');
  assert.equal(result.reason, 'refresh_failed_without_snapshot');
  assert.equal(result.snapshot, null);
});

test('future-dated official observations beyond bounded clock skew are rejected', () => {
  const cache = createAlertaRioRainfallCache({ now: () => BASE_MS });
  const future = snapshot({ observedAt: '2026-09-07T20:02:01.000Z' });

  assert.throws(
    () => cache.recordSuccess(future),
    (error) => error instanceof OfficialSourceCacheError && error.code === 'official_source_future_observation',
  );
});

test('cache stores an immutable copy rather than caller-owned mutable data', () => {
  let nowMs = BASE_MS;
  const cache = createAlertaRioRainfallCache({ now: () => nowMs });
  const original = snapshot();
  cache.recordSuccess(original);

  original.stationCount = 1;
  original.stations[0].code = 999;
  const cached = cache.read();

  assert.equal(cached.snapshot.stationCount, 33);
  assert.equal(cached.snapshot.stations[0].code, 1);
  assert.equal(Object.isFrozen(cached.snapshot), true);
  assert.equal(Object.isFrozen(cached.snapshot.stations), true);
  assert.equal(Object.isFrozen(cached.snapshot.stations[0]), true);
});

test('unknown refresh mode fails closed', () => {
  const cache = createAlertaRioRainfallCache({ now: () => BASE_MS });
  cache.recordSuccess(snapshot());

  assert.throws(
    () => cache.read({ mode: 'turbo' }),
    (error) => error instanceof OfficialSourceCacheError && error.code === 'official_source_invalid_refresh_mode',
  );
});
