import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,readFileSync,rmSync,existsSync}
 from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';

const SCRIPT=resolve(dirname(fileURLToPath(import.meta.url)),
 '../scripts/rj-openweather-v2-zero-traffic-candidate.mjs');
const FAKE=String.raw`#!/usr/bin/env node
// This gcloud is an in-memory fixture ONLY, never a Google Cloud connection.
const fs=require('node:fs');
const a=process.argv.slice(2), state=process.env.MOCK_RUN_STATE;
const bad=process.env.MOCK_BAD||'';
const key=a.slice(0,2).join(' ');
const service='blaise-v6-rj-backend', historical=service+'-00058-sos';
const candidate=service+'-owv2-211126';
const sa='runtime@blaise-v6-rj.iam.gserviceaccount.com';
const hash='a'.repeat(64);
const oldImage='gcr.io/blaise-v6-rj/backend:old';
const pinnedImage='gcr.io/blaise-v6-rj/backend@sha256:'+hash;
const env=[{name:'BLAISE_OPENWEATHER_API_KEY',
 valueFrom:{secretKeyRef:{name:'blaise-rj-openweather-api-key',key:'1'}}},
 {name:'BLAISE_REDEMET_API_KEY',
 valueFrom:{secretKeyRef:{name:'blaise-rj-redemet-api-key',key:'1'}}},
 {name:'BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED',value:'true'}];
const oldSpec={serviceAccountName:sa,containers:[{
 image:oldImage,env,ports:[{containerPort:8080}],
 resources:{limits:{cpu:'1',memory:'512Mi'}}
}]};
const currentSpec={...oldSpec,containers:[{...oldSpec.containers[0],
 env:env.map(e=>e.name==='BLAISE_OPENWEATHER_API_KEY'
  ?{...e,valueFrom:{secretKeyRef:{
    name:'blaise-rj-openweather-api-key',
    key:bad==='templatekey'?'1':'2'}}}:e)}]};
const newEnv=[{name:'BLAISE_OPENWEATHER_API_KEY',
 valueFrom:{secretKeyRef:{name:'blaise-rj-openweather-api-key',key:'2'}}},
 {name:'BLAISE_REDEMET_API_KEY',
 valueFrom:{secretKeyRef:{name:'blaise-rj-redemet-api-key',key:'1'}}},
 ...['BLAISE_OPENWEATHER_AGENT13_ENABLED',
 'BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED',
 'BLAISE_AGENT13_FIRESTORE_ENABLED',
 'BLAISE_AGENT13_TEMPERATURE_CONTINGENCY_ENABLED',
 'BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED',
 'BLAISE_MET_NORWAY_ENABLED',
 'BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED',
 'BLAISE_INMET_P0_PUBLISH_ENABLED'].map(name=>({name,value:'false'}))];
const newSpec={...oldSpec,containers:[{...oldSpec.containers[0],
 image:pinnedImage,env:newEnv}]};
const minAnn=n=>({'autoscaling.knative.dev/minScale':n});
const candidateMin=bad==='candidate-min-1'?'1':'0';
const active=[{revisionName:service+'-00031-vep',percent:99},
 {revisionName:service+'-00038-pin',percent:1},
 {revisionName:historical,tag:'validacao-rj'}];
if(bad==='traffic')active[0].percent=98;
const result=x=>process.stdout.write(JSON.stringify(x)+'\n');
if(key==='run deploy'){
 if(!a.includes('--no-traffic')||a.some(x=>x.startsWith('--tag='))||
   !a.includes('--min-instances=0')||
   a.some(x=>x==='--min=0'||x.startsWith('--min='))||
   !a.includes('--no-deploy-health-check')||
   !a.some(x=>x.includes('blaise-rj-openweather-api-key:2'))){
  process.exit(13);
 }
 fs.writeFileSync(state,JSON.stringify(a));
 process.exit(0);
}
if(key==='projects describe'){
 result({projectId:'blaise-v6-rj',lifecycleState:'ACTIVE'});
}else if(key==='run services'&&a[2]==='describe'){
 result({
  metadata:{name:service,uid:'unchanged-uid',
   annotations:bad==='service-min-1'?{'run.googleapis.com/minScale':'1'}:{}},
  spec:{template:{metadata:{annotations:
   minAnn(fs.existsSync(state)?candidateMin:(bad==='template-min-0'?'0':'1'))},
   spec:fs.existsSync(state)?newSpec:currentSpec},
   traffic:active},
  status:{latestCreatedRevisionName:fs.existsSync(state)?candidate:service+'-00043-hjk',
   latestReadyRevisionName:historical,
   traffic:active}
 });
}else if(key==='run revisions'&&a[2]==='describe'){
 const name=a[3];
 if(name===historical){
  result({metadata:{name:historical,
   annotations:minAnn(bad==='historic-min-0'?'0':'1')},spec:oldSpec,
   status:{imageDigest:pinnedImage}});
 }else if(name===candidate&&fs.existsSync(state)){
  result({metadata:{name:candidate,
   annotations:minAnn(candidateMin)},spec:newSpec,
   status:{imageDigest:pinnedImage}});
 }else {
  process.stderr.write(bad==='forbidden'?'PERMISSION_DENIED':'NOT_FOUND');
  process.exit(1);
 }
}else if(key==='secrets versions'&&a[2]==='list'){
 const name=a[3];
 if(name==='blaise-rj-openweather-api-key'){
  result([{name:'versions/1',state:'DISABLED'},
   {name:'versions/2',state:bad==='secret'?'DISABLED':'ENABLED'}]);
 }else if(name==='blaise-rj-redemet-api-key'){
  result([{name:'versions/1',state:'ENABLED'}]);
 }else process.exit(2);
}else if(key==='secrets get-iam-policy'){
 result({bindings:[{role:'roles/secretmanager.secretAccessor',
  members:['serviceAccount:'+sa]}]});
}else process.exit(20);
`;

