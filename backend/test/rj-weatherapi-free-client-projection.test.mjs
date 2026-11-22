import test from 'node:test';
import assert from 'node:assert/strict';
import {projectWeatherApiFreeCurrentForPaidDashboard as project}
 from '../src/rj-weatherapi-free-client-projection.mjs';
const NOW=Date.parse('2026-11-22T15:00:00Z');
const sample=()=>({
 status:'PRIVATE_CACHE_VALID',sourceId:'WEATHERAPI_FREE',
 ibge:'3304557',nature:'E',
 providerDataVerified:true,municipalityGeographyVerified:true,
 publicReleaseEnabled:false,
 checkedAt:'2026-11-22T14:59:00.000Z',
 location:{lat:-22.91,lon:-43.20},
 data:{last_updated_epoch:Math.floor((NOW-18*60_000)/1000),
  temp_c:29.3,feelslike_c:32.1,humidity:74,cloud:42,
  wind_kph:16.2,gust_kph:27.0,precip_mm:1.2,pressure_mb:1009,
  uv:5,condition:{code:1003,text:'Partly cloudy'}}
});
test('maps bounded current weather with genuine 18-minute source age, not fetch timestamp',()=>{
 const a=project(sample(),{ibge:'3304557',now:NOW});
 assert.equal(a.temperatureC,29.3);
 assert.equal(a.feelsLikeC,32.1);
 assert.equal(a.skyCondition,'PARCIALMENTE_NUBLADO');
 assert.equal(a.cloudPct,42);
 assert.equal(a.precipitationMm,1.2);
 assert.equal(a.validAt,'2026-11-22T14:42:00.000Z');
 assert.equal(a.checkedAt,'2026-11-22T14:59:00.000Z');
 assert.equal(a.officialAlert,false);
 assert.equal(a.actualStormConfirmed,false);
 assert.equal(a.nature,'E_AGGREGATED_NOT_STATION');
 assert.equal(JSON.stringify(a).includes('Partly cloudy'),false);
});
test('source/municipality/country evidence, commercial release state and freshness gates fail closed',()=>{
 const now=NOW;
 const samples=[
  {...sample(),sourceId:'INMET'},
  {...sample(),providerDataVerified:false},
  {...sample(),municipalityGeographyVerified:false},
  {...sample(),publicReleaseEnabled:true},
  {...sample(),ibge:'3303302'},
  {...sample(),location:{lat:-21.0,lon:-40.0}},
  {...sample(),checkedAt:'2026-11-22T14:40:00.000Z'},
  {...sample(),data:{...sample().data,last_updated_epoch:Math.floor((NOW-36*60_000)/1000)}},
  {...sample(),data:{...sample().data,last_updated_epoch:Math.floor((NOW+60_000)/1000)}},
  {...sample(),data:{...sample().data,last_updated_epoch:35.5}},
 ];
 for(const c of samples)assert.equal(project(c,{ibge:'3304557',now}),null);
});
test('sky codes distinguish clouds, sun, rain and storm wording without activating alerts',()=>{
 for(const [code,expected] of [[1000,'SOL'],[1006,'NUBLADO'],[1183,'CHUVA'],
  [1276,'TEMPESTADE'],[9999,null]]){
  const data=sample();data.data.condition.code=code;
  const r=project(data,{ibge:'3304557',now:NOW});
  assert.equal(r.skyCondition,expected);
  assert.equal(r.actualStormConfirmed,false);
  assert.equal(r.criticalAlertEscalationAuthorized,false);
 }
});
test('invalid numeric values are omitted instead of fabricated or displayed as zero',()=>{
 const data=sample();
 data.data.temp_c=NaN;data.data.feelslike_c='32';
 data.data.humidity=170;data.data.wind_kph=-1;
 const r=project(data,{ibge:'3304557',now:NOW});
 assert.equal(r.temperatureC,null);
 assert.equal(r.feelsLikeC,null);
 assert.equal(r.humidityPct,null);
 assert.equal(r.windKmh,null);
 assert.equal(r.precipitationMm,1.2);
});

test('22-Nov real WeatherAPI V2 reading is mapped as light drizzle / rain, not a critical alert',()=>{
 // Values taken from the operator's authorized one-off Cloud Shell test,
 // never persisted as current readings or shown after source expiration.
 const now=Date.parse('2026-11-22T17:52:24.000Z');
 const cached=sample();
 cached.checkedAt=new Date(now).toISOString();
 cached.data={
  last_updated_epoch:Math.floor(Date.parse('2026-11-22T17:45:00.000Z')/1000),
  temp_c:31.1,feelslike_c:35.5,humidity:61,cloud:93,
  wind_kph:6.1,gust_kph:20.1,precip_mm:0.17,
  pressure_mb:1007.0,uv:8.2,condition:{code:1153}
 };
 const result=project(cached,{ibge:'3304557',now});
 assert.ok(result);
 assert.equal(result.temperatureC,31.1);
 assert.equal(result.feelsLikeC,35.5);
 assert.equal(result.humidityPct,61);
 assert.equal(result.cloudPct,93);
 assert.equal(result.skyCondition,'CHUVA');
 assert.equal(result.precipitationMm,0.17);
 assert.equal(result.validAt,'2026-11-22T17:45:00.000Z');
 assert.equal(result.officialAlert,false);
 assert.equal(result.actualStormConfirmed,false);
 assert.equal(result.criticalAlertEscalationAuthorized,false);
 assert.equal(project(cached,{ibge:'3304557',now:Date.parse('2026-11-22T18:21:00Z')}),null);
});
