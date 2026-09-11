import { createHash } from 'node:crypto';

import {
  CEMADEN_RJ_EXPECTED_MUNICIPALITIES,
  CEMADEN_RJ_SOURCE_ID,
} from './cemaden-rj-source.mjs';
import {
  OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS,
  OFFICIAL_SOURCE_NORMAL_REFRESH_MS,
  OFFICIAL_SOURCE_SEVERE_REFRESH_MS,
} from './official-source-cache.mjs';

export const CEMADEN_RJ_MAX_DATA_AGE_MS = 30 * 60 * 1000;
export const CEMADEN_RJ_MAX_SNAPSHOT_BYTES = 256 * 1024;

export class CemadenRjCacheError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CemadenRjCacheError';
    this.code = code;
  }
}

function epochMs(value, code) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new CemadenRjCacheError(code);
  return parsed;
}

function refreshIntervalFor(mode) {
  if (mode === 'normal') return OFFICIAL_SOURCE_NORMAL_REFRESH_MS;
  if (mode === 'severe') return OFFICIAL_SOURCE_SEVERE_REFRESH_MS;
  throw new CemadenRjCacheError('cemaden_rj_cache_invalid_refresh_mode');
}

function serializedSize(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new CemadenRjCacheError('cemaden_rj_cache_unserializable_snapshot');
  }
  return Buffer.byteLength(serialized, 'utf8');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function immutableClone(value) {
  return deepFreeze(structuredClone(value));
}

