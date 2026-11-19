import test from 'node:test';
import assert from 'node:assert/strict';
import {projectVisualCrossingForPaidDashboard as project}
 from '../src/rj-visual-crossing-client-projection.mjs';
const NOW=Date.parse('2026-11-19T16:00:00Z');
const stamp=offset=>new Date(NOW+offset).toISOString();
const base=()=>({
 sourceId:'VISUAL_CROSSING_FREE',status:'PRIVATE_CACHE_VALID',
 ibge:'3304557',kindCurrent:'E',kindForecast:'P',
 publishedToSubscribers:false,providerBalanceVerified:false,
 attribution:'Weather data by Visual Crossing',
 validAt:stamp(-10*60_000),checkedAt:stamp(-60_000),
 fields:[
  {field:'temperatureC',value:28,kind:'E',unit:'°C'},
  {field:'feelsLikeC',value:31,kind:'E',unit:'°C'},
  {field:'relativeHumidityPct',value:70,kind:'E',unit:'%'},
  {field:'precipitationMm',value:0,kind:'E',unit:'mm'}
 ],
 forecast:[{validAt:stamp(60*60_000),kind:'P',
  fields:[
   {field:'precipitationMm',value:1.3,kind:'P',unit:'mm'},
   {field:'precipitationProbabilityPct',value:55,kind:'P',unit:'%'}
  ]}]
});
test('paid two-city projection includes only bounded E and next-hour P with attribution',()=>{
 const r=project(base(),{ibge:'3304557',now:NOW});
 assert.equal(r.contract,'RJ_VISUAL_CROSSING_BOUNDED_CITY_E_P_V1');
 assert.equal(r.ibge,'3304557');
 assert.equal(r.current.temperatureC,28);
 assert.equal(r.current.precipitationMm,0);
 assert.equal(r.current.windKmh,null);
 assert.equal(r.forecastNext.precipitationMm,1.3);
 assert.equal(r.forecastNext.precipitationProbabilityPct,55);
 assert.equal(r.currentKind,'E_AGGREGATED_NOT_STATION');
 assert.equal(r.forecastKind,'P_MODEL_NOT_OBSERVATION');
 assert.equal(r.officialAlert,false);
 assert.equal(r.dataNotForSafetyCriticalDecisions,true);
 assert.ok(!JSON.stringify(r).includes('secret'));
});
test('cached current expires in 30 minutes but valid P can remain as forecast',()=>{
 const r=project({...base(),validAt:stamp(-65*60_000)},{ibge:'3304557',now:NOW});
 assert.equal(r.currentValidAt,null);
 assert.equal(r.current.temperatureC,null);
 assert.equal(r.forecastNext.precipitationMm,1.3);
 const expired=project({...base(),checkedAt:stamp(-7*60*60_000)},{ibge:'3304557',now:NOW});
 assert.equal(expired,null);
});
test('no station/alert from unvalidated city, attribution or wrong source identity',()=>{
 for(const invalid of [
  {...base(),ibge:'3303302'},
  {...base(),status:'INDISPONIVEL'},
  {...base(),publishedToSubscribers:true},
  {...base(),providerBalanceVerified:true},
  {...base(),attribution:'Unknown'},
  {...base(),fields:[{field:'temperatureC',value:999,kind:'E'}]},
  {...base(),fields:[{field:'temperatureC',value:'28',kind:'E'}]},
  {...base(),fields:[{field:'temperatureC',value:25,kind:'O'}]},
  {...base(),fields:[{field:'temperatureC',value:25,kind:'E'},
    {field:'temperatureC',value:26,kind:'E'}]}
 ]){
  const result=project(invalid,{ibge:'3304557',now:NOW});
  assert.equal(result,null);
 }
});
