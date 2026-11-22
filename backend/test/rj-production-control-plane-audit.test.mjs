import test from 'node:test';
import assert from 'node:assert/strict';
import {
 summarizeBlaiseProject,summarizeRunServices,summarizeRunService,
 summarizeSecretVersions,summarizeSecretIam,summarizeScheduler,assessCloudReadOnlySummary
} from '../src/rj-production-control-plane-audit.mjs';

test('offline control plane only reports project identity, never deployment',()=>{
 const a=assessCloudReadOnlySummary({});
 assert.equal(a.status,'CONTROL_PLANE_READ_ONLY_NOT_PRODUCTION_HOMOLOGATION');
 assert.equal(a.observations.project,null);
 assert.equal(a.releaseApproval,false);
 assert.equal(a.sourcePublicationAuthorized,false);
 assert.equal(a.cloudMutationsPerformed,0);
 assert.equal(a.directProviderWeatherCallsFromAudit,0);
 assert.equal(a.apiKeyValuesRead,0);
});
test('project and region metadata cannot prove actual forecast freshness',()=>{
 assert.deepEqual(summarizeBlaiseProject({
  projectId:'blaise-v6-rj',lifecycleState:'ACTIVE',projectNumber:'secret-number'
 }),{
  projectIdentityVerified:true,projectActive:true,projectNumberVisibleToOperator:false
 });
 const a=assessCloudReadOnlySummary({project:{projectId:'blaise-v6-rj',lifecycleState:'ACTIVE'}});
 assert.equal(a.productFreshness92Municipalities,'NOT_PROVED_BY_CONTROL_PLANE');
 assert.equal(a.clientDeviceAndP0Delivery,'NOT_PROVED_BY_CONTROL_PLANE');
});
test('Cloud Run service response loses names, URLs, service account and secrets',()=>{
 const x={
  metadata:{name:'private-service'},
  status:{
   url:'https://private-service-123.a.run.app',
   latestReadyRevisionName:'private-service-0001',
   conditions:[{type:'Ready',status:'True'}],
   traffic:[{percent:100,revisionName:'private-service-0001'}]
  },
  spec:{template:{spec:{
   serviceAccountName:'runtime@blaise-v6-rj.iam.gserviceaccount.com',
   containers:[{env:[{name:'MB',valueFrom:{
    secretKeyRef:{name:'blaise-meteoblue-free-api-key',key:'3'}
   }},{name:'PLAIN',value:'private-value'}]}]
  }}}
 };
 const a=summarizeRunService(x);
 assert.equal(a.readyCondition,'REPORTED_TRUE');
 assert.equal(a.runtimeServiceIdentityPresent,true);
 assert.equal(a.trafficAllocationKnown,true);
 assert.equal(a.trafficPercentSum,100);
 assert.equal(a.secretBackedEnvBindingCount,1);
 assert.equal(a.releaseApproved,false);
 const txt=JSON.stringify(a);
 assert.ok(!txt.includes('blaise-meteoblue-free-api-key'));
 assert.ok(!txt.includes('private-service'));
 assert.ok(!txt.includes('runtime@'));
 assert.ok(!txt.includes('private-value'));
 assert.equal(summarizeRunServices([x]).totalServices,1);
});
test('secret versions state is not key rotation, provider allowance or balance',()=>{
 const a=summarizeSecretVersions([
  {name:'versions/3',state:'ENABLED',payload:'NEVER_SHOULD_SHOW'},
  {name:'versions/1',state:'DISABLED'},
  {name:'versions/2',state:'DISABLED'}
 ]);
 assert.equal(a.versionCount,3);
 assert.equal(a.enabledVersionCount,1);
 assert.equal(a.exposedCredentialRotationVerified,false);
 assert.equal(a.secretPayloadRead,false);
 assert.equal(a.paidApiActivationStatus,'NOT_INSPECTED');
 assert.ok(!JSON.stringify(a).includes('NEVER_SHOULD_SHOW'));
});
test('Scheduler count is not proof of active meteorological polling',()=>{
 const s=summarizeScheduler([
  {name:'private-weather-job',state:'ENABLED'},
  {name:'private-other-job',state:'PAUSED'}
 ]);
 assert.equal(s.jobCount,2);
 assert.equal(s.enabledCount,1);
 assert.equal(s.pausedCount,1);
 assert.equal(s.providerSpecificSchedulingNotProved,true);
 assert.ok(!JSON.stringify(s).includes('private-weather-job'));
});
test('even live green Cloud Run health cannot authorize source publication',()=>{
 const report=assessCloudReadOnlySummary({
  project:{projectId:'blaise-v6-rj',lifecycleState:'ACTIVE'},
  runServices:[{metadata:{name:'blaise-rj-service'}}],
  runService:{
   status:{conditions:[{type:'Ready',status:'True'}],
    latestReadyRevisionName:'rev-123',traffic:[{percent:100}]},
   spec:{template:{spec:{serviceAccountName:'runtime@blaise-v6-rj.iam.gserviceaccount.com'}}}
  },
  health:'BOTH_HEALTH_ENDPOINTS_PASS'
 });
 assert.equal(report.observations.health,'BOTH_HEALTH_ENDPOINTS_PASS');
 assert.equal(report.observations.selectedRunService.readyCondition,'REPORTED_TRUE');
 assert.equal(report.sourcePublicationAuthorized,false);
 assert.equal(report.releaseApproval,false);
 assert.equal(report.observations.selectedRunService.releaseApproved,false);
 assert.equal(report.contractualRights,'NOT_PROVED_BY_CONTROL_PLANE');
});

test('IAM metadata proves only direct secret grant, not effective permission or key content',()=>{
 const sa='runtime@blaise-v6-rj.iam.gserviceaccount.com';
 const fake={
  bindings:[{role:'roles/secretmanager.secretAccessor',
    members:['serviceAccount:'+sa,'user:private@example.com']}]
 };
 const x=summarizeSecretIam(fake,sa);
 assert.equal(x.runtimeServiceIdentityAvailable,true);
 assert.equal(x.directSecretAccessorBinding,'REPORTED_PRESENT');
 assert.equal(x.effectiveAccessNotVerified,true);
 assert.equal(x.projectInheritedAccessNotInspected,true);
 assert.ok(!JSON.stringify(x).includes(sa));
 assert.ok(!JSON.stringify(x).includes('private@example.com'));
 const incomplete=summarizeSecretIam(fake,null);
 assert.equal(incomplete.directSecretAccessorBinding,'NOT_PROVED');
 const conditional=summarizeSecretIam({bindings:[{...fake.bindings[0],
  condition:{title:'temporary'}}]},sa);
 assert.equal(conditional.directSecretAccessorBinding,'NOT_PROVED');
});
