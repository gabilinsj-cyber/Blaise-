import {
  CHM_TIDE_VALUE_SOURCE_ID,
  CHM_TIDE_TIME_BASIS,
  normalizeChmTideValues,
} from './chm-tide-values.mjs';
import {
  OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS,
  OFFICIAL_SOURCE_NORMAL_REFRESH_MS,
  OFFICIAL_SOURCE_SEVERE_REFRESH_MS,
} from './official-source-cache.mjs';

export const CHM_TIDE_CACHE_CONTRACT = 'OFFICIAL_CHM_TIDE_VALUES_MEMORY_CACHE_V1';
export const CHM_TIDE_CACHE_MAX_VERIFICATION_AGE_MS = 24 * 60 * 60 * 1000;
export const CHM_TIDE_CACHE_MAX_SNAPSHOT_BYTES = 1024 * 1024;

export class ChmTideCacheError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmTideCacheError';
    this.code = code;
  }
}

function epochMs(value, code) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new ChmTideCacheError(code);
  return parsed;
}

function boundedInteger(value, min, max, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ChmTideCacheError(code);
  }
  return parsed;
}

function refreshIntervalFor(mode) {
  if (mode === 'normal') return OFFICIAL_SOURCE_NORMAL_REFRESH_MS;
  if (mode === 'severe') return OFFICIAL_SOURCE_SEVERE_REFRESH_MS;
  throw new ChmTideCacheError('chm_tide_cache_invalid_refresh_mode');
}

function validateErrorCode(code) {
  if (typeof code !== 'string' || !/^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(code)) {
    throw new ChmTideCacheError('chm_tide_cache_invalid_error_code');
  }
  return code;
}

function keyFor(stationNumber, calendarYear) {
  return `${stationNumber}:${calendarYear}`;
}

function canonicalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new ChmTideCacheError('chm_tide_cache_invalid_snapshot');
  }
  if (snapshot.sourceId !== CHM_TIDE_VALUE_SOURCE_ID) {
    throw new ChmTideCacheError('chm_tide_cache_invalid_source_id');
  }
  const stationNumber = boundedInteger(
    snapshot.station?.stationNumber,
    1,
    99,
    'chm_tide_cache_invalid_station_number',
  );
  const calendarYear = boundedInteger(
    snapshot.calendarYear,
    2020,
    2100,
    'chm_tide_cache_invalid_calendar_year',
  );
  if (snapshot.timeBasis !== CHM_TIDE_TIME_BASIS) {
    throw new ChmTideCacheError('chm_tide_cache_invalid_time_basis');
  }
  if (!Array.isArray(snapshot.predictions)) {
    throw new ChmTideCacheError('chm_tide_cache_invalid_predictions');
  }

  const canonical = normalizeChmTideValues({
    station: snapshot.station,
    calendarYear,
    timeBasis: snapshot.timeBasis,
    utcOffsetMinutes: snapshot.utcOffsetMinutes,
    sourceArtifactSha256: snapshot.sourceArtifactSha256,
    predictions: snapshot.predictions.map((prediction) => ({
      localDate: prediction.localDate,
      localTime: prediction.localTime,
      heightMeters: prediction.heightMeters,
      phase: prediction.phase,
      sourcePage: prediction.sourcePage,
    })),
  });

  if (snapshot.tideValueSha256 !== canonical.tideValueSha256) {
    throw new ChmTideCacheError('chm_tide_cache_digest_mismatch');
  }
  const serialized = JSON.stringify(canonical);
  if (Buffer.byteLength(serialized, 'utf8') > CHM_TIDE_CACHE_MAX_SNAPSHOT_BYTES) {
    throw new ChmTideCacheError('chm_tide_cache_snapshot_too_large');
  }
  return { stationNumber, calendarYear, canonical };
}

function immutableClone(value) {
  const clone = structuredClone(value);
  const freeze = (candidate) => {
    if (!candidate || typeof candidate !== 'object' || Object.isFrozen(candidate)) return candidate;
    for (const child of Object.values(candidate)) freeze(child);
    return Object.freeze(candidate);
  };
  return freeze(clone);
}

