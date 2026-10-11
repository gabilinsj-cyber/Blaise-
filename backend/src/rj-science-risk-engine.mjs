/**
 * Blaise V6 RJ — operational connection between actual CEMADEN-RJ
 * hydrological risk, INMET CAP warnings, and the provenanced scientific-job
 * library. No forecast, interpolation or model output is a second authority.
 *
 * An active official warning must be shown promptly, including at scale 4/5.
 * Independent confirmation is a gate for experimental escalation / sirens,
 * NOT a precondition for displaying a real warning to the user.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';
import { rjCadenceForLevel, evaluateExtremeAudioGate } from './rj-agent-registry.mjs';
import { evaluateScientificJobs } from './blaise-scientific-jobs.mjs';

export const RJ_SCIENCE_RISK_CONTRACT = 'BLAISE_RJ_SCIENTIFIC_RISK_REVIEW_V1';
const RJ = new Set(RJ_MUNICIPALITIES.map(c => c.ibge));
const MAX_SCIENTIFIC_JOBS = 64;
const CAP_LEVELS = Object.freeze({ Extreme: 5, Severe: 4, Moderate: 3, Minor: 2 });
const AGE_HYDRO_MS = 30 * 60_000;
const MAX_WARNING_VALIDITY_MS = 7 * 86_400_000;
const SOURCE_NATURES = new Set(['OBSERVADO','MODELO']);
const safeTime = value => {
  const v = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(v) ? v : null;
};
const isFresh = (timestamp, now, maxAge) => {
  const time=safeTime(timestamp);
  return time !== null && time <= now && now-time <= maxAge;
};
function failNoData(reason) {
  return Object.freeze({contract:RJ_SCIENCE_RISK_CONTRACT,
    state:'NO_VALID_OFFICIAL_SNAPSHOT',reason,
    generatedAt:null,municipalities:Object.freeze([]),
    scientificJobsEvaluated:0,scientificJobsAccepted:0,
    automaticAlertAuthorized:false,audibleAlertAuthorized:false});
}
function validHydro(hydro,now) {
  return hydro && ['CURRENT','CURRENT_DEGRADED'].includes(hydro.state)
    &&Number.isInteger(hydro.level)&&hydro.level>=1&&hydro.level<=5
    &&isFresh(hydro.observedAt,now,AGE_HYDRO_MS)
    &&typeof hydro.sourceUrl==='string'&&hydro.sourceUrl.startsWith('https://');
}
function validCap(warning, ibge, now) {
  if(!warning||warning.attribution!=='EXACT_IBGE'
    ||!Array.isArray(warning.municipalityIbges)
    ||!warning.municipalityIbges.includes(ibge)
    ||!Object.hasOwn(CAP_LEVELS,warning.severity)
    ||typeof warning.id!=='string'||!warning.id
    ||typeof warning.event!=='string'||!warning.event
    ||typeof warning.sourceUrl!=='string'||!warning.sourceUrl.startsWith('https://'))return false;
  const sent=safeTime(warning.sent),onset=safeTime(warning.onset),
    expires=safeTime(warning.expires);
  return sent!==null&&onset!==null&&expires!==null
    &&sent<=now&&onset<=now&&now<expires&&expires>sent
    &&expires-sent<=MAX_WARNING_VALIDITY_MS;
}
function jobTrustworthy(job, result, ibge, now) {
  if(!job||result?.status!=='CALCULATED_INPUTS_ONLY'
    ||result.result?.officialAlert!==false
    ||result.result?.mayTriggerAlert===true
    ||job.scopeId!==`municipality:${ibge}`
    ||!Array.isArray(job.sources)||!job.sources.length)return false;
  return job.sources.every(s=>s?.scopeId===job.scopeId
    &&s.quality==='VALIDATED'&&SOURCE_NATURES.has(s.nature)
    &&typeof s.sourceId==='string'&&s.sourceId.length>0
    &&typeof s.sourceUrl==='string'&&s.sourceUrl.startsWith('https://')
    &&isFresh(s.observedAt,now,job.maxAgeMs));
}
/**
 * sourceSnapshot must come from buildStatewideDashboardSnapshot(worker), not
 * a caller-supplied "all clear" flag. Any non-current data is discarded.
 * Only verified input jobs evaluated with the existing scientific kernels
 * may contribute supporting diagnostics; they NEVER set the official scale.
 */
