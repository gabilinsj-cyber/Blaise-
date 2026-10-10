import { buildStatewideDashboardSnapshot } from './statewide-dashboard.mjs';

export const RJ_PUBLIC_STATUS_PATH = '/v1/public/rj-status';
export const RJ_PUBLIC_STATUS_CONTRACT = 'BLAISE_RJ_PUBLIC_OFFICIAL_STATUS_V1';
export const RJ_PUBLIC_STATUS_MAX_BYTES = 80 * 1024;

// Public safety notices are not tied to purchases. Source/content publication
// must still be explicitly approved by the operator for its licensing terms.
// No full provider payload, subscriber/purchase token or personal location.
export function buildRjPublicStatusSnapshot(worker, { nowMillis = Date.now() } = {}) {
  if(!worker || typeof worker.status !== 'function'
    || typeof worker.readSource !== 'function') throw new TypeError('rj_public_worker_invalid');
  if(!Number.isFinite(nowMillis)||nowMillis<0) throw new TypeError('rj_public_clock_invalid');
  const source=buildStatewideDashboardSnapshot(worker,{nowMillis});
  if(!source.workerActive) return null;
  const permittedSourceIds=['inmet','cemaden-rj'];
  const sourceSummaries=source.sources
    .filter(s=>permittedSourceIds.includes(s.id))
    .map(s=>Object.freeze({
      id:s.id,name:s.name,state:s.state,
      connectedProduct:s.connectedProduct,scope:s.scope,
    }));
  const active=sourceSummaries.some(s=>['CURRENT','CURRENT_DEGRADED'].includes(s.state));
  const municipalities=source.municipalities.map(row=>Object.freeze({
    ibge:row.ibge,name:row.name,seaFacing:row.seaFacing,
    risk:row.hydrologicalRisk?.level!=null&&
      ['CURRENT','CURRENT_DEGRADED'].includes(row.hydrologicalRisk.state)
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
    sources:Object.freeze(sourceSummaries),
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
export function createRjPublicStatusHandler(delegate, {
  sourceWorker,enabled=false,licensingApproved=false,clock=()=>Date.now(),
}={}) {
  if(typeof delegate!=='function')throw new TypeError('rj_public_delegate_required');
  if(!sourceWorker || typeof sourceWorker.status!=='function'
    || typeof sourceWorker.readSource!=='function')throw new TypeError('rj_public_worker_required');
  if(typeof clock!=='function')throw new TypeError('rj_public_clock_required');
  return async (req,res)=>{
    const path=req.url?.split('?',1)[0];
    if(path!==RJ_PUBLIC_STATUS_PATH || !enabled || !licensingApproved)
      return delegate(req,res);
    if(req.method!=='GET') {
      respond(res,405,{error:'method_not_allowed'});return;
    }
    try {
      const status=buildRjPublicStatusSnapshot(sourceWorker,{nowMillis:clock()});
      if(!status || !status.usableOfficialProducts) {
        respond(res,503,{error:'official_sources_not_validated'});return;
      }
      respond(res,200,status);
    }catch(_){
      respond(res,503,{error:'official_sources_unavailable'});
    }
  };
}
