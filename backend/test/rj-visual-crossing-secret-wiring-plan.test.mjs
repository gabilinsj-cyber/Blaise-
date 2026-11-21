import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVisualCrossingSecretWiringPlan,VC_CLOUD_RUN_SECRET_BINDING}
 from '../src/rj-visual-crossing-secret-wiring-plan.mjs';

test('proposed secret binding is pinned, least privilege and never applied',()=>{
 const p=createVisualCrossingSecretWiringPlan({
   existingSecretReferenceCount:3,secretReferenceExists:false
 });
 assert.equal(p.state,'PREPARED_OFFLINE_NOT_APPLIED');
 assert.equal(p.binding.secretResourceName,'blaise-visual-crossing-free-api-key');
 assert.equal(p.binding.pinnedVersion,'1');
 assert.equal(p.binding.environmentVariable,'BLAISE_VISUAL_CROSSING_FREE_API_KEY');
 assert.equal(p.binding.safeUpdateMode,'--update-secrets');
 assert.equal(p.binding.existingSecretReferenceCount,3);
 assert.equal(p.binding.preserveExistingSecrets,true);
 assert.equal(p.iam.proposedScope,'SECRET_ONLY_NOT_PROJECT');
 assert.equal(p.iam.proposedRole,'roles/secretmanager.secretAccessor');
 assert.equal(p.iam.noTokenCreatorGrant,true);
 for(const field of ['cloudApiCalled','weatherApiCalled','deployExecuted',
  'iamModified','workerOrSchedulerEnabled','clientPublished','keyRotated',
  'releaseApproved','sourceApiKeyValueIncluded','versionValueRead']){
  assert.equal(p[field],false,field);
 }
 assert.ok(p.requiredDisabledFlagNames.includes('BLAISE_VC_92_COLLECTION_ENABLED'));
 assert.ok(p.requiredDisabledFlagNames.includes('BLAISE_VISUAL_CROSSING_PRIVATE_ENABLED'));
});

test('rejects invalid metadata and never returns environment values',()=>{
 for(const n of [-1,1.25,Infinity,NaN,1001,'3',null]){
  assert.throws(()=>createVisualCrossingSecretWiringPlan({
   existingSecretReferenceCount:n
  }));
 }
 assert.throws(()=>createVisualCrossingSecretWiringPlan({
  secretReferenceExists:'yes'
 }));
 const secretSentinel='SENTINEL_DO_NOT_ECHO';
 const before=process.env.BLAISE_VISUAL_CROSSING_FREE_API_KEY;
 try{
  process.env.BLAISE_VISUAL_CROSSING_FREE_API_KEY=secretSentinel;
  const plan=createVisualCrossingSecretWiringPlan({
   existingSecretReferenceCount:3
  });
  assert.ok(!JSON.stringify(plan).includes(secretSentinel));
 }finally{
  if(before===undefined)delete process.env.BLAISE_VISUAL_CROSSING_FREE_API_KEY;
  else process.env.BLAISE_VISUAL_CROSSING_FREE_API_KEY=before;
 }
});

test('future binding uses existing private collector contract but does not wire runtime',()=>{
 const privateCollector=readFileSync(
  new URL('../src/rj-visual-crossing-free-private.mjs',import.meta.url),'utf8'
 );
 const runtime=readFileSync(new URL('../src/runtime.mjs',import.meta.url),'utf8');
 assert.ok(privateCollector.includes(
  'env.BLAISE_VISUAL_CROSSING_FREE_API_KEY'));
 assert.ok(privateCollector.includes(
  "env.BLAISE_VISUAL_CROSSING_ONESHOT_APPROVED!=='true'"));
 assert.ok(!runtime.includes("from './rj-visual-crossing-secret-wiring-plan.mjs'"));
 assert.ok(!runtime.includes("from './rj-visual-crossing-free-private.mjs'"));
 assert.equal(VC_CLOUD_RUN_SECRET_BINDING.collectorSchedulerEnabled,false);
 assert.equal(VC_CLOUD_RUN_SECRET_BINDING.clientsEnabled,false);
});
