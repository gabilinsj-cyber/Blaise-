/**
 * Pure zero-minimum Cloud Run revision plan.
 * No subprocesses, cloud access, weather API requests, or writes.
 *
 * gcloud run deploy --min-instances sets the minimum on the new REVISION.
 * --min sets the minimum on the SERVICE; it must never be generated here.
 * The immutable historical revision may have minScale=1 and is untouched.
 */
const OWN = Object.freeze({
 project:'blaise-v6-rj',
 region:'southamerica-east1',
 service:'blaise-v6-rj-backend',
 suffix:'owv2-211126',
 openweatherSecret:'blaise-rj-openweather-api-key',
});
export const OPENWEATHER_ZERO_MIN_CANDIDATE = OWN;

export const CANDIDATE_WEATHER_SWITCHES_OFF = Object.freeze({
 BLAISE_OPENWEATHER_AGENT13_ENABLED:'false',
 BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED:'false',
 BLAISE_AGENT13_FIRESTORE_ENABLED:'false',
 BLAISE_AGENT13_TEMPERATURE_CONTINGENCY_ENABLED:'false',
 BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED:'false',
 BLAISE_MET_NORWAY_ENABLED:'false',
 BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED:'false',
 BLAISE_INMET_P0_PUBLISH_ENABLED:'false',
});

const parseMin=(value)=>{
 if(value===undefined||value===null||value==='')return 0;
 const str=String(value);
 return /^(0|[1-9][0-9]*)$/.test(str)?Number(str):null;
};
/** Only revision-level annotations/scaling. Missing is 0 by Cloud Run default. */
export function revisionMinCount(r){
 const ann=r?.metadata?.annotations||{};
 const values=[
  ann['autoscaling.knative.dev/minScale'],
  r?.spec?.scaling?.minInstanceCount
 ].filter(x=>x!==undefined&&x!==null&&x!=='');
 if(values.length===0)return 0;
 const parsed=values.map(parseMin);
 if(parsed.some(x=>x===null)||new Set(parsed).size!==1)return null;
 return parsed[0];
}
/** Service-level scaling is distinct; must never be changed by this plan. */
export function serviceMinSnapshot(s){
 const ann=s?.metadata?.annotations||{};
 const values=[
  ann['run.googleapis.com/minScale'],
  s?.spec?.scaling?.minInstanceCount,
  s?.scaling?.minInstanceCount
 ].filter(x=>x!==undefined&&x!==null&&x!=='');
 return JSON.stringify(values.map(x=>String(x)));
}
export function serviceTemplateMinCount(s){
 const ann=s?.spec?.template?.metadata?.annotations||{};
 const value=ann['autoscaling.knative.dev/minScale'];
 return parseMin(value??s?.spec?.template?.spec?.scaling?.minInstanceCount);
}
export function candidateMinZeroVerified({beforeService,afterService,newRevision}={}){
 if(!beforeService||!afterService||!newRevision)return false;
 return revisionMinCount(newRevision)===0&&
  serviceTemplateMinCount(afterService)===0&&
  serviceMinSnapshot(beforeService)===serviceMinSnapshot(afterService);
}

export function buildZeroMinCandidateDeployCommand({
 image,serviceAccount,weatherSwitches=CANDIDATE_WEATHER_SWITCHES_OFF
}={}){
 if(typeof image!=='string'||
   !/^([a-z0-9-]+-docker\.pkg\.dev|gcr\.io|[a-z0-9-]+\.gcr\.io)\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/i.test(image))
  throw new Error('IMAGE_DIGEST_NOT_PINNED');
 if(typeof serviceAccount!=='string'||
    !/^[a-z0-9][a-z0-9._-]*@[a-z0-9-]+\.iam\.gserviceaccount\.com$/i.test(serviceAccount))
  throw new Error('SERVICE_IDENTITY_NOT_VALIDATED');
 const names=Object.keys(CANDIDATE_WEATHER_SWITCHES_OFF);
 if(names.length!==8||Object.keys(weatherSwitches).length!==names.length||
    names.some(k=>weatherSwitches[k]!=='false'))
  throw new Error('WEATHER_COLLECTORS_NOT_EXPLICITLY_OFF');
 const cmd=[
  'run','deploy',OWN.service,
  '--project='+OWN.project,'--region='+OWN.region,'--platform=managed',
  '--image='+image,'--service-account='+serviceAccount,
  '--port=8080','--cpu=1','--memory=512Mi',
  '--revision-suffix='+OWN.suffix,
  '--update-secrets=BLAISE_OPENWEATHER_API_KEY='+OWN.openweatherSecret+':2',
  '--update-env-vars='+names.map(k=>k+'=false').join(','),
  '--min-instances=0', // REVISION-level, never '--min=0' (service-wide).
  '--no-traffic','--no-deploy-health-check','--quiet'
 ];
 if(cmd.some(x=>x==='--min=0'||x.startsWith('--tag')||
   x.includes('update-traffic')))
  throw new Error('UNSAFE_DEPLOY_ARGUMENTS');
 return Object.freeze(cmd);
}
