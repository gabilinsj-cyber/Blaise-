import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRjTempAndThermalCorrection} from '../src/rj-temperature-thermal-observation-model.mjs';

const NOW=Date.parse('2026-11-13T18:00:00Z');
const target={ibge:'3304557',latitude:-22.91,longitude:-43.22,elevationM:35};
const sources=['DWD_ICON_GLOBAL','NOAA_GFS'];
const input=(metric,value,sourceId='DWD_ICON_GLOBAL')=>({
  kind:'DECODED_GRIB2_MODEL_GRID_POINT',dataType:'MODEL_FORECAST',
  sourceId,metric,unit:metric==='TEMPERATURE_2M_C'?'°C':
    metric==='RELATIVE_HUMIDITY_2M'?'%':'km/h',
  value,ibge:target.ibge,latitude:-22.91,longitude:-43.22,
  productId:sourceId+'-'+metric,modelRunId:sourceId+'-20261113-12UTC',
  cycleAt:'2026-11-13T12:00:00Z',validAt:'2026-11-13T18:00:00Z',
  sourceUrl:sourceId==='DWD_ICON_GLOBAL'?
    'https://opendata.dwd.de/weather/nwp/icon/grib/12/t_2m/test.grib2.bz2':
    'https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/gfs.20261113/12/atmos/test.grib2'
});
const models=(sourceId='DWD_ICON_GLOBAL')=>({
  temperature:input('TEMPERATURE_2M_C',29,sourceId),
  humidity:input('RELATIVE_HUMIDITY_2M',70,sourceId),
  wind:input('WIND_SPEED_10M_KMH',10,sourceId)
});
const rights=Object.values(models()).map(p=>({
  sourceId:p.sourceId,productId:p.productId,status:'VERIFIED',
  permission:'COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION',
  evidenceId:'SYNTHETIC-MODEL-RIGHTS-'+p.metric,
  attribution:'Synthetic fixture: license review is not real approval',
  validUntil:'2027-01-01T00:00:00Z'
}));
const observation={
  kind:'STATION_OBSERVATION',sourceId:'defesa-civil-rj',
  originalProducerId:'defesa-civil-rj',productId:'dc-rj-station-temperature',
  stationId:'dc-rj-local-01',metric:'TEMPERATURE_C',unit:'°C',value:30,
  ibge:target.ibge,latitude:-22.911,longitude:-43.22,
  elevationM:36,quality:.9,observedAt:'2026-11-13T17:59:00Z',
  sourceUrl:'https://defesacivil.rj.gov.br/estacoes/temp'
};
const observationGrant={
  sourceId:'defesa-civil-rj',productId:'dc-rj-station-temperature',
  status:'VERIFIED',permission:'COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION',
  licenseUrl:'https://defesacivil.rj.gov.br/termos',
  evidenceId:'SYNTHETIC-DEFESA-CIVIL-GRANT',
  attribution:'Synthetic fixture for unit test; not a real license',
  validUntil:'2027-01-01T00:00:00Z'
};
const calibration={
  status:'VERIFIED',method:'LOCAL_BACKTESTED_OBSERVATION_MODEL_WEIGHT',
  modelSourceId:'DWD_ICON_GLOBAL',ibge:target.ibge,observationWeight:0.7,
  evidenceId:'SYNTHETIC-BACKTEST-WEIGHT-NOT-PRODUCTION',
  validUntil:'2027-01-01T00:00:00Z'
};
const run=opts=>prepareRjTempAndThermalCorrection({
  target,observation,observationGrant,models:models(),modelRights:rights,
  calibration,now:NOW,...opts
});

