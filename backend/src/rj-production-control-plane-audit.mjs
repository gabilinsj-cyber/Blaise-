/**
 * Blaise RJ — privacy-preserving Google Cloud READ ONLY evidence reducers.
 * No credentials, URLs, names, payloads, secrets or user data leave this module.
 * Provider collection, Firestore writes and Cloud Run deployments are forbidden.
 */
const array=x=>Array.isArray(x)?x:[];
const data=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const statusBool=x=>x===true?'REPORTED_TRUE':'NOT_PROVED';
export function summarizeBlaiseProject(project,expected='blaise-v6-rj'){
 const x=data(project);
 return Object.freeze({
  projectIdentityVerified:x.projectId===expected,
  projectActive:x.lifecycleState==='ACTIVE',
  projectNumberVisibleToOperator:false
 });
}
export function summarizeRunServices(services){
 const list=array(services);
 return Object.freeze({
   totalServices:list.length,
   serviceRecordsWellFormed:list.every(s=>typeof s?.metadata?.name==='string'||
    typeof s?.name==='string'),
   serviceNamesOmitted:true
 });
}
export function summarizeRunService(service){
 const s=data(service),spec=data(s.spec),status=data(s.status);
 const template=data(spec.template);
 const tSpec=data(template.spec);
 const containers=array(tSpec.containers).length?array(tSpec.containers):array(template.containers);
 const env=containers.flatMap(c=>array(c?.env));
 const boundSecrets=env.filter(e=>
  e?.valueFrom?.secretKeyRef||e?.valueSource?.secretKeyRef).length;
 const traffic=array(status.traffic).length?array(status.traffic):
   array(spec.traffic);
 const percent=traffic.map(t=>t?.percent).filter(Number.isFinite);
 const ready=array(status.conditions).some(x=>x?.type==='Ready'&&
   (x.status==='True'||x.status===true));
 const sa=tSpec.serviceAccountName??template.serviceAccount??'';
 return Object.freeze({
   serviceDescribed:Object.keys(s).length>0,
   readyCondition:statusBool(ready),
   revisionConfigured:typeof status.latestReadyRevisionName==='string'&&
     status.latestReadyRevisionName.length>0,
   trafficAllocationKnown:traffic.length>0&&percent.length===traffic.length,
   trafficPercentSum:traffic.length>0&&percent.length===traffic.length
     ?percent.reduce((a,b)=>a+b,0):null,
   runtimeServiceIdentityPresent:typeof sa==='string'&&sa.includes('@')&&
     sa.endsWith('.iam.gserviceaccount.com'),
   secretBackedEnvBindingCount:boundSecrets,
   secretContentRead:false,
   directProviderCalls:false,
   releaseApproved:false
 });
}
export function summarizeSecretVersions(versions){
 const list=array(versions);
 return Object.freeze({
  versionCount:list.length,
  enabledVersionCount:list.filter(x=>x?.state==='ENABLED').length,
  secretPayloadRead:false,
  exposedCredentialRotationVerified:false,
  paidApiEnabled:false
 });
}
export function summarizeScheduler(jobs){
 const list=array(jobs);
 return Object.freeze({
  jobCount:list.length,
  enabledCount:list.filter(x=>x?.state==='ENABLED').length,
  pausedCount:list.filter(x=>x?.state==='PAUSED').length,
  providerSpecificSchedulingNotProved:true,
  jobNamesOmitted:true,
  noSchedulerMutation:true
 });
}
export function assessCloudReadOnlySummary({project,runServices,runService,
 meteoblueSecretVersions,schedulerJobs,health}={}){
 const observations=Object.freeze({
   project:project===null||project===undefined?null:summarizeBlaiseProject(project),
   runServices:runServices===null||runServices===undefined?null:summarizeRunServices(runServices),
   selectedRunService:runService===null||runService===undefined?null:summarizeRunService(runService),
   meteoblueSecret:meteoblueSecretVersions===null||meteoblueSecretVersions===undefined
     ?null:summarizeSecretVersions(meteoblueSecretVersions),
   scheduler:schedulerJobs===null||schedulerJobs===undefined?null:summarizeScheduler(schedulerJobs),
   health:health??'NOT_RUN'
 });
 return Object.freeze({
  status:'CONTROL_PLANE_READ_ONLY_NOT_PRODUCTION_HOMOLOGATION',
  observations,
  productFreshness92Municipalities:'NOT_PROVED_BY_CONTROL_PLANE',
  clientDeviceAndP0Delivery:'NOT_PROVED_BY_CONTROL_PLANE',
  contractualRights:'NOT_PROVED_BY_CONTROL_PLANE',
  sourcePublicationAuthorized:false,
  releaseApproval:false,
  deploymentsPerformed:0,
  cloudMutationsPerformed:0,
  newProviderWeatherCalls:0,
  apiKeyValuesRead:0
 });
}
