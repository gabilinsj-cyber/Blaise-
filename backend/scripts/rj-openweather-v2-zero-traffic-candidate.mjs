/**
 * Owner-authorized ONE-TIME Cloud Run candidate deployment (21 Nov 2026).
 *
 * Without --execute-approved-zero-traffic: read-only preflight only.
 * With the explicit flag: create an untagged Cloud Run revision with 0%
 * production traffic. No Secret Manager payload reads, no public tag, no
 * outbound weather API, no build/push, no traffic migration or promotions.
 *
 * This targets only the HISTORICAL 00058 image digest, not the unmerged PR
 * code. It deliberately does not claim validation of the vendor key or live
 * meteorological collection.
 */
import {execFileSync} from 'node:child_process';
import {assessOpenweatherV2RepairEvidence,
 OPENWEATHER_V2_REPAIR_TARGET as T,
 OPENWEATHER_V2_CANDIDATE_SAFE_ENV as SAFE_ENV}
 from '../src/rj-openweather-secret-v2-repair-plan.mjs';

const PROJECT=T.project, REGION='southamerica-east1', SERVICE=T.service;
const REVISION_SUFFIX='owv2-211126';
const CANDIDATE=SERVICE+'-'+REVISION_SUFFIX;
const CURRENT_TEMPLATE_ORIGIN=SERVICE+'-00043-hjk';
const REVISION_MIN_EXPECTED_BEFORE='1';
const REVISION_MIN_REQUIRED_AFTER='0';
const run=process.argv.slice(2);
const approved=run.includes('--execute-approved-zero-traffic');
const allowed=new Set(['--execute-approved-zero-traffic','--preflight-only']);
const emit=x=>console.log('RJ_OPENWEATHER_V2_CANDIDATE='+JSON.stringify(x));
const stop=(reason,detail)=>{
 emit({status:'BLOCKED_NO_DEPLOY',reason,detail:detail||undefined,
  releaseAuthorized:false,weatherProviderCalled:false,
  secretPayloadRead:false});
 process.exitCode=2;
};
const getJson=(args)=>{
 try{
  const raw=execFileSync('gcloud',[...args,'--format=json'],{
   encoding:'utf8',stdio:['ignore','pipe','pipe'],
   timeout:30000,maxBuffer:5*1024*1024
  });
  const parsed=JSON.parse(raw);
  return parsed&&typeof parsed==='object'?parsed:null;
 }catch{return null;}
};
// A missing candidate revision must be CONFIRMED as not found. IAM/API errors
// are never treated as absence, preventing accidental duplicate deployment.
const candidateExistence=()=>{
 try{
  execFileSync('gcloud',['run','revisions','describe',CANDIDATE,
   '--project='+PROJECT,'--region='+REGION,'--format=json'],{
   encoding:'utf8',stdio:['ignore','pipe','pipe'],
   timeout:30000,maxBuffer:256*1024
  });
  return 'EXISTS';
 }catch(e){
  const message=String(e?.stderr||'');
  return /cannot find revision|not[ _-]?found|does not exist/i.test(message)
   ?'CONFIRMED_ABSENT':'UNKNOWN_API_OR_PERMISSION_ERROR';
 }
};
const specContainer=x=>{
 const cs=x?.spec?.containers;
 return Array.isArray(cs)&&cs.length===1?cs[0]:null;
};
const svcContainer=x=>{
 const cs=x?.spec?.template?.spec?.containers;
 return Array.isArray(cs)&&cs.length===1?cs[0]:null;
};
const envVal=(container,name)=>container?.env?.find(e=>e.name===name);
const secretRef=(container,name)=>{
 const e=envVal(container,name);
 return e?.valueFrom?.secretKeyRef||null;
};
const activeTraffic=x=>(x?.status?.traffic||[])
 .filter(t=>Number(t.percent||0)>0)
 .map(t=>({revision:t.revisionName||'',percent:Number(t.percent)}))
 .sort((a,b)=>a.revision.localeCompare(b.revision));
const trafficKey=x=>JSON.stringify(activeTraffic(x));
const trafficExpected=arr=>arr.length===2&&
 arr.some(t=>t.revision===SERVICE+'-00031-vep'&&t.percent===99)&&
 arr.some(t=>t.revision===SERVICE+'-00038-pin'&&t.percent===1);
