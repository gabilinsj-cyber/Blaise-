/**
 * Read-only operational evidence for Blaise V6 RJ continuous meteorological
 * collection. This is deliberately NOT a source-republication endpoint.
 *
 * Only the live worker's scheduler and redacted cache metadata count as
 * evidence; a configured flag or successful CI test never proves ingestion.
 */
import {
  RJ_METEO_HOMOLOGATION_ID,
  RJ_METEO_HOMOLOGATION_VERSION,
  RJ_METEO_TABLE2,
  buildRjMeteorologicalHomologationTables,
} from './rj-meteorological-homologation.mjs';

export const RJ_SOURCE_READINESS_PATH = '/v1/internal/rj-sources/readiness';
export const RJ_SOURCE_READINESS_CONTRACT = 'BLAISE_RJ_SOURCE_LIVE_READINESS_V1';
const STATES = new Set(['CURRENT','CURRENT_DEGRADED']);

function parseAt(iso) {
  const date = typeof iso === 'string' ? Date.parse(iso) : NaN;
  return Number.isFinite(date) ? date : null;
}
function normalizeSource(entry,nowMillis) {
  const collectedAt=parseAt(entry?.fetchedAt);
  const observedAt=parseAt(entry?.observedAt);
  const ageMs=collectedAt===null ? null : nowMillis-collectedAt;
  const sourceFresh=collectedAt!==null && ageMs>=0 && ageMs<=15*60_000
    && STATES.has(entry.state);
  return Object.freeze({
    sourceId:String(entry?.sourceId||'unknown').slice(0,70),
    state:typeof entry?.state==='string'?entry.state:'UNAVAILABLE',
    fresh:sourceFresh,
    lastFetchAt:collectedAt===null?null:new Date(collectedAt).toISOString(),
    lastObservationAt:observedAt===null?null:new Date(observedAt).toISOString(),
    cacheAgeSeconds:ageMs===null?null:Math.round(ageMs/1000),
    lastErrorCode:typeof entry?.lastErrorCode==='string'
      ?entry.lastErrorCode.slice(0,70):null,
    dataPayloadIncluded:false,
  });
}
export function buildRjSourceReadiness(worker,{nowMillis=Date.now()}={}) {
  if(!worker||typeof worker.status!=='function')throw TypeError('source_worker_required');
  if(!Number.isFinite(nowMillis)||nowMillis<0)throw TypeError('invalid_readiness_clock');
  const info=worker.status();
  const enabled=info?.enabled===true;
  const started=info?.started===true;
  const scheduler=info?.scheduler;
  const tasks=Array.isArray(scheduler?.tasks)?scheduler.tasks:[];
  const reports=Array.isArray(info?.sources)?info.sources.map(e=>normalizeSource(e,nowMillis)):[];
  const completed=tasks.filter(t=>t?.lastOutcome==='SUCCESS'
    &&Number.isInteger(t?.runCount)&&t.runCount>=1);
  const sourceFresh=reports.filter(s=>s.fresh);
  const live=enabled&&started&&completed.length>=1&&sourceFresh.length>=1;
  return Object.freeze({
    contract:RJ_SOURCE_READINESS_CONTRACT,
    checkedAt:new Date(nowMillis).toISOString(),
    collectionState:!enabled?'DISABLED_BY_CONFIGURATION':
      !started?'NOT_STARTED':
      live?'LIVE_SOURCES_WITH_FRESH_VALIDATED_DATA':'NO_FRESH_VALIDATED_SOURCE_EVIDENCE',
    workerEnabled:enabled,
    schedulerStarted:started,
    cadenceMode:scheduler?.mode??null,
    schedulerRefreshMs:Number.isFinite(scheduler?.refreshIntervalMs)?
      scheduler.refreshIntervalMs:null,
    sourceCount:reports.length,
    freshSourceCount:sourceFresh.length,
    taskCount:tasks.length,
    completedSourceTaskCount:completed.length,
    sourceStates:Object.freeze(reports),
    tasks:Object.freeze(tasks.map(t=>Object.freeze({
      taskId:String(t.taskId??'unknown').slice(0,70),
      lastOutcome:String(t.lastOutcome??'NOT_RUN').slice(0,30),
      runCount:Number.isInteger(t.runCount)?t.runCount:0,
      lastFinishedAt:parseAt(t.lastFinishedAt)===null?null:t.lastFinishedAt,
      lastErrorCode:typeof t.lastErrorCode==='string'?t.lastErrorCode.slice(0,70):null,
    }))),
    radarSpatialFrameReady:false,
    inpeApiReady:false,
    windyLicensedModelApiReady:false,
    continuousUptimeProven:false, // require external Cloud Run/Cloud Monitoring SLO
    sourceLicensingProven:false, // source-product authorization is separate
    homologationRegister:Object.freeze({
      id:RJ_METEO_HOMOLOGATION_ID,
      version:RJ_METEO_HOMOLOGATION_VERSION,
      registeredPhenomena:buildRjMeteorologicalHomologationTables().table1.length,
      documentedDisputeStages:RJ_METEO_TABLE2.length,
      sourceProductsVerifiedForCommercialUse:false,
      allThirtyPhenomenaLive:false,
      openWeatherMapLiveProof:false,
      copernicusMarineLiveProof:false,
      eumetsatSatelliteLiveProof:false,
      type:'CATALOG_PLUS_READ_ONLY_SOURCE_STATUS_NOT_PRODUCTION_LICENSE',
      liveSourceTasksWithRecentData:sourceFresh.length,
    }),
    thirdPartyDataIncluded:false,
    purchaseTokenIncluded:false,
  });
}
function writeJson(res,code,object) {
  res.statusCode=code;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(object));
}
export function createRjSourceReadinessHandler(delegate,{
  worker,verifyOperatorOidc=null,clock=()=>Date.now(),
}={}) {
  if(typeof delegate!=='function'||!worker||typeof worker.status!=='function'
    ||typeof clock!=='function')throw TypeError('invalid_source_readiness_handler');
  return async (req,res)=>{
    if(req.url?.split('?',1)[0]!==RJ_SOURCE_READINESS_PATH)
      return delegate(req,res);
    if(req.method!=='GET') {
      writeJson(res,405,{error:'method_not_allowed'});return;
    }
    // Never allow anonymous access to infrastructure operating details.
    if(typeof verifyOperatorOidc!=='function') {
      writeJson(res,503,{error:'operator_identity_not_configured'});return;
    }
    let permitted=false;
    try { permitted=await verifyOperatorOidc(req.headers?.authorization); }
    catch { permitted=false; }
    if(permitted!==true) {
      writeJson(res,403,{error:'not_authorized'});return;
    }
    try {
      const report=buildRjSourceReadiness(worker,{nowMillis:clock()});
      const ready=report.collectionState==='LIVE_SOURCES_WITH_FRESH_VALIDATED_DATA';
      writeJson(res,ready?200:503,report);
    } catch {
      writeJson(res,503,{error:'source_readiness_unavailable'});
    }
  };
}
