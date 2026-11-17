import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMetNorwayRjForecast,
  createRjMetNorwayLocationforecastCollector,
  MET_NORWAY_MIN_CACHE_MS
} from '../src/rj-met-norway-locationforecast.mjs';
import {RJ_METEOROLOGICAL_FIELDS} from '../src/rj-meteorological-completeness-audit.mjs';

const NOW=Date.parse('2026-11-17T15:00:00Z');
const point={lat:-22.9068,lon:-43.1729,verifiedByBackend:true};
const payload=()=>({
  type:'Feature',geometry:{coordinates:[-43.1729,-22.9068,10]},
  properties:{
    meta:{updated_at:new Date(NOW-2*60*60_000).toISOString()},
    timeseries:Array.from({length:12},(_,i)=>({
      time:new Date(NOW+(i-1)*60*60_000).toISOString(),
      data:{
        instant:{details:{
          air_temperature:27.4,apparent_air_temperature:30.1,
          relative_humidity:76,air_pressure_at_sea_level:1010.1,
          cloud_area_fraction:45,wind_speed:3.5,wind_speed_of_gust:6,
          wind_from_direction:180,dew_point_temperature:21.9,
          ultraviolet_index_clear_sky:8.6
        }},
        next_1_hours:{details:{precipitation_amount:2.1,
          probability_of_precipitation:65}}
      }
    }))
  }
});
const userAgent='BlaiseV6RJ/6.0 https://github.com/gabilinsj-cyber/Blaise-';
const normalize=(p=payload(),now=NOW)=>normalizeMetNorwayRjForecast(p,{
  municipalityIbge:'3304557',point,checkedAtMs:now
});
test('global ECMWF values and Copernicus CAMS UV have different provenance and time',()=>{
  const f=normalize();
  assert.equal(f.status,'FORECAST_AVAILABLE');
  assert.equal(f.values.temperatureC,27.4);
  assert.equal(f.values.feelsLikeC,30.1);
  assert.equal(f.values.windKmh,12.6);
  assert.equal(f.values.gustKmh,21.6);
  assert.equal(f.hourly.precipitationNextHourMm,2.1);
  assert.equal(f.hourly.precipitationProbabilityNextHourPct,65);
  assert.equal(f.values.uvClearSkyIndex,8.6);
  assert.equal(f.uvIsClearSky,true);
  assert.equal(f.uvIsActualCloudAdjusted,false);
  assert.equal(f.originWeather,'ECMWF_IFS');
  assert.equal(f.originUv,'COPERNICUS_CAMS_UV_VIA_MET_NO');
  assert.equal(f.independentFromEcmwfDirect,false);
  assert.equal(f.officialObservation,false);
  assert.equal(f.automaticAlertsAuthorized,false);
  assert.equal(f.validAt,new Date(NOW).toISOString());
  assert.equal(f.issuedAt,new Date(NOW-2*60*60_000).toISOString());
  const uv=RJ_METEOROLOGICAL_FIELDS.find(x=>x.id==='uvClearSkyIndex');
  const actual=RJ_METEOROLOGICAL_FIELDS.find(x=>x.id==='uvIndex');
  assert.ok(uv.candidates.some(x=>x.sourceId===f.originUv));
  assert.ok(!actual.candidates.some(x=>x.sourceId===f.originUv));
});
test('rejects coordinates, unverified city, future and stale forecast, missing values',()=>{
  const p=payload();
  assert.equal(normalizeMetNorwayRjForecast(p,{municipalityIbge:'3304557',
    point:{...point,verifiedByBackend:false},checkedAtMs:NOW}).status,'UNAVAILABLE');
  assert.equal(normalizeMetNorwayRjForecast(p,{municipalityIbge:'0000000',
    point,checkedAtMs:NOW}).status,'UNAVAILABLE');
  assert.equal(normalize({...p,geometry:{coordinates:[-40,-20]} }).status,'UNAVAILABLE');
  const stale=payload();stale.properties.meta.updated_at=new Date(NOW-13*60*60_000).toISOString();
  assert.equal(normalize(stale).status,'UNAVAILABLE');
  const future=payload();future.properties.timeseries=future.properties.timeseries.map(x=>({
    ...x,time:new Date(NOW+4*60*60_000).toISOString()
  }));
  assert.equal(normalize(future).status,'UNAVAILABLE');
});
function harness(){
  const state={clock:NOW,calls:0,reservedAt:-Infinity,record:null};
  const store={
    async get(){return state.record;},
    async reserve(ibge,nowMs,minIntervalMs){
      assert.equal(ibge,'3304557');assert.equal(minIntervalMs,MET_NORWAY_MIN_CACHE_MS);
      if(nowMs-state.reservedAt<minIntervalMs)return false;
      state.reservedAt=nowMs;return true;
    },
    async set(ibge,record){
      assert.equal(ibge,'3304557');state.record=record;
    }
  };
  const fetchImpl=async(url,options)=>{
    state.calls++;
    assert.equal(new URL(url).hostname,'api.met.no');
    assert.equal(new URL(url).pathname,'/weatherapi/locationforecast/2.0/complete');
    assert.equal(new URL(url).searchParams.get('lat'),'-22.9068');
    assert.equal(options.headers['User-Agent'],userAgent);
    assert.equal(options.redirect,'error');
    return new Response(JSON.stringify(payload()),{status:200,headers:{
      'content-type':'application/json',
      'last-modified':'Tue, 17 Nov 2026 13:00:00 GMT',
      'expires':'Tue, 17 Nov 2026 18:00:00 GMT'
    }});
  };
  const create=(opts={})=>createRjMetNorwayLocationforecastCollector({
    enabled:true,termsAcceptedByHuman:true,userAgent,store,fetchImpl,
    clock:()=>state.clock,...opts
  });
  return {state,store,create};
}
test('no terms acceptance or authenticated server store means no HTTP call',async()=>{
  const {state,create}=harness();
  for(const options of [{termsAcceptedByHuman:false},{enabled:false},{store:null},
    {userAgent:'okhttp'},{userAgent:'BlaiseV6RJ/6.0'}]){
    const x=create(options);
    assert.equal(x.configured,false);
    assert.equal((await x.collect({municipalityIbge:'3304557',point})).status,'UNAVAILABLE');
  }
  assert.equal(state.calls,0);
});
test('one shared request, 3h cache and no duplicate Norwegian billable/network calls',async()=>{
  const {state,create}=harness();
  const c=create();
  const a=await c.collect({municipalityIbge:'3304557',point});
  assert.equal(a.status,'FORECAST_AVAILABLE');
  assert.equal(a.providerRequestMade,true);
  assert.equal(a.cacheHit,false);
  assert.equal(state.calls,1);
  state.clock+=2*60*60_000;
  const b=await c.collect({municipalityIbge:'3304557',point});
  assert.equal(b.status,'FORECAST_AVAILABLE');
  assert.equal(b.cacheHit,true);
  assert.equal(b.providerRequestMade,false);
  assert.equal(state.calls,1);
  assert.equal(c.automaticPolling,false);
  assert.equal(c.publishedToAndroid,false);
});
test('invalid source response never fabricates weather or UV',async()=>{
  const {state,create}=harness();
  const c=create({fetchImpl:async()=>{state.calls++;return new Response('bad', {status:200});}});
  const result=await c.collect({municipalityIbge:'3304557',point});
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.forecast,null);
  assert.equal(state.calls,1);
});