const make=()=>{
 const dir=mkdtempSync(join(tmpdir(),'blaise-owv2-mock-'));
 writeFileSync(join(dir,'gcloud'),FAKE);
 chmodSync(join(dir,'gcloud'),0o755);
 return dir;
};
const invoke=(dir,args,bad='')=>spawnSync(process.execPath,[SCRIPT,...args],{
 cwd:resolve('.'),
 encoding:'utf8',
 env:{...process.env,PATH:dir+':'+process.env.PATH,
  MOCK_RUN_STATE:join(dir,'deployed'),MOCK_BAD:bad},
 timeout:30000
});
test('default is read-only preflight: no Cloud Run deployment',()=>{
 const dir=make();
 try{
  const result=invoke(dir,[]);
  assert.equal(result.status,0,result.stderr+' '+result.stdout);
  assert.match(result.stdout,/PREFLIGHT_PASS_CANDIDATE_NOT_CREATED/);
  assert.match(result.stdout,/"secretVersionRequested":"2"/);
  assert.match(result.stdout,/"candidateWeatherFlagsOff":8/);
  assert.match(result.stdout,/"priorHistoricalRevisionMinInstances":"1"/);
  assert.match(result.stdout,/"priorTemplateMinInstances":"1"/);
  assert.match(result.stdout,/"proposedCandidateMinInstances":"0"/);
  assert.equal(existsSync(join(dir,'deployed')),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('explicit owner-approved flag produces untagged 0% candidate only in mock GCloud',()=>{
 const dir=make();
 try{
  const result=invoke(dir,['--execute-approved-zero-traffic']);
  assert.equal(result.status,0,result.stderr+' '+result.stdout);
  assert.match(result.stdout,/CREATED_ISOLATED_ZERO_TRAFFIC_PENDING_SMOKE/);
  assert.match(result.stdout,/"trafficPreserved99_1":true/);
  assert.match(result.stdout,/"eightWeatherGatesExplicitlyOff":true/);
  assert.match(result.stdout,/"candidateSecretBindingV2Verified":true/);
  assert.match(result.stdout,/"productionReleaseApproved":false/);
  assert.match(result.stdout,/"candidateRevisionMinInstances":"0"/);
  assert.match(result.stdout,/"historicalRevisionMinPreserved":true/);
  assert.match(result.stdout,/"serviceLevelMinPreserved":true/);
  assert.match(result.stdout,/"noTaggedCandidate":true/);
  const cmd=JSON.parse(readFileSync(join(dir,'deployed'),'utf8'));
  assert.ok(cmd.includes('--no-traffic'));
  assert.ok(cmd.includes('--min-instances=0'));
  assert.ok(cmd.includes('--no-deploy-health-check'));
  assert.ok(!cmd.some(x=>x.startsWith('--min=')));
  assert.ok(!cmd.some(x=>x.startsWith('--tag')));
  assert.ok(!cmd.some(x=>x.includes('update-traffic')));
  assert.ok(cmd.some(x=>x.startsWith('--image=')&&x.includes('@sha256:')));
  assert.ok(cmd.some(x=>x.includes('blaise-rj-openweather-api-key:2')));
  assert.ok(cmd.some(x=>x.includes('BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED=false')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('disabled v2 fails closed before deployment',()=>{
 const dir=make();
 try{
  const result=invoke(dir,['--execute-approved-zero-traffic'],'secret');
  assert.equal(result.status,2);
  assert.match(result.stdout,/PREFLIGHT_NOT_SAFE_TO_CREATE/);
  assert.equal(existsSync(join(dir,'deployed')),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('traffic drift fails closed even with explicit consent flag',()=>{
 const dir=make();
 try{
  const result=invoke(dir,['--execute-approved-zero-traffic'],'traffic');
  assert.equal(result.status,2);
  assert.match(result.stdout,/NOT_THE_APPROVED_99_1_TRAFFIC_SPLIT/);
  assert.equal(existsSync(join(dir,'deployed')),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('unexpected argument fails closed without any GCloud mutation',()=>{
 const dir=make();
 try{
  const result=invoke(dir,['--force']);
  assert.equal(result.status,2);
  assert.match(result.stdout,/BLOCKED_NO_DEPLOY/);
  assert.equal(existsSync(join(dir,'deployed')),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('unknown candidate absence due to IAM denial blocks deployment',()=>{
 const dir=make();
 try{
  const result=invoke(dir,['--execute-approved-zero-traffic'],'forbidden');
  assert.equal(result.status,2);
  assert.match(result.stdout,/CANDIDATE_NOT_CONFIRMED_ABSENT/);
  assert.match(result.stdout,/UNKNOWN_API_OR_PERMISSION_ERROR/);
  assert.equal(existsSync(join(dir,'deployed')),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('historical and template minScale=1 are allowed only as preserved baseline',()=>{
 for(const [bad,reason] of [
  ['historic-min-0','HISTORICAL_MIN_SCALE_DRIFT'],
  ['template-min-0','CURRENT_TEMPLATE_MIN_SCALE_DRIFT'],
  ['service-min-1','SERVICE_LEVEL_MIN_INSTANCES_NOT_ZERO'],
  ['templatekey','CURRENT_TEMPLATE_OPENWEATHER_SECRET_NOT_V2']
 ]){
  const dir=make();
  try{
   const r=invoke(dir,['--execute-approved-zero-traffic'],bad);
   assert.equal(r.status,2,bad+' '+r.stdout);
   assert.match(r.stdout,new RegExp(reason),bad);
   assert.equal(existsSync(join(dir,'deployed')),false,bad);
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});
test('candidate minScale drift after deploy fails postcheck and never promotes',()=>{
 const dir=make();
 try{
  const r=invoke(dir,['--execute-approved-zero-traffic'],'candidate-min-1');
  assert.equal(r.status,2);
  assert.match(r.stdout,/CREATED_OR_ATTEMPTED_POSTCHECK_FAILED_NO_PROMOTION/);
  assert.match(r.stdout,/"candidateRevisionMinInstances":"1"/);
  const cmd=JSON.parse(readFileSync(join(dir,'deployed'),'utf8'));
  assert.ok(cmd.includes('--min-instances=0'));
  assert.ok(!cmd.some(x=>x.startsWith('--tag=')));
  assert.ok(!cmd.some(x=>x.includes('update-traffic')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
