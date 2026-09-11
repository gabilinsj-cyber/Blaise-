import { createHash } from 'node:crypto';

import {
  CHM_HOST,
  CHM_MAX_WARNING_AREAS,
  CHM_MAX_WARNING_RECORDS,
  CHM_MAX_WARNING_VALIDITY_MS,
  CHM_SOURCE_ID,
  CHM_TEMPORAL_VALIDITY_CONTRACT,
  CHM_WARNINGS_URL,
} from './chm-source.mjs';
import {
  OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS,
  OFFICIAL_SOURCE_NORMAL_REFRESH_MS,
  OFFICIAL_SOURCE_SEVERE_REFRESH_MS,
} from './official-source-cache.mjs';

export const CHM_WARNINGS_MAX_CACHE_AGE_MS = 30 * 60 * 1000;
export const CHM_WARNINGS_MAX_SNAPSHOT_BYTES = 64 * 1024;
export const CHM_WARNINGS_SEMANTIC_VALIDITY = 'SOURCE_INVENTORY_TEMPORAL_VALIDITY_NOT_RJ_GEOFENCED';

export class ChmWarningsCacheError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmWarningsCacheError';
    this.code = code;
  }
}

function epochMs(value, code) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new ChmWarningsCacheError(code);
  return parsed;
}

function canonicalIsoMs(value, code) {
  if (typeof value !== 'string') throw new ChmWarningsCacheError(code);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) {
    throw new ChmWarningsCacheError(code);
  }
  return ms;
}

function refreshIntervalFor(mode) {
  if (mode === 'normal') return OFFICIAL_SOURCE_NORMAL_REFRESH_MS;
  if (mode === 'severe') return OFFICIAL_SOURCE_SEVERE_REFRESH_MS;
  throw new ChmWarningsCacheError('chm_warnings_cache_invalid_refresh_mode');
}

function serializedSize(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new ChmWarningsCacheError('chm_warnings_cache_unserializable_snapshot');
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

function validateErrorCode(code) {
  if (typeof code !== 'string' || !/^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(code)) {
    throw new ChmWarningsCacheError('chm_warnings_cache_invalid_error_code');
  }
  return code;
}

function digestWarnings(warnings) {
  const canonical = warnings.map((warning) => ({
    id: warning.id,
    area: warning.area,
    areas: warning.areas,
    warningType: warning.warningType,
    issuedZuluClock: warning.issuedZuluClock,
    issuedAt: warning.issuedAt,
    validUntil: warning.validUntil,
    validityDurationMs: warning.validityDurationMs,
  }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function validateArea(area) {
  if (typeof area !== 'string'
      || area.length < 2
      || area.length > 48
      || /[\u0000-\u001f\u007f]/.test(area)) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_area_invalid');
  }
}

function validateWarning(warning, seen) {
  if (!warning || typeof warning !== 'object' || Array.isArray(warning)) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_invalid');
  }
  if (!/^\d{1,4}\/\d{4}$/.test(warning.id || '')) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_id_invalid');
  }
  if (seen.has(warning.id)) throw new ChmWarningsCacheError('chm_warnings_cache_warning_duplicate');
  seen.add(warning.id);
  if (!Number.isInteger(warning.warningNumber) || warning.warningNumber < 1 || warning.warningNumber > 9999) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_number_invalid');
  }
  if (!Number.isInteger(warning.year) || warning.year < 2020 || warning.year > 2100) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_year_invalid');
  }
  if (`${warning.warningNumber}/${warning.year}` !== warning.id) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_identity_mismatch');
  }
  if (warning.area !== null) validateArea(warning.area);
  if (!Array.isArray(warning.areas) || warning.areas.length > CHM_MAX_WARNING_AREAS) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_areas_invalid');
  }
  const uniqueAreas = new Set();
  for (const area of warning.areas) {
    validateArea(area);
    if (uniqueAreas.has(area)) {
      throw new ChmWarningsCacheError('chm_warnings_cache_warning_area_duplicate');
    }
    uniqueAreas.add(area);
  }
  if (warning.area !== (warning.areas[0] ?? null)) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_area_compatibility_mismatch');
  }
  if (typeof warning.warningType !== 'string'
      || warning.warningType.length < 3
      || warning.warningType.length > 96) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_type_invalid');
  }
  if (!/^(?:[01]\d|2[0-3])[0-5]\dZ$/.test(warning.issuedZuluClock || '')) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_clock_invalid');
  }

  const issuedAtMs = canonicalIsoMs(warning.issuedAt, 'chm_warnings_cache_warning_issued_at_invalid');
  const validUntilMs = canonicalIsoMs(warning.validUntil, 'chm_warnings_cache_warning_valid_until_invalid');
  const issuedDate = new Date(issuedAtMs);
  const expectedClock = `${String(issuedDate.getUTCHours()).padStart(2, '0')}${String(issuedDate.getUTCMinutes()).padStart(2, '0')}Z`;
  if (expectedClock !== warning.issuedZuluClock || issuedDate.getUTCFullYear() !== warning.year) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_temporal_identity_mismatch');
  }
  const durationMs = validUntilMs - issuedAtMs;
  if (!Number.isInteger(warning.validityDurationMs)
      || warning.validityDurationMs !== durationMs
      || durationMs < 1
      || durationMs > CHM_MAX_WARNING_VALIDITY_MS) {
    throw new ChmWarningsCacheError('chm_warnings_cache_warning_validity_window_invalid');
  }
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new ChmWarningsCacheError('chm_warnings_cache_invalid_snapshot');
  }
  if (snapshot.sourceId !== CHM_SOURCE_ID
      || snapshot.sourceHost !== CHM_HOST
      || snapshot.sourceUrl !== CHM_WARNINGS_URL
      || snapshot.metarea !== 'V') {
    throw new ChmWarningsCacheError('chm_warnings_cache_source_contract_invalid');
  }
  if (!Number.isInteger(snapshot.activeWarningCount)
      || snapshot.activeWarningCount < 0
      || snapshot.activeWarningCount > CHM_MAX_WARNING_RECORDS) {
    throw new ChmWarningsCacheError('chm_warnings_cache_count_invalid');
  }
  if (!Array.isArray(snapshot.warnings) || snapshot.warnings.length !== snapshot.activeWarningCount) {
    throw new ChmWarningsCacheError('chm_warnings_cache_inventory_invalid');
  }
  if (snapshot.noWarningMarker !== (snapshot.activeWarningCount === 0)) {
    throw new ChmWarningsCacheError('chm_warnings_cache_no_warning_marker_invalid');
  }
  if (snapshot.rawWarningTextRetention !== 'NONE'
      || snapshot.temporalValidityValidation !== CHM_TEMPORAL_VALIDITY_CONTRACT
      || snapshot.rjCoastGeofenceValidation !== 'NOT_IMPLEMENTED') {
    throw new ChmWarningsCacheError('chm_warnings_cache_semantic_contract_drift');
  }
  if (serializedSize(snapshot) > CHM_WARNINGS_MAX_SNAPSHOT_BYTES) {
    throw new ChmWarningsCacheError('chm_warnings_cache_snapshot_too_large');
  }

  const seen = new Set();
  for (const warning of snapshot.warnings) validateWarning(warning, seen);
  if (!/^[0-9a-f]{64}$/.test(snapshot.warningInventorySha256 || '')
      || digestWarnings(snapshot.warnings) !== snapshot.warningInventorySha256) {
    throw new ChmWarningsCacheError('chm_warnings_cache_digest_invalid');
  }
}

