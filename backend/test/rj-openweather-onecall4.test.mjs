import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRjOpenWeatherOneCall4Connector,
  RJ_OPENWEATHER_DAILY_INTERNAL_MAX
} from '../src/rj-openweather-onecall4.mjs';

const NOW=Date.parse('2026-11-13T20:00:00Z');
const target={ibge:'3304557',latitude:-22.91,longitude:-43.22};
const fakeKey='a'.repeat(32); // synthetic fixture; NEVER a user credential.
const payload={
  lat:-22.91,lon:-43.22,data:[{
    dt:Math.floor((NOW-5*60_000)/1000),
    temp:29.4,feels_like:32.1,humidity:71,pressure:1010,
    wind_speed:4.5,wind_gust:9.2,rain:{'1h':1.3}
  }]
};
function make(variant={},impl={}){
  const state={calls:0,reservations:0,sets:0,seenUrl:null},items=new Map();
  const cache=impl.cache??{
    async get(key){return items.get(key)||null;},
    async set(key,value){items.set(key,value);state.sets++;}
  };
  const budget=impl.budget??{async tryReserve({maximum,utcDay,provider}){
    assert.equal(maximum,RJ_OPENWEATHER_DAILY_INTERNAL_MAX);
    assert.equal(utcDay,'2026-11-13');
    assert.ok(provider.includes('OPENWEATHER'));
    state.reservations++;return true;
  }};
  const fetchImpl=impl.fetchImpl??(async(url,options)=>{
    state.calls++;state.seenUrl=String(url);
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'manual');
    return new Response(JSON.stringify(payload),{
      status:200,headers:{'content-type':'application/json'}
    });
  });
  return {state,client:createRjOpenWeatherOneCall4Connector({
    enabled:true,subscriptionApproved:true,apiKey:fakeKey,
    cache,budget,fetchImpl,...variant
  })};
}
test('not activated without server key, subscription approval and shared budget/cache',async()=>{
  const cases=[
    {enabled:false},{subscriptionApproved:false},{apiKey:null},
    {cache:null},{budget:null}
  ];
  for(const v of cases){
    const {client,state}=make(v);
    const result=await client.getCurrent({target,now:NOW});
    assert.equal(client.configured,false);
    assert.equal(result.status,'UNAVAILABLE');
    assert.equal(state.calls,0);
    assert.equal(state.reservations,0);
  }
});
test('converts authorized One Call 4 current into clearly labeled MODEL estimate, not observed station',async()=>{
  const {state,client}=make();
  const out=await client.getCurrent({target,now:NOW});
  assert.equal(out.status,'AVAILABLE_PROVIDER_CURRENT_ESTIMATE');
  assert.equal(out.values.temperatureC,29.4);
  assert.equal(out.values.providerFeelsLikeC,32.1);
  assert.equal(out.values.windKmh,16.2);
  assert.equal(out.values.gustKmh,33.12);
  assert.equal(out.values.rainMm1h,1.3);
  assert.equal(out.officialObservation,false);
  assert.equal(out.officialAlert,false);
  assert.equal(out.radarFrame,false);
  assert.equal(out.originalMapPreserved,true);
  assert.equal(out.sourceId,'OPENWEATHER_ONECALL4_CURRENT');
  assert.equal(state.reservations,1);
  assert.equal(state.calls,1);
  assert.equal(state.sets,1);
  assert.ok(state.seenUrl.startsWith('https://api.openweathermap.org/data/4.0/onecall/current?'));
  assert.equal(new URL(state.seenUrl).searchParams.get('appid'),fakeKey);
  assert.equal(JSON.stringify(out).includes(fakeKey),false);
  const again=await client.getCurrent({target,now:NOW+2*60_000});
  assert.equal(again.values.temperatureC,29.4);
  assert.equal(state.calls,1);
  assert.equal(state.reservations,1);
});
test('never request if distributed daily quota reserve says no',async()=>{
  const {client,state}=make({}, {budget:{async tryReserve(){return false;}}});
  const r=await client.getCurrent({target,now:NOW});
  assert.equal(r.reason,'DAILY_PROVIDER_BUDGET_EXHAUSTED');
  assert.equal(state.calls,0);
});
test('invalid city coordinates are fail-closed before consuming quota',async()=>{
  const {client,state}=make();
  for(const wrong of [
    {ibge:'9999999',latitude:-22.91,longitude:-43.22},
    {ibge:'3304557',latitude:41.0,longitude:-43.22},
    {ibge:'3304557',latitude:NaN,longitude:-43.22}
  ])assert.equal((await client.getCurrent({target:wrong,now:NOW})).status,'UNAVAILABLE');
  assert.equal(state.calls,0);
  assert.equal(state.reservations,0);
});
test('missing rain is unknown, not 0; missing gust stays missing',async()=>{
  const data=structuredClone(payload);delete data.data[0].rain;delete data.data[0].wind_gust;
  const {client}=make({}, {fetchImpl:async()=>new Response(JSON.stringify(data),{
    status:200,headers:{'content-type':'application/json'}
  })});
  const r=await client.getCurrent({target,now:NOW});
  assert.equal(r.values.rainMm1h,null);
  assert.equal(r.values.gustKmh,null);
  assert.equal(r.values.missingPrecipitationIsZero,false);
});
test('stale or wrong-city weather cannot be shown as real time',async()=>{
  for(const mismatch of [
    {...payload,data:[{...payload.data[0],dt:Math.floor((NOW-31*60_000)/1000)}]},
    {...payload,lat:-5},
    {...payload,data:[]}
  ]){
    const {client}=make({}, {fetchImpl:async()=>new Response(JSON.stringify(mismatch),{
      status:200,headers:{'content-type':'application/json'}
    })});
    const result=await client.getCurrent({target,now:NOW});
    assert.equal(result.status,'UNAVAILABLE');
  }
});
test('provider errors never expose API key or request URL in results',async()=>{
  const {client}=make({}, {fetchImpl:async()=>new Response(JSON.stringify({
    cod:401,message:'wrong api key'
  }),{status:401,headers:{'content-type':'application/json'}})});
  const result=await client.getCurrent({target,now:NOW});
  assert.equal(result.reason,'OPENWEATHER_PROVIDER_FETCH_FAILED');
  assert.equal(JSON.stringify(result).includes(fakeKey),false);
});
