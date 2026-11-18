import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMeteoblueBasic6h,METEOBLUE_BASIC6H_FIELDS}
 from '../src/rj-meteoblue-basic6h-parse.mjs';
import {createRjMeteoblueFreeFirestoreStore,
 METEOBLUE_BASIC6H_CREDITS,METEOBLUE_MAX_DAILY_CALLS,
 METEOBLUE_PRIVATE_CEILING_CREDITS} from '../src/rj-meteoblue-free-firestore-store.mjs';
import {createBlaiseRjMeteoblueFreeCollector}
 from '../src/rj-meteoblue-free-collector.mjs';
import {prepareMeteoblueFreeRjProbe}
 from '../src/rj-meteoblue-free-connection.mjs';

const NOW=Date.parse('2026-11-18T13:15:00Z'),IBGE='3304557';
const target=prepareMeteoblueFreeRjProbe({
 ibge:IBGE,freeTrialConfirmed:true,autoTopUpDisabled:true,
 operatorApprovedSingleCreditUse:true,serverEnvironment:true
}).targetCoordinates;
assert.ok(target);
const samples=29;
const series=(from)=>Array.from({length:samples},(_,i)=>from+((i%5)*0.5));
const time=Array.from({length:samples},(_,i)=>
 new Date(Date.parse('2026-11-18T12:00:00Z')+i*6*60*60_000)
  .toISOString().slice(0,16).replace('T',' '));