export function createChmTideValuesCache({ now = () => Date.now() } = {}) {
  if (typeof now !== 'function') throw new ChmTideCacheError('chm_tide_cache_invalid_clock');

  const entries = new Map();
  const attempts = new Map();

  function recordSuccess(snapshot, { fetchedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'chm_tide_cache_clock_invalid');
    const fetchedAtMs = epochMs(fetchedAt, 'chm_tide_cache_fetched_at_invalid');
    if (fetchedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new ChmTideCacheError('chm_tide_cache_future_fetch');
    }
    const { stationNumber, calendarYear, canonical } = canonicalizeSnapshot(snapshot);
    const key = keyFor(stationNumber, calendarYear);
    entries.set(key, {
      snapshot: immutableClone(canonical),
      fetchedAtMs,
    });
    attempts.set(key, { lastAttemptAtMs: fetchedAtMs, lastErrorCode: null });
  }

  function recordFailure(code, {
    stationNumber,
    calendarYear,
    attemptedAt = now(),
  } = {}) {
    const normalizedStation = boundedInteger(
      stationNumber,
      1,
      99,
      'chm_tide_cache_invalid_station_number',
    );
    const normalizedYear = boundedInteger(
      calendarYear,
      2020,
      2100,
      'chm_tide_cache_invalid_calendar_year',
    );
    const currentMs = epochMs(now(), 'chm_tide_cache_clock_invalid');
    const attemptedAtMs = epochMs(attemptedAt, 'chm_tide_cache_attempted_at_invalid');
    if (attemptedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new ChmTideCacheError('chm_tide_cache_future_attempt');
    }
    attempts.set(keyFor(normalizedStation, normalizedYear), {
      lastAttemptAtMs: attemptedAtMs,
      lastErrorCode: validateErrorCode(code),
    });
  }

  function read({
    stationNumber,
    calendarYear,
    at = now(),
    mode = 'normal',
  } = {}) {
    const normalizedStation = boundedInteger(
      stationNumber,
      1,
      99,
      'chm_tide_cache_invalid_station_number',
    );
    const normalizedYear = boundedInteger(
      calendarYear,
      2020,
      2100,
      'chm_tide_cache_invalid_calendar_year',
    );
    const atMs = epochMs(at, 'chm_tide_cache_read_at_invalid');
    const refreshIntervalMs = refreshIntervalFor(mode);
    const key = keyFor(normalizedStation, normalizedYear);
    const entry = entries.get(key) ?? null;
    const attempt = attempts.get(key) ?? { lastAttemptAtMs: null, lastErrorCode: null };
    const nextRefreshDueAtMs = attempt.lastAttemptAtMs === null
      ? null
      : attempt.lastAttemptAtMs + refreshIntervalMs;
    const refreshDue = nextRefreshDueAtMs === null || atMs >= nextRefreshDueAtMs;
    const base = {
      contract: CHM_TIDE_CACHE_CONTRACT,
      sourceId: CHM_TIDE_VALUE_SOURCE_ID,
      stationNumber: normalizedStation,
      calendarYear: normalizedYear,
      mode,
      refreshIntervalMs,
      refreshDue,
      nextRefreshDueAt: nextRefreshDueAtMs === null ? null : new Date(nextRefreshDueAtMs).toISOString(),
      lastAttemptAt: attempt.lastAttemptAtMs === null ? null : new Date(attempt.lastAttemptAtMs).toISOString(),
      lastErrorCode: attempt.lastErrorCode,
      rawPdfRetention: 'NONE',
      rawTextRetention: 'NONE',
    };

    if (!entry) {
      return Object.freeze({
        ...base,
        state: 'UNAVAILABLE',
        reason: attempt.lastErrorCode ? 'refresh_failed_without_snapshot' : 'no_snapshot',
        fetchedAt: null,
        verificationAgeMs: null,
        snapshot: null,
      });
    }

    if (entry.fetchedAtMs > atMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      return Object.freeze({
        ...base,
        state: 'UNAVAILABLE',
        reason: 'clock_skew',
        fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
        verificationAgeMs: null,
        snapshot: null,
      });
    }

    const verificationAgeMs = Math.max(0, atMs - entry.fetchedAtMs);
    if (verificationAgeMs > CHM_TIDE_CACHE_MAX_VERIFICATION_AGE_MS) {
      return Object.freeze({
        ...base,
        state: 'STALE',
        reason: 'source_verification_age_exceeded',
        fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
        verificationAgeMs,
        snapshot: null,
      });
    }

    const failedAfterSnapshot = attempt.lastErrorCode !== null
      && attempt.lastAttemptAtMs !== null
      && attempt.lastAttemptAtMs > entry.fetchedAtMs;

    return Object.freeze({
      ...base,
      state: failedAfterSnapshot ? 'CURRENT_DEGRADED' : 'CURRENT',
      reason: failedAfterSnapshot ? 'latest_refresh_failed_using_verified_cache' : 'verified_snapshot',
      fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
      verificationAgeMs,
      snapshot: entry.snapshot,
    });
  }

  function clear({ stationNumber, calendarYear } = {}) {
    if (stationNumber === undefined && calendarYear === undefined) {
      entries.clear();
      attempts.clear();
      return;
    }
    const normalizedStation = boundedInteger(
      stationNumber,
      1,
      99,
      'chm_tide_cache_invalid_station_number',
    );
    const normalizedYear = boundedInteger(
      calendarYear,
      2020,
      2100,
      'chm_tide_cache_invalid_calendar_year',
    );
    const key = keyFor(normalizedStation, normalizedYear);
    entries.delete(key);
    attempts.delete(key);
  }

  return Object.freeze({ recordSuccess, recordFailure, read, clear });
}
