import { createHash } from 'node:crypto';

import { findRjMunicipality } from './rio-municipalities.mjs';
import {
  INMET_CAP_RSS_URL,
  INMET_HOST,
  INMET_MAX_WARNING_RECORDS,
  INMET_SOURCE_ID,
} from './inmet-source.mjs';
import {
  OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS,
  OFFICIAL_SOURCE_NORMAL_REFRESH_MS,
  OFFICIAL_SOURCE_SEVERE_REFRESH_MS,
} from './official-source-cache.mjs';

export const INMET_WARNINGS_MAX_CACHE_AGE_MS = 30 * 60 * 1000;
export const INMET_WARNINGS_MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
export const INMET_WARNINGS_SEMANTIC_VALIDITY = 'CAP_CONTRACT_VALIDATED_P0_POLICY_NOT_EVALUATED';

const CAP_SEVERITIES = new Set(['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown']);
const CAP_URGENCIES = new Set(['Immediate', 'Expected', 'Future', 'Past', 'Unknown']);
const CAP_CERTAINTIES = new Set(['Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown']);
const CAP_MESSAGE_TYPES = new Set(['Alert', 'Update']);
const RJ_MATCH_METHODS = new Set([
  'CAP_GEOCODE_IBGE_33',
  'CAP_GEOCODE_BR_RJ',
  'CAP_AREA_DESC_RIO_DE_JANEIRO',
]);

export class InmetWarningsCacheError extends Error {
  constructor(code) {
    super(code);
    this.name = 'InmetWarningsCacheError';
    this.code = code;
  }
}

function epochMs(value, code) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new InmetWarningsCacheError(code);
  return parsed;
}

function refreshIntervalFor(mode) {
  if (mode === 'normal') return OFFICIAL_SOURCE_NORMAL_REFRESH_MS;
  if (mode === 'severe') return OFFICIAL_SOURCE_SEVERE_REFRESH_MS;
  throw new InmetWarningsCacheError('inmet_warnings_cache_invalid_refresh_mode');
}

function serializedSize(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new InmetWarningsCacheError('inmet_warnings_cache_unserializable_snapshot');
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
    throw new InmetWarningsCacheError('inmet_warnings_cache_invalid_error_code');
  }
  return code;
}

