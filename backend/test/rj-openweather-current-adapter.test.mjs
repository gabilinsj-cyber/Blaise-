import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeOpenWeatherCurrentRj,fetchOpenWeatherCurrentRj,
  OPENWEATHER_RJ_SECRET_NAME,OPENWEATHER_RJ_MIN_REFRESH_MS,
} from '../src/rj-openweather-current-adapter.mjs';

const now=Date.parse('2026-10-11T16:00:00.000Z');
const fakeKey='FIXTURE_NOT_REAL_1234567890';
const place={ibge:'3304557',latitude:-22.9,longitude:-43.2,now};
const sample={
  cod:200,dt:now/1000,coord:{lat:-22.9,lon:-43.2},
  main:{temp:27.2,feels_like:30.5,humidity:74,pressure:1014},
  wind:{speed:5,gust:9,deg:120},
  rain:{'1h':4.2},weather:[{id:501,main:'Rain'}],
};
test('current OpenWeather aggregate returns source/time and nullable metric values, not official warning',()=>{
 const result=normalizeOpenWeatherCurrentRj(sample,place);
 assert.equal(result.status,'CURRENT_AGGREGATED_PROVIDER_POINT');
 assert.equal(result.values.temperatureC,27.2);
 assert.equal(result.values.feelsLikeC,30.5);
 assert.equal(result.values.windKmh,18);
 assert.equal(result.values.windGustKmh,32.4);
 assert.equal(result.values.rain1hMm,4.2);
 assert.equal(result.values.hailVerified,null);
 assert.equal(result.values.forecastRainProbability,null);
 assert.equal(result.forecastHorizon,null);
 assert.equal(result.officialAlertAuthorized,false);
 assert.equal(result.sourceIsIndependentOfficialObservation,false);
 assert.equal(result.ibge,'3304557');
});
test('missing rain and gust mean unknown, never zero or no hazard',()=>{
 const r=normalizeOpenWeatherCurrentRj({...sample,rain:undefined,wind:{speed:1}},place);
 assert.equal(r.values.rain1hMm,null);
 assert.equal(r.values.windGustKmh,null);
});
test('provider old timestamps, foreign city and drifted coordinates fail closed',()=>{
 for(const row of [
   {...sample,dt:(now-5*3_600_000)/1000},
   {...sample,coord:{lat:-20,lon:-42}},
   {...sample,main:{} ,cod:500},
 ]) {
   assert.equal(normalizeOpenWeatherCurrentRj(row,place).status,'UNAVAILABLE');
 }
 assert.equal(normalizeOpenWeatherCurrentRj(sample,{...place,ibge:'4106902'}).status,'UNAVAILABLE');
});
test('server-side adapter never starts unapproved or unconfigured API calls',async()=>{
 let called=0;
 const fetchImpl=async()=>{called++;throw Error('should not call network')};
 assert.equal((await fetchOpenWeatherCurrentRj({...place,apiKey:fakeKey,
   fetchImpl,dataUseApproved:false})).reason,'SOURCE_PLAN_AND_DATA_USE_NOT_VERIFIED');
 assert.equal((await fetchOpenWeatherCurrentRj({...place,apiKey:'',
   fetchImpl,dataUseApproved:true})).reason,'SERVER_SIDE_OPENWEATHER_SECRET_MISSING_OR_INVALID');
 assert.equal(called,0);
 assert.equal(OPENWEATHER_RJ_SECRET_NAME,'OPENWEATHER_API_KEY');
 assert.equal(OPENWEATHER_RJ_MIN_REFRESH_MS,300000);
});
test('authorized server adapter makes controlled query, but never returns or logs API key',async()=>{
 let capturedUrl;
 const r=await fetchOpenWeatherCurrentRj({
   ...place,apiKey:fakeKey,dataUseApproved:true,
   fetchImpl:async(uri,options)=>{
     capturedUrl=new URL(uri);
     assert.equal(capturedUrl.host,'api.openweathermap.org');
     assert.equal(capturedUrl.searchParams.get('units'),'metric');
     assert.equal(capturedUrl.searchParams.get('appid'),fakeKey);
     assert.equal(options.redirect,'error');
     return {ok:true,json:async()=>sample};
   },
 });
 assert.equal(r.values.temperatureC,27.2);
 assert.equal(JSON.stringify(r).includes(fakeKey),false);
});
test('HTTP errors and fetch stack traces never leak credentials in public result',async()=>{
 for(const fetchImpl of [
   async()=>({ok:false,status:429}),
   async()=>{throw Error('query contained '+fakeKey)},
 ]) {
   const r=await fetchOpenWeatherCurrentRj({...place,
     apiKey:fakeKey,dataUseApproved:true,fetchImpl,
   });
   assert.equal(r.status,'UNAVAILABLE');
   assert.equal(JSON.stringify(r).includes(fakeKey),false);
   assert.equal(r.officialAlertAuthorized,false);
 }
});
