/**
 * Blaise V6 RJ - policy for commercially licensed international weather data.
 *
 * No fetches, jobs, scheduled checks, or credential access occur in this module.
 * Brazilian official data is exclusively an internal, consent/licence-gated
 * comparison source and cannot directly produce public displayed values.
 *
 * Emergency warnings are not weather measurements and are subject to their own
 * official authorized relay channel; do not interfere with native Cell Broadcast.
 */
export const BRAZILIAN_REVIEW_INTERVAL_MS = 30 * 60_000;
export const BRAZILIAN_REVIEW_SOURCES = Object.freeze([
  'INMET', 'ALERTA_RIO', 'DEFESA_CIVIL_RJ',
]);
export const INTERNATIONAL_CANDIDATES = Object.freeze([
  'NOAA', 'EUMETSAT', 'JAXA_GSMAP', 'OPENWEATHER',
]);
export const EXCLUDED_PROVIDERS = Object.freeze([
  'INEA', 'MARINHA_BRASIL', 'WINDY', 'COPERNICUS',
]);

const validTime = value => value instanceof Date && !Number.isNaN(value.valueOf());

/**
 * Plan the next review without requesting any data.
 *
 * No authorization evidence -> always disabled. A successful authorization
 * only schedules a possible, non-public check on the isolated backend.
 */
export function planBrazilianInternalReview({
  sourceId, licenseAllowsInternalComparison = false,
  now, previousCheckAt = null,
} = {}) {
  if (!BRAZILIAN_REVIEW_SOURCES.includes(sourceId)) {
    return Object.freeze({allowed: false, reason: 'SOURCE_NOT_REVIEW_ONLY'});
  }
  if (!licenseAllowsInternalComparison) {
    return Object.freeze({allowed: false, reason: 'AUTHORIZATION_REQUIRED'});
  }
  if (!validTime(now) || (previousCheckAt !== null && !validTime(previousCheckAt))) {
    return Object.freeze({allowed: false, reason: 'INVALID_CLOCK'});
  }
  if (previousCheckAt && now.valueOf() - previousCheckAt.valueOf() < BRAZILIAN_REVIEW_INTERVAL_MS) {
    return Object.freeze({allowed: false, reason: 'THIRTY_MINUTE_INTERVAL'});
  }
  return Object.freeze({allowed: true, reason: 'INTERNAL_COMPARISON_ONLY'});
}

/** A change in an internal source can flag the international data for its OWN
 * fresh-source review, but cannot be used to synthesize or correct a value. */
export function internalDifferenceAction({permissionConfirmed = false, differenceFound = false} = {}) {
  if (!permissionConfirmed) return 'NO_COMPARISON_AUTHORIZED';
  if (!differenceFound) return 'NO_INTERNAL_REVIEW_TRIGGER';
  return 'RECHECK_INTERNATIONAL_PROVIDERS_INDEPENDENTLY';
}

/**
 * Gate the international product per explicit licence and provenance.
 * International origin alone never implies commercial rights or freshness.
 */
export function permitPublicInternationalValue({
  sourceId, productLicensedForCommercialApp = false,
  productAttributionSatisfied = false,
  type, displayedAs, observedAt, expiresAt,
  municipalityMatch = false, independentlyObtained = false,
  now,
} = {}) {
  if (!INTERNATIONAL_CANDIDATES.includes(sourceId)) return false;
  if (!productLicensedForCommercialApp || !productAttributionSatisfied) return false;
  if (!['OBSERVATION', 'FORECAST', 'MODEL'].includes(type)) return false;
  // Never label satellite/model estimates or forecasts as direct observations.
  if (displayedAs !== type) return false;
  if (!municipalityMatch || !independentlyObtained) return false;
  if (![observedAt, expiresAt, now].every(validTime)) return false;
  return observedAt <= now && now <= expiresAt;
}

/**
 * Logs only aggregate verification state. No official measurements, warning
 * texts, location traces, identifiers or secrets are persisted.
 */
export function privateVerificationAudit({sourceId, checkedAt, outcome} = {}) {
  if (!BRAZILIAN_REVIEW_SOURCES.includes(sourceId)) throw Error('SOURCE_NOT_ALLOWED');
  if (!validTime(checkedAt)) throw Error('INVALID_CLOCK');
  if (!['AVAILABLE', 'UNAVAILABLE', 'LICENSE_BLOCKED', 'DISCREPANCY_REVIEW'].includes(outcome))
    throw Error('INVALID_OUTCOME');
  return Object.freeze({sourceId, checkedAt: checkedAt.toISOString(), outcome});
}
