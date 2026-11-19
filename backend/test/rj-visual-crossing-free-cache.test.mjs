import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVisualCrossingPrivateSample} from '../src/rj-visual-crossing-free-private.mjs';
import {createRjVisualCrossingPrivateCache,normalizeVisualCrossingCacheRecord,
 evaluateVisualCrossingPrivateCache,VC_PRIVATE_CACHE_COLLECTION}
 from '../src/rj-visual-crossing-free-cache.mjs';
import geo from '../src/rj-ibge-92-points.json' with {type:'json'};
const NOW=Date.parse('2026-11-19T15:00:00Z');
const rio=geo.points.find(p=>p.ibge==='3304557');
const createSample=()=>parseVisualCrossingPrivateSample({
 queryCost:1,latitude:rio.lat,longitude:rio.lon,
 currentConditions:{
  datetimeEpoch:Math.floor(NOW/1000)-300,temp:28.2,
  feelslike:32,humidity:70,dew:22,windspeed:12,
  windgust:null,precip:null,precipprob:35,pressure:1010,
  severerisk:null
 },
 days:[{hours:[
  {datetimeEpoch:Math.floor(NOW/1000)+3600,temp:29,windgust:40},
  {datetimeEpoch:Math.floor(NOW/1000)+7200,temp:30,precip:0}
 ]}]
},{ibge:'3304557',now:NOW});
const makeDb=()=>{
 const docs=new Map();
 const db={collection:(key)=>{
  assert.equal(key,VC_PRIVATE_CACHE_COLLECTION);
  return {doc:id=>({
   get:async()=>({exists:docs.has(id),data:()=>docs.get(id)}),
   set:async data=>{docs.set(id,data)}
  })};
 }};
 return {db,docs};
};
test('save only normalized provider fields to private Firestore, never secrets/raw response',async()=>{
 const {db,docs}=makeDb();
 const c=createRjVisualCrossingPrivateCache({db,clock:()=>NOW});
 const saved=await c.save(createSample());
 assert.equal(saved.saved,true);
 assert.equal(saved.currentFields,7);
 assert.equal(saved.forecastSlots,2);
 const raw=docs.get('3304557');
 assert.equal(raw.forecast.length,2);
 assert.equal(raw.current.measurementStationVerified,false);
 assert.equal(raw.categoryCurrent,'E');
 assert.equal(raw.categoryForecast,'P');
 assert.equal(raw.publishedToSubscribers,false);
 assert.equal(raw.clientReleased,false);
 const text=JSON.stringify(raw);
 for(const secret of ['apiKey','apikey','weather.visualcrossing.com','billingEmail'])
  assert.ok(!text.includes(secret));
 const r=await c.read('3304557');
 assert.equal(r.status,'PRIVATE_CACHE_VALID');
 assert.equal(r.fields.length,7);
 assert.equal(r.forecast.length,2);
 assert.equal(r.forecast[0].fields.find(f=>f.field==='windGustKmh').value,40);
 assert.ok(!r.fields.some(f=>f.field==='windGustKmh'));
});
test('invalid provider metadata, guessed numbers and paid inputs are not saved',()=>{
 const s=createSample();
 for(const bad of [
  {...s,ibge:'3303302'},
  {...s,paidApiUsed:true},
  {...s,publishedToSubscribers:true},
  {...s,queryCost:5},
  {...s,current:{...s.current,kind:'O'}},
  {...s,current:{...s.current,values:{...s.current.values,temperatureC:'28'}}},
  {...s,current:{...s.current,values:{...s.current.values,temperatureC:90}}},
  {...s,forecast:[...s.forecast,...s.forecast]},
  {...s,forecast:[{...s.forecast[0],validAt:new Date(NOW+49*3600_000).toISOString()}]},
 ]){
  assert.equal(normalizeVisualCrossingCacheRecord(bad,{now:NOW}),null);
 }
});
test('expired, removed, unpublished, past or future current data remains unavailable',async()=>{
 const sample=createSample();
 const valid=normalizeVisualCrossingCacheRecord(sample,{now:NOW});
 assert.ok(valid);
 assert.equal(evaluateVisualCrossingPrivateCache(valid,{now:NOW}).status,'PRIVATE_CACHE_VALID');
 const twoHours=NOW+2*3600_000;
 const later=evaluateVisualCrossingPrivateCache(valid,{now:twoHours});
 assert.equal(later.fields.length,0);
 assert.equal(later.validAt,null);
 // Two hourly predictions are now expired; no fabricated replacement.
 assert.equal(later.status,'INDISPONIVEL');
 assert.equal(evaluateVisualCrossingPrivateCache(valid,{now:NOW+7*3600_000}).status,'INDISPONIVEL');
 assert.equal(evaluateVisualCrossingPrivateCache({...valid,clientReleased:true},{now:NOW}).status,'INDISPONIVEL');
 assert.equal(evaluateVisualCrossingPrivateCache({...valid,providerRecordCost:4},{now:NOW}).status,'INDISPONIVEL');
 const {db}=makeDb();
 const c=createRjVisualCrossingPrivateCache({db,clock:()=>NOW});
 assert.equal((await c.read('3303302')).status,'INDISPONIVEL');
});
