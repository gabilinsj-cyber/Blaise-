import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRjLicensedLocalWeatherFusion} from '../src/rj-licensed-weather-fusion.mjs';

const NOW=Date.parse('2026-11-13T18:00:00Z');
const IBGE='3304557';
const target={ibge:IBGE,latitude:-22.91,longitude:-43.22,elevationM:35};
const sourceUrl=id=>id==='inmet'?'https://apitempo.inmet.gov.br/station/test':
  'https://alertario.rio.rj.gov.br/station/test';
const grant=(id,metric)=>({
  sourceId:id,productId:id+'-'+metric,status:'VERIFIED',
  permission:'COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION',
  evidenceId:'independent-license-review-test-'+id,
  attribution:'SYNTHETIC TEST GRANT (NOT REAL SOURCE PERMISSION)',
  licenseUrl:id==='inmet'?'https://apitempo.inmet.gov.br/termos':
    'https://alertario.rio.rj.gov.br/termos',
  validUntil:'2026-12-31T00:00:00Z'
});
const cfg={
  temperature:{metric:'TEMPERATURE_C',unit:'°C',val:[29,30]},
  humidity:{metric:'HUMIDITY_PERCENT',unit:'%',val:[74,78]},
  wind:{metric:'WIND_10M_VECTOR_KMH',unit:'km/h',
    val:[{speedKmh:12,directionFromDeg:90},{speedKmh:14,directionFromDeg:100}]},
  rainfall:{metric:'RAIN_ACCUMULATION_MM',unit:'mm',val:[4,4.4]},
};
const ids=['alerta-rio','inmet'];
function samples(metric){
  const config=cfg[metric];
  return ids.map((sourceId,i)=>({
    kind:'STATION_OBSERVATION',metric:config.metric,unit:config.unit,
    sourceId,originalSourceId:sourceId,sourceUrl:sourceUrl(sourceId),
    productId:sourceId+'-'+metric,stationId:sourceId+'-station-01',
    ibge:IBGE,latitude:-22.91,longitude:i===0?-43.215:-43.225,
    elevationM:40,quality:.9,observedAt:'2026-11-13T17:59:00Z',
    value:config.val[i],
    ...(metric==='wind'?{heightM:10,averagingMinutes:10,exposureClass:'URBAN'}:{}),
    ...(metric==='rainfall'?{accumulationStart:'2026-11-13T17:49:00Z',
      accumulationEnd:'2026-11-13T17:59:00Z'}:{})
  }));
}
const rights=Object.keys(cfg).flatMap(metric=>ids.map(id=>grant(id,metric)));
const all=()=>Object.fromEntries(Object.keys(cfg).map(metric=>[metric,samples(metric)]));
const run=(observations=all(),grants=rights,targetOverride=target)=>
  prepareRjLicensedLocalWeatherFusion({observations,grants,target:targetOverride,now:NOW});