const imageDigest=(rev)=>{
 const c=specContainer(rev);
 if(!c||typeof c.image!=='string')return null;
 const raw=rev?.status?.imageDigest||'';
 const image=c.image;
 const match=String(raw).match(/sha256:[a-f0-9]{64}$/i);
 if(!match)return null;
 const sha=match[0].toLowerCase();
 const prefix=image.replace(/@sha256:[a-f0-9]{64}$/i,'')
  .replace(/:([^/:]+)$/,'');
 const out=prefix+'@'+sha;
 if(/\s/.test(out)||!/^([a-z0-9-]+-docker\.pkg\.dev|gcr\.io|[a-z0-9-]+\.gcr\.io)\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/i.test(out))
  return null;
 return out;
};
const revisionMinScale=x=>{
 const annotations=x?.metadata?.annotations||{};
 const value=annotations['autoscaling.knative.dev/minScale']??
  annotations['run.googleapis.com/minScale'];
 return value===undefined||value===null?'NOT_SET':String(value);
};
// Read-only: changing --min would change service-level capacity across
// revisions. The candidate MUST use --min-instances=0 (revision-level) only.
const serviceMinScale=x=>{
 const a=x?.metadata?.annotations||{};
 const value=x?.spec?.scaling?.minInstanceCount??
  a['run.googleapis.com/minScale']??
  a['autoscaling.knative.dev/minScale'];
 return value===undefined||value===null?'NOT_SET':String(value);
};
const revisionHasNoPositiveTrafficOrTag=(service,candidate)=>
  !(service?.status?.traffic||[]).some(t=>
   t?.revisionName===candidate&&
   (Number(t?.percent||0)>0||Boolean(t?.tag)))&&
  !(service?.spec?.traffic||[]).some(t=>
   t?.revisionName===candidate&&
   (Number(t?.percent||0)>0||Boolean(t?.tag)));
