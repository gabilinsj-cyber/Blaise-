import test from 'node:test';
import assert from 'node:assert/strict';
import geo from '../src/rj-ibge-92-points.json' with {type:'json'};
import {auditedDwdThermalRecord} from '../src/rj-dwd-thermal-admin-bridge.mjs';
import {buildInternalRjMeteorologyCoverage} from '../src/rj-meteorological-completeness-audit.mjs';
import {selectRjApprovedThermal} from '../src/rj-thermal-approved-policy.mjs';
const now=Date.parse('2026-11-18T11:50:00Z');
const p=geo.points.find(x=>x.ibge==='3304557');
const proof=()=>({
  contract:'BLAISE_DWD_ICON_GLOBAL_RJ_NUMERIC_STAGING_V1',
  status:'DWD_MODEL_POINT_VALIDATED',sourceId:'DWD_ICON_GLOBAL',
  kind:'P',ibge:'3304557',latitude:p.lat,longitude:p.lon,
  unit:'°C',valueC:25.5,
  issuedAt:'2026-11-18T06:00:00.000Z',
  validAt:'2026-11-18T11:00:00.000Z',
  checkedAt:'2026-11-18T11:49:00.000Z',
  sourceUrl:'https://opendata.dwd.de/weather/nwp/icon/grib/06/t_2m/icon_global_icosahedral_single-level_2026111806_005_T_2M.grib2.bz2',
  gridResolutionDegrees:0.25,
  gridInterpolation:'DWD_OFFICIAL_CDO_PRECOMPUTED_WEIGHTS',
  gridWeightsUrl:'https://opendata.dwd.de/weather/lib/cdo/ICON_GLOBAL2WORLD_025_EASY.tar.bz2',
  officialObservation:false,officialAlert:false,
  productionChanged:false,publishedToAndroid:false
});
test('no approval means no admin weather value even for plausible staging proof',()=>{
  assert.equal(auditedDwdThermalRecord(proof(),{now}),null);
});
test('only valid DWD proof enters audit as predicted P and never sensed O',()=>{
  const record=auditedDwdThermalRecord(proof(),{now,dwdRightsReviewed:true});
  assert.equal(record.field,'temperatureC');
  assert.equal(record.category,'P');
  const report=buildInternalRjMeteorologyCoverage([record],{now});
  assert.equal(report.fields.find(x=>x.field==='temperatureC').coveredMunicipalities,1);
  assert.equal(report.publishedToSubscriber,false);
  const thermal=selectRjApprovedThermal({
    municipalityIbge:'3304557',now,
    candidates:[{...record,nature:'P',officialObservation:false,officialAlert:false,
      licensedForCommercialUse:true,
      values:{temperatureC:record.value}}]
  });
  assert.equal(thermal.temperatureC,25.5);
  assert.equal(thermal.feelsLikeC,null);
  assert.equal(thermal.temperatureNature,'P');
});
test('no fake numerical reading can pass invalid provenance/geo/time',()=>{
  for(const altered of [
    {ibge:'3309999'},{latitude:p.lat+1},{officialObservation:true},
    {gridInterpolation:'NONE'},{gridWeightsUrl:'https://example.org/'},
    {sourceUrl:'https://example.org/data.grib2'},
    {checkedAt:'2026-11-18T05:00:00.000Z'},
    {validAt:'2026-11-17T00:00:00.000Z'},
    {valueC:null},
  ]){
    assert.equal(auditedDwdThermalRecord({...proof(),...altered},{
      now,dwdRightsReviewed:true
    }),null);
  }
});