test('two authorized independent gauges yield only local estimates with complete provenance',()=>{
  const r=run();
  assert.equal(r.status,'PARTIAL_OR_FULL_AUTHORIZED_ESTIMATES');
  for(const metric of Object.keys(cfg)){
    const v=r.metrics[metric];
    assert.equal(v.status,'AUTHORIZED_LOCAL_WEIGHTED_ESTIMATE',metric);
    assert.equal(v.sourceCount,2);
    assert.equal(v.sources.length,2);
    assert.equal(v.sources[0].sourceId,'alerta-rio');
    assert.equal(v.sources[1].sourceId,'inmet');
    assert.equal(v.provenanceMustBeDisplayed,true);
    assert.equal(v.estimateScope,'LOCAL_POINT_ONLY_NOT_WHOLE_CITY_OR_STATE');
    assert.equal(v.officialAlert,false);
    assert.equal(v.mayTriggerAlert,false);
  }
  assert.ok(r.metrics.temperature.value>29&&r.metrics.temperature.value<30);
  assert.ok(r.metrics.humidity.value>74&&r.metrics.humidity.value<78);
  assert.ok(r.metrics.wind.value>12&&r.metrics.wind.value<14);
  assert.equal(typeof r.metrics.wind.directionFromDeg,'number');
  assert.ok(r.metrics.wind.directionFromDeg>90&&r.metrics.wind.directionFromDeg<100);
  assert.equal(r.metrics.rainfall.accumulationStart,'2026-11-13T17:49:00Z');
  assert.equal(r.metrics.rainfall.maximumGaugeMm,4.4);
  assert.equal(r.publisherMayClaimOfficialMeasurement,false);
  assert.equal(r.thermal.status,'AUTHORIZED_LOCAL_DERIVED_SENSATION');
  assert.equal(r.thermal.officialAlert,false);
  assert.ok(r.thermal.value>r.metrics.temperature.value);
});
test('no license or expired/restricted grant is never relabeled as allowed official source',()=>{
  assert.equal(run(all(),[]).metrics.temperature.reason,
    'COMMERCIAL_DERIVATION_LICENSE_NOT_VERIFIED');
  const restricted=rights.map(g=>({...g,permission:'NON_COMMERCIAL_ONLY'}));
  assert.equal(run(all(),restricted).metrics.rainfall.status,'UNAVAILABLE');
  const expired=rights.map(g=>({...g,validUntil:'2026-11-01T00:00:00Z'}));
  assert.equal(run(all(),expired).metrics.wind.status,'UNAVAILABLE');
});
test('COR.Rio mirror, unapproved source and false independent attribution blocked',()=>{
  const input=all();
  input.temperature[1]={...input.temperature[1],
    sourceId:'cor-rio',originalSourceId:'alerta-rio'};
  const x=run(input);
  assert.equal(x.metrics.temperature.status,'UNAVAILABLE');
  const y=all();
  y.humidity[1]={...y.humidity[1],originalSourceId:'alerta-rio'};
  assert.equal(run(y).metrics.humidity.reason,'INCOMPATIBLE_OR_REPUBLISHED_OBSERVATIONS');
  const z=all();
  z.rainfall[1]={...z.rainfall[1],sourceId:'windy',originalSourceId:'windy'};
  assert.equal(run(z).metrics.rainfall.status,'UNAVAILABLE');
});
test('rainfall is only fused for aligned gauge periods, local scale, and bounded disagreement',()=>{
  const a=all();a.rainfall[1]={...a.rainfall[1],
    accumulationStart:'2026-11-13T17:44:00Z'};
  assert.equal(run(a).metrics.rainfall.reason,'RAIN_ACCUMULATION_WINDOWS_NOT_EQUAL');
  const b=all();b.rainfall[1]={...b.rainfall[1],longitude:-43.5};
  assert.equal(run(b).metrics.rainfall.reason,'STATIONS_NOT_LOCALLY_COMPARABLE');
  const c=all();c.rainfall[1]={...c.rainfall[1],value:22};
  assert.equal(run(c).metrics.rainfall.reason,
    'LOCAL_RAINFALL_DISAGREEMENT_REVIEW_REQUIRED');
});
test('wind uses comparable 10-meter vectors and never averages gusts',()=>{
  const a=all();a.wind[0]={...a.wind[0],heightM:2};
  assert.equal(run(a).metrics.wind.reason,'WIND_REFERENCE_NOT_COMPARABLE');
  const b=all();b.wind[1]={...b.wind[1],
    value:{speedKmh:30,directionFromDeg:260}};
  assert.equal(run(b).metrics.wind.reason,'WIND_STATIONS_DISAGREE_REVIEW_REQUIRED');
  const c=all();c.wind[1]={...c.wind[1],averagingMinutes:5};
  assert.equal(run(c).metrics.wind.reason,'WIND_AVERAGING_OR_EXPOSURE_MISMATCH');
});
test('no citywide/statewide invention and no stale/cross-municipal samples',()=>{
  const old=all();old.temperature[1]={...old.temperature[1],observedAt:'2026-11-13T16:59:00Z'};
  assert.equal(run(old).metrics.temperature.reason,'STALE_OR_FUTURE_READING');
  const other=all();other.temperature[0]={...other.temperature[0],ibge:'3303302'};
  assert.equal(run(other).metrics.temperature.status,'UNAVAILABLE');
  assert.equal(run(all(),rights,{...target,ibge:'3303302'}).metrics.rainfall.status,'UNAVAILABLE');
  assert.equal(run(all(),rights,{...target,longitude:-40}).status,'UNAVAILABLE');
});
test('thermal sensation never invented at moderate temperatures or without humidity',()=>{
  const moderate=all();
  for(const s of moderate.temperature)s.value=20;
  assert.equal(run(moderate).thermal.status,'UNAVAILABLE');
  const absent=all();absent.humidity=[];
  assert.equal(run(absent).thermal.status,'UNAVAILABLE');
});