export function createChmWarningsInventoryCache({ now = () => Date.now() } = {}) {
  if (typeof now !== 'function') throw new ChmWarningsCacheError('chm_warnings_cache_invalid_clock');

  let entry = null;
  let lastAttemptAtMs = null;
  let lastErrorCode = null;

  function recordSuccess(snapshot, { fetchedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'chm_warnings_cache_clock_invalid');
    const fetchedAtMs = epochMs(fetchedAt, 'chm_warnings_cache_fetched_at_invalid');
    if (fetchedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new ChmWarningsCacheError('chm_warnings_cache_future_fetch');
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
    const currentMs = epochMs(now(), 'chm_warnings_cache_clock_invalid');
    const attemptedAtMs = epochMs(attemptedAt, 'chm_warnings_cache_attempted_at_invalid');
    if (attemptedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new ChmWarningsCacheError('chm_warnings_cache_future_attempt');
    }
    lastAttemptAtMs = attemptedAtMs;
    lastErrorCode = validateErrorCode(code);
  }

  function read({ at = now(), mode = 'normal' } = {}) {
    const atMs = epochMs(at, 'chm_warnings_cache_read_at_invalid');
    const refreshIntervalMs = refreshIntervalFor(mode);
    const nextRefreshDueAtMs = lastAttemptAtMs === null ? null : lastAttemptAtMs + refreshIntervalMs;
    const refreshDue = nextRefreshDueAtMs === null || atMs >= nextRefreshDueAtMs;
    const base = {
      sourceId: CHM_SOURCE_ID,
      mode,
      refreshIntervalMs,
      refreshDue,
      nextRefreshDueAt: nextRefreshDueAtMs === null ? null : new Date(nextRefreshDueAtMs).toISOString(),
      lastAttemptAt: lastAttemptAtMs === null ? null : new Date(lastAttemptAtMs).toISOString(),
      lastErrorCode,
      semanticValidity: CHM_WARNINGS_SEMANTIC_VALIDITY,
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
    if (cacheAgeMs > CHM_WARNINGS_MAX_CACHE_AGE_MS) {
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
      reason: failedAfterSnapshot ? 'latest_refresh_failed_using_current_cache' : 'fresh_source_inventory',
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
