import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_SOURCE_SECTOR_MATRIX as matrix,
  RJ_SOURCE_MATRIX_POLICY as policy,
  getUnderlyingFamiliesForSector
} from '../src/rj-source-sector-matrix.mjs';
test('sector registry lists approved roles without claiming live download',()=>{
  assert.equal(matrix.length,15);
  assert.equal(new Set(matrix.map(s=>s.id)).size,matrix.length);
  for(const sector of matrix){
    assert.ok(sector.products.length>=1);
    assert.ok(sector.notes.length>12);
    for(const product of sector.products){
      assert.ok(['O','E','P'].includes(product.kind));
      assert.equal(product.liveIngestionConfirmed,false);
      assert.equal(product.validatedRjCoverage,false);
      assert.ok(product.family.length>=3);
    }
  }
  assert.equal(policy.automaticCollection,false);
  assert.equal(policy.publishedToAndroid,false);
  assert.equal(policy.notLiveCollection,true);
});
test('MET Norway is same underlying ECMWF family and no duplicate fourth thermometer',()=>{
  const air=matrix.find(s=>s.id==='AIR_TEMPERATURE');
  const independent=getUnderlyingFamiliesForSector(air.id);
  assert.deepEqual(independent,['ECMWF_IFS','DWD_ICON','NOAA_GFS']);
  assert.equal(air.products.length,3);
  assert.equal(matrix.find(s=>s.id==='THERMAL_SENSATION').products[0].family,'ECMWF_IFS');
});
test('satellite precipitation and marine SST distinguish estimates from observations',()=>{
  for(const sectorId of ['RAIN_SATELLITE_LAND','RAIN_SATELLITE_OCEAN','SST']){
    assert.ok(matrix.find(s=>s.id===sectorId).products.every(p=>p.kind==='E'));
  }
  const ocean=matrix.find(s=>s.id==='SST');
  assert.equal(ocean.products[0].family,ocean.products[1].family);
  assert.equal(getUnderlyingFamiliesForSector('SST').length,2);
  assert.equal(matrix.find(s=>s.id==='RAIN_SATELLITE_LAND').products[0].productId,'IMERG_EARLY_V07');
  assert.ok(matrix.filter(s=>s.id.startsWith('RAIN_SATELLITE_')).every(s=>
    s.products.every(p=>p.sourceId==='NASA_GPM_IMERG')));
  assert.ok(matrix.filter(s=>s.id.startsWith('RAIN_SATELLITE_')).every(s=>
    s.title.includes('somente análise científica interna')));
});
test('CAMS exception limited to MET Norway clear-sky UV; domestic only comparison',()=>{
  assert.equal(matrix.find(s=>s.id==='CLEAR_SKY_UV').products.length,1);
  assert.equal(policy.singleCamsException,'COPERNICUS_CAMS_UV_VIA_MET_NO');
  assert.deepEqual(policy.domesticComparisonOnly,['INMET','CEMADEN']);
  assert.deepEqual(policy.officialPublicLinks,['ALERTA_RIO','DEFESA_CIVIL_RJ','INMET','INPE_CPTEC']);
  assert.ok(policy.expresslyExcludedDirectSources.includes('COPERNICUS_DIRECT'));
  assert.ok(policy.expresslyExcludedDirectSources.includes('JAXA_GSMAP'));
  assert.equal(policy.currentRainObservation.maxAgeMinutes,30);
  assert.deepEqual(policy.currentRainObservation.acceptedKinds,['O']);
  assert.equal(policy.currentRainObservation.acceptedLicensedRainGaugeSources.length,0);
  assert.equal(policy.currentRainObservation.satelliteRainEstimateAllowed,false);
  assert.equal(policy.currentRainObservation.missingDataStatus,'UNAVAILABLE');
  const ids=matrix.flatMap(s=>s.products.map(p=>p.sourceId));
  for(const excluded of ['INEA','MARINHA_DO_BRASIL','WINDY','COPERNICUS_DIRECT','INMET','CEMADEN','JAXA_GSMAP'])
    assert.ok(!ids.includes(excluded));
});