function digestWarnings(warnings) {
  const canonical = warnings.map((warning) => ({
    identifier: warning.identifier,
    sent: warning.sent,
    event: warning.event,
    urgency: warning.urgency,
    severity: warning.severity,
    certainty: warning.certainty,
    onset: warning.onset,
    expires: warning.expires,
    areaDescriptions: warning.areaDescriptions,
    rjMatchMethod: warning.rjMatchMethod,
    rjMunicipalityIbges: warning.rjMunicipalityIbges,
  }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function validateText(value, { min = 1, max = 16_384, code }) {
  if (typeof value !== 'string'
      || value.length < min
      || value.length > max
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new InmetWarningsCacheError(code);
  }
}

function validateWarning(warning, seenIdentifiers) {
  if (!warning || typeof warning !== 'object' || Array.isArray(warning)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_warning_invalid');
  }
  validateText(warning.identifier, { max: 256, code: 'inmet_warnings_cache_identifier_invalid' });
  if (!warning.identifier.startsWith('urn:oid:2.49.0.0.76.0.')) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_identifier_untrusted');
  }
  if (seenIdentifiers.has(warning.identifier)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_duplicate_identifier');
  }
  seenIdentifiers.add(warning.identifier);

  validateText(warning.sender, { max: 256, code: 'inmet_warnings_cache_sender_invalid' });
  if (!/@inmet\.gov\.br$/i.test(warning.sender)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_sender_untrusted');
  }
  if (warning.status !== 'Actual') {
    throw new InmetWarningsCacheError('inmet_warnings_cache_status_invalid');
  }
  if (!CAP_MESSAGE_TYPES.has(warning.msgType)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_msg_type_invalid');
  }
  validateText(warning.event, { max: 160, code: 'inmet_warnings_cache_event_invalid' });
  if (!CAP_URGENCIES.has(warning.urgency)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_urgency_invalid');
  }
  if (!CAP_SEVERITIES.has(warning.severity)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_severity_invalid');
  }
  if (!CAP_CERTAINTIES.has(warning.certainty)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_certainty_invalid');
  }

  const sentMs = epochMs(warning.sent, 'inmet_warnings_cache_sent_invalid');
  const onsetMs = epochMs(warning.onset, 'inmet_warnings_cache_onset_invalid');
  const expiresMs = epochMs(warning.expires, 'inmet_warnings_cache_expires_invalid');
  if (expiresMs <= onsetMs || expiresMs - onsetMs > 7 * 24 * 60 * 60 * 1000) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_temporal_window_invalid');
  }
  if (!Number.isFinite(sentMs)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_sent_invalid');
  }

  if (!Number.isInteger(warning.areaCount) || warning.areaCount < 1 || warning.areaCount > 64) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_area_count_invalid');
  }
  if (!Array.isArray(warning.areaDescriptions)
      || warning.areaDescriptions.length !== warning.areaCount) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_area_descriptions_invalid');
  }
  for (const area of warning.areaDescriptions) {
    validateText(area, { max: 16_384, code: 'inmet_warnings_cache_area_description_invalid' });
  }

  if (!Array.isArray(warning.rjMunicipalityIbges)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_rj_municipalities_invalid');
  }
  const seenIbges = new Set();
  for (const ibge of warning.rjMunicipalityIbges) {
    if (!/^33\d{5}$/.test(ibge || '') || !findRjMunicipality(ibge)) {
      throw new InmetWarningsCacheError('inmet_warnings_cache_rj_municipality_untrusted');
    }
    if (seenIbges.has(ibge)) {
      throw new InmetWarningsCacheError('inmet_warnings_cache_duplicate_rj_municipality');
    }
    seenIbges.add(ibge);
  }

  if (warning.rjMatchMethod !== null && !RJ_MATCH_METHODS.has(warning.rjMatchMethod)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_rj_match_method_invalid');
  }
  if (warning.affectsRioDeJaneiro !== Boolean(warning.rjMatchMethod)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_rj_scope_mismatch');
  }
  if (warning.rjMunicipalityIbges.length > 0 && warning.rjMatchMethod !== 'CAP_GEOCODE_IBGE_33') {
    throw new InmetWarningsCacheError('inmet_warnings_cache_rj_municipality_scope_mismatch');
  }
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_invalid_snapshot');
  }
  if (snapshot.sourceId !== INMET_SOURCE_ID
      || snapshot.sourceHost !== INMET_HOST
      || snapshot.sourceUrl !== INMET_CAP_RSS_URL) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_source_contract_invalid');
  }
  if (!['CAP_ALERT', 'RSS_ITEM', 'ATOM_ENTRY'].includes(snapshot.feedShape)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_feed_shape_invalid');
  }
  if (!Number.isInteger(snapshot.activeWarningCount)
      || snapshot.activeWarningCount < 1
      || snapshot.activeWarningCount > INMET_MAX_WARNING_RECORDS) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_count_invalid');
  }
  if (!Array.isArray(snapshot.warnings) || snapshot.warnings.length !== snapshot.activeWarningCount) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_inventory_invalid');
  }
  if (!Number.isInteger(snapshot.rjWarningCount)
      || snapshot.rjWarningCount < 0
      || snapshot.rjWarningCount > snapshot.activeWarningCount
      || !Array.isArray(snapshot.rjWarnings)
      || snapshot.rjWarnings.length !== snapshot.rjWarningCount) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_rj_inventory_invalid');
  }
  if (snapshot.identityValidation !== 'INMET_SENDER_DOMAIN+OFFICIAL_OID_PREFIX'
      || snapshot.temporalValidityValidation !== 'BOUNDED_CAP_ONSET_EXPIRES_MAX_7D'
      || snapshot.rjGeofenceValidation !== 'CAP_CANONICAL_IBGE33_OR_BR_RJ_OR_AREA_DESC'
      || snapshot.polygonRetention !== 'NONE'
      || snapshot.rawFeedRetention !== 'NONE') {
    throw new InmetWarningsCacheError('inmet_warnings_cache_semantic_contract_drift');
  }
  if (serializedSize(snapshot) > INMET_WARNINGS_MAX_SNAPSHOT_BYTES) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_snapshot_too_large');
  }

  const seenIdentifiers = new Set();
  for (const warning of snapshot.warnings) validateWarning(warning, seenIdentifiers);

  const expectedRjIdentifiers = snapshot.warnings
    .filter((warning) => warning.affectsRioDeJaneiro)
    .map((warning) => warning.identifier);
  const actualRjIdentifiers = snapshot.rjWarnings.map((warning) => warning?.identifier);
  if (expectedRjIdentifiers.length !== snapshot.rjWarningCount
      || JSON.stringify(expectedRjIdentifiers) !== JSON.stringify(actualRjIdentifiers)) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_rj_inventory_mismatch');
  }

  if (!/^[0-9a-f]{64}$/.test(snapshot.warningInventorySha256 || '')
      || digestWarnings(snapshot.warnings) !== snapshot.warningInventorySha256) {
    throw new InmetWarningsCacheError('inmet_warnings_cache_digest_invalid');
  }
}