function digestRecords(records) {
  const canonical = records.map((record) => ({
    ibge: record.ibge,
    municipality: record.municipality,
    redec: record.redec,
    risk: record.risk,
    priority: record.priority,
    observedAt: record.observedAt,
  }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function validateErrorCode(code) {
  if (typeof code !== 'string' || !/^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(code)) {
    throw new CemadenRjCacheError('cemaden_rj_cache_invalid_error_code');
  }
  return code;
}

function validateSnapshot(snapshot, referenceNowMs) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new CemadenRjCacheError('cemaden_rj_cache_invalid_snapshot');
  }
  if (snapshot.sourceId !== CEMADEN_RJ_SOURCE_ID) {
    throw new CemadenRjCacheError('cemaden_rj_cache_invalid_source_id');
  }
  if (snapshot.municipalityCount !== CEMADEN_RJ_EXPECTED_MUNICIPALITIES
      || snapshot.municipalCoverage !== '92_OF_92_CANONICAL_RJ') {
    throw new CemadenRjCacheError('cemaden_rj_cache_coverage_invalid');
  }
  if (!Array.isArray(snapshot.records) || snapshot.records.length !== CEMADEN_RJ_EXPECTED_MUNICIPALITIES) {
    throw new CemadenRjCacheError('cemaden_rj_cache_records_invalid');
  }
  if (serializedSize(snapshot) > CEMADEN_RJ_MAX_SNAPSHOT_BYTES) {
    throw new CemadenRjCacheError('cemaden_rj_cache_snapshot_too_large');
  }

  const oldestObservedMs = epochMs(snapshot.oldestObservedAt, 'cemaden_rj_cache_oldest_observed_invalid');
  const latestObservedMs = epochMs(snapshot.latestObservedAt, 'cemaden_rj_cache_latest_observed_invalid');
  if (oldestObservedMs > latestObservedMs) {
    throw new CemadenRjCacheError('cemaden_rj_cache_observation_window_invalid');
  }
  if (latestObservedMs > referenceNowMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
    throw new CemadenRjCacheError('cemaden_rj_cache_future_observation');
  }

  const seen = new Set();
  for (const record of snapshot.records) {
    if (!record || typeof record !== 'object' || !/^33\d{5}$/.test(record.ibge || '')) {
      throw new CemadenRjCacheError('cemaden_rj_cache_record_invalid');
    }
    if (seen.has(record.ibge)) throw new CemadenRjCacheError('cemaden_rj_cache_duplicate_municipality');
    seen.add(record.ibge);
    if (!Number.isInteger(record.priority) || record.priority < 1 || record.priority > 5) {
      throw new CemadenRjCacheError('cemaden_rj_cache_priority_invalid');
    }
    const observedMs = epochMs(record.observedAt, 'cemaden_rj_cache_record_observed_invalid');
    if (observedMs < oldestObservedMs || observedMs > latestObservedMs) {
      throw new CemadenRjCacheError('cemaden_rj_cache_record_outside_window');
    }
  }
  if (seen.size !== CEMADEN_RJ_EXPECTED_MUNICIPALITIES) {
    throw new CemadenRjCacheError('cemaden_rj_cache_coverage_invalid');
  }
  if (!/^[0-9a-f]{64}$/.test(snapshot.statusInventorySha256 || '')
      || digestRecords(snapshot.records) !== snapshot.statusInventorySha256) {
    throw new CemadenRjCacheError('cemaden_rj_cache_digest_invalid');
  }

  return { oldestObservedMs, latestObservedMs };
}

export function createCemadenRjHydrologicalRiskCache({ now = () => Date.now() } = {}) {
  if (typeof now !== 'function') throw new CemadenRjCacheError('cemaden_rj_cache_invalid_clock');

  let entry = null;
  let lastAttemptAtMs = null;
  let lastErrorCode = null;

  function recordSuccess(snapshot, { fetchedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'cemaden_rj_cache_clock_invalid');
    const fetchedAtMs = epochMs(fetchedAt, 'cemaden_rj_cache_fetched_at_invalid');
    if (fetchedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new CemadenRjCacheError('cemaden_rj_cache_future_fetch');
    }
    const { oldestObservedMs, latestObservedMs } = validateSnapshot(snapshot, fetchedAtMs);
    entry = {
      snapshot: immutableClone(snapshot),
      fetchedAtMs,
      oldestObservedMs,
      latestObservedMs,
    };
    lastAttemptAtMs = fetchedAtMs;
    lastErrorCode = null;
  }

  function recordFailure(code, { attemptedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'cemaden_rj_cache_clock_invalid');
    const attemptedAtMs = epochMs(attemptedAt, 'cemaden_rj_cache_attempted_at_invalid');
    if (attemptedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new CemadenRjCacheError('cemaden_rj_cache_future_attempt');
    }
    lastAttemptAtMs = attemptedAtMs;
    lastErrorCode = validateErrorCode(code);
  }

  function read({ at = now(), mode = 'normal' } = {}) {
    const atMs = epochMs(at, 'cemaden_rj_cache_read_at_invalid');
    const refreshIntervalMs = refreshIntervalFor(mode);
    const nextRefreshDueAtMs = lastAttemptAtMs === null ? null : lastAttemptAtMs + refreshIntervalMs;
    const refreshDue = nextRefreshDueAtMs === null || atMs >= nextRefreshDueAtMs;
    const base = {
      sourceId: CEMADEN_RJ_SOURCE_ID,
      mode,
      refreshIntervalMs,
      refreshDue,
      nextRefreshDueAt: nextRefreshDueAtMs === null ? null : new Date(nextRefreshDueAtMs).toISOString(),
      lastAttemptAt: lastAttemptAtMs === null ? null : new Date(lastAttemptAtMs).toISOString(),
      lastErrorCode,
    };

    if (!entry) {
      return Object.freeze({
        ...base,
        state: 'UNAVAILABLE',
        reason: lastErrorCode ? 'refresh_failed_without_snapshot' : 'no_snapshot',
        fetchedAt: null,
        observedAt: null,
        dataAgeMs: null,
        cacheAgeMs: null,
        snapshot: null,
      });
    }

    if (entry.fetchedAtMs > atMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS
        || entry.latestObservedMs > atMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      return Object.freeze({
        ...base,
        state: 'UNAVAILABLE',
        reason: 'clock_skew',
        fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
        observedAt: new Date(entry.latestObservedMs).toISOString(),
        dataAgeMs: null,
        cacheAgeMs: null,
        snapshot: null,
      });
    }

    const dataAgeMs = Math.max(0, atMs - entry.oldestObservedMs);
    const cacheAgeMs = Math.max(0, atMs - entry.fetchedAtMs);
    const fresh = dataAgeMs <= CEMADEN_RJ_MAX_DATA_AGE_MS
      && cacheAgeMs <= CEMADEN_RJ_MAX_DATA_AGE_MS;
    const failedAfterSnapshot = lastErrorCode !== null
      && lastAttemptAtMs !== null
      && lastAttemptAtMs > entry.fetchedAtMs;

    if (!fresh) {
      return Object.freeze({
        ...base,
        state: 'STALE',
        reason: dataAgeMs > CEMADEN_RJ_MAX_DATA_AGE_MS
          ? 'observation_age_exceeded'
          : 'cache_age_exceeded',
        fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
        observedAt: new Date(entry.latestObservedMs).toISOString(),
        dataAgeMs,
        cacheAgeMs,
        snapshot: null,
      });
    }

    return Object.freeze({
      ...base,
      state: failedAfterSnapshot ? 'CURRENT_DEGRADED' : 'CURRENT',
      reason: failedAfterSnapshot ? 'latest_refresh_failed_using_current_cache' : 'fresh_snapshot',
      fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
      observedAt: new Date(entry.latestObservedMs).toISOString(),
      dataAgeMs,
      cacheAgeMs,
      snapshot: entry.snapshot,
    });
  }

  function clear() {
    entry = null;
    lastAttemptAtMs = null;
    lastErrorCode = null;
  }

  return Object.freeze({ recordSuccess, recordFailure, read, clear });
}
