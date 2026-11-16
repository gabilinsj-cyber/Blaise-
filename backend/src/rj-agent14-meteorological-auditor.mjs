/**
 * Agent 14 — Blaise V6 RJ Meteorological Reference Auditor.
 *
 * POLICY ONLY. No network request, paid AI API call, scraping, service account
 * impersonation, Firestore write or production scheduler is performed here.
 * Agent 14 does not supply measurements; it checks independently obtained,
 * provenance-bearing inputs and selects ONLY from licensed international data.
 */
import {
  planBrazilianInternalReview,
  chooseFromThreeInternationalSources,
} from './rj-international-source-policy.mjs';

export const AGENT14 = Object.freeze({
  number: 14,
  id: 'blaise-agent14-inmet-reference-auditor',
  scope: 'PRIVATE_METEOROLOGICAL_COMPARISON',
  enabledInProduction: false,
  mayQueryAI: false,
  mayFetchInmet: false,
  mayFetchDefesaCivilMeteorology: false,
  maxInternationalSourcesPerReview: 3,
  brazilianReviewIntervalMinutes: 30,
  displayBrazilianMeasurements: false,
  nationalTemperatureReference: 'INMET_OWN_STATION_ONLY',
  publicSafetyLinksUnaffected: true,
  exclusions: Object.freeze(['ALERTA_RIO_METEOROLOGY','COR_RIO_METEOROLOGY']),
});

const validDate = date => date instanceof Date && Number.isFinite(date.valueOf());

/**
 * Optional *manual* GPT research question. Search is an information-finding
 * aid, never an instrument, station feed, or official observation.
 * Do NOT submit this to any API without separately approved key, cost
 * controls, user opt-in and an authorized integration.
 */
export function prepareAgent14GptResearchQuestion({
  municipality = 'Rio de Janeiro', localDate,
} = {}) {
  if (!/^[-\p{L}\s]{2,70}$/u.test(municipality) ||
      typeof localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(localDate))
    throw new Error('INVALID_RESEARCH_QUERY');
  return [
    'Pesquise fontes oficiais nacionais para a temperatura de hoje',
    `(${localDate}) em ${municipality}, RJ, Brasil.`,
    'Priorize somente observações de estações próprias do INMET.',
    'Informe URL oficial, ID/nome da estação, local exato, horário de coleta',
    'e se a fonte indica dado observado ou previsão.',
    'Não trate informação de parceiros do INMET como estação própria.',
    'Não invente medição e não faça inferência por proximidade de cidades.',
    'Não reproduza boletins; apresente apenas referências para conferência humana.',
    'Se não houver observação primária verificável, diga isso explicitamente.',
  ].join(' ');
}

/**
 * GPT/web search lead can only suggest a URL to inspect independently.
 * Any temperature in the AI answer is intentionally discarded.
 */
export function inspectAgent14AiLead({officialUrl} = {}) {
  let u;
  try { u = new URL(officialUrl); } catch {
    return Object.freeze({status:'REJECT',reason:'INVALID_URL'});
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port ||
      !['portal.inmet.gov.br','tempo.inmet.gov.br','mapas.inmet.gov.br']
        .includes(u.hostname)) {
    return Object.freeze({status:'REJECT',reason:'NOT_INMET_PRIMARY_SOURCE'});
  }
  return Object.freeze({status:'REVIEW_URL_ONLY',officialUrl:u.href,
    reason:'VERIFY_PRIMARY_STATION_INDEPENDENTLY'});
}

/**
 * Public INMET portal availability is NOT equivalent to a validated licence
 * for ranking data in a commercial app. Do not use the reading for arbitration
 * until explicit comparison/derivative use rights are confirmed.
 * Defesa Civil emergency bulletins are not temperature readings.
 * INMET mapped partner stations (including Alerta Rio) are excluded.
 */
// Conservative physics guards catch INMET missing-sensor markers (9999/null),
// implausible units and unverified station-to-city associations. Source-specific
// calibration and quality flags must additionally be checked upstream.
const INMET_REFERENCE_BOUNDS = Object.freeze({
  temperatureC: Object.freeze({unit:'°C',min:-60,max:65}),
  thermalSensationC: Object.freeze({unit:'°C',min:-80,max:80}),
  windKmh: Object.freeze({unit:'km/h',min:0,max:400}),
  rainMm: Object.freeze({unit:'mm',min:0,max:1200}),
  humidityPct: Object.freeze({unit:'%',min:0,max:100}),
  pressureHpa: Object.freeze({unit:'hPa',min:800,max:1100}),
});

