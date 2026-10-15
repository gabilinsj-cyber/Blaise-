import { INMET_WIS2_URL } from './inmet-wis2-source.mjs';
import { rjAlertIsActive } from './rj-alert-retention.mjs';
import { buildStatewideDashboardSnapshot } from './statewide-dashboard.mjs';
import { CHM_WARNINGS_TASK_ID, INMET_WARNINGS_TASK_ID } from './official-source-worker.mjs';
import { CHM_SOURCE_ID, CHM_WARNINGS_URL, CHM_TEMPORAL_VALIDITY_CONTRACT } from './chm-source.mjs';
import { INMET_SOURCE_ID, INMET_CAP_RSS_URL } from './inmet-source.mjs';

export const RJ_PUBLIC_STATUS_PATH = '/v1/public/rj-status';
export const RJ_PUBLIC_STATUS_CONTRACT = 'BLAISE_RJ_PUBLIC_OFFICIAL_STATUS_V1';
export const RJ_PUBLIC_STATUS_MAX_BYTES = 80 * 1024;

const MARINE_FRESH_MS = 5 * 60_000;
const MARINE_MAX_WARNINGS = 16;
/** Proven complete collection, not a missing/partial HTTP response. */
export function projectWarningInventories(worker, nowMillis) {
  return [[INMET_WARNINGS_TASK_ID, 'inmet', INMET_SOURCE_ID, INMET_CAP_RSS_URL],
    [CHM_WARNINGS_TASK_ID, 'chm', CHM_SOURCE_ID, CHM_WARNINGS_URL]].flatMap(([task, sourceId, expectedId, sourceUrl]) => {
    let feed;
    try { feed = worker.readSource(task); } catch { return []; }
    const checked = Date.parse(feed?.fetchedAt), snapshot = feed?.snapshot;
    const wis2 = sourceId === 'inmet' && snapshot?.sourceUrl === INMET_WIS2_URL
      && snapshot.feedShape === 'WIS2_ARCHIVE_WINDOW_CAP' && snapshot.inventoryComplete === false;
    if (!(feed?.state === 'CURRENT' || wis2 && feed?.state === 'CURRENT_DEGRADED') || !Number.isFinite(checked) || checked > nowMillis || nowMillis - checked > 300_000 ||
        snapshot?.sourceId !== expectedId || snapshot.sourceUrl !== (wis2 ? INMET_WIS2_URL : sourceUrl) ||
        !Array.isArray(snapshot.warnings) || snapshot.warnings.length > 64) return [];
    if (sourceId === 'inmet' ?
        snapshot.identityValidation !== 'INMET_SENDER_DOMAIN+OFFICIAL_OID_PREFIX' ||
          snapshot.temporalValidityValidation !== 'BOUNDED_CAP_ONSET_EXPIRES_MAX_7D' ||
          snapshot.activeWarningCount !== snapshot.warnings.length :
        snapshot.temporalValidityValidation !== CHM_TEMPORAL_VALIDITY_CONTRACT) return [];
    const complete = !snapshot.localRetentionPruned && (sourceId === 'inmet'
      ? snapshot.feedShape === 'RSS_INDEX_RESOLVED_CAP'
      : snapshot.rawWarningTextRetention === 'NONE' && snapshot.activeWarningCount === snapshot.warnings.length);
    const keys = snapshot.warnings.map(w => `${sourceId === 'inmet' ? w.identifier : w.id}|${Date.parse(sourceId === 'inmet' ? w.sent : w.issuedAt)}`);
    if (keys.some(key => key.length > 330 || key.endsWith('|NaN'))) return [];
    const cancelledIds = sourceId === 'inmet' ? [...new Set((snapshot.cancellations ?? [])
      .filter(w => Date.parse(w.sent) <= nowMillis && w.msgType === 'Cancel')
      .flatMap(w => w.cancelledIdentifiers ?? []))].slice(0, 64) : [];
    return [{sourceId, sourceUrl: snapshot.sourceUrl, checkedAt: new Date(checked).toISOString(), complete, recordKeys: keys, cancelledIds}];
  });
}
/** Regional METAREA V is not a coastal municipality polygon. */
export function projectRjPublicMarineWarnings(worker, nowMillis) {
  let feed;
  try { feed=worker.readSource(CHM_WARNINGS_TASK_ID); }
  catch { return null; }
  if(!feed || !['CURRENT','CURRENT_DEGRADED'].includes(feed.state)
    || !feed.snapshot || feed.snapshot.sourceId!==CHM_SOURCE_ID
    || feed.snapshot.sourceUrl!==CHM_WARNINGS_URL) return null;
  const fetched=Date.parse(feed.fetchedAt);
  if(!Number.isFinite(fetched)||fetched>nowMillis||nowMillis-fetched>MARINE_FRESH_MS)
    return null;
  const warnings=feed.snapshot.warnings;
  if(!Array.isArray(warnings) || warnings.length>64)return null;
  const current=warnings.filter(w=>{
    const issued=Date.parse(w?.issuedAt),validUntil=Date.parse(w?.validUntil);
    return w?.rjRouting?.route==='RJ_MARINE_REGIONAL'
      && w.rjRouting.canExposeRjMarineWarning===true
      && w.rjRouting.canPromoteMunicipalityP0===false
      && Number.isFinite(issued)&&issued<=nowMillis
      && Number.isFinite(validUntil)&&rjAlertIsActive(w.issuedAt,w.validUntil,nowMillis)
      && typeof w.id==='string'&&/^\d{1,4}\/\d{4}$/.test(w.id)
      && typeof w.warningType==='string'&&w.warningType.length<=96
      && Array.isArray(w.rjRouting.directRjAreas);
  });
  if(current.length>MARINE_MAX_WARNINGS) return null;
  return Object.freeze({
    sourceId:CHM_SOURCE_ID,sourceUrl:CHM_WARNINGS_URL,
    fetchedAt:feed.fetchedAt,scope:'METAREA_V_RJ_REGIONAL_NOT_MUNICIPAL',
    warningCount:current.length,
    warnings:Object.freeze(current.map(w=>{
      const signal=w.rjRouting.marineSignal;
      const hasWave=signal?.explicitWaveHeight===true
        && Number.isFinite(signal.waveMinMeters)
        && Number.isFinite(signal.waveMaxMeters)
        && signal.waveMinMeters>0&&signal.waveMaxMeters<=30
        && signal.waveMinMeters<=signal.waveMaxMeters;
      return Object.freeze({
        id:w.id,warningType:w.warningType,issuedAt:w.issuedAt,
        validUntil:w.validUntil,
        areas:Object.freeze(w.rjRouting.directRjAreas.filter(area=>
          typeof area==='string'&&area.length<=48)),
        waveMinMeters:hasWave?signal.waveMinMeters:null,
        waveMaxMeters:hasWave?signal.waveMaxMeters:null,
        waveDirection:hasWave?signal.waveDirection:null,
        officialRessacaLabel:signal?.officialRessacaLabel===true,
        // The marine wave threshold is a contextual value, not an
        // independent coastal ressaca declaration or municipal warning.
        waveThresholdExceeded:hasWave?signal.waveHeightThresholdExceeded:null,
        municipalityGeofenceValidated:false,
        mayIssueMunicipalP0:false,
      });
    })),
    noWarningsDoesNotMeanSafe:true,municipalityGeofenceValidated:false,
  });
}


