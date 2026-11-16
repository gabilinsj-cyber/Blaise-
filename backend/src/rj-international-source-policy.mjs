/**
 * Blaise V6 RJ - policy for commercially licensed international weather data.
 *
 * No fetches, jobs, scheduled checks, or credential access occur in this module.
 * INMET-owned station data is an internal, license-gated comparison source;
 * Defesa Civil RJ is alert-context only, never a thermometer and cannot directly produce public displayed values.
 *
 * Emergency warnings are not weather measurements and are subject to their own
 * official authorized relay channel; do not interfere with native Cell Broadcast.
 */
export const BRAZILIAN_REVIEW_INTERVAL_MS = 30 * 60_000;
export const BRAZILIAN_REVIEW_SOURCES = Object.freeze([
  'INMET', 'DEFESA_CIVIL_RJ',
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
  // Revised rule: NEVER republish any issuer text, risk level 1–5 or
  // severity in the Blaise client, even if broader rights are granted.
  // Show only a neutral sentence with a link to the source authority.
  return Object.freeze({
    action:'LINK_ONLY', sourceId, officialUrl:url.href,
    phrase:'Aviso público oficial: consulte o comunicado na página da autoridade.',
    reason:'VERIFIED_OFFICIAL_LINK_ONLY',
  });
}


/**
 * Public-facing arbitration of up to 3 independently fetched international
 * products. Brazilian measurements are reference-only, transient, and used
 * to rank sources ONLY with separately confirmed comparison/derivative rights.
 * We never return, persist or display the Brazilian reference itself.
 *
 * All products must have the same phenomenon, unit, geographic footprint,
 * observation/model type, and comparable valid times. Weather models and
 * observations are never combined. With three international sources and no
 * permitted Brazilian reference, prefer the international consensus (medoid).
 * Disagreement alone never suppresses an otherwise valid international value.
 */
export function chooseFromThreeInternationalSources({
  candidates = [], brazilianReference = null,
  comparisonPermissionConfirmed = false, thirdAttempted = false, now,
} = {}) {
  if (!validTime(now) || !Array.isArray(candidates) || candidates.length > 3)
    return Object.freeze({action:'UNAVAILABLE',reason:'INVALID_INPUT'});
  const eligible=candidates.filter(row=>row &&
    permitPublicInternationalValue({...row,now}) &&
    typeof row.value === 'number' && Number.isFinite(row.value) &&
    typeof row.scopeId === 'string' && row.scopeId.length > 0 &&
    typeof row.phenomenon === 'string' && row.phenomenon.length > 0 &&
    typeof row.unit === 'string' && row.unit.length > 0 &&
    typeof row.qualityScore === 'number' && Number.isFinite(row.qualityScore) &&
    row.qualityScore >= 0 && row.qualityScore <= 1 &&
    row.independentProviderEvidence === true &&
    row.verifiedOwnObservationTime === true);
  if (!eligible.length)
    return Object.freeze({action:'UNAVAILABLE',reason:'NO_VALID_INTERNATIONAL_SOURCE'});
  const first=eligible[0];
  const comparable=eligible.filter(row =>
    row.scopeId === first.scopeId && row.phenomenon === first.phenomenon &&
    row.unit === first.unit && row.type === first.type &&
    row.displayedAs === first.displayedAs &&
    Math.abs(row.observedAt.valueOf()-first.observedAt.valueOf()) <= 15*60_000);
  const unique=[...new Map(comparable.map(row=>[row.sourceId,row])).values()];
  if (!unique.length) return Object.freeze({action:'UNAVAILABLE',reason:'INCOMPARABLE_SOURCES'});
  const sourceCount=unique.length;
  // A third source is required only when two independent, comparable products
  // disagree beyond their scientifically declared, dimension-specific tolerance.
  if (!thirdAttempted && sourceCount===2 &&
      Math.abs(unique[0].value-unique[1].value) >
        Math.max(...unique.map(row =>
          typeof row.comparisonTolerance === 'number' &&
          Number.isFinite(row.comparisonTolerance) && row.comparisonTolerance >= 0
            ? row.comparisonTolerance : 0))) {
    const preferred=[...unique].sort((a,b)=>b.qualityScore-a.qualityScore)[0];
    return Object.freeze({
      action:'REQUEST_THIRD_INTERNATIONAL_SOURCE',
      provisionalSourceId:preferred.sourceId,
      provisionalValue:preferred.value,
      unit:preferred.unit,phenomenon:preferred.phenomenon,
      displayType:preferred.type,
      reason:'TWO_INTERNATIONAL_PRODUCTS_DIVERGE',
    });
  }
  // If the third provider could not deliver a qualified product, reselect
  // the best valid international source instead of looping or hiding readings.
  let strategy='INTERNATIONAL_QUALITY';
  let chosen;
  const referenceReady = comparisonPermissionConfirmed && brazilianReference &&
    typeof brazilianReference.value === 'number' &&
    Number.isFinite(brazilianReference.value) &&
    brazilianReference.unit === first.unit &&
    brazilianReference.phenomenon === first.phenomenon &&
    brazilianReference.scopeId === first.scopeId &&
    validTime(brazilianReference.observedAt) &&
    Math.abs(brazilianReference.observedAt.valueOf()-first.observedAt.valueOf())<=15*60_000;
  if (referenceReady && sourceCount >= 2) {
    // All candidates remain independently licensed international values.
    strategy='CLOSEST_TO_PERMITTED_BRAZILIAN_REFERENCE';
    chosen=[...unique].sort((a,b) =>
      Math.abs(a.value-brazilianReference.value) - Math.abs(b.value-brazilianReference.value) ||
      b.qualityScore-a.qualityScore)[0];
  } else if (sourceCount>=3) {
    // Robust medoid: smallest total distance to other international products.
    strategy='INTERNATIONAL_CONSENSUS';
    chosen=[...unique].sort((a,b)=>{
      const da=unique.reduce((sum,v)=>sum+Math.abs(a.value-v.value),0);
      const db=unique.reduce((sum,v)=>sum+Math.abs(b.value-v.value),0);
      return da-db || b.qualityScore-a.qualityScore;
    })[0];
  } else {
    chosen=[...unique].sort((a,b)=>b.qualityScore-a.qualityScore)[0];
  }
  return Object.freeze({
    action:'PUBLISH_VALID_INTERNATIONAL',
    sourceId:chosen.sourceId,value:chosen.value,
    unit:chosen.unit,phenomenon:chosen.phenomenon,
    scopeId:chosen.scopeId,displayType:chosen.type,
    observedAt:chosen.observedAt.toISOString(),
    validUntil:chosen.expiresAt.toISOString(),
    strategy,
  });
}