export function validateAgent14BrazilianReference({
  record, comparisonUseLicensed = false, now,
} = {}) {
  if (!record || !validDate(now)) return null;
  const bounds=INMET_REFERENCE_BOUNDS[record.phenomenon];
  if (!bounds || record.unit !== bounds.unit ||
      typeof record.value !== 'number' ||
      record.value < bounds.min || record.value > bounds.max ||
      record.value === 9999 || !/^33\d{5}$/.test(String(record.scopeId)) ||
      typeof record.stationId !== 'string' || record.stationId.length < 2)
    return null;
  if (record.sourceId !== 'INMET' || record.stationOwner !== 'INMET' ||
      record.containsPartnerData === true || record.aiGenerated === true ||
      !record.authenticatedPrimaryStation || !comparisonUseLicensed ||
      !Number.isFinite(record.value) || !validDate(record.observedAt) ||
      !record.scopeId || typeof record.phenomenon !== 'string' ||
      typeof record.unit !== 'string' ||
      record.observedAt > now || now.valueOf()-record.observedAt.valueOf()>90*60_000)
    return null;
  // Intentional ephemeral reference: only sanitized fields enter arithmetic.
  return Object.freeze({
    value: record.value,
    phenomenon: record.phenomenon,
    unit: record.unit,
    scopeId: record.scopeId,
    observedAt: record.observedAt,
  });
}

/**
 * Pure decision. No network calls or data persistence. We never return the
 * Brazilian reference or an AI numeric answer to the app.
 */
export function evaluateAgent14({
  candidates = [], inmetRecord = null, comparisonUseLicensed = false,
  thirdAttempted = false, now,
} = {}) {
  const reference = validateAgent14BrazilianReference({
    record: inmetRecord, comparisonUseLicensed, now,
  });
  const selected = chooseFromThreeInternationalSources({
    candidates, brazilianReference: reference,
    comparisonPermissionConfirmed: reference !== null,
    thirdAttempted, now,
  });
  return Object.freeze({
    agentId: AGENT14.id,
    decision: selected,
    referenceMode: reference === null
      ? 'INTERNATIONAL_CONSENSUS_OR_QUALITY'
      : 'INMET_PRIMARY_COMPARISON_PERMITTED',
    gptMode: 'RESEARCH_POINTER_ONLY_NOT_USED_AS_MEASUREMENT',
    writesToProduction: false,
  });
}

/** Without an active valid international source, display the prior verified
 * value only as EXPIRED/HISTORICAL with timestamp (not real-time), or show
 * no current observation. Never emit a fake numerical temperature. */
export function continuityOfService({decision, lastVerified, now} = {}) {
  if (decision?.action === 'PUBLISH_VALID_INTERNATIONAL')
    return Object.freeze({status:'CURRENT',publication:decision});
  if (decision?.action === 'REQUEST_THIRD_INTERNATIONAL_SOURCE')
    return Object.freeze({status:'RECHECKING_THIRD',provisionalSourceId:decision.provisionalSourceId});
  if (lastVerified && validDate(now) && validDate(lastVerified.observedAt) &&
      typeof lastVerified.value === 'number' && Number.isFinite(lastVerified.value) &&
      typeof lastVerified.sourceId === 'string' && lastVerified.sourceId.length>0 &&
      lastVerified.observedAt <= now) {
    return Object.freeze({status:'HISTORICAL_NOT_CURRENT',
      value:lastVerified.value, sourceId:lastVerified.sourceId,
      observedAt:lastVerified.observedAt.toISOString()});
  }
  return Object.freeze({status:'CURRENT_DATA_NOT_CONFIRMED'});
}

/** 30 minute planning for INMET only. Defesa Civil is the separate alert
 * channel, not a temperature station. This module initiates no external call.
 */
export function planAgent14PrimaryReference({
  now, previousCheckAt, comparisonUseLicensed = false,
} = {}) {
  return planBrazilianInternalReview({
    sourceId:'INMET',licenseAllowsInternalComparison:comparisonUseLicensed,
    now,previousCheckAt,
  });
}