// Public safety notices are not tied to purchases. Source/content publication
// must still be explicitly approved by the operator for its licensing terms.
// No full provider payload, subscriber/purchase token or personal location.
export function buildRjPublicStatusSnapshot(worker, { nowMillis = Date.now() } = {}) {
  if(!worker || typeof worker.status !== 'function'
    || typeof worker.readSource !== 'function') throw new TypeError('rj_public_worker_invalid');
  if(!Number.isFinite(nowMillis)||nowMillis<0) throw new TypeError('rj_public_clock_invalid');
  const source=buildStatewideDashboardSnapshot(worker,{nowMillis});
  if(!source.workerActive) return null;
  const permittedSourceIds=['inmet','cemaden-rj','cemaden-national','redemet'];
  const sourceSummaries=source.sources
    .filter(s=>permittedSourceIds.includes(s.id))
    .map(s=>Object.freeze({
      id:s.id,name:s.name,state:s.state,
      connectedProduct:s.connectedProduct,scope:s.scope,
    }));
  // CHM's regional marine inventory can be the only live official product.
  // Do not hide a current permitted maritime bulletin merely because
  // INMET CAP and CEMADEN hydrological risk are momentarily unavailable.
  // A CHM inventory never becomes a municipal warning or a safe-sea claim.
  const marine=projectRjPublicMarineWarnings(worker,nowMillis);
  const active=sourceSummaries.some(s=>['CURRENT','CURRENT_DEGRADED'].includes(s.state))
    || marine!==null;
  const municipalities=source.municipalities.map(row=>Object.freeze({
    ibge:row.ibge,name:row.name,seaFacing:row.seaFacing,
    risk:row.hydrologicalRisk?.level!=null&&
      ['CURRENT','CURRENT_DEGRADED'].includes(row.hydrologicalRisk.state)
      &&Number.isFinite(Date.parse(row.hydrologicalRisk.observedAt))
      &&nowMillis-Date.parse(row.hydrologicalRisk.observedAt)>=0
      &&nowMillis-Date.parse(row.hydrologicalRisk.observedAt)<=300_000
      ? Object.freeze({
          level:row.hydrologicalRisk.level,
          label:row.hydrologicalRisk.label,
          observedAt:row.hydrologicalRisk.observedAt,
          sourceUrl:row.hydrologicalRisk.sourceUrl,
          sourceName:'CEMADEN-RJ / Defesa Civil RJ',
          geographicScope:'MUNICIPAL_RISK_BULLETIN_NOT_POINT_PRECIPITATION',
        }):null,
    warningIds:Object.freeze([...row.warningIds]),
    warningCoverage:row.warningCoverage,
  }));
  const warnings=source.warnings
    .filter(w=>w.attribution==='EXACT_IBGE'&&Array.isArray(w.municipalityIbges)
      &&w.municipalityIbges.length>0)
    .map(w=>Object.freeze({
      id:w.id,event:w.event,severity:w.severity,sent:w.sent,onset:w.onset,
      expires:w.expires,sourceName:'INMET',sourceUrl:w.sourceUrl,
      municipalityIbges:Object.freeze([...w.municipalityIbges]),
      attribution:'EXACT_IBGE',
    }));
  return Object.freeze({
    contract:RJ_PUBLIC_STATUS_CONTRACT,
    generatedAt:new Date(nowMillis).toISOString(),
    scope:'RJ_92_MUNICIPALITIES',
    workerActive:true,
    usableOfficialProducts:active,
    municipalities:Object.freeze(municipalities),
    warnings:Object.freeze(warnings),
    marine,
    nationalAlerts: source.nationalAlerts,
    aerodromeObservations: source.aerodromeObservations,
    sources:Object.freeze(sourceSummaries),
    warningInventories: Object.freeze(projectWarningInventories(worker, nowMillis)),
    thirdPartyImagesIncluded:false,
    subscriberDataIncluded:false,
    coverageNote:'Only specifically attributed and recent official records; absence of warning never means safety.',
  });
}

