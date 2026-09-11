import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CEMADEN_RJ_MAX_DATA_AGE_MS,
  CemadenRjCacheError,
  createCemadenRjHydrologicalRiskCache,
} from '../src/cemaden-rj-cache.mjs';
import { CEMADEN_RJ_SOURCE_ID } from '../src/cemaden-rj-source.mjs';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';

const BASE = Date.parse('2026-09-11T06:00:00.000Z');

function snapshot(observedAt = new Date(BASE).toISOString()) {
  const records = RJ_MUNICIPALITIES
    .map((city) => Object.freeze({
      municipality: city.name,
      ibge: city.ibge,
      redec: 'METROPOLITANA',
      risk: 'BAIXO',
      priority: 2,
      observedAt,
    }))
    .sort((a, b) => a.ibge.localeCompare(b.ibge));
  const canonical = records.map((record) => ({
    ibge: record.ibge,
    municipality: record.municipality,
    redec: record.redec,
    risk: record.risk,
    priority: record.priority,
    observedAt: record.observedAt,
  }));
  return Object.freeze({
    sourceId: CEMADEN_RJ_SOURCE_ID,
    municipalityCount: 92,
    municipalCoverage: '92_OF_92_CANONICAL_RJ',
    records: Object.freeze(records),
    oldestObservedAt: observedAt,
    latestObservedAt: observedAt,
    statusInventorySha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
  });
}

test('CEMADEN cache exposes only a complete fresh 92-city snapshot', () => {
  let now = BASE;
  const cache = createCemadenRjHydrologicalRiskCache({ now: () => now });
  cache.recordSuccess(snapshot(), { fetchedAt: now });

  const reading = cache.read({ mode: 'normal' });
  assert.equal(reading.state, 'CURRENT');
  assert.equal(reading.snapshot.municipalityCount, 92);
  assert.equal(reading.snapshot.records.length, 92);
  assert.equal(reading.dataAgeMs, 0);
  assert.equal(reading.cacheAgeMs, 0);

  now += 15 * 60 * 1000;
  assert.equal(cache.read({ mode: 'normal' }).refreshDue, true);
});

test('CEMADEN cache hides stale statewide data fail-closed', () => {
  let now = BASE;
  const cache = createCemadenRjHydrologicalRiskCache({ now: () => now });
  cache.recordSuccess(snapshot(), { fetchedAt: now });

  now += CEMADEN_RJ_MAX_DATA_AGE_MS + 1;
  const reading = cache.read();
  assert.equal(reading.state, 'STALE');
  assert.equal(reading.reason, 'observation_age_exceeded');
  assert.equal(reading.snapshot, null);
});

test('CEMADEN cache keeps a still-current snapshot degraded after a refresh failure', () => {
  let now = BASE;
  const cache = createCemadenRjHydrologicalRiskCache({ now: () => now });
  cache.recordSuccess(snapshot(), { fetchedAt: now });

  now += 60_000;
  cache.recordFailure('cemaden_source_timeout', { attemptedAt: now });
  const reading = cache.read({ mode: 'severe' });
  assert.equal(reading.state, 'CURRENT_DEGRADED');
  assert.equal(reading.lastErrorCode, 'cemaden_source_timeout');
  assert.equal(reading.snapshot.municipalityCount, 92);
});

test('CEMADEN cache rejects digest or coverage drift', () => {
  const cache = createCemadenRjHydrologicalRiskCache({ now: () => BASE });
  const invalid = { ...snapshot(), statusInventorySha256: '0'.repeat(64) };
  assert.throws(
    () => cache.recordSuccess(invalid, { fetchedAt: BASE }),
    (error) => error instanceof CemadenRjCacheError && error.code === 'cemaden_rj_cache_digest_invalid',
  );

  const incomplete = { ...snapshot(), municipalityCount: 91 };
  assert.throws(
    () => cache.recordSuccess(incomplete, { fetchedAt: BASE }),
    (error) => error.code === 'cemaden_rj_cache_coverage_invalid',
  );
});
