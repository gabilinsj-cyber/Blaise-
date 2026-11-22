/**
 * Offline-only interpretation of Cloud Run historical startup evidence.
 * No credentials, network, gcloud, secret payloads or deployment functions.
 * Every conclusion concerns metadata, not confirmed backend/root-cause health.
 */
const SERVICE='blaise-v6-rj-backend';
const HISTORIC=SERVICE+'-00058-sos';
const SECRET='blaise-rj-openweather-api-key';
const REDEMET='blaise-rj-redemet-api-key';
const ENV_OW='BLAISE_OPENWEATHER_API_KEY';
const ENV_RD='BLAISE_REDEMET_API_KEY';
const REQUEST_FAIL_TEXT=/could not start|failed to start/i;
const array=x=>Array.isArray(x)?x:[];
const object=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const secretEnv=(container,envName)=>{
 const matches=array(container?.env).filter(e=>e?.name===envName);
 if(matches.length!==1)return {kind:matches.length?'DUPLICATE':'ABSENT'};
 const item=matches[0];
 const ref=item?.valueFrom?.secretKeyRef;
 if(typeof item?.value==='string')return {kind:'PLAINTEXT_IN_ENV'};
 if(!ref||typeof ref?.name!=='string'||typeof ref?.key!=='string')
  return {kind:'UNVERIFIED'};
 return {kind:'SECRET_REF',secret:ref.name,version:ref.key};
};
const condition=meta=>{
 if(!meta||typeof meta!=='object')return 'NOT_VERIFIED';
 return meta.state==='ENABLED'?'ENABLED':
  meta.state==='DISABLED'?'DISABLED':
  meta.state==='DESTROYED'?'DESTROYED':'NOT_VERIFIED';
};
const directIam=(policy,sa)=>{
 if(!policy||!Array.isArray(policy.bindings)||typeof sa!=='string')
  return 'NOT_VERIFIED';
 return policy.bindings.some(b=>b?.role==='roles/secretmanager.secretAccessor'&&
  !b.condition&&array(b.members).includes('serviceAccount:'+sa))
  ?'DIRECT_UNCONDITIONAL_GRANT_PRESENT':'DIRECT_GRANT_NOT_PROVEN';
};
const bound=(binding,name,version)=>binding.kind==='SECRET_REF'&&
 binding.secret===name&&binding.version===version;
