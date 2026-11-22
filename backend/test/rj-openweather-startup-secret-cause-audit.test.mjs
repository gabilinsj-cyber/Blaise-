import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {diagnoseHistoricalStartupSecret as diagnose}
 from '../src/rj-openweather-startup-secret-cause-audit.mjs';

const S='blaise-v6-rj-backend';
const sa='runtime@blaise-v6-rj.iam.gserviceaccount.com';
const oldEnv=(name,secret,version)=>({
 name,valueFrom:{secretKeyRef:{name:secret,key:version}}
});
const samples=()=>({
 historicalRevision:{
  metadata:{name:S+'-00058-sos'},
  spec:{serviceAccountName:sa,containers:[{env:[
   oldEnv('BLAISE_OPENWEATHER_API_KEY','blaise-rj-openweather-api-key','1'),
   oldEnv('BLAISE_REDEMET_API_KEY','blaise-rj-redemet-api-key','1')
  ]}]}
 },
 currentService:{
  metadata:{name:S},
  spec:{template:{spec:{serviceAccountName:sa,containers:[{env:[
   oldEnv('BLAISE_OPENWEATHER_API_KEY','blaise-rj-openweather-api-key','2')
  ]}]}}},
  status:{traffic:[
   {revisionName:S+'-00031-vep',percent:99},
   {revisionName:S+'-00038-pin',percent:1},
   {revisionName:S+'-00058-sos',tag:'validacao-rj',percent:0}
  ]}
 },
 owV1Metadata:{state:'DISABLED'},
 owV2Metadata:{state:'ENABLED'},
 redemetV1Metadata:{state:'ENABLED'},
 openweatherIamPolicy:{bindings:[{role:'roles/secretmanager.secretAccessor',
  members:['serviceAccount:'+sa]}]},
 requestLogs:[
  {httpRequest:{status:500},textPayload:
   'The request failed because the instance could not start successfully.'},
  {httpRequest:{status:500},jsonPayload:{message:
   'The request failed because the instance could not start successfully.'}},
  {httpRequest:{status:500},textPayload:
   'The request failed because the instance could not start successfully.'}
 ]
});
test('historical v1 disabled, v2 enabled and 3 startup indications are distinct from proof of HTTP cause',()=>{
 const x=diagnose(samples());
 assert.equal(x.status,'DIAGNOSIS_ONLY_NO_DEPLOY');
 assert.equal(x.evidenceComplete,true);
 assert.equal(x.historicalBindingVersion,'1');
 assert.equal(x.historicalSecretVersion1State,'DISABLED');
 assert.equal(x.currentTemplateBindingVersion,'2');
 assert.equal(x.currentSecretVersion2State,'ENABLED');
 assert.equal(x.historicalRedemetV1State,'ENABLED');
 assert.equal(x.historicalRedemetBoundV1,true);
 assert.equal(x.historicalRuntimeIdentityMatchesTemplate,true);
 assert.equal(x.historicalSecretDirectIam,'DIRECT_UNCONDITIONAL_GRANT_PRESENT');
 assert.equal(x.startupFailureReportedByRequestLog,true);
 assert.equal(x.historicalStartupErrorPhraseCount,3);
 assert.equal(x.requestHttp500Count,3);
 assert.equal(x.oldSecretVersionUnavailableForNewStarts,true);
 assert.equal(x.likelyStartupBlocker,'DISABLED_ENV_SECRET_V1');
 assert.equal(x.causeOfThreeHttp500,'NOT_CONCLUSIVELY_PROVEN');
 assert.equal(x.productionTraffic99_1,true);
 assert.equal(x.actualRuntimeSecretAccess,'NOT_TESTED');
 assert.equal(x.secretPayloadRead,false);
 assert.equal(x.deployPerformed,false);
 assert.equal(x.weatherProviderContacted,false);
 assert.equal(x.meteorologicalCreditsUsed,0);
});
test('v1 enabled is not falsely reported as unavailable for startup',()=>{
 const a=samples();a.owV1Metadata.state='ENABLED';
 const x=diagnose(a);
 assert.equal(x.oldSecretVersionUnavailableForNewStarts,false);
 assert.equal(x.likelyStartupBlocker,'NOT_CONFIRMED');
 assert.equal(x.causeOfThreeHttp500,'NOT_CONCLUSIVELY_PROVEN');
});
test('missing version metadata is unknown, not interpreted as disabled',()=>{
 const a=samples();a.owV1Metadata=null;
 const x=diagnose(a);
 assert.equal(x.evidenceComplete,false);
 assert.equal(x.historicalSecretVersion1State,'NOT_VERIFIED');
 assert.equal(x.oldSecretVersionUnavailableForNewStarts,false);
 assert.ok(x.riskMarkers.includes('READONLY_EVIDENCE_INCOMPLETE'));
});
test('incorrect or duplicate historical references do not imply v1 diagnosis',()=>{
 for(const version of ['2','latest']){
  const a=samples();
  a.historicalRevision.spec.containers[0].env[0].
   valueFrom.secretKeyRef.key=version;
  const x=diagnose(a);
  assert.equal(x.historicalBindingVersion,'NOT_VERIFIED');
  assert.equal(x.oldSecretVersionUnavailableForNewStarts,false);
 }
 const dup=samples();
 dup.historicalRevision.spec.containers[0].env.push(
  dup.historicalRevision.spec.containers[0].env[0]);
 assert.equal(diagnose(dup).oldSecretVersionUnavailableForNewStarts,false);
});
test('unproven IAM is not represented as failed runtime permission',()=>{
 const a=samples();a.openweatherIamPolicy={bindings:[]};
 const x=diagnose(a);
 assert.equal(x.historicalSecretDirectIam,'DIRECT_GRANT_NOT_PROVEN');
 assert.equal(x.inheritedOrConditionalIamEffectiveAccess,'NOT_TESTED');
 assert.ok(x.riskMarkers.includes('DIRECT_SECRET_IAM_GRANT_NOT_PROVEN'));
 const b=samples();b.openweatherIamPolicy=null;
 assert.equal(diagnose(b).historicalSecretDirectIam,'NOT_VERIFIED');
});
test('disabled Redemet or v2 is an explicit blocker, not a key rotation instruction',()=>{
 const a=samples();a.owV2Metadata.state='DISABLED';
 a.redemetV1Metadata.state='DISABLED';
 const x=diagnose(a);
 assert.ok(x.riskMarkers.includes('CURRENT_TEMPLATE_V2_BINDING_OR_STATE_UNPROVEN'));
 assert.ok(x.riskMarkers.includes('HISTORICAL_REDEMET_BINDING_OR_STATE_UNPROVEN'));
 assert.equal(x.deployPerformed,false);
});
test('traffic drift is discovered but never automatically corrected',()=>{
 const a=samples();a.currentService.status.traffic[0].percent=98;
 const x=diagnose(a);
 assert.equal(x.productionTraffic99_1,false);
 assert.ok(x.riskMarkers.includes('CLIENT_TRAFFIC_NOT_PROVEN_99_1'));
 assert.equal(x.trafficChanged,false);
});
test('sanitized output never discloses raw messages, identities, secret payloads or URLs',()=>{
 const a=samples();
 a.requestLogs[0].textPayload+=' SECRET_KEY_SENTINEL';
 a.historicalRevision.spec.containers[0].env.push({
  name:'SOME_PRIVATE_VALUE',value:'HIDDEN_SENTINEL'
 });
 const json=JSON.stringify(diagnose(a));
 for(const unsafe of ['HIDDEN_SENTINEL','SECRET_KEY_SENTINEL',sa,
  'https://'])assert.equal(json.includes(unsafe),false);
});
test('request logs unavailable remain unverified and never synthesized as 3',()=>{
 const a=samples();a.requestLogs=null;
 const x=diagnose(a);
 assert.equal(x.requestHttp500Count,null);
 assert.equal(x.startupFailureReportedByRequestLog,false);
 assert.equal(x.evidenceComplete,false);
});
test('CLI is offline by default, invalid args fail closed, and source contains only read commands',()=>{
 const script=resolve(dirname(fileURLToPath(import.meta.url)),
  '../scripts/rj-openweather-startup-secret-cause-readonly.mjs');
 const a=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:10000});
 assert.equal(a.status,0,a.stderr);
 assert.match(a.stdout,/"status":"OFFLINE_NO_CLOUD_ACCESS"/);
 const b=spawnSync(process.execPath,[script,'--deploy'],{encoding:'utf8',timeout:10000});
 assert.equal(b.status,2);
 assert.match(b.stdout,/"status":"BLOCKED_UNKNOWN_ARGUMENT"/);
 const source=readFileSync(script,'utf8');
 assert.equal(source.includes("'secrets','versions','access'"),false);
 assert.equal(source.includes("'run','deploy'"),false);
 assert.equal(source.includes("'run','services','update'"),false);
 assert.equal(source.includes("'secrets','versions','enable'"),false);
 assert.equal(source.includes("'run','services','update-traffic'"),false);
});
