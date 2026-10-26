#!/usr/bin/env node
// Blaise V6 RJ — read-only health audit. This does not repair the deployed app.
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BLAISE_BACKEND_BASE_URL?.trim()??'';
const report={product:'Blaise V6 RJ',kind:'READ_ONLY_BACKEND_HEALTH',checkedAt:new Date().toISOString(),status:'BLOCKED',checks:[]};
let exitCode=2;
try {
 if(!base)throw new Error('BACKEND_URL_NOT_CONFIGURED');
 const origin=new URL(base);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.port||origin.pathname!=='/')throw new Error('BACKEND_BASE_URL_NOT_HTTPS_OR_NOT_ORIGIN');
 for(const [path,expected] of [['/healthz','ok'],['/readyz','ready']]){
   const response=await fetch(new URL(path,origin),{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
   if(response.status!==200)throw new Error(path+'_HTTP_'+response.status);
   if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new Error(path+'_NOT_JSON');
   if(Number(response.headers.get('content-length')||'0')>4096)throw new Error(path+'_OVERSIZE');
   const body=await response.text();
   if(body.length>4096)throw new Error(path+'_OVERSIZE');
   let parsed;try{parsed=JSON.parse(body);}catch{throw new Error(path+'_INVALID_JSON');}
   if(parsed?.status!==expected)throw new Error(path+'_UNEXPECTED_STATUS');
   report.checks.push({path,state:'PASS'});
 }
 report.status='PASS_RUNTIME_HEALTH_ONLY';exitCode=0;
}catch(error){report.reason=String(error?.message??'UNKNOWN_ERROR').replace(/https?:\/\/\S+/g,'[url]');}
await mkdir('evidence/maintenance',{recursive:true});
await writeFile('evidence/maintenance/hourly.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log('BLAISE_RJ_HOURLY='+report.status+(report.reason?' reason='+report.reason:''));
console.log('LIMITATION=no_data_freshness_or_android_interface_test_in_this_probe');
process.exitCode=exitCode;
