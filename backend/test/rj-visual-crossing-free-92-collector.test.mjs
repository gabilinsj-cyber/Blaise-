import test from 'node:test';
import assert from 'node:assert/strict';
import geo from '../src/rj-ibge-92-points.json' with {type:'json'};
import {buildVisualCrossing92FutureUrl,collectVisualCrossing92FutureOne}
 from '../src/rj-visual-crossing-free-92-collector.mjs';
const NOW=Date.parse('2026-11-20T10:00:00Z');
const point=geo.points.find(p=>p.ibge==='3304557');
const body=()=>({
 queryCost:1,latitude:point.lat,longitude:point.lon,
 currentConditions:{
  datetimeEpoch:NOW/1000-300,temp:25,feelslike:27,
  humidity:70,dew:21,windspeed:10,windgust:null,
  precip:null,precipprob:30,pressure:1015,severerisk:null
 },
 days:[{hours:[{datetimeEpoch:NOW/1000+3600,temp:26,windgust:23}]}]
});
const ready={
 BLAISE_VC_92_COLLECTION_ENABLED:'true',
 BLAISE_VC_FREE_PLAN_CONFIRMED:'true',
 BLAISE_VC_NO_BILLING_CONFIRMED:'true',
 BLAISE_VC_KEY_ROTATED_AFTER_EXPOSURE:'true',
 BLAISE_VC_PROVIDER_EXTRA_CREDITS_REVIEWED:'true',
 BLAISE_VC_92_OPERATOR_APPROVED:'true',
 BLAISE_VC_PAID_ALLOWED:'false',
 BLAISE_VC_PUBLISH_CLIENT:'false',
 BLAISE_VC_FREE_API_KEY:'TEST_SERVER_ONLY_KEY_123456'
};
test('default disabled or exposed-key config never reserves or contacts supplier',async()=>{
 let reserveCalls=0,fetchCalls=0;
 const reserve=async()=>{reserveCalls++;return {approved:true}};
 const cache={save:async()=>({forecastSlots:1,currentFields:7,expiresAt:'x'})};
 const fetchImpl=async()=>{fetchCalls++;return new Response(JSON.stringify(body()))};
 for(const env of [{},{...ready,BLAISE_VC_KEY_ROTATED_AFTER_EXPOSURE:'false'},
    {...ready,BLAISE_VC_PROVIDER_EXTRA_CREDITS_REVIEWED:'false'},
    {...ready,BLAISE_VC_PAID_ALLOWED:'true'}]){
  const r=await collectVisualCrossing92FutureOne({
   ibge:'3304557',env,reserve,cache,fetchImpl,clock:()=>NOW
  });
  assert.equal(r.status,'DISABLED_OR_UNAVAILABLE');
  assert.equal(r.providerContacted,false);
 }
 assert.equal(reserveCalls,0);
 assert.equal(fetchCalls,0);
});
test('future one-city collector reserves before fetch and writes only sanitized parsed sample',async()=>{
 let reserveCalls=0,networkCalls=0,saved=null;
 const r=await collectVisualCrossing92FutureOne({
  ibge:'3304557',env:ready,
  reserve:async city=>{assert.equal(city,'3304557');reserveCalls++;return {approved:true}},
  fetchImpl:async href=>{
   networkCalls++;
   const url=new URL(href);
   assert.equal(url.host,'weather.visualcrossing.com');
   assert.equal(url.searchParams.get('include'),'current,hours');
   return new Response(JSON.stringify(body()),{status:200});
  },
  cache:{save:async sample=>{
   saved=sample;
   return {forecastSlots:sample.forecast.length,currentFields:7,
    expiresAt:new Date(NOW+3*3600_000).toISOString()}
  }},
  clock:()=>NOW
 });
 assert.equal(r.status,'PRIVATE_CACHE_SAVED');
 assert.equal(reserveCalls,1);
 assert.equal(networkCalls,1);
 assert.equal(saved.current.values.temperatureC,25);
 assert.equal(saved.current.kind,'E');
 assert.equal(saved.forecast[0].kind,'P');
 assert.equal(r.queryCost,1);
 assert.equal(r.clientPublishingEnabled,false);
 assert.ok(!JSON.stringify(r).includes(ready.BLAISE_VC_FREE_API_KEY));
});
test('bad supplier cost or denied transaction never stores and never retries',async()=>{
 let network=0,saves=0;
 const cache={save:async()=>{saves++}};
 const restricted=await collectVisualCrossing92FutureOne({
  ibge:'3304557',env:ready,
  reserve:async()=>({approved:false,reason:'CITY_THREE_HOUR_COOLDOWN'}),
  fetchImpl:async()=>{network++;return new Response(JSON.stringify(body()))},
  cache,clock:()=>NOW
 });
 assert.equal(restricted.providerContacted,false);
 assert.equal(network,0);
 const bad=await collectVisualCrossing92FutureOne({
  ibge:'3304557',env:ready,reserve:async()=>({approved:true}),
  fetchImpl:async()=>{network++;return new Response(JSON.stringify({...body(),queryCost:5}))},
  cache,clock:()=>NOW
 });
 assert.equal(bad.status,'DISABLED_OR_UNAVAILABLE');
 assert.equal(bad.providerContacted,true);
 assert.equal(network,1);
 assert.equal(saves,0);
});
test('only known RJ 92 interior points may be requested',()=>{
 const url=buildVisualCrossing92FutureUrl({ibge:'3304557',key:ready.BLAISE_VC_FREE_API_KEY});
 assert.equal(url.protocol,'https:');
 assert.throws(()=>buildVisualCrossing92FutureUrl({ibge:'9999999',key:ready.BLAISE_VC_FREE_API_KEY}));
 assert.throws(()=>buildVisualCrossing92FutureUrl({ibge:'3304557',key:'exposed key'}));
});
