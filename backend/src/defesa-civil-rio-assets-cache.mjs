import { createHash } from 'node:crypto';

import {
  DEFESA_CIVIL_RIO_ASSETS_HOST,
  DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID,
  DEFESA_CIVIL_RIO_MAX_FEATURES,
  DEFESA_CIVIL_RIO_SERVICE_ITEM_ID,
} from './defesa-civil-rio-assets.mjs';
import {
  OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS,
  OFFICIAL_SOURCE_NORMAL_REFRESH_MS,
  OFFICIAL_SOURCE_SEVERE_REFRESH_MS,
} from './official-source-cache.mjs';

export const DEFESA_CIVIL_RIO_ASSETS_MAX_CACHE_AGE_MS = 30 * 60 * 1000;
export const DEFESA_CIVIL_RIO_ASSETS_MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
export const DEFESA_CIVIL_RIO_ASSETS_SEMANTIC_VALIDITY = 'MAP_ASSET_INVENTORY_ONLY_OPERATIONAL_STATUS_NOT_VALIDATED';

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

function refreshIntervalFor(mode) {
  if (mode === 'normal') return OFFICIAL_SOURCE_NORMAL_REFRESH_MS;
  if (mode === 'severe') return OFFICIAL_SOURCE_SEVERE_REFRESH_MS;
  throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_refresh_mode');
}

function serializedSize(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_unserializable_snapshot');
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

function digest(items) {
  return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

function validateErrorCode(code) {
  if (typeof code !== 'string' || !/^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(code)) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_error_code');
  }
  return code;
}

function validateText(value, max, code) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new DefesaCivilRioAssetsCacheError(code);
  }
}

function validateGeometry(geometry) {
  if (!geometry || !Number.isFinite(geometry.longitude) || !Number.isFinite(geometry.latitude)) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_geometry_invalid');
  }
  if (geometry.longitude < -44.0 || geometry.longitude > -42.5
      || geometry.latitude < -23.3 || geometry.latitude > -22.5) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_geometry_outside_expected_bounds');
  }
}

function validateLayer(layer, kind) {
  if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
    throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_layer_invalid`);
  }
  if (!Number.isInteger(layer.count) || layer.count < 1 || layer.count > DEFESA_CIVIL_RIO_MAX_FEATURES) {
    throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_count_invalid`);
  }
  if (!Array.isArray(layer.items) || layer.items.length !== layer.count) {
    throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_items_invalid`);
  }
  if (!/^[0-9a-f]{64}$/.test(layer.sha256 || '') || digest(layer.items) !== layer.sha256) {
    throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_digest_invalid`);
  }

  const objectIds = new Set();
  const globalIds = new Set();
  const operationalCodes = new Set();
  for (const item of layer.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_item_invalid`);
    }
    if (!Number.isInteger(item.objectId) || item.objectId < 1 || item.objectId > 2_147_483_647) {
      throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_object_id_invalid`);
    }
    if (objectIds.has(item.objectId)) {
      throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_object_id_duplicate`);
    }
    objectIds.add(item.objectId);
    if (typeof item.globalId !== 'string'
        || !/^\{?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\}?$/i.test(item.globalId)) {
      throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_global_id_invalid`);
    }
    if (globalIds.has(item.globalId)) {
      throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_global_id_duplicate`);
    }
    globalIds.add(item.globalId);
    validateGeometry(item.geometry);
    validateText(item.name, 254, `defesa_civil_rio_assets_cache_${kind}_name_invalid`);

    const operationalCode = kind === 'sirens' ? item.sirenCode : item.supportCode;
    if (!Number.isInteger(operationalCode) || operationalCode < 1 || operationalCode > 2_147_483_647) {
      throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_code_invalid`);
    }
    if (operationalCodes.has(operationalCode)) {
      throw new DefesaCivilRioAssetsCacheError(`defesa_civil_rio_assets_cache_${kind}_code_duplicate`);
    }
    operationalCodes.add(operationalCode);
  }
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_snapshot');
  }
  if (snapshot.sourceId !== DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID
      || snapshot.sourceHost !== DEFESA_CIVIL_RIO_ASSETS_HOST
      || snapshot.serviceItemId !== DEFESA_CIVIL_RIO_SERVICE_ITEM_ID
      || snapshot.spatialReference !== 4326) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_source_contract_invalid');
  }
  if (serializedSize(snapshot) > DEFESA_CIVIL_RIO_ASSETS_MAX_SNAPSHOT_BYTES) {
    throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_snapshot_too_large');
  }
  validateLayer(snapshot.sirens, 'sirens');
  validateLayer(snapshot.supportPoints, 'support_points');
}

export function createDefesaCivilRioAssetsCache({ now = () => Date.now() } = {}) {
  if (typeof now !== 'function') throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_invalid_clock');

  let entry = null;
  let lastAttemptAtMs = null;
  let lastErrorCode = null;

  function recordSuccess(snapshot, { fetchedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'defesa_civil_rio_assets_cache_clock_invalid');
    const fetchedAtMs = epochMs(fetchedAt, 'defesa_civil_rio_assets_cache_fetched_at_invalid');
    if (fetchedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_future_fetch');
    }
    validateSnapshot(snapshot);
    entry = { snapshot: immutableClone(snapshot), fetchedAtMs };
    lastAttemptAtMs = fetchedAtMs;
    lastErrorCode = null;
  }

  function recordFailure(code, { attemptedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'defesa_civil_rio_assets_cache_clock_invalid');
    const attemptedAtMs = epochMs(attemptedAt, 'defesa_civil_rio_assets_cache_attempted_at_invalid');
    if (attemptedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new DefesaCivilRioAssetsCacheError('defesa_civil_rio_assets_cache_future_attempt');
    }
    lastAttemptAtMs = attemptedAtMs;
    lastErrorCode = validateErrorCode(code);
  }

  function read({ at = now(), mode = 'normal' } = {}) {
    const atMs = epochMs(at, 'defesa_civil_rio_assets_cache_read_at_invalid');
    const refreshIntervalMs = refreshIntervalFor(mode);
    const nextRefreshDueAtMs = lastAttemptAtMs === null ? null : lastAttemptAtMs + refreshIntervalMs;
    const base = {
      sourceId: DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID,
      mode,
      refreshIntervalMs,
      refreshDue: nextRefreshDueAtMs === null || atMs >= nextRefreshDueAtMs,
      nextRefreshDueAt: nextRefreshDueAtMs === null ? null : new Date(nextRefreshDueAtMs).toISOString(),
      lastAttemptAt: lastAttemptAtMs === null ? null : new Date(lastAttemptAtMs).toISOString(),
      lastErrorCode,
      semanticValidity: DEFESA_CIVIL_RIO_ASSETS_SEMANTIC_VALIDITY,
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

    if (entry.fetchedAtMs > atMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
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
    if (cacheAgeMs > DEFESA_CIVIL_RIO_ASSETS_MAX_CACHE_AGE_MS) {
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
      reason: failedAfterSnapshot ? 'latest_refresh_failed_using_current_cache' : 'fresh_map_asset_inventory',
      fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
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
