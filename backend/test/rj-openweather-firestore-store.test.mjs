import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRjOpenWeatherFirestoreStore,
  RJ_AGENT13_CACHE_COLLECTION,RJ_AGENT13_QUOTA_COLLECTION,RJ_AGENT13_CITY_COOLDOWN_COLLECTION,RJ_AGENT13_TEMP_CACHE_COLLECTION
} from '../src/rj-openweather-firestore-store.mjs';
import {RJ_OPENWEATHER_SOURCE_ID} from '../src/rj-openweather-onecall4.mjs';

const DATE='2026-11-13',NOW=Date.parse('2026-11-13T19:00:00Z');
const KEY='openweather:v4:current:3304557:-22.9100:-43.2200';
const WEATHER=Object.freeze({
  status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
  sourceId:RJ_OPENWEATHER_SOURCE_ID,
  ibge:'3304557',validAt:new Date(NOW-60_000).toISOString(),
  values:{temperatureC:30.2,providerFeelsLikeC:33.4}
});
function fakeDb(){
  const data=new Map();
  let queue=Promise.resolve();
  const ref=key=>({
    key,
    async get(){
      return {exists:data.has(key),data:()=>structuredClone(data.get(key))};
    },
    async set(value){data.set(key,structuredClone(value));}
  });
  return {
    data,
    collection(name){return {doc(key){return ref(name+'/'+key);}};},
    async runTransaction(fn){
      const execute=async()=>{
        const pending=[];
        const transaction={
          get:r=>r.get(),
          set(r,value){pending.push([r.key,structuredClone(value)]);}
        };
        const result=await fn(transaction);
        for(const [key,value] of pending)data.set(key,value);
        return result;
      };
      // Mock serializable transactions to assert the intended API contract.
      const completed=queue.then(execute,execute);
      queue=completed.then(()=>{},()=>{});
      return completed;
    }
  };
}
test('Agent13 Firestore uses separate bounded namespaced collections',()=>{
  const s=createRjOpenWeatherFirestoreStore({db:fakeDb(),clock:()=>NOW});
  assert.equal(s.cacheCollection,RJ_AGENT13_CACHE_COLLECTION);
  assert.equal(s.quotaCollection,RJ_AGENT13_QUOTA_COLLECTION);
  assert.equal(s.automaticPolling,false);
  assert.equal(s.automaticTtlDeletion,false);
});
test('shared cache saves only normalized source data and expires without paid managed TTL',async()=>{
  const db=fakeDb();
  let clock=NOW;
  const store=createRjOpenWeatherFirestoreStore({db,clock:()=>clock});
  assert.equal(await store.cache.get(KEY),null);
  await store.cache.set(KEY,WEATHER,60_000);
  assert.deepEqual(await store.cache.get(KEY),WEATHER);
  assert.equal(db.data.size,1);
  assert.equal([...db.data.keys()][0].startsWith(RJ_AGENT13_CACHE_COLLECTION+'/'),true);
  assert.equal([...db.data.keys()][0].includes('3304557'),false);
  clock+=60_001;
  assert.equal(await store.cache.get(KEY),null);
});
test('transaction quota permits only one daily call even across instances',async()=>{
  const db=fakeDb();
  const a=createRjOpenWeatherFirestoreStore({db,clock:()=>NOW});
  const b=createRjOpenWeatherFirestoreStore({db,clock:()=>NOW});
  const params={provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:DATE,maximum:1};
  const results=await Promise.all(Array.from({length:10},(_,i)=>
    (i%2?a:b).budget.tryReserve(params)));
  assert.equal(results.filter(Boolean).length,1);
  assert.equal(results.filter(x=>x===false).length,9);
  assert.equal(db.data.get(RJ_AGENT13_QUOTA_COLLECTION+'/'+DATE).count,1);
});
test('provider, date, key, and malformed cache cannot bypass validation',async()=>{
  const store=createRjOpenWeatherFirestoreStore({db:fakeDb(),clock:()=>NOW});
  for(const params of [
    {provider:'RAINVIEWER',utcDay:DATE,maximum:1},
    {provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:'2026-02-31',maximum:1},
    {provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:DATE,maximum:901},
    {provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:DATE,maximum:0}
  ])await assert.rejects(store.budget.tryReserve(params),/invalid_quota_reservation/);
  await assert.rejects(store.cache.get('other:source'),/invalid_cache_key/);
  await assert.rejects(store.cache.set(KEY,{...WEATHER,status:'UNKNOWN'},600_000),/invalid_cache_write/);
  await assert.rejects(store.cache.set(KEY,WEATHER,600_000),/invalid_cache_write/);
  await assert.rejects(store.cache.set(KEY,WEATHER,24*3600_000),/invalid_cache_write/);
});
test('Firestore failure fails closed and cannot authorize an OpenWeather request',async()=>{
  const db=fakeDb();
  db.runTransaction=async()=>{throw Error('permission denied');};
  const store=createRjOpenWeatherFirestoreStore({db,clock:()=>NOW});
  await assert.rejects(store.budget.tryReserve({
    provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:DATE,maximum:1
  }));
});