export function createInmetCapWarningsCache({ now = () => Date.now() } = {}) {
  if (typeof now !== 'function') throw new InmetWarningsCacheError('inmet_warnings_cache_invalid_clock');

  let entry = null;
  let lastAttemptAtMs = null;
  let lastErrorCode = null;

  function recordSuccess(snapshot, { fetchedAt = now() } = {}) {
    const currentMs = epochMs(now(), 'inmet_warnings_cache_clock_invalid');
    const fetchedAtMs = epochMs(fetchedAt, 'inmet_warnings_cache_fetched_at_invalid');
    if (fetchedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new InmetWarningsCacheError('inmet_warnings_cache_future_fetch');
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
    const currentMs = epochMs(now(), 'inmet_warnings_cache_clock_invalid');
    const attemptedAtMs = epochMs(attemptedAt, 'inmet_warnings_cache_attempted_at_invalid');
    if (attemptedAtMs > currentMs + OFFICIAL_SOURCE_MAX_FUTURE_SKEW_MS) {
      throw new InmetWarningsCacheError('inmet_warnings_cache_future_attempt');
    }
    lastAttemptAtMs = attemptedAtMs;
    lastErrorCode = validateErrorCode(code);
  }

  function read({ at = now(), mode = 'normal' } = {}) {
    const atMs = epochMs(at, 'inmet_warnings_cache_read_at_invalid');
    const refreshIntervalMs = refreshIntervalFor(mode);
    const nextRefreshDueAtMs = lastAttemptAtMs === null ? null : lastAttemptAtMs + refreshIntervalMs;
    const refreshDue = nextRefreshDueAtMs === null || atMs >= nextRefreshDueAtMs;
    const base = {
      sourceId: INMET_SOURCE_ID,
      mode,
      refreshIntervalMs,
      refreshDue,
      nextRefreshDueAt: nextRefreshDueAtMs === null ? null : new Date(nextRefreshDueAtMs).toISOString(),
      lastAttemptAt: lastAttemptAtMs === null ? null : new Date(lastAttemptAtMs).toISOString(),
      lastErrorCode,
      semanticValidity: INMET_WARNINGS_SEMANTIC_VALIDITY,
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
    if (cacheAgeMs > INMET_WARNINGS_MAX_CACHE_AGE_MS) {
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
      reason: failedAfterSnapshot ? 'latest_refresh_failed_using_current_cache' : 'fresh_cap_inventory',
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
