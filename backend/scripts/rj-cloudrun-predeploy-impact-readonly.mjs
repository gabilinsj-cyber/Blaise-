/**
 * Cloud Shell read-only safety/cost exposure review. No secret payload access,
 * no Cloud Billing API, no HTTP request to service and no provider calls.
 */
import {execFileSync} from 'node:child_process';
import {reviewRjCloudRunPredeployImpact}
 from '../src/rj-cloudrun-predeploy-impact-audit.mjs';

const args=process.argv.slice(2);
const out=x=>console.log('RJ_CLOUDRUN_PREDEPLOY_SAFETY='+JSON.stringify(x));
if(args.length===0){
 out({status:'OFFLINE_ONLY',cloudReadPerformed:false,
  deployed:false,secretPayloadRead:false,weatherProviderContacted:false});
}else if(args.length!==1||args[0]!=='--cloud-readonly'){
 out({status:'BLOCKED_INVALID_ARGUMENT',deployed:false});
 process.exitCode=2;
}else{
 const project='blaise-v6-rj';
 const base=['--project='+project,'--region=southamerica-east1'];
 const get=(args)=>{
  try{
   return JSON.parse(execFileSync('gcloud',[...args,'--format=json'],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],
    timeout:30000,maxBuffer:5*1024*1024
   }));
  }catch{return null;}
 };
 const projectInfo=get(['projects','describe',project]);
 if(projectInfo?.projectId!==project||projectInfo?.lifecycleState!=='ACTIVE'){
  out({status:'BLOCKED_PROJECT_UNVERIFIED',cloudReadPerformed:true,
   deployed:false,secretPayloadRead:false});
  process.exitCode=2;
 }else{
  const service=get(['run','services','describe',
   'blaise-v6-rj-backend',...base]);
  const historicalRevision=get(['run','revisions','describe',
   'blaise-v6-rj-backend-00058-sos',...base]);
  const retiredRevision=get(['run','revisions','describe',
   'blaise-v6-rj-backend-00043-hjk',...base]);
  const report=reviewRjCloudRunPredeployImpact({
   service,historicalRevision,retiredRevision
  });
  out({...report,cloudReadPerformed:true,
   projectVerified:true,weatherProviderContacted:false,
   cloudRunRevisionCreated:false,billingUsageNotQueried:true});
  if(!report.recordsIdentified)process.exitCode=2;
 }
}
