import test from 'node:test';
import assert from 'node:assert/strict';
import {
 OPENWEATHER_ZERO_MIN_CANDIDATE,
 CANDIDATE_WEATHER_SWITCHES_OFF,
 revisionMinCount,serviceTemplateMinCount,serviceMinSnapshot,
 candidateMinZeroVerified,buildZeroMinCandidateDeployCommand
} from '../src/rj-openweather-zero-min-candidate.mjs';

const image='gcr.io/blaise-v6-rj/backend@sha256:'+'a'.repeat(64);
const sa='runtime@blaise-v6-rj.iam.gserviceaccount.com';
const oldRevision={metadata:{name:'blaise-v6-rj-backend-00058-sos',
 annotations:{'autoscaling.knative.dev/minScale':'1'}}};
const preService={metadata:{name:'blaise-v6-rj-backend',annotations:{}},
 spec:{template:{metadata:{
  annotations:{'autoscaling.knative.dev/minScale':'1'}}}}};
const postService={metadata:{name:'blaise-v6-rj-backend',annotations:{}},
 spec:{template:{metadata:{
  annotations:{'autoscaling.knative.dev/minScale':'0'}}}}};
const candidate={metadata:{name:'blaise-v6-rj-backend-owv2-211126',
 annotations:{'autoscaling.knative.dev/minScale':'0'}}};

test('gcloud deploy plan controls only revision min=0, never global service min',()=>{
 const args=buildZeroMinCandidateDeployCommand({image,serviceAccount:sa});
 assert.equal(args.filter(x=>x==='--min-instances=0').length,1);
 assert.ok(!args.some(x=>x.startsWith('--min=')));
 assert.ok(args.includes('--no-traffic'));
 assert.ok(args.includes('--no-deploy-health-check'));
 assert.ok(!args.some(x=>x.startsWith('--tag')));
 assert.ok(!args.includes('update-traffic'));
 assert.ok(args.some(x=>x==='--update-secrets=BLAISE_OPENWEATHER_API_KEY=blaise-rj-openweather-api-key:2'));
 assert.ok(args.some(x=>x==='--image='+image));
 assert.ok(Object.isFrozen(args));
});

test('historical and current template retain minimum one, candidate alone minimum zero',()=>{
 assert.equal(revisionMinCount(oldRevision),1);
 assert.equal(serviceTemplateMinCount(preService),1);
 assert.equal(revisionMinCount(candidate),0);
 assert.equal(serviceTemplateMinCount(postService),0);
 assert.equal(candidateMinZeroVerified({
  beforeService:preService,afterService:postService,newRevision:candidate
 }),true);
});

test('missing revision-scale annotation defaults to zero; explicit nonzero is rejected',()=>{
 assert.equal(revisionMinCount({metadata:{}}),0);
 assert.equal(revisionMinCount({}),0);
 assert.equal(revisionMinCount({
  metadata:{annotations:{'autoscaling.knative.dev/minScale':'1'}}}),1);
 assert.equal(revisionMinCount({
  metadata:{annotations:{'autoscaling.knative.dev/minScale':'invalid'}}}),null);
 assert.equal(revisionMinCount({
  metadata:{annotations:{'autoscaling.knative.dev/minScale':'1'}},
  spec:{scaling:{minInstanceCount:0}}}),null);
});

test('minScale=1 on new candidate blocks postcondition even with unchanged traffic',()=>{
 const changed={metadata:{annotations:{'autoscaling.knative.dev/minScale':'1'}}};
 assert.equal(candidateMinZeroVerified({
  beforeService:preService,afterService:postService,newRevision:changed
 }),false);
});

test('minScale=1 on new service template blocks postcondition',()=>{
 const wrong={metadata:{},spec:{template:{metadata:{
  annotations:{'autoscaling.knative.dev/minScale':'1'}}}}};
 assert.equal(candidateMinZeroVerified({
  beforeService:preService,afterService:wrong,newRevision:candidate
 }),false);
});

test('service-level min must be preserved, including when higher than zero',()=>{
 const pre={...preService,metadata:{
  annotations:{'run.googleapis.com/minScale':'3'}}};
 const after={...postService,metadata:{
  annotations:{'run.googleapis.com/minScale':'0'}}};
 assert.notEqual(serviceMinSnapshot(pre),serviceMinSnapshot(after));
 assert.equal(candidateMinZeroVerified({
  beforeService:pre,afterService:after,newRevision:candidate
 }),false);
 const same={...postService,metadata:{
  annotations:{'run.googleapis.com/minScale':'3'}}};
 assert.equal(candidateMinZeroVerified({
  beforeService:pre,afterService:same,newRevision:candidate
 }),true);
});

test('eight collection and approval flags are all explicitly false',()=>{
 assert.equal(Object.keys(CANDIDATE_WEATHER_SWITCHES_OFF).length,8);
 assert.ok(Object.values(CANDIDATE_WEATHER_SWITCHES_OFF)
  .every(v=>v==='false'));
 const cmd=buildZeroMinCandidateDeployCommand({image,serviceAccount:sa});
 const flags=cmd.find(x=>x.startsWith('--update-env-vars='));
 for(const name of Object.keys(CANDIDATE_WEATHER_SWITCHES_OFF))
  assert.ok(flags.includes(name+'=false'));
});

test('unexpected weather override or missing flag blocks command creation',()=>{
 const wrong={...CANDIDATE_WEATHER_SWITCHES_OFF,
  BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED:'true'};
 assert.throws(()=>buildZeroMinCandidateDeployCommand({
  image,serviceAccount:sa,weatherSwitches:wrong}),/WEATHER_COLLECTORS/);
 const missing={...CANDIDATE_WEATHER_SWITCHES_OFF};
 delete missing.BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED;
 assert.throws(()=>buildZeroMinCandidateDeployCommand({
  image,serviceAccount:sa,weatherSwitches:missing}),/WEATHER_COLLECTORS/);
});

test('non-digest image and unverified runtime identity cannot create safe command',()=>{
 assert.throws(()=>buildZeroMinCandidateDeployCommand({
  image:'gcr.io/blaise-v6-rj/backend:latest',serviceAccount:sa
 }),/IMAGE_DIGEST/);
 assert.throws(()=>buildZeroMinCandidateDeployCommand({
  image,serviceAccount:'user@gmail.com'
 }),/SERVICE_IDENTITY/);
 assert.equal(OPENWEATHER_ZERO_MIN_CANDIDATE.suffix,'owv2-211126');
});

test('pure functions cannot create revisions or read secret payloads',()=>{
 const plan=buildZeroMinCandidateDeployCommand({image,serviceAccount:sa});
 assert.equal(plan[0],'run');
 assert.equal(plan[1],'deploy');
 assert.ok(!plan.includes('secrets'));
 assert.ok(!plan.includes('versions'));
 assert.ok(!plan.includes('access'));
 assert.ok(!plan.includes('enable'));
 assert.ok(!plan.includes('services update-traffic'));
});
