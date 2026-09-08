import {
  ALERTA_RIO_EXPECTED_ACTIVE_STATIONS,
  ALERTA_RIO_LIVE_SOURCE_ID,
} from './alerta-rio-source.mjs';

export const OFFICIAL_SOURCE_NORMAL_REFRESH_MS = 15 * 60 * 1000;
export const OFFICIAL_SOURCE_SEVERE_REFRESH_MS = 60 * 1000;
export const OFFICIAL_SOURCE_MAX_DATA_AGE_MS = 15 * 60 * 1000;
export const OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;
export const OFFICIAL_SOURCE_MAX_SNAPSHOT_BYTES = 256 * 1024;

export class OfficialSourceCacheError extends Error {
  constructor(code) {
    super(code);
    this.name = 'OfficialSourceCacheError';
    this.code = code;
  }
}

function epochMs(value, code) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new OfficialSourceCacheError(code);
  return parsed;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function immutableClone(value) {
  return deepFreeze(structuredClone(value));
}

function validateSnapshot(snapshot, referenceNowMs) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new OfficialSourceCacheError('official_source_invalid_snapshot');
  }
  if (snapshot.sourceId !== ALERTA_RIO_LIVE_SOURCE_ID) {
    throw new OfficialSourceCacheError('official_source_invalid_source_id');
  }
  if (snapshot.stationCount !== ALERTA_RIO_EXPECTED_ACTIVE_STATIONS) {
    throw new OfficialSourceCacheError('official_source_station_count_drift');
  }
  if (!Array.isArray(snapshot.stations) || snapshot.stations.length !== ALERTA_RIO_EXPECTED_ACTIVE_STATIONS) {
    throw new OfficialSourceCacheError('official_source_station_payload_drift');
  }
  if (!Number.isInteger(snapshot.missingValueCount)
      || snapshot.missingValueCount < 0
      || snapshot.missingValueCount > ALERTA_RIO_EXPECTED_ACTIVE_STATIONS * 14) {
    throw new OfficialSourceCacheError('official_source_invalid_missing_value_count');
  }
  if (!/^[0-9a-f]{64}$/.test(snapshot.snapshotSha256 || '')) {
    throw new OfficialSourceCacheError('official_source_invalid_snapshot_digest');
  }

  let serialized;
  try {
    serialized = JSON.stringify(snapshot);
  } catch {
    throw new OfficialSourceCacheError('official_source_unserializable_snapshot');
  }
  if (Buffer.byteLength(serialized, 'utf8') > OFFICIAL_SOURCE_MAX_SNAPSHOT_BYTES) {
    throw new OfficialSourceCacheError('official_source_snapshot_too_large');
  }

  const oldestObservedMs = epochMs(snapshot.oldestObservedAt, 'official_source_invalid_oldest_observed_at');
  const freshestObservedMs = epochMs(snapshot.freshestObservedAt, 'official_source_invalid_freshest_observed_at');
  if (oldestObservedMs > freshestObservedMs) {
    throw new OfficialSourceCacheError('official_source_invalid_observation_window');
  }
  if (freshestObservedMs > referenceNowMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
    throw new OfficialSourceCacheError('official_source_future_observation');
  }

  const stationCodes = new Set();
  for (const station of snapshot.stations) {
    if (!station || typeof station !== 'object' || !Number.isInteger(station.code)) {
      throw new OfficialSourceCacheError('official_source_invalid_station');
    }
    if (stationCodes.has(station.code)) {
      throw new OfficialSourceCacheError('official_source_duplicate_station');
    }
    stationCodes.add(station.code);
    const observedMs = epochMs(station.observedAt, 'official_source_invalid_station_observed_at');
    if (observedMs < oldestObservedMs || observedMs > freshestObservedMs) {
      throw new OfficialSourceCacheError('official_source_station_outside_observation_window');
    }
  }

  return { oldestObservedMs, freshestObservedMs };
}

function validateErrorCode(code) {
  if (typeof code !== 'string' || !/^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(code)) {
    throw new OfficialSourceCacheError('official_source_invalid_error_code');
  }
  return code;
}

function refreshIntervalFor(mode) {
  if (mode === 'normal') return OFFICIAL_SOURCE_NORMAL_REFRESH_MS;
  if (mode === 'severe') return OFFICIAL_SOURCE_SEVERE_REFRESH_MS;
  throw new OfficialSourceCacheError('official_source_invalid_refresh_mode');
}

export function createAlertaRioRainfallCache({ now = () => Date.now() } = {}) {
  if (typeof now !== 'function') throw new OfficialSourceCacheError('official_source_invalid_clock');

  let entry = null;
  let lastAttemptAtMs = null;
  let lastErrorCode = null;

  function recordSuccess(snapshot, { fetchedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'official_source_invalid_clock_value');
    const fetchedAtMs = epochMs(fetchedAt, 'official_source_invalid_fetched_at');
    if (fetchedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new OfficialSourceCacheError('official_source_future_fetch');
    }
    const { oldestObservedMs, freshestObservedMs } = validateSnapshot(snapshot, fetchedAtMs);
    entry = {
      snapshot: immutableClone(snapshot),
      fetchedAtMs,
      oldestObservedMs,
      freshestObservedMs,
    };
    lastAttemptAtMs = fetchedAtMs;
    lastErrorCode = null;
  }

  function recordFailure(code, { attemptedAt = now() } = {}) {
    const attemptedAtMs = epochMs(attemptedAt, 'official_source_invalid_attempted_at');
    const currentMs = epochMs(now(), 'official_source_invalid_clock_value');
    if (attemptedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new OfficialSourceCacheError('official_source_future_attempt');
    }
    lastAttemptAtMs = attemptedAtMs;
    lastErrorCode = validateErrorCode(code);
  }

  function read({ at = now(), mode = 'normal' } = {}) {
    const atMs = epochMs(at, 'official_source_invalid_read_at');
    const refreshIntervalMs = refreshIntervalFor(mode);
    const nextRefreshDueAtMs = lastAttemptAtMs === null ? null : lastAttemptAtMs + refreshIntervalMs;
    const refreshDue = nextRefreshDueAtMs === null || atMs >= nextRefreshDueAtMs;

    const base = {
      sourceId: ALERTA_RIO_LIVE_SOURCE_ID,
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
        dataAgeMs: null,
        cacheAgeMs: null,
        snapshot: null,
      });
    }

    if (entry.fetchedAtMs > atMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS
        || entry.freshestObservedMs > atMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      return Object.freeze({
        ...base,
        state: 'UNAVAILABLE',
        reason: 'clock_skew',
        fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
        dataAgeMs: null,
        cacheAgeMs: null,
        snapshot: null,
      });
    }

    const dataAgeMs = Math.max(0, atMs - entry.oldestObservedMs);
    const cacheAgeMs = Math.max(0, atMs - entry.fetchedAtMs);
    const fresh = dataAgeMs <= OFFICIAL_SOURCE_MAX_DATA_AGE_MS
      && cacheAgeMs <= OFFICIAL_SOURCE_MAX_DATA_AGE_MS;
    const failedAfterSnapshot = lastErrorCode !== null
      && lastAttemptAtMs !== null
      && lastAttemptAtMs > entry.fetchedAtMs;

    if (!fresh) {
      return Object.freeze({
        ...base,
        state: 'STALE',
        reason: dataAgeMs > OFFICIAL_SOURCE_MAX_DATA_AGE_MS
          ? 'observation_age_exceeded'
          : 'cache_age_exceeded',
        fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
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
