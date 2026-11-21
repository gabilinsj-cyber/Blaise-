/**
 * Blaise V6 RJ — strictly read-only Cloud Run OpenWeather secret binding audit.
 *
 * Historical evidence: 00058-sos references OpenWeather secret version 1
 * (DISABLED), while version 2 is ENABLED. Never read a secret payload; never
 * enable a version, deploy, roll traffic or contact a weather API.
 *
 * A successful plan is NOT proof the vendor accepts the v2 key, that
 * Secret Manager permissions work at runtime, or that the backend is healthy.
 */
const EXPECTED = Object.freeze({
 project:'blaise-v6-rj',
 service:'blaise-v6-rj-backend',
 revision:'blaise-v6-rj-backend-00058-sos',
 openweatherSecret:'blaise-rj-openweather-api-key',
 openweatherEnv:'BLAISE_OPENWEATHER_API_KEY',
 redemetSecret:'blaise-rj-redemet-api-key',
 redemetEnv:'BLAISE_REDEMET_API_KEY',
 candidateSecretVersion:'2',
 previousSecretVersion:'1',
});
export const OPENWEATHER_V2_REPAIR_TARGET = EXPECTED;

const asArray=x=>Array.isArray(x)?x:[];
const asObject=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const versionState=(versions,n)=>{
 const hit=asArray(versions).find(x=>String(x?.name??'').split('/').at(-1)===n);
 return hit?.state==='ENABLED'?'ENABLED':
  hit?.state==='DISABLED'?'DISABLED':
  hit?.state==='DESTROYED'?'DESTROYED':'NOT_PROVED';
};
const binding=(revision,envName)=>{
 const x=asObject(revision);
 const env=asArray(x.spec?.containers).flatMap(c=>asArray(c?.env));
 const matches=env.filter(e=>e?.name===envName);
 if(matches.length!==1)return null;
 const ref=matches[0]?.valueFrom?.secretKeyRef;
 if(!ref||typeof ref.name!=='string'||typeof ref.key!=='string')return null;
 return {name:ref.name,version:ref.key};
};
const envTrue=(revision,name)=>asArray(revision?.spec?.containers)
 .flatMap(c=>asArray(c?.env))
 .some(e=>e?.name===name&&e?.value==='true');

export function assessOpenweatherV2RepairEvidence({
 revision,service,openweatherVersions,redemetVersions,openweatherIamPolicy
}={}){
 const r=asObject(revision),s=asObject(service);
 const oldBinding=binding(r,EXPECTED.openweatherEnv);
 const redemetBinding=binding(r,EXPECTED.redemetEnv);
 const sa=r.spec?.serviceAccountName;
 const iam=asObject(openweatherIamPolicy);
 const hasIam=Array.isArray(iam.bindings);
 const directGrant=typeof sa==='string'&&sa.endsWith('.iam.gserviceaccount.com')&&
  asArray(iam.bindings).some(b=>b?.role==='roles/secretmanager.secretAccessor'&&
    !b.condition&&asArray(b.members).includes('serviceAccount:'+sa));
 const traffic=asArray(s.status?.traffic);
 const matching=traffic.filter(t=>t?.revisionName===EXPECTED.revision);
 const percent=matching.reduce((sum,t)=>sum+(typeof t?.percent==='number'?t.percent:0),0);
 const projectedTotal=traffic.reduce((sum,t)=>sum+
    (typeof t?.percent==='number'?t.percent:0),0);
 const activeAgent13=envTrue(r,'BLAISE_OPENWEATHER_AGENT13_ENABLED')||
  envTrue(r,'BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED')||
  envTrue(r,'BLAISE_AGENT13_FIRESTORE_ENABLED')||
  envTrue(r,'BLAISE_AGENT13_TEMPERATURE_CONTINGENCY_ENABLED');
 const activeBackgroundCollection=[
  'BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED',
  'BLAISE_MET_NORWAY_ENABLED',
  'BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED',
  'BLAISE_INMET_P0_PUBLISH_ENABLED'
 ].some(name=>envTrue(r,name));

 const checks=Object.freeze({
  projectAssumedNotVerifiedInPureReducer:true,
  expectedService:s.metadata?.name===EXPECTED.service,
  expectedHistoricalRevision:r.metadata?.name===EXPECTED.revision,
  originalOpenweatherBindingVersion1:oldBinding?.name===EXPECTED.openweatherSecret&&
   oldBinding?.version===EXPECTED.previousSecretVersion,
  priorOpenweatherVersionDisabled:versionState(openweatherVersions,'1')==='DISABLED',
  targetOpenweatherVersion2Enabled:versionState(openweatherVersions,'2')==='ENABLED',
  redemetBindingPreserved:redemetBinding?.name===EXPECTED.redemetSecret&&
   redemetBinding?.version==='1',
  redemetVersion1Enabled:versionState(redemetVersions,'1')==='ENABLED',
  directUnconditionalSecretAccessor:directGrant===true,
  iamPolicyRead:hasIam,
  originalRevisionZeroTraffic:matching.length>0&&percent===0,
  serviceTrafficTotals100Percent:traffic.length>0&&projectedTotal===100,
  openweatherAgent13AndApprovalsOff:!activeAgent13,
  historicalAutomaticWeatherCollectionOff:!activeBackgroundCollection,
 });
 const blockers=Object.freeze(Object.entries(checks)
  .filter(([name,pass])=>name!=='projectAssumedNotVerifiedInPureReducer'&&!pass)
  .map(([name])=>name));
 const planReady=blockers.length===0;
 return Object.freeze({
  status:planReady?'REPAIR_PLAN_ELIGIBLE_NOT_DEPLOYED':'REPAIR_PLAN_BLOCKED',
  checks,
  blockers,
  openweatherVersion1:versionState(openweatherVersions,'1'),
  openweatherVersion2:versionState(openweatherVersions,'2'),
  redemetVersion1:versionState(redemetVersions,'1'),
  proposedOpenweatherSecretVersion:EXPECTED.candidateSecretVersion,
  proposedBinding:'PIN_SECRET_VERSION_2_IN_NEW_ISOLATED_REVISION_ONLY',
  preserveRedemetVersion1:true,
  previousRevisionMustNotBeModified:true,
  neverReenableOldOpenweatherVersion:true,
  noAutoEnableOfOpenweatherAgent13:true,
  requiresSeparateExplicitDeploymentAuthorization:true,
  targetRevisionExists:false,
  proposedRevisionCreated:false,
  productionTrafficChanged:false,
  keyPayloadRead:false,
  vendorKeyValid:'NOT_VERIFIED',
  effectiveSecretAccess:'NOT_VERIFIED',
  endpointHealthAfterRepair:'NOT_TESTED',
  weatherProviderContacted:false,
  meteorologicalCreditsUsed:0,
  productionReleaseApproved:false,
 });
}
