import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHM_TIDE_TIME_BASIS,
  normalizeChmTideValues,
} from '../src/chm-tide-values.mjs';
import {
  CHM_TIDE_CACHE_MAX_VERIFICATION_AGE_MS,
  ChmTideCacheError,
  createChmTideValuesCache,
} from '../src/chm-tide-cache.mjs';

const station = Object.freeze({
  stationNumber: 1,
  name: 'PORTO DO RIO DE JANEIRO',
  pageStart: 10,
  pageEnd: 12,
});

function snapshot() {
  return normalizeChmTideValues({
    station,
    calendarYear: 2026,
    timeBasis: CHM_TIDE_TIME_BASIS,
    utcOffsetMinutes: -180,
    sourceArtifactSha256: 'a'.repeat(64),
    predictions: [
      { localDate: '2026-09-14', localTime: '03:12', heightMeters: 0.3, phase: 'LOW', sourcePage: 10 },
      { localDate: '2026-09-14', localTime: '09:28', heightMeters: 1.2, phase: 'HIGH', sourcePage: 10 },
      { localDate: '2026-09-14', localTime: '15:44', heightMeters: 0.2, phase: 'LOW', sourcePage: 10 },
      { localDate: '2026-09-14', localTime: '21:57', heightMeters: 1.1, phase: 'HIGH', sourcePage: 10 },
    ],
  });
}

test('CHM tide cache starts fail-closed with no snapshot', () => {
  const cache = createChmTideValuesCache({ now: () => Date.parse('2026-09-14T12:00:00Z') });
  const reading = cache.read({ stationNumber: 1, calendarYear: 2026 });
  assert.equal(reading.state, 'UNAVAILABLE');
  assert.equal(reading.reason, 'no_snapshot');
  assert.equal(reading.snapshot, null);
  assert.equal(reading.rawPdfRetention, 'NONE');
  assert.equal(reading.rawTextRetention, 'NONE');
});

test('CHM tide cache stores only revalidated normalized values and returns an immutable snapshot', () => {
  let now = Date.parse('2026-09-14T12:00:00Z');
  const cache = createChmTideValuesCache({ now: () => now });
  const normalized = snapshot();
  cache.recordSuccess(normalized, { fetchedAt: now });

  now += 5 * 60 * 1000;
  const reading = cache.read({ stationNumber: 1, calendarYear: 2026 });
  assert.equal(reading.state, 'CURRENT');
  assert.equal(reading.reason, 'verified_snapshot');
  assert.equal(reading.snapshot.tideValueSha256, normalized.tideValueSha256);
  assert.equal(reading.snapshot.predictionCount, 4);
  assert.equal(reading.snapshot.predictions[0].instantUtc, '2026-09-14T06:12:00.000Z');
  assert.ok(Object.isFrozen(reading.snapshot));
  assert.ok(Object.isFrozen(reading.snapshot.predictions));
});

test('CHM tide cache rejects a tampered normalized digest', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  const cache = createChmTideValuesCache({ now: () => now });
  const tampered = structuredClone(snapshot());
  tampered.tideValueSha256 = 'b'.repeat(64);
  assert.throws(
    () => cache.recordSuccess(tampered, { fetchedAt: now }),
    (error) => error instanceof ChmTideCacheError && error.code === 'chm_tide_cache_digest_mismatch',
  );
});

test('CHM tide cache degrades after a failed refresh without exposing stale data as healthy', () => {
  let now = Date.parse('2026-09-14T12:00:00Z');
  const cache = createChmTideValuesCache({ now: () => now });
  cache.recordSuccess(snapshot(), { fetchedAt: now });

  now += 16 * 60 * 1000;
  cache.recordFailure('chm_source_refresh_failed', {
    stationNumber: 1,
    calendarYear: 2026,
    attemptedAt: now,
  });
  const reading = cache.read({ stationNumber: 1, calendarYear: 2026, at: now });
  assert.equal(reading.state, 'CURRENT_DEGRADED');
  assert.equal(reading.reason, 'latest_refresh_failed_using_verified_cache');
  assert.equal(reading.lastErrorCode, 'chm_source_refresh_failed');
  assert.notEqual(reading.snapshot, null);
});

test('CHM tide cache fails closed after source verification age is exceeded', () => {
  const fetchedAt = Date.parse('2026-09-14T12:00:00Z');
  let now = fetchedAt;
  const cache = createChmTideValuesCache({ now: () => now });
  cache.recordSuccess(snapshot(), { fetchedAt });

  now = fetchedAt + CHM_TIDE_CACHE_MAX_VERIFICATION_AGE_MS + 1;
  const reading = cache.read({ stationNumber: 1, calendarYear: 2026, at: now });
  assert.equal(reading.state, 'STALE');
  assert.equal(reading.reason, 'source_verification_age_exceeded');
  assert.equal(reading.snapshot, null);
});

test('CHM tide cache tracks refresh cadence for normal and severe modes', () => {
  const fetchedAt = Date.parse('2026-09-14T12:00:00Z');
  const cache = createChmTideValuesCache({ now: () => fetchedAt });
  cache.recordSuccess(snapshot(), { fetchedAt });

  const normal = cache.read({
    stationNumber: 1,
    calendarYear: 2026,
    at: fetchedAt + 14 * 60 * 1000,
    mode: 'normal',
  });
  const severe = cache.read({
    stationNumber: 1,
    calendarYear: 2026,
    at: fetchedAt + 2 * 60 * 1000,
    mode: 'severe',
  });
  assert.equal(normal.refreshDue, false);
  assert.equal(severe.refreshDue, true);
});

test('CHM tide cache clear can remove one station/year or all state', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  const cache = createChmTideValuesCache({ now: () => now });
  cache.recordSuccess(snapshot(), { fetchedAt: now });
  cache.clear({ stationNumber: 1, calendarYear: 2026 });
  assert.equal(cache.read({ stationNumber: 1, calendarYear: 2026 }).state, 'UNAVAILABLE');
  cache.recordSuccess(snapshot(), { fetchedAt: now });
  cache.clear();
  assert.equal(cache.read({ stationNumber: 1, calendarYear: 2026 }).state, 'UNAVAILABLE');
});
