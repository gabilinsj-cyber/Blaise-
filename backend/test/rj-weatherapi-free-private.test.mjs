import test from 'node:test';
import assert from 'node:assert/strict';
import {
 parseWeatherApiPrivateSample,buildWeatherApiPrivateUrl,
 collectWeatherApiPrivateOnce,classifyWeatherApiSky
} from '../src/rj-weatherapi-free-private.mjs';
import {
 createWeatherApiPrivateBudget,WAPI_PRIVATE_BUDGET_COLLECTION,WAPI_PRIVATE_BUDGET_ID
} from '../src/rj-weatherapi-free-one-shot-budget.mjs';
const now=Date.parse('2026-11-22T13:00:00Z');
const env=Object.freeze({
 BLAISE_WAPI_PRIVATE_ENABLED:'true',BLAISE_WAPI_FREE_PLAN_CONFIRMED:'true',
 BLAISE_WAPI_NO_AUTOTOPUP_CONFIRMED:'true',
 BLAISE_WAPI_ONE_SHOT_APPROVED:'true',BLAISE_WAPI_PAID_ALLOWED:'false',
 BLAISE_WAPI_PUBLISH_TO_SUBSCRIBERS:'false',
 BLAISE_WAPI_FREE_API_KEY:'FAKE_TEST_KEY_12345'
});
const epoch=ms=>Math.floor(ms/1000);
function response(){
 return {
  location:{lat:-22.9068,lon:-43.1729,name:'Rio de Janeiro',country:'Brazil'},
  current:{
   last_updated_epoch:epoch(now-12*60_000),
   temp_c:27.8,feelslike_c:30.6,humidity:77,cloud:45,
   wind_kph:17.5,gust_kph:26.3,pressure_mb:1012,
   precip_mm:0.2,uv:5.4,condition:{text:'Partly cloudy',code:1003}
  },
  forecast:{forecastday:[{hour:[
   {time_epoch:epoch(now+60*60_000),temp_c:28.2,
     feelslike_c:31,cloud:50,precip_mm:0.4,wind_kph:20,condition:{code:1003}},
   {time_epoch:epoch(now+2*60*60_000),temp_c:26.1,
     feelslike_c:28.4,cloud:95,precip_mm:2.3,wind_kph:16,condition:{code:1183}}
  ]}]}
 };
}
function fakeDb(){
 const data=new Map();let queue=Promise.resolve();
 const key=(collection,id)=>collection+'/'+id;
 const document=(k)=>({key:k,async get(){
  return {exists:data.has(k),data:()=>structuredClone(data.get(k))}
 }});
 return {
  data,
  collection(name){return {doc(id){return document(key(name,id))}}},
  async runTransaction(fn){
   const job=async()=>{
    const changes=[];
    const tx={
     get:doc=>doc.get(),
     set:(doc,value)=>changes.push([doc.key,structuredClone(value)])
    };
    const value=await fn(tx);
    for(const [key,val] of changes)data.set(key,val);
    return value;
   };
   const next=queue.then(job,job);
   queue=next.then(()=>{},()=>{});
   return next;
  }
 };
}
test('offline parser: fields, sky and current/forecast are classified E/P with timestamps',()=>{
 const result=parseWeatherApiPrivateSample(response(),{now});
 assert.equal(result.status,'PRIVATE_REAL_SAMPLE_READY');
 assert.equal(result.current.values.temperatureC,27.8);
 assert.equal(result.current.values.feelsLikeC,30.6);
 assert.equal(result.current.values.cloudPct,45);
 assert.equal(result.current.skyCondition,'PARCIALMENTE_NUBLADO');
 assert.equal(result.hourly.length,2);
 assert.equal(result.hourly[1].skyCondition,'CHUVA_INDICADA_PELO_PROVEDOR');
 assert.equal(result.ageMinutes,12);
 assert.equal(result.meets30MinuteTarget,true);
 assert.equal(result.currentKind,'E_AGGREGATED_NOT_INSTRUMENTAL');
 assert.equal(result.officialAlert,false);
 assert.equal(result.publishedToSubscribers,false);
 assert.equal(result.rawResponseSaved,false);
 assert.deepEqual([1000,1003,1006,1009].map(classifyWeatherApiSky),[
  'SOL_OU_CEU_LIMPO','PARCIALMENTE_NUBLADO','NUBLADO','ENCUBERTO']);
 assert.equal(classifyWeatherApiSky(1276),'TROVOADA_INDICADA_NAO_ALERTA_OFICIAL');
});
test('never invent zero for missing fields; 31-minute age is not freshness target',()=>{
 const p=response();delete p.current.gust_kph;delete p.current.precip_mm;
 p.current.last_updated_epoch=epoch(now-31*60_000);
 const r=parseWeatherApiPrivateSample(p,{now});
 assert.equal(r.status,'PRIVATE_REAL_SAMPLE_READY');
 assert.equal(r.current.values.gustKmh,null);
 assert.equal(r.current.values.precipitationMm,null);
 assert.equal(r.meets30MinuteTarget,false);
});
test('invalid city, old source, future source and malformed forecast fail closed',()=>{
 const p=response();
 assert.equal(parseWeatherApiPrivateSample({...p,
  location:{lat:51.5,lon:0.1}},{now}).reason,'PROVIDER_COORDINATES_MISMATCH');
 assert.equal(parseWeatherApiPrivateSample({...p,
  current:{...p.current,last_updated_epoch:epoch(now-61*60_000)}},{now})
  .reason,'CURRENT_SOURCE_TIME_STALE_OR_FUTURE');
 assert.equal(parseWeatherApiPrivateSample({...p,
  current:{...p.current,last_updated_epoch:epoch(now+60_000)}},{now})
  .reason,'CURRENT_SOURCE_TIME_STALE_OR_FUTURE');
 assert.equal(parseWeatherApiPrivateSample({...p,
  forecast:{forecastday:[]}}, {now}).reason,'FORECAST_SHAPE_INVALID');
 assert.equal(parseWeatherApiPrivateSample({...p,error:{code:1006}},{now})
  .status,'UNAVAILABLE');
 const dup=response();
 dup.forecast.forecastday[0].hour[1].time_epoch=
  dup.forecast.forecastday[0].hour[0].time_epoch;
 assert.equal(parseWeatherApiPrivateSample(dup,{now}).reason,
  'DUPLICATE_HOURLY_TIMESTAMPS');
});
test('URL limits to known Rio and denies query without secret (never print key)',()=>{
 const url=buildWeatherApiPrivateUrl({ibge:'3304557',apiKey:env.BLAISE_WAPI_FREE_API_KEY});
 assert.equal(url.host,'api.weatherapi.com');
 assert.equal(url.pathname,'/v1/forecast.json');
 assert.equal(url.searchParams.get('days'),'1');
 assert.equal(url.searchParams.get('aqi'),'no');
 assert.equal(url.searchParams.get('alerts'),'no');
 assert.throws(()=>buildWeatherApiPrivateUrl({ibge:'3303302',apiKey:'FAKE_TEST_KEY_12345'}));
 assert.throws(()=>buildWeatherApiPrivateUrl({ibge:'3304557',apiKey:'INVALID!'}));
});
test('a single Firestore reservation wins concurrency across replicas and persists across day boundaries',async()=>{
 const db=fakeDb();
 const a=createWeatherApiPrivateBudget({db,clock:()=>now});
 const b=createWeatherApiPrivateBudget({db,clock:()=>now+86400_000});
 const results=await Promise.all(Array.from({length:12},(_,i)=>
   (i%2?a:b).reserve('3304557')));
 assert.equal(results.filter(x=>x.approved).length,1);
 assert.equal(db.data.get(WAPI_PRIVATE_BUDGET_COLLECTION+'/'+WAPI_PRIVATE_BUDGET_ID)
  .callsReserved,1);
 assert.equal((await a.read()).callsReserved,1);
 assert.equal((await b.reserve('3304557')).reason,'ONE_FREE_CALL_ALREADY_RESERVED');
 assert.equal(db.data.size,1);
});
test('no key or approval, no budget or failed Firestore makes zero weather calls',async()=>{
 let calls=0;
 const fakeFetch=async()=>{calls++;return {status:200,headers:{get:()=>null},
  text:async()=>JSON.stringify(response())}};
 const denied=await collectWeatherApiPrivateOnce({env:{},clock:()=>now,
  reserve:()=>({approved:true}),fetchImpl:fakeFetch});
 assert.equal(denied.providerContacted,false);
 const noQuota=await collectWeatherApiPrivateOnce({env,clock:()=>now,
  reserve:async()=>{throw Error('Firestore permission denied')},fetchImpl:fakeFetch});
 assert.equal(noQuota.providerContacted,false);
 assert.equal(calls,0);
});
test('one approved staged response parses only once and never publishes or uses paid plan',async()=>{
 const db=fakeDb();const budget=createWeatherApiPrivateBudget({db,clock:()=>now});
 let calls=0;
 const api=async()=>{calls++;return {status:200,headers:{get:()=>null},
  text:async()=>JSON.stringify(response())}};
 const result=await collectWeatherApiPrivateOnce({
  env,reserve:budget.reserve,clock:()=>now,fetchImpl:api});
 assert.equal(result.status,'PRIVATE_REAL_SAMPLE_READY');
 assert.equal(result.providerContacted,true);
 assert.equal(result.publishedToSubscribers,false);
 assert.equal(result.usedPaidPlan,false);
 const again=await collectWeatherApiPrivateOnce({
  env,reserve:budget.reserve,clock:()=>now,fetchImpl:api});
 assert.equal(again.providerContacted,false);
 assert.equal(calls,1);
 assert.equal((await budget.read()).callsReserved,1);
});
