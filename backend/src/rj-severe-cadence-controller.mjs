/**
 * Adaptive schedule decision for REAL, cached, source-attributed RJ severity
 * 4/5, entirely separate from alarm publication.
 *
 * Never re-fetches provider APIs itself; task scheduling is controlled by the
 * existing official-source scheduler's limits and vendor terms.
 */
import { buildStatewideDashboardSnapshot } from './statewide-dashboard.mjs';
import { evaluateRjScientificRiskSnapshot } from './rj-science-risk-engine.mjs';

export const RJ_SEVERE_CADENCE_CONTRACT='BLAISE_RJ_OFFICIAL_SOURCE_SEVERITY_CADENCE_V1';
export function createRjSevereCadenceController({
  worker,vector=null,now=()=>Date.now(),enabled=false,
  operatorSevereOverride=false,
}={}) {
  if(!worker||typeof worker.status!=='function'
      ||typeof worker.setMode!=='function'
      ||typeof worker.readSource!=='function'
      ||(vector!==null&&typeof vector.setSeverity!=='function')
      ||typeof now!=='function'||typeof enabled!=='boolean'
      ||typeof operatorSevereOverride!=='boolean')
    throw new TypeError('invalid_rj_severity_controller_dependencies');
  let highest=0,mode=null,lastError=null,reviewAt=null;
  let calls=0;
  function evaluate() {
    calls+=1;
    const nowMs=now();
    if(!Number.isFinite(nowMs))throw TypeError('rj_cadence_invalid_clock');
    if(!enabled)return Object.freeze({
      status:'DISABLED_BY_OPERATOR',mode:null,
      action:'NO_CHANGE',externalSourcePolling:false,
    });
    const snapshot=buildStatewideDashboardSnapshot(worker,{nowMillis:nowMs});
    const risk=evaluateRjScientificRiskSnapshot({sourceSnapshot:snapshot,nowMillis:nowMs});
    if(risk.state!=='EVALUATED_OFFICIAL_AND_EXPERIMENTAL_INPUTS') {
      lastError='NO_VALID_OFFICIAL_SCOPE';
      return Object.freeze({status:'PRESERVE_EXISTING_MODE_DURING_SOURCE_OUTAGE',
        mode,action:'NO_CHANGE',lastError,externalSourcePolling:false});
    }
    highest=Math.max(0,...risk.municipalities
      .map(row=>row.officialDisplayScale??0));
    const activeRisk=risk.municipalities.filter(row=>row.highPriority);
    const hasFreshRisk=risk.municipalities.some(row=>
      row.officialDisplayScale!==null);
    if(!hasFreshRisk){
      lastError='NO_CURRENT_SOURCE_RISK';
      return Object.freeze({status:'PRESERVE_EXISTING_MODE_DURING_SOURCE_OUTAGE',
        mode,action:'NO_CHANGE',lastError,externalSourcePolling:false});
    }
    const target=operatorSevereOverride||highest>=4?'severe':'normal';
    const previous=worker.status().mode;
    if(!['normal','severe'].includes(previous))
      return Object.freeze({status:'INVALID_WORKER_SCHEDULER_MODE',
        mode,action:'NO_CHANGE',externalSourcePolling:false});
    // Do not switch mode merely because a derived numerical quantity exceeds
    // an ad hoc threshold. Level comes from a current competent official
    // warning or risk product for a specific municipality.
    if(previous!==target)worker.setMode(target);
    vector?.setSeverity(target==='severe'?4:1);
    mode=target;
    lastError=null;
    reviewAt=new Date(nowMs).toISOString();
    return Object.freeze({
      contract:RJ_SEVERE_CADENCE_CONTRACT,
      status:'VERIFIED_SOURCE_DRIVEN_CADENCE',
      reviewAt,mode,highestCurrentOfficialScale:highest,
      highRiskMunicipalityCount:activeRisk.length,
      action:target!==previous?'MODE_SWITCHED':'NO_CHANGE',
      sourceRefreshTargetMs:target==='severe'?30_000:60_000,
      alertPublished:false,audioTriggered:false,
      calculatedOfficialAlert:false,
      sourceIntervalsSubjectToProviderLicense:true,
    });
  }
  return Object.freeze({
    evaluate,
    snapshot:()=>Object.freeze({
      contract:RJ_SEVERE_CADENCE_CONTRACT,enabled,mode,
      highestCurrentOfficialScale:highest,
      lastReviewAt:reviewAt,lastError,
      evaluationCount:calls,
      requiresValidatedOfficialSource:true,
      25SecondPollingAuthorized:false,
      alertPublished:false,
    }),
  });
}