function headers(res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}
function respond(res,code,body) {
  const value=JSON.stringify(body);
  if(Buffer.byteLength(value,'utf8')>RJ_PUBLIC_STATUS_MAX_BYTES)
    throw new TypeError('rj_public_status_response_too_large');
  headers(res);
  res.statusCode=code;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(value);
}
export function restrictPublicProducts(worker, approved) {
  const allowed = new Set([
    ['inmetWarnings', 'inmet-cap-warnings'],
    ['cemadenNational', 'cemaden-national-open-alerts'],
    ['cemadenRjRisk', 'cemaden-rj-hydrological-risk'],
    ['redemet', 'redemet-rj-metar'],
    ['chm', 'chm-marine-warnings'],
  ].filter(([product]) => approved[product] === true).map(([, task]) => task));
  return {
    status: () => {
      const status = worker.status();
      return {...status, sources: (status.sources ?? []).filter(item => allowed.has(item.sourceId))};
    },
    readSource: task => allowed.has(task) ? worker.readSource(task) : null,
  };
}
export function createRjPublicStatusHandler(delegate, {
  sourceWorker,enabled=false,licensingApproved=false,productApprovals=null,clock=()=>Date.now(),
}={}) {
  if(typeof delegate!=='function')throw new TypeError('rj_public_delegate_required');
  if(!sourceWorker || typeof sourceWorker.status!=='function'
    || typeof sourceWorker.readSource!=='function')throw new TypeError('rj_public_worker_required');
  if(typeof clock!=='function')throw new TypeError('rj_public_clock_required');
  const publicationWorker = productApprovals === null ? sourceWorker : restrictPublicProducts(sourceWorker, productApprovals);
  const termsReady = productApprovals === null ? licensingApproved : Object.values(productApprovals).some(value => value === true);
  return async (req,res)=>{
    const path=req.url?.split('?',1)[0];
    if(path!==RJ_PUBLIC_STATUS_PATH) return delegate(req,res);
    if(!enabled || !termsReady) {
      respond(res,503,{error:!enabled?'official_status_not_enabled':'source_terms_not_approved'});
      return;
    }
    if(req.method!=='GET') {
      respond(res,405,{error:'method_not_allowed'});return;
    }
    try {
      const status=buildRjPublicStatusSnapshot(publicationWorker,{nowMillis:clock()});
      if(!status || !status.usableOfficialProducts) {
        respond(res,503,{error:'official_sources_not_validated'});return;
      }
      respond(res,200,status);
    }catch(_){
      respond(res,503,{error:'official_sources_unavailable'});
    }
  };
}
