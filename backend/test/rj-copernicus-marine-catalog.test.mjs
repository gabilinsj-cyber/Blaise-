import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import {rjSourceRouting,RJ_SOURCE_CLASS} from '../src/rj-phenomenon-source-policy.mjs';
import {CMEMS_SOURCE,CMEMS_MARINE_PRODUCTS,cmemsProductsFor,
  validateCmemsMarineSample} from '../src/rj-copernicus-marine-catalog.mjs';
const now=Date.parse('2026-10-11T07:00:00Z');
const wave={
  sourceId:'COPERNICUS_MARINE',region:'ATLANTICO',
  productId:'GLOBAL_ANALYSISFORECAST_WAV_001_027',
  datasetId:'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
  gridCellId:'-42.5,-23.3',variable:'WAVE_HEIGHT_M',unit:'m',value:2.3,
  latitude:-23.3,longitude:-42.5,
  issuedAt:'2026-10-11T00:00:00Z',validAt:'2026-10-11T06:00:00Z',
  kind:'MODEL_ANALYSIS_OR_FORECAST',doi:'10.48670/moi-00017',
  licenseStatus:'VERIFIED_FOR_BLAISE_COMMERCIAL_USE',
  attributionStatus:'COPERNICUS_AND_PRODUCT_DOI_VISIBLE',
};
test('CMEMS is alongside NOAA in maritime phenomena, not official warning authority',()=>{
  for(const phenomenon of ['ONDAS','RESSACA','CICLONE_EXTRATROPICAL','TEMPERATURA_MAR','CORRENTES_MARINHAS']){
    const p=rjSourceRouting({region:'ATLANTICO',phenomenon});
    const sources=p.sources.map(s=>s.id);
    assert.ok(sources.includes('NOAA'));
    assert.ok(sources.includes('COPERNICUS_MARINE'));
    assert.equal(sources.indexOf('COPERNICUS_MARINE'),sources.indexOf('NOAA')+1);
    assert.equal(p.sources.find(s=>s.id==='COPERNICUS_MARINE').role,RJ_SOURCE_CLASS.OFFICIAL_MODEL);
    assert.equal(p.sources.find(s=>s.id==='COPERNICUS_MARINE').automaticAlertAuthority,false);
    assert.equal(p.liveData,'NOT_CONFIRMED');
  }
});
test('do not claim CMEMS marine model measures atmospheric rain, earthquake or tsunami',()=>{
  for(const phenomenon of ['CHUVA_ATLANTICO','SISMO','TSUNAMI','TEMPERATURA','CHUVA_ACUMULADA']){
    const p=rjSourceRouting({region:'ATLANTICO',phenomenon});
    assert.ok(!p.sources.some(s=>s.id==='COPERNICUS_MARINE'),phenomenon);
  }
  assert.equal(CMEMS_SOURCE.mayIndependentlyVerifyTsunami,false);
  assert.equal(CMEMS_SOURCE.mayIssueOfficialMarineAlert,false);
});
test('Copernicus metadata is correct, has HTTPS catalogue and DOI, and explicitly awaits live ingestion',()=>{
  assert.equal(CMEMS_SOURCE.runtimeStatus,'NOT_CONNECTED_TO_LIVE_CMEMS');
  assert.match(CMEMS_SOURCE.homeUrl,/^https:\/\/marine\.copernicus\.eu/);
  assert.equal(CMEMS_MARINE_PRODUCTS.length,3);
  assert.deepEqual(CMEMS_MARINE_PRODUCTS.map(x=>x.doi),
    ['10.48670/moi-00017','10.48670/moi-00016','10.48670/moi-00165']);
  assert.ok(cmemsProductsFor({phenomenon:'ONDAS'}).some(p=>p.id.includes('WAV')));
  assert.ok(cmemsProductsFor({phenomenon:'TEMPERATURA_MAR'}).some(p=>p.id.includes('SST_GLO')));
  assert.deepEqual(cmemsProductsFor({phenomenon:'VAZAO_RIO'}),[]);
  assert.throws(()=>cmemsProductsFor({phenomenon:'ONDAS',region:'MUNICIPAL'}));
});
test('validated marine sample remains a gridded forecast, not an official alert',()=>{
  const result=validateCmemsMarineSample({sample:wave,now});
  assert.equal(result.status,'VALID_CMEMS_GRID_PRODUCT_SAMPLE');
  assert.equal(result.point.value,2.3);
  assert.equal(result.point.doi,'10.48670/moi-00017');
  assert.equal(result.point.displayKind,'GRIDDED_OCEAN_MODEL_NOT_OFFICIAL_WEATHER_WARNING');
  assert.equal(result.officialWarning,false);
  assert.equal(result.interpretedAsTideTable,false);
  assert.equal(result.observationAtMunicipalStation,false);
  assert.equal(result.mayBeShownOnBlaiseOwnMap,true);
  assert.equal(result.isProofOfRipCurrentOrSafeSea,false);
});
test('commercial attribution, product DOI, marine region, coordinates and correct provenance are mandatory',()=>{
  const variants=[
    {...wave,licenseStatus:'PUBLIC_ACCESS'},
    {...wave,attributionStatus:'NONE'},
    {...wave,doi:'10.48670/moi-99999'},
    {...wave,region:'MUNICIPAL'},
    {...wave,latitude:-18.0},
    {...wave,longitude:-38.0},
    {...wave,variable:'RAIN_MM_1H'},
    {...wave,sourceId:'NOAA'},
    {...wave,gridCellId:null},
    {...wave,kind:'IN_SITU_OBSERVATION'},
    {...wave,validAt:'2026-11-11T00:00:00Z'},
    {...wave,issuedAt:'2026-10-01T00:00:00Z'},
  ];
  for(const sample of variants) {
    const result=validateCmemsMarineSample({sample,now});
    assert.equal(result.status,'UNAVAILABLE',JSON.stringify(result));
    assert.equal(result.point,null);
  }
});
test('satellite/in situ combined SST analysis is not a thermometer station or modeled tsunami risk',()=>{
  const record={...wave,
    productId:'SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001',
    datasetId:'cmems_SST_OSTIA_L4',gridCellId:'OSTIA_RJ_ATLANTIC',
    variable:'SEA_WATER_TEMPERATURE_C',unit:'°C',value:23.8,
    doi:'10.48670/moi-00165',
    validAt:'2026-10-10T12:00:00Z',
    kind:'GRIDDED_SATELLITE_ANALYSIS',
  };
  const x=validateCmemsMarineSample({sample:record,now});
  assert.equal(x.status,'VALID_CMEMS_GRID_PRODUCT_SAMPLE');
  assert.equal(x.point.displayKind,'GRIDDED_OBSERVATIONAL_ANALYSIS_NOT_IN_SITU_STATION');
  assert.equal(x.officialWarning,false);
  assert.equal(validateCmemsMarineSample({sample:{...record,kind:'OFFICIAL_WARNING'},now}).status,'UNAVAILABLE');
});
test('RJ has 92 municipalities but a global model never certifies station availability in 92 cities',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES){
    const p=rjSourceRouting({ibge,phenomenon:'TEMPERATURA'});
    assert.ok(p.sources.every(s=>s.id!=='COPERNICUS_MARINE'));
  }
});
