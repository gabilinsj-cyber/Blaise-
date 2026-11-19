import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {probeVisualCrossingSecretFromApprovedRuntime}
 from '../src/rj-visual-crossing-runtime-secret-proof.mjs';

const ENV={CLOUD_RUN_JOB:'blaise-vc-secret-proof-once',
 CLOUD_RUN_TASK_INDEX:'0',CLOUD_RUN_TASK_COUNT:'1',
 BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED:'true'};
const IDENTITY='blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com';
const KEY='EXPOSED_CREDENTIAL_DO_NOT_PRINT';

function mocks(status=200,{email=IDENTITY}={}){
 const calls=[];let discarded=0;
 const fetchImpl=async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith('/email'))
   return {status:200,text:async()=>email};
  if(url.endsWith('/token'))
   return {status:200,json:async()=>({
    token_type:'Bearer',access_token:'MOCK_OAUTH_TOKEN_abcdefghijklmnopqrstuvwxyz'
   })};
  if(url.includes('secretmanager.googleapis.com')){
   assert.equal(opts.method,'GET');
   assert.equal(opts.redirect,'error');
   assert.ok(opts.headers.Authorization.startsWith('Bearer '));
   return {status,body:{cancel:async()=>{discarded++;}},
    text:async()=>{throw Error('must never consume key='+KEY)},
    json:async()=>{throw Error('must never consume key='+KEY)},
    arrayBuffer:async()=>{throw Error('must never consume key='+KEY)}};
  }
  throw Error('unexpected network destination');
 };
 return {fetchImpl,calls,get discarded(){return discarded}};
}

test('default is fail-closed: no metadata, no secret access, no provider',async()=>{
 const m=mocks();
 for(const env of [{},{K_SERVICE:'blaise-v6-rj-backend',
  BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED:'true'},
  {CLOUD_RUN_JOB:'other-job',CLOUD_RUN_TASK_INDEX:'0',
   CLOUD_RUN_TASK_COUNT:'1',BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED:'true'},
  {CLOUD_RUN_JOB:'blaise-vc-secret-proof-once',
   CLOUD_RUN_TASK_INDEX:'1',CLOUD_RUN_TASK_COUNT:'2',
   BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED:'true'},
  {BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED:'true'}]){
  const r=await probeVisualCrossingSecretFromApprovedRuntime({
   env,fetchImpl:m.fetchImpl
  });
  assert.equal(r.status,'EXPLICIT_APPROVAL_AND_ISOLATED_JOB_REQUIRED');
  assert.equal(r.secretAccessAttempted,false);
  assert.equal(r.releaseApproved,false);
 }
 assert.equal(m.calls.length,0);
});

test('identity mismatch never attempts token or secret read',async()=>{
 const m=mocks(200,{email:'other-runtime@example.invalid'});
 const r=await probeVisualCrossingSecretFromApprovedRuntime({
  env:ENV,fetchImpl:m.fetchImpl
 });
 assert.equal(r.status,'SERVICE_IDENTITY_MISMATCH');
 assert.equal(m.calls.length,1);
});

test('real success status is reported only for runtime and response body discarded',async()=>{
 const m=mocks(200);
 const r=await probeVisualCrossingSecretFromApprovedRuntime({
  env:ENV,fetchImpl:m.fetchImpl
 });
 assert.equal(r.status,'VERSION_ACCESS_GRANTED_AT_TIME');
 assert.equal(r.authorizationAtTime,'GRANTED_AT_TIME_OF_PROBE');
 assert.equal(r.identityVerified,true);
 assert.equal(r.secretPayloadParsed,false);
 assert.equal(r.secretPayloadLogged,false);
 assert.equal(r.providerCalled,false);
 assert.equal(r.clientPublished,false);
 assert.equal(r.releaseApproved,false);
 assert.equal(m.discarded,1);
 assert.equal(m.calls.length,3);
 assert.ok(!JSON.stringify(r).includes(KEY));
 assert.ok(!JSON.stringify(r).includes('MOCK_OAUTH_TOKEN_'));
});

test('403 is denied for this attempt, not green, and body is discarded',async()=>{
 const m=mocks(403);
 const r=await probeVisualCrossingSecretFromApprovedRuntime({
  env:ENV,fetchImpl:m.fetchImpl
 });
 assert.equal(r.status,'VERSION_ACCESS_DENIED_AT_TIME');
 assert.equal(r.authorizationAtTime,'DENIED_FOR_THIS_ATTEMPT');
 assert.equal(r.releaseApproved,false);
 assert.equal(m.discarded,1);
});

test('unexpected result never converted to pass',async()=>{
 const m=mocks(500);
 const r=await probeVisualCrossingSecretFromApprovedRuntime({
  env:ENV,fetchImpl:m.fetchImpl
 });
 assert.equal(r.status,'SECRET_MANAGER_UNEXPECTED_STATUS');
 assert.equal(r.authorizationAtTime,'NOT_VERIFIED');
 assert.equal(m.discarded,1);
});

test('production runtime imports neither diagnostic module nor entrypoint',()=>{
 const runtime=readFileSync(new URL('../src/runtime.mjs',import.meta.url),'utf8');
 assert.ok(!runtime.includes('rj-visual-crossing-runtime-secret-proof'));
 assert.ok(!runtime.includes('visual-crossing-runtime-secret-proof.mjs'));
});