if(run.some(x=>!allowed.has(x))||(approved&&run.includes('--preflight-only'))){
 stop('INVALID_CLI_ARGUMENTS');
}else{
 const projectMeta=getJson(['projects','describe',PROJECT]);
 if(projectMeta?.projectId!==PROJECT||projectMeta?.lifecycleState!=='ACTIVE'){
  stop('PROJECT_IDENTITY_UNVERIFIED');
 }else{
  const base=['--project='+PROJECT,'--region='+REGION];
  const revision=getJson(['run','revisions','describe',T.revision,...base]);
  const service=getJson(['run','services','describe',SERVICE,...base]);
  const ow=getJson(['secrets','versions','list',T.openweatherSecret,'--project='+PROJECT]);
  const redemet=getJson(['secrets','versions','list',T.redemetSecret,'--project='+PROJECT]);
  const iam=getJson(['secrets','get-iam-policy',T.openweatherSecret,'--project='+PROJECT]);
  const p=assessOpenweatherV2RepairEvidence({
   revision,service,openweatherVersions:ow,redemetVersions:redemet,
   openweatherIamPolicy:iam
  });
  const rc=specContainer(revision), sc=svcContainer(service);
  const problems=[...p.blockers];
  if(p.status!=='REPAIR_PLAN_ELIGIBLE_NOT_DEPLOYED')problems.push('READONLY_PLAN_NOT_READY');
  // The live service template already uses OpenWeather v2 and is based on
  // 00043-hjk (Retired), while 00058-sos remains an immutable historical
  // reference. Do not treat the more recent template as the old v1 snapshot.
  if(service?.status?.latestCreatedRevisionName!==CURRENT_TEMPLATE_ORIGIN||
     service?.status?.latestReadyRevisionName!==T.revision)
   problems.push('SERVICE_REVISION_BASELINE_DRIFT');
  if(service?.metadata?.name!==SERVICE||!service?.metadata?.uid)
   problems.push('SERVICE_UID_NOT_VERIFIED');
  if(!trafficExpected(activeTraffic(service)))
   problems.push('NOT_THE_APPROVED_99_1_TRAFFIC_SPLIT');
  if(service?.spec?.traffic?.some(t=>t.latestRevision===true&&Number(t.percent||0)>0))
   problems.push('LIVE_LATEST_REVISION_ROUTING_FORBIDDEN');
  if(!rc||!sc)problems.push('CONTAINER_COUNT_NOT_ONE');
  if(rc&&sc&&sc.image!==rc.image)
   problems.push('SERVICE_TEMPLATE_IMAGE_DIFFERS_FROM_HISTORICAL_REVISION');
  if(rc&&sc&&(secretRef(sc,T.openweatherEnv)?.name!==T.openweatherSecret||
     secretRef(sc,T.openweatherEnv)?.key!=='2'))
   problems.push('CURRENT_TEMPLATE_OPENWEATHER_SECRET_NOT_V2');
  if(rc&&sc&&secretRef(sc,T.redemetEnv)?.key!=='1')
   problems.push('CURRENT_TEMPLATE_REDEMET_SECRET_NOT_V1');
  if(revision?.spec?.serviceAccountName!==service?.spec?.template?.spec?.serviceAccountName||
     !revision?.spec?.serviceAccountName)
   problems.push('SERVICE_IDENTITY_MISMATCH');
  // Historical 00058 and current service template both have minScale=1.
  // These are observations, not a reason to mutate them. Only the FUTURE
  // candidate is allowed to have minScale=0, expressly via the revision flag.
  if(revisionMinScale(revision)!==REVISION_MIN_EXPECTED_BEFORE)
   problems.push('HISTORICAL_MIN_SCALE_DRIFT');
  if(revisionMinScale(service?.spec?.template)!==REVISION_MIN_EXPECTED_BEFORE)
   problems.push('CURRENT_TEMPLATE_MIN_SCALE_DRIFT');
  if(!['NOT_SET','0'].includes(serviceMinScale(service)))
   problems.push('SERVICE_LEVEL_MIN_INSTANCES_NOT_ZERO');
  if(rc&&((rc.command||[]).length>0||(rc.args||[]).length>0||
      rc.ports?.[0]?.containerPort!==8080))
   problems.push('ENTRYPOINT_OR_PORT_UNEXPECTED');
  if(rc&&(rc.resources?.limits?.cpu!=='1'||rc.resources?.limits?.memory!=='512Mi'))
   problems.push('CPU_OR_MEMORY_UNEXPECTED');
  if(!imageDigest(revision))problems.push('PINNED_IMAGE_DIGEST_NOT_RESOLVED');
  const candidateState=candidateExistence();
  if(candidateState!=='CONFIRMED_ABSENT')
   problems.push('CANDIDATE_NOT_CONFIRMED_ABSENT_'+candidateState);
  if(Object.values(SAFE_ENV).some(x=>x!=='false')||
   Object.keys(SAFE_ENV).length!==8)
   problems.push('CANDIDATE_WEATHER_GATES_NOT_OFF');
  if(problems.length){
   stop('PREFLIGHT_NOT_SAFE_TO_CREATE',problems);
  }else if(!approved){
   emit({status:'PREFLIGHT_PASS_CANDIDATE_NOT_CREATED',
    candidate:CANDIDATE,
    historicalWorkerEnabled:p.historicalAutomaticWeatherCollectionOn,
    historicalFlagsPreserved:true,clientTraffic:'99_1',
    secretVersionRequested:'2',candidateWeatherFlagsOff:8,
    imageDigestPinned:true,tagCreated:false,
    priorHistoricalRevisionMinInstances:revisionMinScale(revision),
    priorTemplateMinInstances:revisionMinScale(service?.spec?.template),
    proposedCandidateMinInstances:REVISION_MIN_REQUIRED_AFTER,
    existingServiceLevelMinInstances:serviceMinScale(service),
    providerKeyValid:'NOT_VERIFIED',
    actualRuntimeSecretAccess:'NOT_VERIFIED',
    deploymentPerformed:false,
    productionTrafficChanged:false,releaseAuthorized:false});
  }else{
   // Everything read-only has passed. This is the ONLY cloud mutation below.
   // No tag: a 0% revision cannot be targeted through a public tag URL.
   const envUpdates=Object.entries(SAFE_ENV).map(([k,v])=>k+'='+v).join(',');
   const cmd=[
    'run','deploy',SERVICE,
    '--project='+PROJECT,'--region='+REGION,'--platform=managed',
    '--image='+imageDigest(revision),
    '--service-account='+revision.spec.serviceAccountName,
    '--port=8080','--cpu=1','--memory=512Mi',
    '--min-instances=0','--no-deploy-health-check',
    '--revision-suffix='+REVISION_SUFFIX,
    '--update-secrets='+T.openweatherEnv+'='+T.openweatherSecret+':2',
    '--update-env-vars='+envUpdates,
    '--no-traffic','--quiet'
   ];
   let deployed=false;
   try{
    execFileSync('gcloud',cmd,{
     encoding:'utf8',stdio:['ignore','pipe','pipe'],
     timeout:240000,maxBuffer:1024*1024
    });
    deployed=true;
   }catch{
    emit({status:'DEPLOY_COMMAND_FAILED_OR_TIMED_OUT',
     candidate:CANDIDATE,
     revisionMayExist:true,
     productionTrafficMustBeRechecked:true,
     weatherProviderCallsByScript:0,
     keyPayloadRead:false,releaseAuthorized:false});
    process.exitCode=2;
   }
   if(deployed){
    const after=getJson(['run','services','describe',SERVICE,...base]);
    const newRev=getJson(['run','revisions','describe',CANDIDATE,...base]);
    const historicAfter=getJson(['run','revisions','describe',T.revision,...base]);
    const newC=specContainer(newRev);
    const flagsValid=Object.entries(SAFE_ENV)
     .every(([name,value])=>envVal(newC,name)?.value===value);
    const secretValid=secretRef(newC,T.openweatherEnv)?.name===T.openweatherSecret&&
      secretRef(newC,T.openweatherEnv)?.key==='2';
    const redemetValid=secretRef(newC,T.redemetEnv)?.name===T.redemetSecret&&
      secretRef(newC,T.redemetEnv)?.key==='1';
    const safe=after?.metadata?.uid===service.metadata.uid&&
      trafficKey(after)===trafficKey(service)&&
      after?.status?.latestCreatedRevisionName===CANDIDATE&&
      newRev?.metadata?.name===CANDIDATE&&
      newRev?.spec?.serviceAccountName===revision.spec.serviceAccountName&&
      newC?.image===imageDigest(revision)&&flagsValid&&secretValid&&redemetValid&&
      revisionMinScale(newRev)===REVISION_MIN_REQUIRED_AFTER&&
      revisionMinScale(after?.spec?.template)===REVISION_MIN_REQUIRED_AFTER&&
      revisionMinScale(historicAfter)===revisionMinScale(revision)&&
      serviceMinScale(after)===serviceMinScale(service)&&
      revisionHasNoPositiveTrafficOrTag(after,CANDIDATE);
    emit({
      status:safe?'CREATED_ISOLATED_ZERO_TRAFFIC_PENDING_SMOKE':
       'CREATED_OR_ATTEMPTED_POSTCHECK_FAILED_NO_PROMOTION',
      candidate:CANDIDATE,created:!!newRev,
      trafficPreserved99_1:trafficKey(after)===trafficKey(service),
      clientTrafficMigrationAttempted:false,
      oldRevisionUntouched:true,secretV1Unchanged:true,
      candidateSecretBindingV2Verified:secretValid,
      redemetBindingPreserved:redemetValid,
      eightWeatherGatesExplicitlyOff:flagsValid,
      pinnedImageMatchesHistorical:!!newC&&newC.image===imageDigest(revision),
      tagCreated:false,providerWeatherCallsByScript:0,
      candidateRevisionMinInstances:revisionMinScale(newRev),
      newTemplateMinInstances:revisionMinScale(after?.spec?.template),
      historicalRevisionMinPreserved:
       revisionMinScale(historicAfter)===revisionMinScale(revision),
      serviceLevelMinPreserved:serviceMinScale(after)===serviceMinScale(service),
      noTaggedCandidate:revisionHasNoPositiveTrafficOrTag(after,CANDIDATE),
      deployHealthCheckSkipped:true,
      secretPayloadRead:false,
      actualSecretAccess:'NOT_VERIFIED',
      vendorKeyValidity:'NOT_VERIFIED',
      healthAndReadiness:'NOT_TESTED_NO_PUBLIC_TAG',
      productionReleaseApproved:false
    });
    if(!safe)process.exitCode=2;
   }
  }
 }
}
