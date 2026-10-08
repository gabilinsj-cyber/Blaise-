import {reviewBlaiseEvidence} from './blaise-source-review.mjs';
import {createOfficialSourceScheduler} from './official-source-scheduler.mjs';
import {validateAlertaRioMeteorologyHtml,ALERTA_RIO_LIVE_URL,ALERTA_RIO_LIVE_HOST} from './alerta-rio-source.mjs';
import {fetchTextContract} from './source-contract.mjs';
import {evaluateScientificJobs,SCIENTIFIC_METHODS} from './blaise-scientific-jobs.mjs';
export const VECTOR_RJ = Object.freeze({name:'Blaise Vector RJ — Agente de Cálculo e Revalidação Científica',historicalName:'Blaise Sigma AI',engines:['atmosférico','tempestades/nowcasting','hidrológico/geológico','oceânico/sismológico','estatístico/incerteza'],nature:'CALCULO_BLAISE',officialAlert:false});
function finite(n){if(typeof n!=='number'||!Number.isFinite(n))throw TypeError('finite_number_required');return n;}
export function advectLocal({xMeters,yMeters,uMetersPerSecond,vMetersPerSecond,seconds}){
 [xMeters,yMeters,uMetersPerSecond,vMetersPerSecond,seconds].forEach(finite);
 if(seconds<0||seconds>7200)throw RangeError('local_horizon');
 return {xMeters:xMeters+uMetersPerSecond*seconds,yMeters:yMeters+vMetersPerSecond*seconds,method:'constant_velocity_local_cartesian',nature:'CALCULO_BLAISE'};
}
export function windComponents(speedKmh,fromDegrees){
 finite(speedKmh);finite(fromDegrees);if(speedKmh<0||speedKmh>400||fromDegrees<0||fromDegrees>360)throw RangeError('invalid_wind');
 const r=fromDegrees*Math.PI/180;return {eastKmh:-speedKmh*Math.sin(r),northKmh:-speedKmh*Math.cos(r)};
}
export function fuseComparableReadings(rows,policy,now=Date.now()){
 if(!Array.isArray(rows)||rows.length<2||!policy?.version||policy.status!=='CALIBRATED')throw TypeError('calibrated_policy_required');
 [now,policy.maxAgeMs,policy.maxSkewMs,policy.maxSpread].forEach(finite);
 if(policy.maxAgeMs<=0||policy.maxSkewMs<0||policy.maxSpread<0)throw RangeError('invalid_policy');
 const first=rows[0],ids=new Set(),times=[];
 for(const r of rows){
  if(!r.sourceId||!r.independentSourceId||ids.has(r.independentSourceId)||!r.sourceUrl?.startsWith('https://'))throw TypeError('independent_provenance_required');
  ids.add(r.independentSourceId);
  if(!r.scopeId||!r.unit||!r.variable||!['OBSERVADO','MODELO'].includes(r.nature)||['scopeId','unit','variable','nature','validAt'].some(k=>r[k]!==first[k]))throw TypeError('incomparable_readings');
  finite(r.value);const time=Date.parse(r.observedAt);if(!Number.isFinite(time)||time>now||now-time>policy.maxAgeMs)throw RangeError('stale_or_invalid_reading');times.push(time);
  finite(policy.weights?.[r.sourceId]);if(policy.weights[r.sourceId]<=0)throw RangeError('invalid_weight');
 }
 if(Math.max(...times)-Math.min(...times)>policy.maxSkewMs)throw RangeError('unsynchronized');
 const min=Math.min(...rows.map(r=>r.value)),max=Math.max(...rows.map(r=>r.value));if(max-min>policy.maxSpread)throw RangeError('divergence_requires_review');
 const total=rows.reduce((s,r)=>s+policy.weights[r.sourceId],0);finite(total);
 const value=rows.reduce((s,r)=>s+r.value*(policy.weights[r.sourceId]/total),0);finite(value);
 return {value,min,max,spread:max-min,scopeId:first.scopeId,variable:first.variable,unit:first.unit,policyVersion:policy.version,nature:'CALCULO_BLAISE',confidencePercent:null,officialAlert:false,sources:rows.map(r=>({sourceId:r.sourceId,sourceUrl:r.sourceUrl,observedAt:r.observedAt,weight:policy.weights[r.sourceId]/total}))};
}
export function createBlaiseVectorRjAgent({fetchImpl=globalThis.fetch,now=Date.now,onResult=()=>{},readEvidence=()=>({}),readScientificJobs=()=>[]}={}){
 let result=null;
 let lastCalculationAt=null,lastInputs=null;
 const scheduler=createOfficialSourceScheduler({now,cadenceMode:'fixed_start',refreshIntervalsMs:{normal:30000,severe:30000},tasks:[{id:'blaise-vector-rj',run:async()=>{
  try{
   const html=await fetchTextContract(ALERTA_RIO_LIVE_URL,{allowedHosts:[ALERTA_RIO_LIVE_HOST],fetchImpl,timeoutMs:7000,maxBytes:1048576});
   const data=validateAlertaRioMeteorologyHtml(html,{now:new Date(now())});
   result={agent:VECTOR_RJ.name,status:'PARTIAL',calculatedAt:new Date(now()).toISOString(),sourceUrl:data.sourceUrl,stations:data.stations.filter(s=>s.freshness==='recent').map(s=>({...s,windVector:s.windSpeedKmh!==null&&s.windDirectionDegrees!==null?windComponents(s.windSpeedKmh,s.windDirectionDegrees):null})),unavailable:['calibrated_fusion','feels_like','CAPE_CIN_SRH','radar_nowcast','cyclone_trajectory','tsunami','regional_coverage'],officialAlert:false};
  }catch{result={agent:VECTOR_RJ.name,status:'UNAVAILABLE',calculatedAt:new Date(now()).toISOString(),stations:[],officialAlert:false};}
  let scientificCalculations=[];
  try{
   const jobs=await readScientificJobs();
   const fingerprint=JSON.stringify(jobs);
   const time=now();
   const changed=fingerprint!==lastInputs;
   const due=lastCalculationAt===null||time-lastCalculationAt>=60000;
   // Validate source age every tick, including unchanged inputs. No observation
   // timestamp is refreshed merely because the scheduler fetched it again.
   scientificCalculations=evaluateScientificJobs(jobs,{now:time});
   if(changed||due){lastCalculationAt=time;lastInputs=fingerprint;}
   result={...result,scientificCycle:{baselineIntervalMs:60000,revalidationIntervalMs:30000,
    reason:changed?'INPUT_CHANGE':due?'BASELINE':'REVALIDATION',
    lastBaselineOrChangeAt:new Date(lastCalculationAt).toISOString(),
    revalidatedAt:new Date(time).toISOString()}};
  }
  catch{scientificCalculations=[{status:'UNAVAILABLE',reason:'scientific_provider_failed',result:null,officialAlert:false}];}
  result={...result,scientificMethods:SCIENTIFIC_METHODS,scientificCalculations,evidenceReview:reviewBlaiseEvidence({...readEvidence(),now:now()})};
  onResult(result);
 }}]});
 return {start:scheduler.start,stop:scheduler.stop,tick:scheduler.tick,setSeverity(level){if(!Number.isInteger(level)||level<1||level>5)throw RangeError('invalid_severity');return scheduler.setMode(level>=4?'severe':'normal');},snapshot(){return {agent:VECTOR_RJ,scheduler:scheduler.snapshot(),result};}};
}
