import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjAgent13TemperatureContingencyCollector} from '../src/rj-agent13-temperature-fallback-collector.mjs';

const NOW=Date.parse('2026-11-17T12:00:00Z');
const KEY='b'.repeat(32); // synthetic fixture, never a real credential
const ibge='3304557';
const priority=(temp=null,feels=null)=>[1,2,3].map(rank=>({
  rank,sourceId:['INMET','INPE_CPTEC','ECMWF_IFS'][rank-1],
  verifiedByBackend:true,
  status:rank===1&&(temp!==null||feels!==null)?'CURRENT':'UNAVAILABLE',
  validAt:new Date(NOW-60_000).toISOString(),
  checkedAt:new Date(NOW).toISOString(),
  values:rank===1?{temperatureC:temp,feelsLikeC:feels}:{
    temperatureC:null,feelsLikeC:null
  }
}));
function fake(now=NOW,dt=NOW-20*60_000){
  const state={now,calls:0,reserved:0,written:0,last:NaN,estimate:null};
  const store={
    temperatureCache:{
      async get(){return state.estimate&&state.now-Date.parse(state.estimate.validAt)<=35*60_000?state.estimate:null;},
      async set(city,v){assert.equal(city,ibge);state.estimate=v;state.written++;}
    },
    budget:{
      async tryReserveMunicipalFallback(p){
        assert.equal(p.ibge,ibge);
        assert.equal(p.maximum,900);
        assert.equal(p.utcDay,new Date(state.now).toISOString().slice(0,10));
        if(state.reserved>=900||state.now-state.last<35*60_000)return false;
        state.last=state.now;state.reserved++;return true;
      }
    }
  };
  const fetchImpl=async url=>{
    state.calls++;
    assert.equal(new URL(url).hostname,'api.openweathermap.org');
    assert.equal(new URL(url).searchParams.get('appid'),KEY);
    return new Response(JSON.stringify({
      lat:-22.9068,lon:-43.1729,
      data:[{dt:Math.floor(dt/1000),temp:26.4,feels_like:28.9,
        rain:{'1h':25},wind_speed:60,wind_gust:90}]
    }),{status:200,headers:{'content-type':'application/json'}});
  };
  const build=(overrides={})=>createRjAgent13TemperatureContingencyCollector({
    enabled:true,subscriptionApproved:true,
    readSecret:async()=>KEY,store,fetchImpl,clock:()=>state.now,...overrides
  });
  return {state,store,build};
}
test('not enabled and no audited data -> zero provider calls and no secret read',async()=>{
  const {state,store}=fake();
  let reads=0;
  const collector=createRjAgent13TemperatureContingencyCollector({
    enabled:false,subscriptionApproved:true,
    store,readSecret:async()=>{reads++;return KEY;},
    fetchImpl:async()=>{state.calls++;throw Error('never');}
  });
  const out=await collector.collect({municipalityIbge:ibge,prioritySources:priority()});
  assert.equal(out.status,'BLOCKED');
  assert.equal(reads,0);assert.equal(state.calls,0);
  const {build}=fake();
  const missing=await build().collect({municipalityIbge:ibge});
  assert.equal(missing.reason,'PRIMARY_SOURCE_AUDIT_INCOMPLETE');
});
test('one call returns only missing temperature/feels-like, never rain or wind',async()=>{
  const {state,build}=fake();
  const result=await build().collect({municipalityIbge:ibge,prioritySources:priority()});
  assert.equal(result.status,'FALLBACK_ESTIMATE');
  assert.deepEqual(result.fields,{temperatureC:26.4,feelsLikeC:28.9});
  assert.equal(result.ageSeconds,1200);
  assert.equal(result.cacheHit,false);
  assert.equal(result.providerRequestMade,true);
  assert.equal(state.calls,1);
  assert.equal(state.reserved,1);
  assert.equal(JSON.stringify(result).includes('wind'),false);
  assert.equal(JSON.stringify(result).includes('rain'),false);
  assert.equal(JSON.stringify(result).includes(KEY),false);
  assert.deepEqual(Object.keys(state.estimate.values),['temperatureC','providerFeelsLikeC']);
});
test('shared cached estimate is reused for many clients and primary temperature remains untouched',async()=>{
  const {state,build}=fake();
  const collector=build();
  const r1=await collector.collect({municipalityIbge:ibge,prioritySources:priority(24.5)});
  assert.deepEqual(r1.fields,{temperatureC:null,feelsLikeC:28.9});
  state.now+=60_000;
  const r2=await collector.collect({municipalityIbge:ibge,prioritySources:priority()});
  assert.equal(r2.status,'FALLBACK_ESTIMATE');
  assert.equal(r2.cacheHit,true);
  assert.equal(r2.providerRequestMade,false);
  assert.equal(state.calls,1);
});
test('35 minutes between reservations per city: if source reading expired earlier, no early fetch',async()=>{
  const {state,build}=fake(NOW,NOW-20*60_000);
  const collector=build();
  assert.equal((await collector.collect({municipalityIbge:ibge,prioritySources:priority()})).status,'FALLBACK_ESTIMATE');
  state.now+=26*60_000;
  const sources=priority();sources.forEach(s=>{s.checkedAt=new Date(state.now).toISOString();});
  const expired=await collector.collect({municipalityIbge:ibge,prioritySources:sources});
  assert.equal(expired.status,'BLOCKED');
  assert.equal(expired.reason,'MUNICIPAL_COOLDOWN_OR_DAILY_QUOTA');
  assert.equal(state.calls,1);
});
test('any priority current field blocks substitution of that specific field',async()=>{
  const {state,build}=fake();
  const one=await build().collect({municipalityIbge:ibge,prioritySources:priority(26,30)});
  assert.equal(one.reason,'PRIORITY_VALUES_PRESENT');
  assert.equal(state.calls,0);
});
test('unknown municipality/geolocation cannot trigger any provider request',async()=>{
  const {state,build}=fake();
  const out=await build().collect({
    municipalityIbge:'3300100',prioritySources:priority()
  });
  assert.equal(out.reason,'MUNICIPAL_COORDINATES_NOT_VERIFIED');
  assert.equal(state.calls,0);
});
test('secret failure, atomic quota denial, and provider failure do not return fabricated values',async()=>{
  const {state,build,store}=fake();
  let result=await build({readSecret:async()=>{throw Error('secret');}})
    .collect({municipalityIbge:ibge,prioritySources:priority()});
  assert.equal(result.reason,'SECRET_MANAGER_UNAVAILABLE');
  assert.equal(state.calls,0);
  result=await build({store:{...store,budget:{async tryReserveMunicipalFallback(){return false;}}}})
    .collect({municipalityIbge:ibge,prioritySources:priority()});
  assert.equal(result.reason,'MUNICIPAL_COOLDOWN_OR_DAILY_QUOTA');
  assert.equal(state.calls,0);
  result=await build({fetchImpl:async()=>{throw Error('secret in error');}})
    .collect({municipalityIbge:ibge,prioritySources:priority()});
  assert.equal(result.reason,'OPENWEATHER_FETCH_FAILED');
  assert.equal(JSON.stringify(result).includes('secret in error'),false);
});