test('temperature and thermal show clearly separated observation/model provenance',()=>{
  const r=run();
  assert.equal(r.temperature.status,'AUTHORIZED_OBSERVATION_MODEL_ESTIMATE');
  assert.equal(r.temperature.value,29.7);
  assert.equal(r.temperature.sources.length,2);
  assert.equal(r.temperature.sources[0].sourceId,'defesa-civil-rj');
  assert.equal(r.temperature.sources[1].sourceId,'DWD_ICON_GLOBAL');
  assert.equal(r.temperature.sources[0].weight,.7);
  assert.equal(r.temperature.sources[1].weight,.3);
  assert.equal(r.temperature.officialMeasurement,false);
  assert.equal(r.temperature.officialAlert,false);
  assert.equal(r.sensation.status,'DERIVED_LOCAL_ESTIMATE_SENSATION');
  assert.equal(r.sensation.formula,'ROTHFUSZ_HEAT_INDEX');
  assert.ok(r.sensation.value>r.temperature.value);
  assert.ok(r.sensation.sources.some(s=>s.productId.endsWith('RELATIVE_HUMIDITY_2M')));
  assert.equal(r.mapRenderer,'BLAISE_V6_RJ_NATIVE_GEOGRAPHIC_CANVAS');
});
test('missing local source does not block permitted international forecast',()=>{
  const r=run({observation:null,observationGrant:null,calibration:null});
  assert.equal(r.temperature.status,'MODEL_FORECAST_ONLY');
  assert.equal(r.temperature.value,29);
  assert.equal(r.temperature.officialMeasurement,false);
  assert.equal(r.sensation.status,'DERIVED_FORECAST_SENSATION');
  assert.equal(r.officialAlert,false);
});
test('Defesa Civil license absent, noncommercial or wrong original producer blocks blending',()=>{
  for(const changes of [
    {observationGrant:null},
    {observationGrant:{...observationGrant,permission:'NON_COMMERCIAL_ONLY'}},
    {observation:{...observation,originalProducerId:'alerta-rio'}},
    {observation:{...observation,sourceUrl:'http://defesacivil.rj.gov.br/termos'}},
  ]){
    const r=run(changes);
    assert.equal(r.temperature.status,'MODEL_FORECAST_ONLY');
    assert.equal(r.sensation.status,'DERIVED_FORECAST_SENSATION');
  }
});
test('no arbitrary weights without an independent hindcast evidence record',()=>{
  for(const bad of [
    null,
    {...calibration,observationWeight:.99},
    {...calibration,status:'DRAFT'},
    {...calibration,modelSourceId:'NOAA_GFS'},
    {...calibration,evidenceId:'na'},
    {...calibration,validUntil:'2026-11-12T00:00:00Z'}
  ]){
    assert.equal(run({calibration:bad}).temperature.status,'MODEL_FORECAST_ONLY');
  }
});
test('model restricted or missing leads to real local station without fictional thermal',()=>{
  const r=run({modelRights:[]});
  assert.equal(r.temperature.status,'LOCAL_STATION_OBSERVATION_ONLY');
  assert.equal(r.temperature.value,30);
  assert.equal(r.temperature.officialMeasurement,true);
  assert.equal(r.sensation.status,'UNAVAILABLE');
  assert.equal(r.officialAlert,false);
});
test('model only not present and local source invalid returns genuine unavailable',()=>{
  const r=run({modelRights:[],observation:null});
  assert.equal(r.temperature.status,'UNAVAILABLE');
  assert.equal(r.sensation.status,'UNAVAILABLE');
  assert.equal(r.temperature.value,null);
});
test('temperature stale or contradictory local reading cannot change model',()=>{
  for(const invalid of [
    {...observation,observedAt:'2026-11-13T17:40:00Z'},
    {...observation,value:42},
    {...observation,latitude:-22.5},
    {...observation,ibge:'3303302'}
  ])assert.equal(run({observation:invalid}).temperature.status,'MODEL_FORECAST_ONLY');
});
test('model forecast future hour not blended with now measurement',()=>{
  const altered=models();
  for(const k of Object.keys(altered))altered[k]={...altered[k],
    validAt:'2026-11-13T21:00:00Z'};
  const r=run({models:altered});
  assert.equal(r.temperature.status,'MODEL_FORECAST_ONLY');
  assert.equal(r.temperature.officialMeasurement,false);
});
test('humidity from different model run is not silently used for feeling temperature',()=>{
  const altered=models();altered.humidity={...altered.humidity,
    modelRunId:'OTHER-2026111312'};
  const r=run({models:altered});
  assert.equal(r.temperature.status,'AUTHORIZED_OBSERVATION_MODEL_ESTIMATE');
  assert.equal(r.sensation.status,'UNAVAILABLE');
});
test('DWD and NOAA are allowed separately but cannot be blended without matching calibration',()=>{
  const n=models('NOAA_GFS');
  const nrights=Object.values(n).map(p=>({
    sourceId:p.sourceId,productId:p.productId,status:'VERIFIED',
    permission:'COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION',
    evidenceId:'TEST-NOAA-MODEL-RIGHTS-2026',
    attribution:'Synthetic NOAA license test evidence only',
    validUntil:'2027-01-01T00:00:00Z'
  }));
  const notCalibrated=run({models:n,modelRights:nrights});
  assert.equal(notCalibrated.temperature.status,'MODEL_FORECAST_ONLY');
  const calibrated=run({models:n,modelRights:nrights,calibration:{
    ...calibration,modelSourceId:'NOAA_GFS'
  }});
  assert.equal(calibrated.temperature.status,'AUTHORIZED_OBSERVATION_MODEL_ESTIMATE');
  assert.equal(calibrated.sensation.status,'DERIVED_LOCAL_ESTIMATE_SENSATION');
});
