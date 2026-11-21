import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {reviewRjCloudRunPredeployImpact as review}
 from '../src/rj-cloudrun-predeploy-impact-audit.mjs';

const base='blaise-v6-rj-backend';
const fixture=()=>{
 const service={
  metadata:{name:base,annotations:{}},
  spec:{
   template:{metadata:{annotations:{
    'autoscaling.knative.dev/minScale':'1',
    'run.googleapis.com/cpu-throttling':'true'
   }}},
   traffic:[{revisionName:base+'-00031-vep',percent:99},
    {revisionName:base+'-00038-pin',percent:1},
    {revisionName:base+'-00058-sos',tag:'validacao-rj'}]
  },
  status:{traffic:[
   {revisionName:base+'-00031-vep',percent:99},
   {revisionName:base+'-00038-pin',percent:1},
   {revisionName:base+'-00058-sos',tag:'validacao-rj'}
  ]}
 };
 const historicalRevision={
  metadata:{name:base+'-00058-sos',annotations:{
   'autoscaling.knative.dev/minScale':'1',
   'run.googleapis.com/cpu-throttling':'false'
  }},
  status:{conditions:[{type:'Ready',status:'True'},{type:'Active',status:'True'}]}
 };
 const retiredRevision={
  metadata:{name:base+'-00043-hjk'},
  status:{conditions:[
   {type:'Ready',status:'False',reason:'Retired'},
   {type:'Active',status:'False',reason:'Retired'}
  ]}
 };
 return {service,historicalRevision,retiredRevision};
};
test('real evidence shows historic tagged min1 exposure even at 0% traffic',()=>{
 const r=review(fixture());
 assert.equal(r.status,'BLOCKED_FOR_REAL_DEPLOY_PENDING_REVIEW');
 assert.equal(r.recordsIdentified,true);
 assert.equal(r.productionTrafficExactly99_1,true);
 assert.equal(r.historicalRevisionZeroTraffic,true);
 assert.equal(r.historicalRevisionHasTag,true);
 assert.equal(r.historicTagCostExposure,true);
 assert.equal(r.minimumInstancesHistorical,1);
 assert.equal(r.minimumInstancesCurrentTemplate,1);
 assert.equal(r.futureCandidateMinimum,0);
 assert.equal(r.billingModeHistorical,'INSTANCE_BASED');
 assert.equal(r.billingModeCurrentTemplate,'REQUEST_BASED');
 assert.ok(r.riskCodes.includes('EXISTING_TAGGED_REVISION_MIN_ONE_MAY_INCUR_IDLE_COST'));
 assert.equal(r.createdNewRevision,false);
 assert.equal(r.secretPayloadRead,false);
});
test('no tagged historical revision yields no tagged minimum billing exposure',()=>{
 const a=fixture();
 delete a.service.status.traffic[2].tag;
 const r=review(a);
 assert.equal(r.historicTagCostExposure,false);
 assert.equal(r.historicalRevisionHasTag,false);
 assert.ok(!r.riskCodes.includes('EXISTING_TAGGED_REVISION_MIN_ONE_MAY_INCUR_IDLE_COST'));
 assert.equal(r.status,'BLOCKED_FOR_REAL_DEPLOY_PENDING_REVIEW');
});
test('unknown billing mode is unknown, never guessed as free',()=>{
 const a=fixture();
 delete a.historicalRevision.metadata.annotations['run.googleapis.com/cpu-throttling'];
 const r=review(a);
 assert.equal(r.billingModeHistorical,'NOT_VERIFIED');
 assert.ok(r.riskCodes.includes('HISTORICAL_BILLING_MODE_NOT_VERIFIED'));
 assert.equal(r.evidenceDoesNotProveActualChargedAmount,true);
});
test('traffic drift is an explicit blocking risk',()=>{
 const a=fixture();
 a.service.status.traffic[0].percent=98;
 const r=review(a);
 assert.equal(r.productionTrafficExactly99_1,false);
 assert.ok(r.riskCodes.includes('LIVE_TRAFFIC_BASELINE_NOT_PROVEN'));
 assert.equal(r.status,'BLOCKED_FOR_REAL_DEPLOY_PENDING_REVIEW');
});
test('new candidate unexpectedly referenced is exposed, never silently approved',()=>{
 const a=fixture();
 a.service.spec.traffic.push({revisionName:base+'-owv2-211126',tag:'test'});
 const r=review(a);
 assert.equal(r.candidateAbsentFromTraffic,false);
 assert.ok(r.riskCodes.includes('CANDIDATE_REFERENCED_IN_TRAFFIC'));
});
test('missing revision metadata fails closed without raw secrets',()=>{
 const a=fixture();
 a.historicalRevision=null;
 const r=review(a);
 assert.equal(r.recordsIdentified,false);
 assert.ok(r.riskCodes.includes('READ_ONLY_CLOUD_RECORDS_INCOMPLETE'));
 const output=JSON.stringify(r);
 assert.ok(!output.includes('serviceAccount:'));
 assert.ok(!output.includes('API_KEY'));
});
test('historical minScale change and unreconciled retired state require review',()=>{
 const a=fixture();
 a.historicalRevision.metadata.annotations['autoscaling.knative.dev/minScale']='0';
 a.retiredRevision.status.conditions=[];
 const r=review(a);
 assert.equal(r.historicTagCostExposure,false);
 assert.equal(r.retiredRevisionInactive,false);
 assert.ok(r.riskCodes.includes('MIN_INSTANCES_CHANGED_FROM_OBSERVED_BASELINE'));
 assert.ok(r.riskCodes.includes('RETIRED_REVISION_STATE_NOT_PROVEN'));
});
test('startup and provider/network access remain unverified even on clean metadata',()=>{
 const r=review(fixture());
 assert.equal(r.exactFutureStartupBehavior,'NOT_VERIFIED');
 assert.equal(r.liveProviderAccess,'NOT_TESTED');
 assert.ok(r.riskCodes.includes('UNCONDITIONAL_STARTUP_NETWORK_CALLS_NOT_INDEPENDENTLY_EXCLUDED'));
 assert.ok(r.riskCodes.includes('ZERO_TRAFFIC_MIN_ZERO_DOES_NOT_TEST_HTTP_STARTUP'));
 assert.ok(r.riskCodes.includes('DEPLOY_ON_EXISTING_SERVICE_MUTATES_SERVICE_TEMPLATE'));
 assert.equal(r.privateBillingAccountQueried,false);
});
test('CLI default offline and invalid argument cannot mutate Cloud Run',()=>{
 const file=resolve(dirname(fileURLToPath(import.meta.url)),
 '../scripts/rj-cloudrun-predeploy-impact-readonly.mjs');
 const a=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:10000});
 assert.equal(a.status,0,a.stderr);
 assert.match(a.stdout,/"status":"OFFLINE_ONLY"/);
 const b=spawnSync(process.execPath,[file,'--deploy'],{
  encoding:'utf8',timeout:10000});
 assert.equal(b.status,2);
 assert.match(b.stdout,/"status":"BLOCKED_INVALID_ARGUMENT"/);
});
