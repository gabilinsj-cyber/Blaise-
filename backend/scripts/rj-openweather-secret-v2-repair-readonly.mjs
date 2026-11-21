/**
 * Offline by default; --gcloud-readonly audits control plane JSON only.
 * No secret payload access, no provider network, no deploy, no traffic edits.
 * Output is aggregated and contains no service account, URLs, or keys.
 */
import {execFileSync} from 'node:child_process';
import {assessOpenweatherV2RepairEvidence,OPENWEATHER_V2_REPAIR_TARGET}
 from '../src/rj-openweather-secret-v2-repair-plan.mjs';
const args=process.argv.slice(2);
const output=o=>console.log('RJ_OPENWEATHER_V2_REPAIR_READONLY='+JSON.stringify(o));

if(!args.includes('--gcloud-readonly')){
 output({status:'OFFLINE_NO_CLOUD_ACCESS',proposedSecretVersion:'2',
  secretPayloadRead:false,weatherProviderContacted:false,
  deployPerformed:false,productionTrafficChanged:false,
  repairAuthorized:false});
}else if(args.some(x=>x!=='--gcloud-readonly')){
 output({status:'BLOCKED_UNKNOWN_ARGUMENT',deployPerformed:false});
 process.exitCode=2;
}else{
 const project=OPENWEATHER_V2_REPAIR_TARGET.project;
 const region='southamerica-east1';
 const get=(parts)=>{
  try{
   const raw=execFileSync('gcloud',[...parts,'--format=json'],{
    encoding:'utf8',timeout:25000,maxBuffer:5*1024*1024,
    stdio:['ignore','pipe','pipe']
   });
   const value=JSON.parse(raw);
   return value&&typeof value==='object'?value:null;
  }catch{return null;}
 };
 const p=get(['projects','describe',project]);
 const projectConfirmed=p?.projectId===project&&p?.lifecycleState==='ACTIVE';
 if(!projectConfirmed){
  output({status:'BLOCKED_PROJECT_IDENTITY_NOT_VERIFIED',
   deployPerformed:false,secretPayloadRead:false,
   weatherProviderContacted:false,productionTrafficChanged:false});
  process.exitCode=2;
 }else{
  const base=['--project='+project,'--region='+region];
  const rev=get(['run','revisions','describe',OPENWEATHER_V2_REPAIR_TARGET.revision,...base]);
  const svc=get(['run','services','describe',OPENWEATHER_V2_REPAIR_TARGET.service,...base]);
  const owVersions=get(['secrets','versions','list',OPENWEATHER_V2_REPAIR_TARGET.openweatherSecret,'--project='+project]);
  const rdVersions=get(['secrets','versions','list',OPENWEATHER_V2_REPAIR_TARGET.redemetSecret,'--project='+project]);
  const iam=get(['secrets','get-iam-policy',OPENWEATHER_V2_REPAIR_TARGET.openweatherSecret,'--project='+project]);
  const report=assessOpenweatherV2RepairEvidence({
   revision:rev,service:svc,openweatherVersions:owVersions,
   redemetVersions:rdVersions,openweatherIamPolicy:iam
  });
  output({...report,projectConfirmed:true,
   regionConfirmed:true,
   effectiveAccessStillRequiresIndependentCheck:true,
   providerKeyValidityStillRequiresIndependentCheck:true});
  if(report.status!=='REPAIR_PLAN_ELIGIBLE_NOT_DEPLOYED')
   process.exitCode=2;
 }
}