const sample=()=>({
 metadata:{latitude:target.lat,longitude:target.lon,
  modelrun_utc:'2026-11-18 06:00',
  modelrun_updatetime_utc:'2026-11-18 07:00'},
 units:{precipitation:'mm',windspeed:'km/h',
  relativehumidity:'%',sealevelpressure:'hPa'},
 data_6h:{time:[...time],
  precipitation:series(0),convective_precipitation:series(0),
  precipitation_probability:series(10),
  windspeed_mean:series(10),windspeed_max:series(15),
  relativehumidity_mean:series(50),
  sealevelpressure_mean:series(1010),
  temperature_mean:series(24),felttemperature_mean:series(26)}
});
function dbFake(){
 const collections=new Map();
 let lock=Promise.resolve();
 const doc=(name,id)=>{
  const k=name+':'+id;
  return {id,
   async get(){return collections.has(k)?{exists:true,data:()=>structuredClone(collections.get(k))}:{exists:false,data:()=>null};},
   async set(value){collections.set(k,structuredClone(value));}
  };
 };
 return {
  collection(name){return {doc(id){return doc(name,id)}};},
  runTransaction(fn){
   const operation=lock.then(async()=>{
    const writes=[];
    const result=await fn({
      get(ref){return ref.get();},
      set(ref,value){writes.push([ref,value]);}
    });
    for(const [ref,value] of writes)await ref.set(value);
    return result;
   });
   lock=operation.catch(()=>{});
   return operation;
  },
  debugGet(name,id){return structuredClone(collections.get(name+':'+id));}
 };
}
const goodEnv={
 BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED:'true',
 BLAISE_METEOBLUE_AUTOTOPUP_DISABLED:'true',
 BLAISE_METEOBLUE_PAID_ALLOWED:'false',
 BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED:'true',
 BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE:'true',
 BLAISE_METEOBLUE_ALLOW_REAL_CREDIT_SPEND:'true',
 BLAISE_METEOBLUE_FREE_API_KEY:'SAFE_EXAMPLE_DO_NOT_USE_12345678'
};
test('provider 6h schema parses seven auditable numerical comparison fields',()=>{
 const r=parseMeteoblueBasic6h({
  payload:sample(),ibge:IBGE,latitude:target.lat,
  longitude:target.lon,nowMs:NOW
 });
 assert.equal(r.status,'FORECAST_PARSED_PRIVATE_STAGING');
 assert.equal(r.validTimes.length,29);
 assert.equal(r.issuedAt,'2026-11-18T06:00:00.000Z');
 assert.equal(r.metadataRunVerified,true);
 assert.equal(r.unitMetadataVerified,true);
 assert.equal(r.sourceCoordinatesVerified,true);
 assert.equal(r.values.length,Object.keys(METEOBLUE_BASIC6H_FIELDS).length);
 assert.ok(r.values.some(f=>f.field==='forecastPrecipitationSixHourMm'&&
   f.semantics==='SIX_HOUR_FORECAST_TOTAL'));
 assert.ok(r.values.some(f=>f.field==='forecastWindMaxSixHourKmh'&&
   f.semantics==='SIX_HOUR_MAX_WIND_SPEED_NOT_GUST'));
 assert.ok(!r.values.some(f=>/temperature|feels/i.test(f.field)));
 assert.equal(r.observational,false);
 assert.equal(r.scientificallyHomologated,false);
 assert.equal(r.publishedToSubscribers,false);
});
test('no fabricated missing values; invalid units not claimed as verified',()=>{
 const p=sample();delete p.data_6h.relativehumidity_mean;
 p.data_6h.precipitation[0]=null;
 p.units.windspeed='m/s';
 const r=parseMeteoblueBasic6h({payload:p,ibge:IBGE,
  latitude:target.lat,longitude:target.lon,nowMs:NOW});
 assert.equal(r.status,'FORECAST_PARSED_PRIVATE_STAGING');
 assert.equal(r.unitMetadataVerified,false);
 assert.equal(r.coverage.forecastHumidityMeanSixHourPct,'UNAVAILABLE_NOT_IN_RESPONSE');
 assert.equal(r.values.find(x=>x.field==='forecastPrecipitationSixHourMm').values[0],null);
});
test('reject invalid lengths, physical range, wrong point and six-hour timeline',()=>{
 const bad=sample();bad.data_6h.precipitation=[1];
 assert.equal(parseMeteoblueBasic6h({payload:bad,ibge:IBGE,
  latitude:target.lat,longitude:target.lon,nowMs:NOW}).status,'UNAVAILABLE');
 const bad2=sample();bad2.data_6h.windspeed_mean[0]=9999;
 assert.equal(parseMeteoblueBasic6h({payload:bad2,ibge:IBGE,
  latitude:target.lat,longitude:target.lon,nowMs:NOW}).status,'UNAVAILABLE');
 const bad3=sample();bad3.metadata.latitude=12;
 assert.equal(parseMeteoblueBasic6h({payload:bad3,ibge:IBGE,
  latitude:target.lat,longitude:target.lon,nowMs:NOW}).reason,'WRONG_LATITUDE');
 const bad4=sample();bad4.data_6h.time[2]=bad4.data_6h.time[1];
 assert.equal(parseMeteoblueBasic6h({payload:bad4,ibge:IBGE,
  latitude:target.lat,longitude:target.lon,nowMs:NOW}).status,'UNAVAILABLE');
});
test('Firestore budget reserves atomically, cannot exceed daily cap under concurrency',async()=>{
 const db=dbFake(),store=createRjMeteoblueFreeFirestoreStore({db,clock:()=>NOW});
 const ids=['3304557','3303906','3305802','3303401','3300100','3300159'];
 const results=await Promise.all(ids.map(id=>store.reserve(id,NOW)));
 assert.equal(results.filter(x=>x.approved).length,METEOBLUE_MAX_DAILY_CALLS);
 assert.equal(results.filter(x=>!x.approved).length,2);
 assert.equal(results[0].creditsReserved,METEOBLUE_BASIC6H_CREDITS);
 assert.equal(results[0].providerBalanceChecked,false);
 assert.equal(METEOBLUE_PRIVATE_CEILING_CREDITS,8_000_000);
 assert.equal((await store.reserve('3304557',NOW)).approved,false);
 assert.equal((await store.reserve('3304557',NOW)).reason,'LOCAL_DAILY_CALL_CEILING');
});
test('day change cannot bypass 24h city cooldown; expiry stops before billed calls',async()=>{
 const db=dbFake(),store=createRjMeteoblueFreeFirestoreStore({db,clock:()=>NOW});
 assert.equal((await store.reserve(IBGE,NOW)).approved,true);
 assert.equal((await store.reserve(IBGE,NOW+12*60*60_000)).reason,'MUNICIPAL_COOLDOWN');
 assert.equal((await store.reserve(IBGE,NOW+25*60*60_000)).approved,true);
 const expiry=Date.parse('2027-11-18T00:00:00Z');
 assert.equal((await store.reserve('3303906',expiry)).reason,'TRIAL_NOT_VALID_AT_REQUEST_TIME');
});
test('off by default; no Firestore or key must mean zero provider calls',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error('should not be called')};
 for(const env of [{}, {...goodEnv,BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED:'false'},
    {...goodEnv,BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE:'false'},
    {...goodEnv,BLAISE_METEOBLUE_PAID_ALLOWED:'true'}]){
  const c=createBlaiseRjMeteoblueFreeCollector({env,db:dbFake(),clock:()=>NOW,fetchImpl});
  assert.equal(c.configured,false);
  const r=await c.collectOne({ibge:IBGE});
  assert.equal(r.providerContacted,false);
 }
 assert.equal(calls,0);
});
test('one private request, shared cache; no repeated calls or subscriber publication',async()=>{
 let calls=0,uri='';
 const fetchImpl=async url=>{
  calls++;uri=url;
  return {status:200,headers:{get:()=>null},text:async()=>JSON.stringify(sample())};
 };
 const c=createBlaiseRjMeteoblueFreeCollector({
  env:goodEnv,db:dbFake(),clock:()=>NOW,fetchImpl
 });
 assert.equal(c.configured,true);
 const r=await c.collectOne({ibge:IBGE});
 assert.equal(r.status,'PRIVATE_STAGING_FORECAST_READY',r.reason);
 assert.equal(r.forecast.validTimes.length,29);
 assert.equal(r.creditsReservedThisInvocation,4000);
 assert.equal(r.providerRemainingBalanceUnknown,true);
 assert.equal(r.publishedToSubscribers,false);
 assert.equal(c.automaticPolling,false);
 assert.equal(calls,1);
 assert.ok(uri.startsWith('https://my.meteoblue.com/packages/basic-6h?'));
 assert.ok(uri.includes('apikey=SAFE_EXAMPLE_'));
 assert.equal(JSON.stringify(r).includes(goodEnv.BLAISE_METEOBLUE_FREE_API_KEY),false);
 const cached=await c.collectOne({ibge:IBGE});
 assert.equal(cached.status,'PRIVATE_STAGING_CACHE_HIT');
 assert.equal(cached.creditsReservedThisInvocation,0);
 assert.equal(calls,1);
});
test('failed or malformed upstream never refunded and cannot double-spend',async()=>{
 const db=dbFake();
 let calls=0;
 const c=createBlaiseRjMeteoblueFreeCollector({
  env:goodEnv,db,clock:()=>NOW,
  fetchImpl:async()=>{calls++;return {status:403,headers:{get:()=>null},
    text:async()=>JSON.stringify({message:'SECRET_NEVER_PRINT'})}}
 });
 const a=await c.collectOne({ibge:IBGE});
 assert.equal(a.reason,'PROVIDER_HTTP_NON_200');
 assert.equal(JSON.stringify(a).includes('SECRET_NEVER_PRINT'),false);
 const b=await c.collectOne({ibge:IBGE});
 assert.equal(b.providerContacted,false);
 assert.equal(b.reason,'MUNICIPAL_COOLDOWN');
 assert.equal(calls,1);
});
test('missing server Firestore fails closed even with key and enabled flag',async()=>{
 let calls=0;
 const c=createBlaiseRjMeteoblueFreeCollector({
  env:goodEnv,clock:()=>NOW,
  fetchImpl:async()=>{calls++;throw Error('should not call')}
 });
 assert.equal((await c.collectOne({ibge:IBGE})).status,'UNAVAILABLE');
 assert.equal(calls,0);
});
