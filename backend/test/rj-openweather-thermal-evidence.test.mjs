import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedOpenWeatherThermalEvidence} from '../src/rj-openweather-thermal-evidence.mjs';
import {buildInternalRjMeteorologyCoverage} from '../src/rj-meteorological-completeness-audit.mjs';
import {selectRjApprovedThermal} from '../src/rj-thermal-approved-policy.mjs';
const now=Date.parse('2026-11-18T12:00:00.000Z');
const target={ibge:'3304557',latitude:-22.9068,longitude:-43.1729,
  municipalityGeoVerifiedByBackend:true};
const normalized=()=>({
  contract:'BLAISE_RJ_OPENWEATHER_CURRENT_4_V1',
  status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
  sourceId:'OPENWEATHER_ONECALL4_CURRENT',
  ibge:'3304557',latitude:target.latitude,longitude:target.longitude,
  validAt:'2026-11-18T11:47:00.000Z',
  retrievedAt:'2026-11-18T11:59:00.000Z',
  type:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT',
  officialObservation:false,officialAlert:false,
  automaticAlertAuthorized:false,attributionRequired:true,
  values:{temperatureC:27.5,providerFeelsLikeC:30.2,
    rainMm1h:40,windKmh:99,gustKmh:108}
});
const permitted={now,subscriptionApproved:true,serverVerified:true,verifiedTarget:target};
test('no purchase/approval, backend registry or subscription means zero temperature records',()=>{
  assert.equal(approvedOpenWeatherThermalEvidence(normalized(),{now}),null);
  assert.equal(approvedOpenWeatherThermalEvidence(normalized(),{
    ...permitted,subscriptionApproved:false
  }),null);
  assert.equal(approvedOpenWeatherThermalEvidence(normalized(),{
    ...permitted,serverVerified:false
  }),null);
  assert.equal(approvedOpenWeatherThermalEvidence(normalized(),{
    ...permitted,verifiedTarget:{...target,municipalityGeoVerifiedByBackend:false}
  }),null);
});
test('real normalized temperature and feels-like E are the only allowed fields',()=>{
  const proof=approvedOpenWeatherThermalEvidence(normalized(),permitted);
  assert.ok(proof);
  assert.deepEqual(proof.records.map(x=>x.field),['temperatureC','feelsLikeC']);
  assert.equal(proof.records[0].category,'E');
  assert.equal(proof.records[1].value,30.2);
  assert.ok(!JSON.stringify(proof).includes('rainMm1h'));
  assert.ok(!JSON.stringify(proof).includes('windKmh'));
  assert.equal(proof.mayPublishToSubscribers,false);
  const audit=buildInternalRjMeteorologyCoverage(proof.records,{now});
  assert.equal(audit.fields.find(x=>x.field==='temperatureC').coveredMunicipalities,1);
  assert.equal(audit.fields.find(x=>x.field==='feelsLikeC').coveredMunicipalities,1);
  const thermal=selectRjApprovedThermal({
    municipalityIbge:'3304557',now,candidates:[proof.candidate]
  });
  assert.equal(thermal.temperatureC,27.5);
  assert.equal(thermal.feelsLikeC,30.2);
  assert.equal(thermal.temperatureSource,'OPENWEATHER_ONECALL4_CURRENT');
});
test('no fabricated temperature if only apparent is present',()=>{
  const value=normalized();value.values.temperatureC=null;
  const proof=approvedOpenWeatherThermalEvidence(value,permitted);
  assert.deepEqual(proof.records.map(x=>x.field),['feelsLikeC']);
  assert.equal(proof.candidate.values.temperatureC,null);
});
test('future, stale, wrong place, wrong source or official label cannot be accepted',()=>{
  const mutations=[
    {validAt:'2026-11-18T12:01:00.000Z'},
    {validAt:'2026-11-18T11:20:00.000Z'},
    {retrievedAt:'2026-11-18T11:40:00.000Z'},
    {latitude:-21.0},
    {sourceId:'NOAA_GFS'},
    {sourceId:'ECMWF_IFS'},
    {sourceId:'CLIMATEMPO'},
    {officialObservation:true},
    {ibge:'3309999'},
  ];
  for(const change of mutations)
    assert.equal(approvedOpenWeatherThermalEvidence({
      ...normalized(),...change
    },permitted),null);
});
