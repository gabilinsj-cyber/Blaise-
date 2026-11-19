import test from 'node:test';
import assert from 'node:assert/strict';
import {VC_FIELD_SPEC,buildVisualCrossingPrivateUrl,
 parseVisualCrossingPrivateSample,collectVisualCrossingPrivateSample}
 from '../src/rj-visual-crossing-free-private.mjs';
import {createRjVisualCrossingFreeBudget} from '../src/rj-visual-crossing-free-budget.mjs';
import geo from '../src/rj-ibge-92-points.json' with {type:'json'};

const NOW=Date.parse('2026-11-19T14:00:00Z');
const rio=geo.points.find(p=>p.ibge==='3304557');
const SAMPLE=()=>({
 queryCost:1,latitude:rio.lat,longitude:rio.lon,
 currentConditions:{
  datetimeEpoch:NOW/1000-300,
  temp:28.3,feelslike:31.5,humidity:76,dew:23.7,
  windspeed:14.7,windgust:null,precip:0,precipprob:53,
  pressure:1012,severerisk:null
 },
 days:[{hours:[{datetimeEpoch:NOW/1000+3600,temp:29.1,precip:1.2,windgust:38}]}]
});
function store(){
 let saved=null;
 const doc={
  get:async()=>({exists:!!saved,data:()=>saved}),
 };
 const db={collection(name){
  assert.equal(name,'blaise_rj_visual_crossing_free_trial_budget_v1');
  return {doc(id){assert.equal(id,'staging_one_rio_20261119');return doc;}};
 },async runTransaction(fn){
  return fn({get:async()=>({exists:!!saved,data:()=>saved}),
   set(_doc,row){saved=row;}});
 }};
 return createRjVisualCrossingFreeBudget({db,clock:()=>NOW});
}
test('private Visual Crossing parser retains field provenance and missing values',()=>{
 const r=parseVisualCrossingPrivateSample(SAMPLE(),{now:NOW});
 assert.equal(r.status,'PRIVATE_REAL_SAMPLE_READY');
 assert.equal(r.category,'E');
 assert.equal(r.current.kind,'E');
 assert.equal(r.current.values.temperatureC,28.3);
 assert.equal(r.current.values.feelsLikeC,31.5);
 assert.equal(r.current.values.windGustKmh,null);
 assert.equal(r.current.values.precipitationMm,0);
 assert.equal(r.current.values.severeRiskIndex,null);
 assert.equal(r.current.measurementStationVerified,false);
 assert.equal(r.forecast[0].kind,'P');
 assert.equal(r.forecast[0].values.windGustKmh,38);
 assert.equal(r.queryCost,1);
 assert.equal(r.publishedToSubscribers,false);
 assert.equal(Object.keys(VC_FIELD_SPEC).length,10);
});
test('reject wrong city, old or future time and unexpected supplier cost',()=>{
 for(const payload of [
  {...SAMPLE(),queryCost:5},
  {...SAMPLE(),latitude:0},
  {...SAMPLE(),currentConditions:{...SAMPLE().currentConditions,datetimeEpoch:NOW/1000-20_000}},
  {...SAMPLE(),currentConditions:{...SAMPLE().currentConditions,datetimeEpoch:NOW/1000+5_000}},
  {...SAMPLE(),currentConditions:{datetimeEpoch:NOW/1000}},
 ]){
  const r=parseVisualCrossingPrivateSample(payload,{now:NOW});
  assert.equal(r.status,'UNAVAILABLE');
 }
});
test('URL uses verified Rio IBGE point, only official HTTPS host, no background calls',()=>{
 const u=buildVisualCrossingPrivateUrl({apiKey:'placeholder_test_key_123456'});
 assert.equal(u.protocol,'https:');
 assert.equal(u.host,'weather.visualcrossing.com');
 assert.equal(u.searchParams.get('include'),'current,hours');
 assert.equal(u.searchParams.get('unitGroup'),'metric');
 assert.throws(()=>buildVisualCrossingPrivateUrl({
  ibge:'3303302',apiKey:'placeholder_test_key_123456'
 }));
 assert.throws(()=>buildVisualCrossingPrivateUrl({apiKey:'not a real key'}));
});
test('atomic Firestore guard permits only one reserved trial record across repeats',async()=>{
 const b=store();
 assert.equal((await b.readBudget()).localRecordsReserved,0);
 assert.equal((await b.reserve('3304557',NOW)).approved,true);
 const denied=await b.reserve('3304557',NOW+24*3600_000);
 assert.equal(denied.approved,false);
 assert.equal(denied.reason,'ONE_STAGING_CALL_ALREADY_RESERVED');
 assert.equal((await b.readBudget()).localRecordsReserved,1);
});
test('collector never fetches when disabled, invalid key or after quota spent',async()=>{
 const b=store();
 let calls=0;
 const fetchImpl=async()=>{calls++;return new Response(JSON.stringify(SAMPLE()),{status:200})};
 const env={
  BLAISE_VISUAL_CROSSING_PRIVATE_ENABLED:'true',
  BLAISE_VISUAL_CROSSING_FREE_PLAN_CONFIRMED:'true',
  BLAISE_VISUAL_CROSSING_PAID_ALLOWED:'false',
  BLAISE_VISUAL_CROSSING_AUTOTOPUP_DISABLED:'true',
  BLAISE_VISUAL_CROSSING_ONESHOT_APPROVED:'true',
  BLAISE_VISUAL_CROSSING_FREE_API_KEY:'placeholder_test_key_123456'
 };
 const denied=await collectVisualCrossingPrivateSample({env:{...env,
   BLAISE_VISUAL_CROSSING_ONESHOT_APPROVED:'false'},
   reserve:b.reserve,fetchImpl,clock:()=>NOW});
 assert.equal(denied.providerContacted,false);
 assert.equal(calls,0);
 const result=await collectVisualCrossingPrivateSample({
  env,reserve:b.reserve,fetchImpl,clock:()=>NOW
 });
 assert.equal(result.status,'PRIVATE_REAL_SAMPLE_READY');
 assert.equal(result.providerContacted,true);
 assert.equal(calls,1);
 const blocked=await collectVisualCrossingPrivateSample({
  env,reserve:b.reserve,fetchImpl,clock:()=>NOW+24*3600_000
 });
 assert.equal(blocked.providerContacted,false);
 assert.equal(calls,1);
 assert.ok(!JSON.stringify(result).includes(env.BLAISE_VISUAL_CROSSING_FREE_API_KEY));
});
