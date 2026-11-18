import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRjApprovedThermal,reviewThermalAgainstOfficial,RJ_THERMAL_PRIORITY}
  from '../src/rj-thermal-approved-policy.mjs';
const now=Date.parse('2026-11-18T11:00:00Z');
const stamp=(age)=>new Date(now-age).toISOString();
const provider=(sourceId,temperatureC=26,feelsLikeC=29)=>({
  ibge:'3304557',sourceId,
  nature:sourceId==='DWD_ICON_GLOBAL'?'P':'E',
  values:{temperatureC,feelsLikeC},validAt:stamp(5*60_000),
  checkedAt:stamp(1*60_000),issuedAt:stamp(60*60_000),
  datasetId:'ICON_GLOBAL_2M',
  verifiedByBackend:true,municipalityGeoVerified:true,
  licensedForCommercialUse:true,officialObservation:false,officialAlert:false,
  sourceUrl:'https://example.com/provider'
});
test('allowlist contains exactly HG, OpenWeather, DWD; no NOAA or Climatempo',()=>{
  assert.deepEqual(RJ_THERMAL_PRIORITY,[
    'HG_BRASIL_WEATHER_PRO','OPENWEATHER_ONECALL4_CURRENT','DWD_ICON_GLOBAL'
  ]);
  assert.deepEqual(selectRjApprovedThermal({municipalityIbge:'3304557',now,
    candidates:[provider('NOAA_GFS',25),provider('ECMWF_IFS',20),provider('CLIMATEMPO',32)]})
    .status,'UNAVAILABLE');
});
test('HG temperature first when legitimately subscribed; OpenWeather thermal E only',()=>{
  const s=selectRjApprovedThermal({municipalityIbge:'3304557',now,
    hgSubscriptionActive:true,candidates:[
    provider('DWD_ICON_GLOBAL',26,40),
    provider('OPENWEATHER_ONECALL4_CURRENT',27,31),
    provider('HG_BRASIL_WEATHER_PRO',28,90),
  ]});
  assert.equal(s.temperatureC,28);
  assert.equal(s.temperatureSource,'HG_BRASIL_WEATHER_PRO');
  assert.equal(s.feelsLikeC,31);
  assert.equal(s.feelsLikeSource,'OPENWEATHER_ONECALL4_CURRENT');
  assert.equal(s.feelsLikeNature,'E');
  assert.equal(s.publishedToSubscriber,false);
});
test('DWD forecast works as temperature last resort, not direct sensation',()=>{
  const s=selectRjApprovedThermal({municipalityIbge:'3304557',now,candidates:[
    provider('DWD_ICON_GLOBAL',25,40)
  ]});
  assert.equal(s.temperatureC,25);
  assert.equal(s.temperatureNature,'P');
  assert.equal(s.feelsLikeC,null);
});
test('unpaid HG, stale provider, wrong source ID and unverified candidates are rejected',()=>{
  const s=selectRjApprovedThermal({municipalityIbge:'3304557',now,candidates:[
    {...provider('HG_BRASIL_WEATHER_PRO'),licensedForCommercialUse:false},
    {...provider('OPENWEATHER_ONECALL4_CURRENT'),validAt:stamp(40*60_000)},
    {...provider('DWD_ICON_GLOBAL'),datasetId:'UNVERIFIED'},
  ]});
  assert.equal(s.temperatureC,null);
  assert.equal(s.feelsLikeC,null);
  assert.equal(s.status,'UNAVAILABLE');
});
test('official visual review tolerates nearby official reference without collecting',()=>{
  const blaise={ibge:'3304557',sourceId:'OPENWEATHER_ONECALL4_CURRENT',
    temperatureC:28.5,validAt:stamp(8*60_000),verifiedByBackend:true};
  const ref={sourceId:'INMET',temperatureC:26.1,validAt:stamp(12*60_000),
    distanceKm:10,referenceUrl:'https://tempo.inmet.gov.br/',
    manualReviewConfirmed:true};
  const close=reviewThermalAgainstOfficial({blaise,reference:ref,now});
  assert.equal(close.result,'CLOSE_TO_OFFICIAL_REFERENCE');
  assert.equal(close.differenceC,2.4);
  assert.equal(close.overrideTemperature,false);
  assert.equal(close.officialDataStored,false);
  assert.equal(close.automaticOfficialFetch,false);
  const far=reviewThermalAgainstOfficial({blaise,reference:{...ref,temperatureC:34},now});
  assert.equal(far.result,'ADMIN_REVIEW_NEEDED');
  assert.equal(far.overrideTemperature,false);
});
test('Defesa Civil warning without measured numeric temperature cannot be used as thermometer',()=>{
  const blaise={ibge:'3304557',sourceId:'DWD_ICON_GLOBAL',temperatureC:28,
    validAt:stamp(8*60_000),verifiedByBackend:true};
  const ref={sourceId:'DEFESA_CIVIL_RJ',referenceUrl:'https://www.defesacivil.rj.gov.br/',
    manualReviewConfirmed:true};
  const out=reviewThermalAgainstOfficial({blaise,reference:ref,now});
  assert.equal(out.result,'NO_COMPARABLE_OFFICIAL_TEMPERATURE');
  assert.equal(out.differenceC,null);
  assert.equal(out.clientDataPublished,false);
});

test('HG licence without purchased active subscription cannot override OpenWeather or DWD',()=>{
  const o=selectRjApprovedThermal({municipalityIbge:'3304557',now,candidates:[
    provider('HG_BRASIL_WEATHER_PRO',34,44),
    provider('OPENWEATHER_ONECALL4_CURRENT',25,28)
  ]});
  assert.equal(o.temperatureSource,'OPENWEATHER_ONECALL4_CURRENT');
  assert.equal(o.temperatureC,25);
});