export function evaluateRjScientificRiskSnapshot({
  sourceSnapshot,scientificJobs=[],nowMillis=Date.now(),
}={}) {
  if(!Number.isFinite(nowMillis)||nowMillis<0)throw new TypeError('rj_science_invalid_clock');
  if(!Array.isArray(scientificJobs)||scientificJobs.length>MAX_SCIENTIFIC_JOBS)
    throw new TypeError('rj_science_bounded_jobs_required');
  if(!sourceSnapshot||sourceSnapshot.scope!=='RJ_92_MUNICIPALITIES'
    ||sourceSnapshot.workerActive!==true
    ||!Array.isArray(sourceSnapshot.municipalities)
    ||sourceSnapshot.municipalities.length!==92
    ||!Array.isArray(sourceSnapshot.warnings))
    return failNoData('SOURCE_WORKER_NOT_ACTIVE_OR_INCOMPLETE_SCOPE');
  const ids=sourceSnapshot.municipalities.map(x=>x.ibge);
  if(ids.some(id=>!RJ.has(id))||new Set(ids).size!==92
    ||sourceSnapshot.warnings.length>128)
    return failNoData('UNTRUSTED_RJ_MUNICIPALITY_OR_WARNING_INVENTORY');
  const evaluation=evaluateScientificJobs(scientificJobs,{now:nowMillis});
  const approvedByMunicipality=new Map();
  for(let i=0;i<evaluation.length;i++){
    const job=scientificJobs[i],output=evaluation[i];
    const ibge=job?.scopeId?.startsWith('municipality:')?job.scopeId.slice(13):null;
    if(!RJ.has(ibge)||!jobTrustworthy(job,output,ibge,nowMillis))continue;
    if(!approvedByMunicipality.has(ibge))approvedByMunicipality.set(ibge,[]);
    approvedByMunicipality.get(ibge).push(Object.freeze({
      id:job.id,method:job.method,
      at:output.calculatedAt,nature:'CALCULO_EXPERIMENTAL_BLAISE',
      officialAlert:false,mayTriggerAlert:false,
      sourceCount:job.sources.length,
      hasModeledInput:job.sources.some(x=>x.nature==='MODELO'),
      observationTime:job.validAt,
    }));
  }
  const groupedWarnings=new Map();
  for(const city of ids)groupedWarnings.set(city,[]);
  for(const warning of sourceSnapshot.warnings){
    if(!Array.isArray(warning.municipalityIbges))continue;
    for(const ibge of warning.municipalityIbges){
      if(groupedWarnings.has(ibge)&&validCap(warning,ibge,nowMillis))
        groupedWarnings.get(ibge).push(warning);
    }
  }
  const reviews=sourceSnapshot.municipalities.map(city=>{
    const hydro=validHydro(city.hydrologicalRisk,nowMillis)
      ? city.hydrologicalRisk:null;
    const cap=groupedWarnings.get(city.ibge);
    const warningMax=cap.length?Math.max(...cap.map(w=>CAP_LEVELS[w.severity])):null;
    const hydroLevel=hydro?.level??null;
    const known=[warningMax,hydroLevel].filter(Number.isInteger);
    const level=known.length?Math.max(...known):null;
    const high=level!==null&&level>=4;
    const cadence=level!==null?rjCadenceForLevel(level):null;
    const diagnoses=approvedByMunicipality.get(city.ibge)||[];
    // CEMADEN hydro risk and INMET storm warnings are DIFFERENT event kinds;
    // they do not automatically count as two confirming severe warnings.
    const separateDomains=Boolean(hydro&&cap.length);
    const reviewState=level===null?'NO_CURRENT_OFFICIAL_RISK_EVIDENCE'
      :high?'HIGH_PRIORITY_OFFICIAL_SOURCE_RECHECK_REQUIRED'
      :'OFFICIAL_SOURCE_SPECIFIC_INFORMATION';
    const officialEvidence=Object.freeze([
      ...(hydro?[Object.freeze({
        kind:'MUNICIPAL_HYDROLOGICAL_RISK',sourceId:'CEMADEN_RJ',
        level:hydro.level,observedAt:hydro.observedAt,
        sourceUrl:hydro.sourceUrl,
        warning:false,
      })]:[]),
      ...cap.map(w=>Object.freeze({
        kind:'EXACT_IBGE_CAP_WARNING',sourceId:'INMET_CAP',
        level:CAP_LEVELS[w.severity],observedAt:w.sent,
        event:w.event,warningId:w.id,expiresAt:w.expires,
        sourceUrl:w.sourceUrl,warning:true,
      })),
    ]);
    return Object.freeze({
      ibge:city.ibge,officialDisplayScale:level,
      hydroScale:hydroLevel,meteorologicalWarningScale:warningMax,
      reviewState,
      highPriority:high,
      officialEvidence,
      scientificDiagnostics:Object.freeze(diagnoses),
      diagnosticCount:diagnoses.length,
      differentPhenomenaAreNotIndependentConfirmations:separateDomains,
      independentSevereConfirmation:'NOT_ESTABLISHED_FROM_MIXED_RISK_AND_CAP_RECORDS',
      highRiskSourceRecheckMs:high?cadence.observationUpdateMs:null,
      highRiskScienceRecheckMs:high?cadence.calculationRecheckMs:null,
      officialWarningDisplayAllowed:cap.length>0,
      autoEscalationAuthorized:false,
      publisherReviewAuthorized:false,
      audibleAlertAuthorized:false,
      safetyAssured:false,
    });
  });
  const accepted=[...approvedByMunicipality.values()].reduce((n,a)=>n+a.length,0);
  return Object.freeze({
    contract:RJ_SCIENCE_RISK_CONTRACT,
    state:'EVALUATED_OFFICIAL_AND_EXPERIMENTAL_INPUTS',
    generatedAt:new Date(nowMillis).toISOString(),
    scope:'RJ_92_MUNICIPALITIES',
    municipalities:Object.freeze(reviews),
    scientificJobsEvaluated:evaluation.length,
    scientificJobsAccepted:accepted,
    sourceMethod:'STATEWIDE_WORKER_ACTUAL_CACHE_ONLY',
    agentsApplied:Object.freeze([1,2,3,5,8]),
    otherAgents:'REGISTERED_NOT_PROVEN_AUTONOMOUS',
    extremeGateStatus:evaluateExtremeAudioGate({
      alerts:[],diagnostic:null,now:nowMillis,
    }).state,
    independentP0Publication:'REQUIRES_SEPARATE_AUTHORITATIVE_PUBLISHER_GATE',
    automaticAlertAuthorized:false,audibleAlertAuthorized:false,
    measurementCoverage:'STATIONS_AND_OFFICIAL_RISK_SCOPES_NOT_92_ACTIVE_STATIONS',
  });
}
