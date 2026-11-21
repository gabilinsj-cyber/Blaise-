/**
 * Run from Cloud Shell in a separate worktree, with NO provider credentials.
 *
 * Offline default: node scripts/rj-production-cloud-readonly-probe.mjs
 * Live read-only metadata: ... --gcloud-readonly
 * Optional Cloud Run GET /healthz + /readyz: ... --gcloud-readonly --health-readonly
 *
 * No writes/deploy/config changes/API-key access, no Firestore/provider API.
 * Never print raw gcloud output, service identities, URLs, secrets or users.
 */
import {execFileSync} from 'node:child_process';
import {assessCloudReadOnlySummary}
 from '../src/rj-production-control-plane-audit.mjs';

const opt=process.argv.slice(2);
const metadata=opt.includes('--gcloud-readonly');
const health=opt.includes('--health-readonly');
const emit=x=>console.log('RJ_CLOUD_PRODUCTION_READ_ONLY='+JSON.stringify(x));
if(!metadata){
 emit({status:'OFFLINE_NO_GCLOUD_NO_PROVIDER',
  cloudMutationsPerformed:0,providerCalls:0,releaseApproved:false});
}else if(health&&!metadata){
 emit({status:'INVALID_FLAGS'});
 process.exitCode=2;
}else{
 const project='blaise-v6-rj';
 const getJson=(args)=>{
  try{
   const raw=execFileSync('gcloud',args,{
    stdio:['ignore','pipe','pipe'],encoding:'utf8',
    timeout:25000,maxBuffer:3*1024*1024
   });
   const parsed=JSON.parse(raw);
   return parsed&&typeof parsed==='object'?parsed:null;
  }catch{return null;}
 };
 const getValue=(args)=>{
  try{
   const x=execFileSync('gcloud',args,{
    stdio:['ignore','pipe','pipe'],encoding:'utf8',
    timeout:12000,maxBuffer:100000
   }).trim();
   return /^(\(unset\)|unset|none|)$/i.test(x)?null:x;
  }catch{return null;}
 };
 const region=process.env.BLAISE_AUDIT_CLOUDRUN_REGION||
  getValue(['config','get-value','run/region'])||null;
 const selectedName=process.env.BLAISE_AUDIT_CLOUDRUN_SERVICE||null;
 const validRegion=region&&/^[a-z]+-[a-z0-9]+[0-9]$/.test(region);
 const validService=selectedName===null||
  /^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/.test(selectedName);
 if(!validService) {
   emit({status:'INVALID_SERVICE_NAME',cloudMutationsPerformed:0,providerCalls:0});
   process.exitCode=2;
 }else{
  const projectMeta=getJson(['projects','describe',project,'--format=json']);
  const secretVersions=getJson(['secrets','versions','list',
   'blaise-meteoblue-free-api-key','--project='+project,'--format=json']);
  const services=validRegion?getJson(['run','services','list',
   '--platform=managed','--project='+project,'--region='+region,
   '--format=json']):null;
  const names=Array.isArray(services)?services.map(s=>s?.metadata?.name||s?.name)
   .filter(x=>typeof x==='string'):[];
  const chosen=selectedName|| (names.length===1?names[0]:null);
  const canDescribe=validRegion&&chosen&&names.includes(chosen);
  const serviceMeta=canDescribe?getJson(['run','services','describe',chosen,
   '--platform=managed','--project='+project,'--region='+region,
   '--format=json']):null;
  const runtimeServiceAccount=serviceMeta?.spec?.template?.spec?.serviceAccountName??
   serviceMeta?.template?.serviceAccount??null;
  const secretIam=getJson(['secrets','get-iam-policy',
   'blaise-meteoblue-free-api-key','--project='+project,'--format=json']);
  const scheduler=validRegion?getJson(['scheduler','jobs','list',
   '--project='+project,'--location='+region,'--format=json']):null;
  let healthState='NOT_REQUESTED';
  if(health){
   const source=serviceMeta?.status?.url;
   if(!canDescribe||typeof source!=='string')healthState='SERVICE_URL_NOT_VERIFIED';
   else {
    try{
     const endpoint=new URL(source);
     // Only the HTTPS URL read from Cloud Run's own control plane is trusted.
     if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||
        !endpoint.hostname.endsWith('.run.app'))throw Error('INVALID_CLOUD_RUN_HOST');
     const fetchHealth=async path=>{
      const u=new URL(path,endpoint);
      const r=await fetch(u,{
       method:'GET',redirect:'manual',
       headers:{accept:'application/json'},
       signal:AbortSignal.timeout(8500)
      });
      if(r.status===401||r.status===403)return 'AUTH_REQUIRED';
      if(r.status!==200)return 'HTTP_NOT_200';
      const data=await r.json().catch(()=>null);
      return (path==='/healthz'&&data?.status==='ok')||
       (path==='/readyz'&&data?.status==='ready')?'PASS':'INVALID_HEALTH_BODY';
     };
     const a=await fetchHealth('/healthz');
     const b=await fetchHealth('/readyz');
     healthState=a==='PASS'&&b==='PASS'?'BOTH_HEALTH_ENDPOINTS_PASS':
      'NOT_VERIFIED_'+a+'_'+b;
    }catch{healthState='HEALTH_NETWORK_OR_HOST_UNAVAILABLE'}
   }
  }
  const a=assessCloudReadOnlySummary({
   project:projectMeta,
   runServices:services,
   runService:serviceMeta,
   meteoblueSecretVersions:secretVersions,
   secretIamPolicy:secretIam,
   runtimeServiceAccount,
   schedulerJobs:scheduler,
   health:healthState
  });
  emit({...a,cloudRunRegionKnown:!!validRegion,
   expectedRunServiceFound:canDescribe===true,
   multiServiceRequiresExplicitName:names.length>1&&!selectedName,
   preflightRealEnvironmentCredentials:'NOT_READ',
   localEvidenceOnly:true
  });
  if(!projectMeta||!validRegion||!serviceMeta)process.exitCode=2;
 }
}
