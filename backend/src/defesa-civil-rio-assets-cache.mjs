import {
  DEFESA_CIVIL_RIO_ASSETS_HOST,
  DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID,
  DEFESA_CIVIL_RIO_MAX_FEATURES,
  DEFESA_CIVIL_RIO_SERVICE_ITEM_ID,
} from './defesa-civil-rio-assets.mjs';
import {
  OFFICIAL_SOURCE_NORMAL_REFRESH_MS,
  OFFICIAL_SOURCE_SEVERE_REFRESH_MS,
} from './official-source-cache.mjs';

export const DEFESA_CIVIL_RIO_ASSETS_MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
export const DEFESA_CIVIL_RIO_ASSETS_NORMAL_MAX_CACHE_AGE_MS = 60 * 60 * 1000;
export const DEFESA_CIVIL_RIO_ASSETS_SEVERE_MAX_CACHE_AGE_MS = 15 * 60 * 1000;

export class DefesaCivilRioAssetsCacheError extends Error {
  constructor(code) {
    super(code);
    this.name = 'DefesaCivilRioAssetsCacheError';
    this.code = code;
  }
}

function epochMs(value, code) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new DefesaCivilRioAssetsCacheError(code);
  return parsed;
}

function validateErrorCode(code) {
  if (typeof code !== 'string' || !/^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(code)) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_error_code');
  }
  return code;
}

function refreshIntervalFor(mode) {
  if (mode === 'normal') return OFFICIAL_SOURCE_NORMAL_REFRESH_MS;
  if (mode === 'severe') return OFFICIAL_SOURCE_SEVERE_REFRESH_MS;
  throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_mode');
}

export function defesaCivilRioAssetsMaxCacheAgeMs(mode) {
  if (mode === 'normal') return DEFESA_CIVIL_RIO_ASSETS_NORMAL_MAX_CACHE_AGE_MS;
  if (mode === 'severe') return DEFESA_CIVIL_RIO_ASSETS_SEVERE_MAX_CACHE_AGE_MS;
  throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_mode');
}

function immutableClone(value) {
  return structuredClone(value);
}

function validateCollection(collection, name) {
  if (!collection || typeof collection !== 'object') {
    throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_invalid_${name}`);
  }
  if (!Number.isInteger(collection.count) || collection.count < 1 || collection.count > DEFESA_CIVIL_RIO_MAX_FEATURES) {
    throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_invalid_${name}_count`);
  }
  if (!Array.isArray(collection.items) || collection.items.length !== collection.count) {
    throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_invalid_${name}_items`);
  }
  if (!/^[0-9a-f]{64}$/.test(collection.sha256 || '')) {
    throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_invalid_${name}_digest`);
  }
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_snapshot');
  }
  if (snapshot.sourceId !== DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_source_id');
  }
  if (snapshot.sourceHost !== DEFESA_CIVIL_RIO_ASSETS_HOST) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_source_host');
  }
  if (snapshot.serviceItemId !== DEFESA_CIVIL_RIO_SERVICE_ITEM_ID) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_service_item');
  }
  if (snapshot.spatialReference !== 4326) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_spatial_reference');
  }
  validateCollection(snapshot.sirens, 'sirens');
  validateCollection(snapshot.supportPoints, 'support_points');

  let serialized;
  try {
    serialized = JSON.stringify(snapshot);
  } catch {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_unserializable_snapshot');
  }
  if (Buffer.byteLength(serialized, 'utf8') > DEFESA_CIVIL_RIO_ASSETS_MAX_SNAPSHOT_BYTES) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_snapshot_too_large');
  }
}

export function createDefesaCivilRioAssetsCache({ now = () => Date.now() } = {}) {
  if (typeof now !== 'function') {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_clock');
  }

  let entry = null;
  let lastAttemptAtMs = null;
  let lastErrorCode = null;

  function recordSuccess(snapshot, { fetchedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'defesa_civil_rio_assets_cache_invalid_clock_value');
    const fetchedAtMs = epochMs(fetchedAt, 'defesa_civil_rio_assets_cache_invalid_fetched_at');
    if (fetchedAtMs > currentMs + 2 * 60 * 1000) {
      throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_future_fetch');
    }
    validateSnapshot(snapshot);
    entry = {
      snapshot: immutableClone(snapshot),
      fetchedAtMs,
    };
    lastAttemptAtMs = fetchedAtMs;
    lastErrorCode = null;
  }

  function recordFailure(code, { attemptedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'defesa_civil_rio_assets_cache_invalid_clock_value');
    const attemptedAtMs = epochMs(attemptedAt, 'defesa_civil_rio_assets_cache_invalid_attempted_at');
    if (attemptedAtMs > currentMs + 2 * 60 * 1000) {
      throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_future_attempt');
    }
    lastAttemptAtMs = attemptedAtMs;
    lastErrorCode = validateErrorCode(code);
  }

  function read({ at = now(), mode = 'normal' } = {}) {
    const atMs = epochMs(at, 'defesa_civil_rio_assets_cache_invalid_read_at');
    const refreshIntervalMs = refreshIntervalFor(mode);
    const maxCacheAgeMs = defesaCivilRioAssetsMaxCacheAgeMs(mode);
    const nextRefreshDueAtMs = lastAttemptAtMs === null ? null : lastAttemptAtMs + refreshIntervalMs;
    const refreshDue = nextRefreshDueAtMs === null || atMs >= nextRefreshDueAtMs;

    const base = {
      sourceId: DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID,
      mode,
      refreshIntervalMs,
      maxCacheAgeMs,
      refreshDue,
      nextRefreshDueAt: nextRefreshDueAtMs === null ? null : new Date(nextRefreshDueAtMs).toISOString(),
      lastAttemptAt: lastAttemptAtMs === null ? null : new Date(lastAttemptAtMs).toISOString(),
      lastErrorCode,
      observedAt: null,
      dataAgeMs: null,
    };

    if (!entry) {
      return Object.freeze({
        ...base,
        state: 'UNAVAILABLE',
        reason: lastErrorCode ? 'refresh_failed_without_snapshot' : 'no_snapshot',
        fetchedAt: null,
        cacheAgeMs: null,
        snapshot: null,
      });
    }

    if (entry.fetchedAtMs > atMs + 2 * 60 * 1000) {
      return Object.freeze({
        ...base,
        state: 'UNAVAILABLE',
        reason: 'clock_skew',
        fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
        cacheAgeMs: null,
        snapshot: null,
      });
    }

    const cacheAgeMs = Math.max(0, atMs - entry.fetchedAtMs);
    if (cacheAgeMs > maxCacheAgeMs) {
      return Object.freeze({
        ...base,
        state: 'STALE',
        reason: 'cache_age_exceeded',
        fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
        cacheAgeMs,
        snapshot: null,
      });
    }

    const failedAfterSnapshot = lastErrorCode !== null
      && lastAttemptAtMs !== null
      && lastAttemptAtMs > entry.fetchedAtMs;

    return Object.freeze({
      ...base,
      state: failedAfterSnapshot ? 'CURRENT_DEGRADED' : 'CURRENT',
      reason: failedAfterSnapshot ? 'latest_refresh_failed_using_current_cache' : 'fresh_snapshot',
      fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
      cacheAgeMs,
      snapshot: immutableClone(entry.snapshot),
    });
  }

  function clear() {
    entry = null;
    lastAttemptAtMs = null;
    lastErrorCode = null;
  }

  return Object.freeze({ recordSuccess, recordFailure, read, clear });
}
