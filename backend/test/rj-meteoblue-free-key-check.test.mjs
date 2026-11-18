import test from 'node:test';
import assert from 'node:assert/strict';
import {METEOBLUE_FREE_RJ_POLICY,prepareMeteoblueFreeRjProbe,
  inspectMeteoblueFreeProbeResponse}
 from '../src/rj-meteoblue-free-connection.mjs';
import {checkMeteoblueFreeKeyOnce}
 from '../src/rj-meteoblue-free-key-check.mjs';
const gate={BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED:'true',
 BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE:'true',
 BLAISE_METEOBLUE_AUTOTOPUP_DISABLED:'true',
 BLAISE_METEOBLUE_ONE_SHOT_TEST_APPROVED:'true',
 BLAISE_METEOBLUE_FREE_API_KEY:'EXAMPLE_ONLY_NOT_A_SECRET_12345'
};
const mock=async()=>{
 return {
  status:200,
  headers:{get:(s)=>s==='content-type'?'application/json':'300'},
  text:async()=>JSON.stringify({metadata:{latitude:-22.9,longitude:-43.46},
   units:{temperature:'C'},data_6h:{time:['2026-11-18 12:00']}})
 };
};
test('disabled by default; no upstream call until all free trial gates explicitly enabled',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return mock()};
 const a=await checkMeteoblueFreeKeyOnce({env:{},fetchImpl});
 assert.equal(a.state,'OPERATOR_GATES_NOT_APPROVED');
 assert.equal(calls,0);
 for(const omitted of Object.keys(gate)){
  const copy={...gate};delete copy[omitted];
  const r=await checkMeteoblueFreeKeyOnce({env:copy,fetchImpl});
  assert.equal(r.providerContacted,false);
 }
 const paid=await checkMeteoblueFreeKeyOnce({env:{
  ...gate,BLAISE_METEOBLUE_PAID_ALLOWED:'true'
 },fetchImpl});
 assert.equal(paid.providerContacted,false);
 assert.equal(calls,0);
});
test('one approved call uses only valid representative IBGE coordinates and basic-6h',async()=>{
 let num=0,request='';
 const fetchImpl=async url=>{num++;request=url;return mock()};
 const result=await checkMeteoblueFreeKeyOnce({env:gate,fetchImpl});
 assert.equal(num,1);
 assert.ok(request.startsWith('https://my.meteoblue.com/packages/basic-6h?'));
 assert.ok(request.includes('apikey=EXAMPLE_ONLY_NOT_A_SECRET'));
 assert.equal(result.state,'KEY_ACCEPTED_BY_PROVIDER_SAMPLE_RECEIVED');
 assert.equal(result.apiKeyAcceptedForBasic6h,true);
 assert.equal(JSON.stringify(result).includes(gate.BLAISE_METEOBLUE_FREE_API_KEY),false);
 assert.equal(result.forecastTimestampsCount,1);
 assert.equal(result.publishedToSubscribers,false);
 assert.equal(result.remainingCreditsVerified,false);
});
test('free policy blocks air temperature current and paid packages',()=>{
 const p=METEOBLUE_FREE_RJ_POLICY;
 assert.equal(p.costEuro,0);
 assert.equal(p.automaticCollection,false);
 assert.equal(p.mayReplaceAirTemperature,false);
 assert.equal(p.mayReplaceObservedRain,false);
 assert.equal(p.billingAutoTopUpAllowed,false);
 const none=prepareMeteoblueFreeRjProbe({ibge:'3304557'});
 assert.equal(none.mayContactProvider,false);
 const invalid=prepareMeteoblueFreeRjProbe({
  ibge:'3304557',packageName:'sea-1h',
  freeTrialConfirmed:true,autoTopUpDisabled:true,
  operatorApprovedSingleCreditUse:true,serverEnvironment:true
 });
 assert.equal(invalid.mayContactProvider,false);
});
test('auth errors or bad schema do not validate key nor leak original response',async()=>{
 const bad=await checkMeteoblueFreeKeyOnce({env:gate,
  fetchImpl:async()=>({status:403,headers:{get:()=>null},text:async()=>'{\"token\":\"SECRET\"}'})
 });
 assert.equal(bad.apiKeyAcceptedForBasic6h,undefined);
 assert.equal(bad.httpStatus,403);
 assert.equal(JSON.stringify(bad).includes('SECRET'),false);
 const invalid=inspectMeteoblueFreeProbeResponse({status:200,
  contentType:'text/html',data:{metadata:{},data_6h:{time:['x']}}});
 assert.equal(invalid.apiKeyAuthorized,false);
});
