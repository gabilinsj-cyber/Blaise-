import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRjOpenWeatherOneCall4Connector,
  RJ_OPENWEATHER_DAILY_INTERNAL_MAX, RJ_OPENWEATHER_CACHE_MS, RJ_OPENWEATHER_MAX_CURRENT_AGE_MS
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
  const again=await client.getCurrent({target,now:NOW+30_000});
  assert.equal(again.values.temperatureC,29.4);
  assert.equal(state.calls,1);
  assert.equal(state.reservations,1);
  assert.equal(RJ_OPENWEATHER_CACHE_MS,60_000);
  assert.equal(RJ_OPENWEATHER_MAX_CURRENT_AGE_MS,720_000);
  const refreshed=await client.getCurrent({target,now:NOW+61_000});
  assert.equal(refreshed.status,'AVAILABLE_PROVIDER_CURRENT_ESTIMATE');
  assert.equal(state.calls,2);
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
    {...payload,data:[{...payload.data[0],dt:Math.floor((NOW-13*60_000)/1000)}]},
    {...payload,lat:-5},
    {...payload,data:[]},
    {...payload,data:[{...payload.data[0],dt:Math.floor((NOW+1000)/1000)}]}
  ]){
    const {client}=make({}, {fetchImpl:async()=>new Response(JSON.stringify(mismatch),{
      status:200,headers:{'content-type':'application/json'}
    })});
    const result=await client.getCurrent({target,now:NOW});
    assert.equal(result.status,'UNAVAILABLE');
  }
});
test('a shared cache may never turn an observation older than 12 minutes into current data',async()=>{
  let requests=0;
  const stale={...structuredClone(payload),
    data:[{...payload.data[0],dt:Math.floor((NOW-13*60_000)/1000)}]};
  const cached=Object.freeze({
    status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
    sourceId:'OPENWEATHER_ONECALL4_CURRENT',
    ibge:target.ibge,latitude:target.latitude,longitude:target.longitude,
    validAt:new Date(NOW-13*60_000).toISOString(),
    retrievedAt:new Date(NOW-10_000).toISOString(),
    values:{temperatureC:99}
  });
  const {client}=make({},{
    cache:{async get(){return cached;},async set(){throw Error('must not cache invalid provider data');}},
    budget:{async tryReserve(){return false;}},
    fetchImpl:async()=>{requests++;return new Response(JSON.stringify(stale),{status:200,headers:{'content-type':'application/json'}});}
  });
  const result=await client.getCurrent({target,now:NOW});
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.reason,'DAILY_PROVIDER_BUDGET_EXHAUSTED');
  assert.equal(requests,0);
});

test('a value exactly 12 minutes old is valid, 12 minutes plus one second is expired',async()=>{
  for(const [delta,expected] of [[720_000,'AVAILABLE_PROVIDER_CURRENT_ESTIMATE'],[721_000,'UNAVAILABLE']]){
    const data={...payload,data:[{...payload.data[0],dt:Math.floor((NOW-delta)/1000)}]};
    const {client}=make({}, {fetchImpl:async()=>new Response(JSON.stringify(data),{
      status:200,headers:{'content-type':'application/json'}
    })});
    const result=await client.getCurrent({target,now:NOW});
    assert.equal(result.status,expected);
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

test('timestamp failures disclose only UTC deltas, never weather or key',async()=>{
  for(const [delta,reason,metric] of [
    [-13*60_000,'PROVIDER_CURRENT_VALUE_STALE','ageSeconds'],
    [60_000,'PROVIDER_CURRENT_VALUE_FUTURE','offsetSeconds']
  ]){
    const altered={...payload,data:[{
      ...payload.data[0],dt:Math.floor((NOW+delta)/1000)
    }]};
    const {client,state}=make({}, {fetchImpl:async()=>new Response(JSON.stringify(altered),{
      status:200,headers:{'content-type':'application/json'}
    })});
    const result=await client.getCurrent({target,now:NOW});
    assert.equal(result.status,'UNAVAILABLE');
    assert.equal(result.reason,reason);
    assert.equal(result.diagnostic?.[metric],Math.abs(delta)/1000);
    assert.equal(result.diagnostic.checkedAt,new Date(NOW).toISOString());
    assert.equal(result.diagnostic.sourceValidAt,new Date(NOW+delta).toISOString());
    assert.equal(result.data,null);
    const serialized=JSON.stringify(result);
    assert.equal(serialized.includes(fakeKey),false);
    assert.equal(serialized.includes('"temp"'),false);
  }
});

test('live call checks UTC after fetch, not frozen request-start clock',async()=>{
  const model={...payload,data:[{
    ...payload.data[0],dt:Math.floor((NOW+2_000)/1_000)
  }]};
  let tick=0,requests=0;
  const clock=()=>tick++===0?NOW:NOW+2_300;
  const {client,state}=make({clock},{
    fetchImpl:async()=>{
      requests++;
      return new Response(JSON.stringify(model),{
        status:200,headers:{'content-type':'application/json'}
      });
    }
  });
  const result=await client.getCurrent({target});
  assert.equal(result.status,'AVAILABLE_PROVIDER_CURRENT_ESTIMATE');
  assert.equal(result.validAt,new Date(NOW+2_000).toISOString());
  assert.equal(result.retrievedAt,new Date(NOW+2_300).toISOString());
  assert.equal(state.reservations,1);
  assert.equal(requests,1);
  assert.equal(tick,2);
});

test('real future-dated values remain rejected using a fresh response clock',async()=>{
  const model={...payload,data:[{
    ...payload.data[0],dt:Math.floor((NOW+60_000)/1_000)
  }]};
  let tick=0;
  const {client,state}=make({clock:()=>tick++===0?NOW:NOW+1_000},{
    fetchImpl:async()=>new Response(JSON.stringify(model),{
      status:200,headers:{'content-type':'application/json'}
    })
  });
  const result=await client.getCurrent({target});
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.reason,'PROVIDER_CURRENT_VALUE_FUTURE');
  assert.equal(result.diagnostic?.offsetSeconds,59);
  assert.equal(state.reservations,1);
});
