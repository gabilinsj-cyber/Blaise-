import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOpenweatherV2RepairEvidence,OPENWEATHER_V2_REPAIR_TARGET as T}
 from '../src/rj-openweather-secret-v2-repair-plan.mjs';

const build=()=>({
 revision:{
  metadata:{name:T.revision},
  spec:{serviceAccountName:'runtime@blaise-v6-rj.iam.gserviceaccount.com',
   containers:[{env:[
    {name:T.openweatherEnv,valueFrom:{secretKeyRef:{
     name:T.openweatherSecret,key:'1'}}},
    {name:T.redemetEnv,valueFrom:{secretKeyRef:{
     name:T.redemetSecret,key:'1'}}},
    {name:'BLAISE_OPENWEATHER_AGENT13_ENABLED',value:'false'},
    {name:'BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED',value:'false'},
    {name:'BLAISE_AGENT13_FIRESTORE_ENABLED',value:'false'}
   ]}]}
 },
 service:{
  metadata:{name:T.service},
  status:{traffic:[
   {revisionName:'blaise-v6-rj-backend-00031-vep',percent:99},
   {revisionName:'blaise-v6-rj-backend-00038-pin',percent:1},
   {revisionName:T.revision,tag:'validacao-rj'}
  ]}
 },
 openweatherVersions:[
  {name:'projects/100/secrets/ow/versions/1',state:'DISABLED'},
  {name:'projects/100/secrets/ow/versions/2',state:'ENABLED'}
 ],
 redemetVersions:[
  {name:'projects/100/secrets/rd/versions/1',state:'ENABLED'}
 ],
 openweatherIamPolicy:{bindings:[{
  role:'roles/secretmanager.secretAccessor',
  members:['serviceAccount:runtime@blaise-v6-rj.iam.gserviceaccount.com']
 }]}
});
const run=x=>assessOpenweatherV2RepairEvidence(x);

test('eligible plan only, with exact disabled v1, enabled v2, 0 traffic and direct IAM',()=>{
 const r=run(build());
 assert.equal(r.status,'REPAIR_PLAN_ELIGIBLE_NOT_DEPLOYED');
 assert.deepEqual(r.blockers,[]);
 assert.equal(r.proposedOpenweatherSecretVersion,'2');
 assert.equal(r.openweatherVersion1,'DISABLED');
 assert.equal(r.openweatherVersion2,'ENABLED');
 assert.equal(r.redemetVersion1,'ENABLED');
 assert.equal(r.proposedRevisionCreated,false);
 assert.equal(r.targetRevisionExists,false);
 assert.equal(r.productionTrafficChanged,false);
 assert.equal(r.neverReenableOldOpenweatherVersion,true);
 assert.equal(r.vendorKeyValid,'NOT_VERIFIED');
 assert.equal(r.effectiveSecretAccess,'NOT_VERIFIED');
 assert.equal(r.endpointHealthAfterRepair,'NOT_TESTED');
 assert.equal(r.weatherProviderContacted,false);
 assert.equal(r.meteorologicalCreditsUsed,0);
 assert.equal(r.productionReleaseApproved,false);
});
test('v2 disabled, missing or destroyed never yields a candidate plan',()=>{
 for(const state of ['DISABLED','DESTROYED',null]){
  const x=build();
  x.openweatherVersions=state?[x.openweatherVersions[0],
   {...x.openweatherVersions[1],state}]:[x.openweatherVersions[0]];
  const result=run(x);
  assert.equal(result.status,'REPAIR_PLAN_BLOCKED');
  assert.ok(result.blockers.includes('targetOpenweatherVersion2Enabled'));
 }
});
test('disabling Redemet v1 cannot be hidden by enabling OpenWeather v2',()=>{
 const x=build();x.redemetVersions[0].state='DISABLED';
 const r=run(x);
 assert.equal(r.status,'REPAIR_PLAN_BLOCKED');
 assert.ok(r.blockers.includes('redemetVersion1Enabled'));
});
test('incorrect or missing OpenWeather v1 historical binding is blocked',()=>{
 for(const val of ['2','latest','9']){
  const x=build();x.revision.spec.containers[0].env[0].valueFrom.secretKeyRef.key=val;
  assert.ok(run(x).blockers.includes('originalOpenweatherBindingVersion1'));
 }
 const x=build();x.revision.spec.containers[0].env[0].valueFrom=null;
 assert.equal(run(x).status,'REPAIR_PLAN_BLOCKED');
});
test('IAM role must be direct, unconditional and match runtime service account',()=>{
 const a=build();a.openweatherIamPolicy={bindings:[]};
 assert.ok(run(a).blockers.includes('directUnconditionalSecretAccessor'));
 const b=build();b.openweatherIamPolicy.bindings[0].condition={title:'conditional'};
 assert.ok(run(b).blockers.includes('directUnconditionalSecretAccessor'));
 const c=build();c.revision.spec.serviceAccountName='different@blaise-v6-rj.iam.gserviceaccount.com';
 assert.ok(run(c).blockers.includes('directUnconditionalSecretAccessor'));
 const d=build();d.openweatherIamPolicy=null;
 assert.ok(run(d).blockers.includes('iamPolicyRead'));
});
test('0% candidate and 100% existing public traffic are mandatory',()=>{
 const a=build();a.service.status.traffic[2].percent=1;
 assert.ok(run(a).blockers.includes('originalRevisionZeroTraffic'));
 assert.ok(run(a).blockers.includes('serviceTrafficTotals100Percent'));
 const b=build();b.service.status.traffic[0].percent=98;
 assert.ok(run(b).blockers.includes('serviceTrafficTotals100Percent'));
 const c=build();c.service.status.traffic=[];
 assert.ok(run(c).blockers.includes('originalRevisionZeroTraffic'));
});
test('optional Agent13 gates must remain OFF, even if credentials are enabled',()=>{
 for(const key of ['BLAISE_OPENWEATHER_AGENT13_ENABLED',
  'BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED',
  'BLAISE_AGENT13_FIRESTORE_ENABLED',
  'BLAISE_AGENT13_TEMPERATURE_CONTINGENCY_ENABLED']){
  const x=build();x.revision.spec.containers[0].env.push({name:key,value:'true'});
  assert.ok(run(x).blockers.includes('openweatherAgent13AndApprovalsOff'),key);
 }
});
test('unverified service identity or alternative revision fails closed',()=>{
 const a=build();a.revision.metadata.name='blaise-v6-rj-backend-00031-vep';
 assert.ok(run(a).blockers.includes('expectedHistoricalRevision'));
 const b=build();b.service.metadata.name='other-service';
 assert.ok(run(b).blockers.includes('expectedService'));
 const c=build();c.revision.spec.containers[0].env.push(
  {...c.revision.spec.containers[0].env[0]});
 assert.ok(run(c).blockers.includes('originalOpenweatherBindingVersion1'));
});
test('audit does not print or disclose service identity and never asserts key validity',()=>{
 const x=build();
 x.revision.spec.containers[0].env.push({name:'UNRELATED',value:'private-sentinel'});
 const text=JSON.stringify(run(x));
 for(const secret of ['private-sentinel','runtime@blaise-v6-rj.iam.gserviceaccount.com',
  'serviceAccount:runtime@blaise-v6-rj.iam.gserviceaccount.com'])
  assert.ok(!text.includes(secret));
 assert.ok(text.includes('"vendorKeyValid":"NOT_VERIFIED"'));
 assert.ok(text.includes('"proposedRevisionCreated":false'));
});
