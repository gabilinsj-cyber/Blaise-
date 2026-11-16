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


/**
 * A Brazilian observation can only flag discrepancy: it NEVER becomes the
 * value used in a public result. The second candidate must be fetched from
 * an independent, licensed international product and have its OWN provenance.
 *
 * Keep the current product if independent evidence is missing, or return
 * UNAVAILABLE when the original is also invalid. Do not automatically trust
 * the most recently queried provider.
 */
export function arbitrateWithSecondInternationalSource({
  discrepancyFlag = false, comparisonPermissionConfirmed = false,
  current, alternative, now,
} = {}) {
  if (!validTime(now)) return Object.freeze({action: 'UNAVAILABLE', reason: 'INVALID_CLOCK'});
  // A restricted Brazilian reading cannot trigger derived commercial decisions
  // without a confirmed comparison right, even when the reading is transient.
  if (discrepancyFlag && !comparisonPermissionConfirmed) return Object.freeze({action:'UNAVAILABLE',reason:'COMPARISON_NOT_AUTHORIZED'});
  const valid = row => row && permitPublicInternationalValue({...row, now}) &&
    typeof row.phenomenon === 'string' && row.phenomenon.length > 0 &&
    typeof row.unit === 'string' && row.unit.length > 0 &&
    typeof row.scopeId === 'string' && row.scopeId.length > 0 &&
    typeof row.qualityScore === 'number' && Number.isFinite(row.qualityScore) &&
    row.qualityScore >= 0 && row.qualityScore <= 1;
  const firstValid=valid(current);
  if (!discrepancyFlag) return Object.freeze({
    action: firstValid ? 'KEEP_PRIMARY' : 'UNAVAILABLE',
    reason: 'NO_AUTHORIZED_DISCREPANCY',
  });
  if (!valid(alternative)) return Object.freeze({
    action: firstValid ? 'KEEP_PRIMARY_RECHECK_PENDING' : 'UNAVAILABLE',
    reason: 'SECOND_INTERNATIONAL_SOURCE_UNAVAILABLE',
  });
  if (firstValid && (
    current.sourceId === alternative.sourceId ||
    current.scopeId !== alternative.scopeId ||
    current.phenomenon !== alternative.phenomenon ||
    current.unit !== alternative.unit ||
    current.type !== alternative.type
  )) return Object.freeze({action:'KEEP_PRIMARY_RECHECK_PENDING',reason:'NON_COMPARABLE_INTERNATIONAL_PRODUCTS'});
  if (!alternative.independentProviderEvidence ||
      !alternative.verifiedOwnObservationTime) return Object.freeze({
    action: firstValid ? 'KEEP_PRIMARY_RECHECK_PENDING' : 'UNAVAILABLE',
    reason: 'INDEPENDENCE_OR_TIME_NOT_VERIFIED',
  });
  if (firstValid && alternative.qualityScore <= current.qualityScore)
    return Object.freeze({action:'KEEP_PRIMARY_RECHECK_PENDING',reason:'NO_VERIFIED_QUALITY_IMPROVEMENT'});
  return Object.freeze({
    action: 'REPLACE_WITH_SECOND_INTERNATIONAL',
    sourceId: alternative.sourceId,
    displayType: alternative.type,
    reason: firstValid ? 'HIGHER_VERIFIED_QUALITY' : 'PRIMARY_INVALID_SECOND_VALID',
  });
}

/** Public safety alerts are intentionally separate from weather measurements. */
export const OFFICIAL_PUBLIC_ALERT_SOURCES = Object.freeze({
  INMET: Object.freeze({hosts:['avisos.inmet.gov.br','portal.inmet.gov.br','apiprevmet3.inmet.gov.br'], permitLinkOnly:true}),
  ALERTA_RIO: Object.freeze({hosts:['sistema-alerta-rio.com.br','www.sistema-alerta-rio.com.br'], permitLinkOnly:true}),
  COR_RIO: Object.freeze({hosts:['cor.rio','www.cor.rio'], permitLinkOnly:true}),
  DEFESA_CIVIL_RJ: Object.freeze({hosts:['defesacivil.rj.gov.br','www.defesacivil.rj.gov.br'], permitLinkOnly:true}),
});

/**
 * A public notice must be an authentic, active notice with verifiable issuance,
 * source, geographic extent and permission for publication in a commercial
 * third-party app. Otherwise the only public presentation is a verified link
 * to the original authority; never copy restricted notice text.
 *
 * IMPORTANT: no direct fetch, scraping, scheduling, or artificial P0 here.
 */
export function assessOfficialPublicAlert({
  sourceId, officialUrl, id, event, severity, issuedAt, expiresAt, checkedAt,
  affectedMunicipalities, publiclyIssued = false,
  signatureOrTrustedFeedVerified = false,
  permissionToRepublish = false,
  withdrawn = false, now,
} = {}) {
  const source = OFFICIAL_PUBLIC_ALERT_SOURCES[sourceId];
  if (!source || !validTime(now)) return Object.freeze({action:'BLOCK', reason:'UNKNOWN_SOURCE_OR_CLOCK'});
  let url;
  try { url = new URL(officialUrl); } catch { return Object.freeze({action:'BLOCK', reason:'INVALID_URL'}); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.port || !source.hosts.includes(url.hostname)) {
    return Object.freeze({action:'BLOCK',reason:'UNVERIFIED_OFFICIAL_URL'});
  }
  if (!publiclyIssued || !signatureOrTrustedFeedVerified ||
      !validTime(issuedAt) || !validTime(expiresAt) || !validTime(checkedAt) ||
      !id || !event || typeof event !== 'string' || event.length > 120 ||
      typeof severity !== 'string' || severity.length === 0 || severity.length > 80 ||
      !Array.isArray(affectedMunicipalities) || affectedMunicipalities.length === 0 ||
      !affectedMunicipalities.every(code => Number.isInteger(code) && code >= 3300000 && code < 3400000)) {
    return Object.freeze({action:'BLOCK',reason:'OFFICIAL_PROVENANCE_OR_SCOPE_MISSING'});
  }
  if (withdrawn || issuedAt > now || expiresAt <= now || expiresAt <= issuedAt)
    return Object.freeze({action:'BLOCK',reason:'WITHDRAWN_OR_NOT_ACTIVE'});
  if (checkedAt > now || now.getTime() - checkedAt.getTime() > 5 * 60_000)
    return Object.freeze({action:'BLOCK',reason:'OFFICIAL_FEED_NOT_RECENTLY_CHECKED'});
  if (!permissionToRepublish)
    return Object.freeze({action:'LINK_ONLY',sourceId,officialUrl:url.href,
      reason:'REPUBLICATION_RIGHTS_NOT_CONFIRMED'});
  return Object.freeze({action:'SHOW_OFFICIAL_ALERT',sourceId,officialUrl:url.href,
    issuedAt:issuedAt.toISOString(),expiresAt:expiresAt.toISOString(),
    checkedAt:checkedAt.toISOString(),event,severity,
    municipalityIbges:[...affectedMunicipalities],
    reason:'VERIFIED_AUTHORIZED_PUBLIC_ALERT'});
}