const exactTraffic=(svc)=>{
 const active=array(svc?.status?.traffic).filter(x=>Number(x?.percent||0)>0);
 return active.length===2&&
  active.some(x=>x.revisionName===SERVICE+'-00031-vep'&&x.percent===99)&&
  active.some(x=>x.revisionName===SERVICE+'-00038-pin'&&x.percent===1);
};
export function diagnoseHistoricalStartupSecret({
 historicalRevision,currentService,owV1Metadata,owV2Metadata,
 redemetV1Metadata,openweatherIamPolicy,requestLogs
}={}){
 const historical=object(historicalRevision),svc=object(currentService);
 const hCont=array(historical.spec?.containers);
 const templateCont=array(svc.spec?.template?.spec?.containers);
 const hOW=secretEnv(hCont.length===1?hCont[0]:null,ENV_OW);
 const tOW=secretEnv(templateCont.length===1?templateCont[0]:null,ENV_OW);
 const hRD=secretEnv(hCont.length===1?hCont[0]:null,ENV_RD);
 const hSA=historical.spec?.serviceAccountName;
 const tSA=svc.spec?.template?.spec?.serviceAccountName;
 const old=condition(owV1Metadata),target=condition(owV2Metadata);
 const rd=condition(redemetV1Metadata);
 const logs=array(requestLogs);
 const requestCount=requestLogs===null||requestLogs===undefined?null:
  logs.filter(x=>x?.httpRequest?.status===500).length;
 const tagged=array(svc.status?.traffic).some(x=>
  x?.revisionName===HISTORIC&&Boolean(x?.tag));
 const hasStartupMessage=logs.some(x=>x?.httpRequest?.status===500&&
  REQUEST_FAIL_TEXT.test(String(x?.textPayload||'')+' '+
   String(x?.jsonPayload?.message||'')));
 const startupMessageCount=logs.filter(x=>x?.httpRequest?.status===500&&
  REQUEST_FAIL_TEXT.test(String(x?.textPayload||'')+' '+
   String(x?.jsonPayload?.message||''))).length;
 const bindingV1=bound(hOW,SECRET,'1');
 const metadataComplete=historical.metadata?.name===HISTORIC&&
  svc.metadata?.name===SERVICE&&old!=='NOT_VERIFIED'&&
  target!=='NOT_VERIFIED'&&rd!=='NOT_VERIFIED'&&
  requestLogs!==null&&requestLogs!==undefined;
 const historicalSecretUnusableAtNewStartup=bindingV1&&old!=='ENABLED'&&old!=='NOT_VERIFIED';
 const riskMarkers=[
  'HISTORICAL_HTTP500_NOT_CAUSALLY_ATTRIBUTED',
  'DO_NOT_REENABLE_OR_READ_V1_SECRET',
  'FUTURE_CANDIDATE_REQUIRES_NEW_EXPLICIT_APPROVAL'
 ];
 if(historicalSecretUnusableAtNewStartup)
  riskMarkers.push('HISTORICAL_ENV_SECRET_VERSION_UNUSABLE_FOR_NEW_STARTS');
 if(!bound(tOW,SECRET,'2')||target!=='ENABLED')
  riskMarkers.push('CURRENT_TEMPLATE_V2_BINDING_OR_STATE_UNPROVEN');
 if(!bound(hRD,REDEMET,'1')||rd!=='ENABLED')
  riskMarkers.push('HISTORICAL_REDEMET_BINDING_OR_STATE_UNPROVEN');
 if(!exactTraffic(svc))riskMarkers.push('CLIENT_TRAFFIC_NOT_PROVEN_99_1');
 if(!metadataComplete)riskMarkers.push('READONLY_EVIDENCE_INCOMPLETE');
 const direct=directIam(openweatherIamPolicy,hSA);
 if(direct!=='DIRECT_UNCONDITIONAL_GRANT_PRESENT')
  riskMarkers.push('DIRECT_SECRET_IAM_GRANT_NOT_PROVEN');
 return Object.freeze({
  status:'DIAGNOSIS_ONLY_NO_DEPLOY',
  historicalBindingVersion:bindingV1?'1':'NOT_VERIFIED',
  historicalSecretVersion1State:old,
  currentTemplateBindingVersion:bound(tOW,SECRET,'2')?'2':'NOT_VERIFIED',
  currentSecretVersion2State:target,
  historicalRedemetV1State:rd,
  historicalRedemetBoundV1:bound(hRD,REDEMET,'1'),
  historicalRuntimeIdentityMatchesTemplate:
   typeof hSA==='string'&&hSA.length>0&&hSA===tSA,
  historicalSecretDirectIam:direct,
  inheritedOrConditionalIamEffectiveAccess:'NOT_TESTED',
  oldSecretVersionUnavailableForNewStarts:historicalSecretUnusableAtNewStartup,
  historicalStartupErrorPhraseCount:startupMessageCount,
  requestHttp500Count:requestCount,
  startupFailureReportedByRequestLog:hasStartupMessage,
  historicalTagged:tagged,
  productionTraffic99_1:exactTraffic(svc),
  evidenceComplete:metadataComplete,
  likelyStartupBlocker:historicalSecretUnusableAtNewStartup?
   'DISABLED_ENV_SECRET_V1':'NOT_CONFIRMED',
  causeOfThreeHttp500:'NOT_CONCLUSIVELY_PROVEN',
  providerKeyAccepted:'NOT_TESTED',
  actualRuntimeSecretAccess:'NOT_TESTED',
  riskMarkers:Object.freeze(riskMarkers),
  secretPayloadRead:false,deployPerformed:false,
  trafficChanged:false,weatherProviderContacted:false,
  meteorologicalCreditsUsed:0
 });
}