test('35-minute city cooldown is atomic across Cloud Run replicas and shared for all users',async()=>{
  const db=fakeDb();
  const a=createRjOpenWeatherFirestoreStore({db,clock:()=>NOW});
  const b=createRjOpenWeatherFirestoreStore({db,clock:()=>NOW});
  const params={provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:DATE,
    maximum:1,ibge:'3304557',nowMs:NOW};
  const attempts=await Promise.all(Array.from({length:30},(_,i)=>
    (i%2?a:b).budget.tryReserveMunicipalFallback(params)));
  assert.equal(attempts.filter(Boolean).length,1);
  assert.equal(db.data.get(RJ_AGENT13_QUOTA_COLLECTION+'/'+DATE).count,1);
  assert.equal(db.data.get(RJ_AGENT13_CITY_COOLDOWN_COLLECTION+'/3304557').lastReservedAtMs,NOW);
  assert.equal(await a.budget.tryReserveMunicipalFallback({
    ...params,nowMs:NOW+34*60_000
  }),false);
  assert.equal(await a.budget.tryReserveMunicipalFallback({
    ...params,nowMs:NOW+35*60_000
  }),false);
  assert.equal(db.data.get(RJ_AGENT13_QUOTA_COLLECTION+'/'+DATE).count,1);
});
test('35-minute city cooldown cannot be bypassed across midnight or via another city',async()=>{
  const db=fakeDb();
  const store=createRjOpenWeatherFirestoreStore({db,clock:()=>NOW});
  const prev=Date.parse('2026-11-13T23:50:00Z');
  const base={provider:RJ_OPENWEATHER_SOURCE_ID,maximum:1,ibge:'3304557'};
  assert.equal(await store.budget.tryReserveMunicipalFallback({
    ...base,utcDay:'2026-11-13',nowMs:prev
  }),true);
  assert.equal(await store.budget.tryReserveMunicipalFallback({
    ...base,utcDay:'2026-11-14',nowMs:prev+20*60_000
  }),false);
  assert.equal(await store.budget.tryReserveMunicipalFallback({
    ...base,ibge:'3303302',utcDay:'2026-11-14',nowMs:prev+20*60_000
  }),false);
  assert.equal(await store.budget.tryReserveMunicipalFallback({
    ...base,utcDay:'2026-11-14',nowMs:prev+35*60_000
  }),false);
});
test('municipal fallback and regular reservations share one global 1/day maximum',async()=>{
  const db=fakeDb(),store=createRjOpenWeatherFirestoreStore({db,clock:()=>NOW});
  db.data.set(RJ_AGENT13_QUOTA_COLLECTION+'/'+DATE,{
    provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:DATE,count:0,maximum:1
  });
  const param={provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:DATE,maximum:1,
    ibge:'3304557',nowMs:NOW};
  assert.equal(await store.budget.tryReserveMunicipalFallback(param),true);
  assert.equal(await store.budget.tryReserve({
    provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:DATE,maximum:1
  }),false);
  assert.equal(await store.budget.tryReserveMunicipalFallback({
    ...param,ibge:'3303302'
  }),false);
  assert.equal(db.data.get(RJ_AGENT13_QUOTA_COLLECTION+'/'+DATE).count,1);
});
test('malformed municipal fallback cannot spend quota',async()=>{
  const db=fakeDb(),store=createRjOpenWeatherFirestoreStore({db,clock:()=>NOW});
  for(const input of [
    {ibge:'0000000'}, {ibge:'3304557',nowMs:NOW-86400_000},
    {ibge:'3304557',maximum:901}, {ibge:'3304557',provider:'OTHER'}
  ]){
    await assert.rejects(store.budget.tryReserveMunicipalFallback({
      provider:RJ_OPENWEATHER_SOURCE_ID,utcDay:DATE,maximum:1,
      ibge:'3304557',nowMs:NOW,...input
    }),/invalid_municipal_reservation/);
  }
  assert.equal(db.data.size,0);
});

test('temperature-only cache expires at provider original validAt, not 35 minutes after insertion',async()=>{
  const db=fakeDb();
  let t=NOW;
  const s=createRjOpenWeatherFirestoreStore({db,clock:()=>t});
  const value={
    ...WEATHER,
    type:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT',
    officialObservation:false,officialAlert:false,
    retrievedAt:new Date(NOW).toISOString(),
    values:{temperatureC:30.2,providerFeelsLikeC:33.4,
      windKmh:100,rainMm1h:50}
  };
  await s.temperatureCache.set('3304557',value);
  const key=RJ_AGENT13_TEMP_CACHE_COLLECTION+'/3304557';
  assert.equal(db.data.get(key).expiresAtMs,
    Date.parse(value.validAt)+35*60_000);
  const read=await s.temperatureCache.get('3304557');
  assert.deepEqual(Object.keys(read.values),['temperatureC','providerFeelsLikeC']);
  assert.equal(JSON.stringify(db.data.get(key)).includes('windKmh'),false);
  assert.equal(JSON.stringify(db.data.get(key)).includes('rainMm1h'),false);
  t=Date.parse(value.validAt)+35*60_000;
  assert.equal(await s.temperatureCache.get('3304557'),null);
});
test('temperature cache rejects unsupported codes, future timestamps, and illegal values',async()=>{
  const db=fakeDb();
  const s=createRjOpenWeatherFirestoreStore({db,clock:()=>NOW});
  const base={
    ...WEATHER,
    type:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT',
    officialObservation:false,officialAlert:false,
    retrievedAt:new Date(NOW).toISOString()
  };
  await assert.rejects(s.temperatureCache.set('9999999',base),/invalid_temperature_cache_write/);
  await assert.rejects(s.temperatureCache.set('3304557',{
    ...base,validAt:new Date(NOW+1000).toISOString()
  }),/expired_temperature_cache_write/);
  await assert.rejects(s.temperatureCache.set('3304557',{
    ...base,values:{temperatureC:99,providerFeelsLikeC:null}
  }),/invalid_temperature_cache_values/);
  assert.equal(db.data.size,0);
});
