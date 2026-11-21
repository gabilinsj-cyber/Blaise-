/**
 * Read-only safety review for the Blaise V6 RJ Cloud Run pre-deployment gate.
 * Input: already fetched Cloud Run service/revision metadata, never payloads.
 * Output: short, non-secret operational evidence. NEVER authorizes a deploy.
 */
import {revisionMinCount,serviceTemplateMinCount}
 from './rj-openweather-zero-min-candidate.mjs';

const SERVICE='blaise-v6-rj-backend';
const TRAFFIC=Object.freeze({
 [SERVICE+'-00031-vep']:99,
 [SERVICE+'-00038-pin']:1
});
const HISTORIC=SERVICE+'-00058-sos';
const RETIRED=SERVICE+'-00043-hjk';
const CANDIDATE=SERVICE+'-owv2-211126';
const list=x=>Array.isArray(x)?x:[];
const truth=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const statusOf=(revision,type)=>{
 const c=list(revision?.status?.conditions).find(x=>x?.type===type);
 return c?.status==='True'?'True':c?.status==='False'?'False':'UNKNOWN';
};
const billingOf=(revision)=>{
 const a=truth(revision?.metadata?.annotations);
 const value=a['run.googleapis.com/cpu-throttling'];
 const cpuIdle=revision?.spec?.containers?.[0]?.resources?.cpuIdle;
 if(value==='true'||cpuIdle===true)return 'REQUEST_BASED';
 if(value==='false'||cpuIdle===false)return 'INSTANCE_BASED';
 return 'NOT_VERIFIED';
};
const serviceMin=(s)=>{
 const val=s?.spec?.scaling?.minInstanceCount??
   s?.metadata?.annotations?.['run.googleapis.com/minScale']??
   s?.scaling?.minInstanceCount;
 return val===undefined||val===null?'NOT_SET':String(val);
};
const trafficOf=s=>list(s?.status?.traffic).map(x=>({
 revision:x?.revisionName||'',
 percent:typeof x?.percent==='number'?x.percent:0,
 tagged:Boolean(x?.tag)
}));
const exactSplit=(xs)=>{
 const positive=xs.filter(x=>x.percent>0);
 return positive.length===2&&
  Object.entries(TRAFFIC).every(([rev,pct])=>
   positive.some(x=>x.revision===rev&&x.percent===pct))&&
  positive.reduce((a,x)=>a+x.percent,0)===100;
};
const pinned=s=>list(s?.spec?.traffic).some(x=>
 x?.latestRevision===true&&Number(x?.percent||0)>0);

export function reviewRjCloudRunPredeployImpact({
 service,historicalRevision,retiredRevision
}={}){
 const s=truth(service),h=truth(historicalRevision),r=truth(retiredRevision);
 const t=trafficOf(s);
 const historicalPresent=t.some(x=>x.revision===HISTORIC);
 const historicTagged=t.some(x=>x.revision===HISTORIC&&x.tagged);
 const historicalMin=revisionMinCount(h);
 const templateMin=serviceTemplateMinCount(s);
 const previousRevisionRetired=statusOf(r,'Active')==='False'&&
  list(r?.status?.conditions).some(x=>
   x?.reason==='Retired');
 const candidateAbsentFromTraffic=!t.some(x=>x.revision===CANDIDATE)&&
  !list(s?.spec?.traffic).some(x=>x?.revisionName===CANDIDATE);
 const dataComplete=s?.metadata?.name===SERVICE&&
  h?.metadata?.name===HISTORIC&&r?.metadata?.name===RETIRED;
 const identityConsistent=exactSplit(t)&&!pinned(s);
 const flags={
  recordsIdentified:Boolean(dataComplete),
  productionTrafficExactly99_1:identityConsistent,
  historicalRevisionZeroTraffic:historicalPresent&&
   t.filter(x=>x.revision===HISTORIC).every(x=>x.percent===0),
  historicalRevisionHasTag:historicTagged,
  historicalRevisionMinOne:historicalMin===1,
  serviceTemplateMinOne:templateMin===1,
  retiredRevisionInactive:previousRevisionRetired,
  candidateAbsentFromTraffic,
 };
 const riskCodes=['DEPLOY_ON_EXISTING_SERVICE_MUTATES_SERVICE_TEMPLATE',
  'ZERO_TRAFFIC_MIN_ZERO_DOES_NOT_TEST_HTTP_STARTUP',
  'UNCONDITIONAL_STARTUP_NETWORK_CALLS_NOT_INDEPENDENTLY_EXCLUDED',
  'ACTUAL_BILLING_COST_REQUIRES_CLOUD_BILLING_USAGE',
  'TAG_URL_AUTHORIZATION_NOT_VERIFIED'];
 if(historicTagged&&historicalMin===1)
  riskCodes.push('EXISTING_TAGGED_REVISION_MIN_ONE_MAY_INCUR_IDLE_COST');
 if(billingOf(h)==='INSTANCE_BASED')
  riskCodes.push('HISTORICAL_INSTANCE_BASED_BILLING');
 if(billingOf(h)==='NOT_VERIFIED')
  riskCodes.push('HISTORICAL_BILLING_MODE_NOT_VERIFIED');
 if(!identityConsistent)riskCodes.push('LIVE_TRAFFIC_BASELINE_NOT_PROVEN');
 if(!candidateAbsentFromTraffic)riskCodes.push('CANDIDATE_REFERENCED_IN_TRAFFIC');
 if(!dataComplete)riskCodes.push('READ_ONLY_CLOUD_RECORDS_INCOMPLETE');
 if(historicalMin!==1||templateMin!==1)
  riskCodes.push('MIN_INSTANCES_CHANGED_FROM_OBSERVED_BASELINE');
 if(!previousRevisionRetired)
  riskCodes.push('RETIRED_REVISION_STATE_NOT_PROVEN');
 return Object.freeze({
  status:'BLOCKED_FOR_REAL_DEPLOY_PENDING_REVIEW',
  ...flags,
  billingModeHistorical:billingOf(h),
  billingModeCurrentTemplate:billingOf({metadata:s?.spec?.template?.metadata,
   spec:s?.spec?.template?.spec}),
  minimumInstancesHistorical:historicalMin,
  minimumInstancesCurrentTemplate:templateMin,
  minimumInstancesServiceLevel:serviceMin(s),
  futureCandidateMinimum:0,
  activeRevisionTrafficPreserved:identityConsistent,
  historicTagCostExposure:historicTagged&&historicalMin===1,
  evidenceDoesNotProveActualChargedAmount:true,
  expectedFutureCandidateTagged:false,
  expectedFutureCandidateNormalTrafficPercent:0,
  exactFutureStartupBehavior:'NOT_VERIFIED',
  oldRevisionSecretAccess:'NOT_TESTED',
  liveProviderAccess:'NOT_TESTED',
  privateBillingAccountQueried:false,
  secretPayloadRead:false,
  productionTrafficChanged:false,
  createdNewRevision:false,
  riskCodes:Object.freeze(riskCodes),
 });
}
