import test from 'node:test';
import assert from 'node:assert/strict';
import {METEOBLUE_FREE_RJ_POLICY,prepareMeteoblueFreeRjProbe,
  inspectMeteoblueFreeProbeResponse}
 from '../src/rj-meteoblue-free-connection.mjs';
import {checkMeteoblueFreeKeyOnce}
 from '../src/rj-meteoblue-free-key-check.mjs';

const gate={
 BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED:'true',
 BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE:'true',
 BLAISE_METEOBLUE_TEMPORARY_KEY_RISK_ACCEPTED:'true',
 BLAISE_METEOBLUE_AUTOTOPUP_DISABLED:'true',
 BLAISE_METEOBLUE_ONE_SHOT_TEST_APPROVED:'true',
 BLAISE_METEOBLUE_PAID_ALLOWED:'false',
 BLAISE_METEOBLUE_FREE_API_KEY:'EXAMPLE_ONLY_NOT_A_SECRET_12345'
};

test('legacy key probe never contacts provider, even with all approval flags',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error('PROVIDER_MUST_NOT_BE_CALLED')};
 for(const env of [{},gate,{...gate,BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE:'false'},
   {...gate,BLAISE_METEOBLUE_PAID_ALLOWED:'true'}]){
  for(let i=0;i<3;i++){
   const r=await checkMeteoblueFreeKeyOnce({
    env,municipalityIbge:'3304557',fetchImpl
   });
   assert.equal(r.state,'LEGACY_UNBUDGETED_PROBE_DISABLED_USE_FIRESTORE_AUDIT');
   assert.equal(r.providerContacted,false);
   assert.equal(r.billingEnabled,false);
   assert.equal(r.automaticPollingEnabled,false);
   assert.equal(r.publishedToSubscribers,false);
   assert.equal(JSON.stringify(r).includes(gate.BLAISE_METEOBLUE_FREE_API_KEY),false);
  }
 }
 assert.equal(calls,0);
});

test('free policy is forecast-only; basic-6h target may be prepared offline',()=>{
 const p=METEOBLUE_FREE_RJ_POLICY;
 assert.equal(p.costEuro,0);
 assert.equal(p.automaticCollection,false);
 assert.equal(p.mayReplaceAirTemperature,false);
 assert.equal(p.mayReplaceObservedRain,false);
 assert.equal(p.billingAutoTopUpAllowed,false);
 assert.equal(prepareMeteoblueFreeRjProbe({ibge:'3304557'}).mayContactProvider,false);
 const invalid=prepareMeteoblueFreeRjProbe({
  ibge:'3304557',packageName:'sea-1h',
  freeTrialConfirmed:true,autoTopUpDisabled:true,
  operatorApprovedSingleCreditUse:true,serverEnvironment:true
 });
 assert.equal(invalid.mayContactProvider,false);
 const prepared=prepareMeteoblueFreeRjProbe({
  ibge:'3304557',packageName:'basic-6h',
  freeTrialConfirmed:true,autoTopUpDisabled:true,
  operatorApprovedSingleCreditUse:true,serverEnvironment:true
 });
 assert.equal(prepared.mayContactProvider,true);
 assert.equal(prepared.packageName,'basic-6h');
 assert.equal(prepared.query.includes('apikey'),false);
});

test('offline auth response inspection rejects bad schema and never prints secrets',()=>{
 const valid=inspectMeteoblueFreeProbeResponse({
  status:200,contentType:'application/json',
  data:{metadata:{latitude:-22.9,longitude:-43.46},
   data_6h:{time:['2026-11-18 12:00']}}
 });
 assert.equal(valid.apiKeyAuthorized,true);
 assert.equal(valid.forecastSampleValidated,false);
 const invalid=inspectMeteoblueFreeProbeResponse({
  status:200,contentType:'text/html',
  data:{metadata:{},data_6h:{time:['x'],apikey:'SECRET_NEVER_PRINT'}}
 });
 assert.equal(invalid.apiKeyAuthorized,false);
 assert.equal(JSON.stringify(invalid).includes('SECRET_NEVER_PRINT'),false);
});
