/**
 * Cloud Shell metadata-only read of known Cloud Run startup incident.
 * DOES NOT call secrets versions access, deploy, HTTP URLs or provider APIs.
 * No raw log payloads, service account IDs, URLs, IPs, or IAM members printed.
 * Default mode never calls gcloud; --cloud-readonly explicitly opts into reads.
 */
import {execFileSync} from 'node:child_process';
import {diagnoseHistoricalStartupSecret}
 from '../src/rj-openweather-startup-secret-cause-audit.mjs';
const args=process.argv.slice(2);
const emit=x=>console.log('RJ_OPENWEATHER_STARTUP_CAUSE_READONLY='+JSON.stringify(x));
if(args.length===0){
 emit({status:'OFFLINE_NO_CLOUD_ACCESS',cloudCalls:0,deployPerformed:false,
  secretPayloadRead:false,weatherProviderContacted:false});
}else if(args.length!==1||args[0]!=='--cloud-readonly'){
 emit({status:'BLOCKED_UNKNOWN_ARGUMENT',cloudCalls:0,deployPerformed:false,
  secretPayloadRead:false});
 process.exitCode=2;
}else{
 const project='blaise-v6-rj',region='southamerica-east1';
 const SERVICE='blaise-v6-rj-backend';
 const get=parts=>{
  try{
   const raw=execFileSync('gcloud',[...parts,'--format=json'],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,
    maxBuffer:3*1024*1024
   });
   return JSON.parse(raw);
  }catch{return null;}
 };
 const identity=get(['projects','describe',project]);
 if(identity?.projectId!==project||identity?.lifecycleState!=='ACTIVE'){
  emit({status:'BLOCKED_PROJECT_NOT_VERIFIED',deployPerformed:false,
   secretPayloadRead:false,weatherProviderContacted:false});
  process.exitCode=2;
 }else{
  const base=['--project='+project,'--region='+region];
  const historicalRevision=get(['run','revisions','describe',
   SERVICE+'-00058-sos',...base]);
  const currentService=get(['run','services','describe',SERVICE,...base]);
  const owV1Metadata=get(['secrets','versions','describe','1',
   '--secret=blaise-rj-openweather-api-key','--project='+project]);
  const owV2Metadata=get(['secrets','versions','describe','2',
   '--secret=blaise-rj-openweather-api-key','--project='+project]);
  const redemetV1Metadata=get(['secrets','versions','describe','1',
   '--secret=blaise-rj-redemet-api-key','--project='+project]);
  const openweatherIamPolicy=get(['secrets','get-iam-policy',
   'blaise-rj-openweather-api-key','--project='+project]);
  const filter=[
   'resource.type="cloud_run_revision"',
   'resource.labels.revision_name="'+SERVICE+'-00058-sos"',
   'logName="projects/'+project+'/logs/run.googleapis.com%2Frequests"',
   'httpRequest.status=500',
   'timestamp>="2026-11-21T11:10:00Z"',
   'timestamp<"2026-11-21T11:32:00Z"'
  ].join(' AND ');
  const requestLogs=get(['logging','read',filter,
   '--project='+project,'--limit=20']);
  const report=diagnoseHistoricalStartupSecret({
   historicalRevision,currentService,owV1Metadata,owV2Metadata,
   redemetV1Metadata,openweatherIamPolicy,requestLogs
  });
  emit({...report,projectVerified:true,cloudReadOnly:true,
   requestLogQueryComplete:Array.isArray(requestLogs)&&requestLogs.length<20,
   historicalRevisionCreated:false,candidateCreated:false});
  if(!report.evidenceComplete||!report.productionTraffic99_1)
   process.exitCode=2;
 }
}
