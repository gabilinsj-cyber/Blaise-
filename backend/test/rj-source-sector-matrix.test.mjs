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
test('RAMMB/CIRA replaces NASA and JAXA as visual reference only, not rain sensor',()=>{
  const sectors=['SATELLITE_VISUAL_RJ','SATELLITE_VISUAL_ATLANTIC'].map(id=>
    matrix.find(x=>x.id===id));
  assert.equal(sectors.length,2);
  assert.ok(sectors.every(Boolean));
  assert.ok(sectors.every(s=>s.products.length===1));
  assert.ok(sectors.every(s=>s.products[0].sourceId==='RAMMB_CIRA_SLIDER'));
  assert.ok(sectors.every(s=>s.products[0].kind==='O'));
  assert.ok(sectors.every(s=>s.products[0].family==='GOES_EAST'));
  assert.ok(sectors.every(s=>s.products[0].liveIngestionConfirmed===false));
  assert.equal(getUnderlyingFamiliesForSector('SATELLITE_VISUAL_RJ')[0],'GOES_EAST');
  assert.ok(!matrix.some(s=>s.id.startsWith('RAIN_SATELLITE_')));
  const sst=matrix.find(s=>s.id==='SST');
  assert.ok(sst.products.every(p=>p.kind==='E'));
  assert.deepEqual(sst.products.map(p=>p.sourceId),['EUMETSAT_OSI_SAF','NOAA_COASTWATCH']);
  assert.equal(getUnderlyingFamiliesForSector('SST').length,1);
  assert.equal(policy.satelliteVisualReference.url,'https://rammb-slider.cira.colostate.edu/');
  assert.equal(policy.satelliteVisualReference.type,'EXTERNAL_LINK_ONLY');
  assert.equal(policy.satelliteVisualReference.authorizedEmbeddedImagery,false);
  assert.equal(policy.satelliteVisualReference.providesRainMm,false);
  assert.equal(policy.satelliteVisualReference.independentFromNoaa,false);
  assert.equal(policy.satelliteVisualReference.operatorValidatedFreshness,false);
  assert.equal(policy.satelliteVisualReference.maxAcceptableImageAgeMinutes,30);
});
test('CAMS exception limited to MET Norway clear-sky UV; domestic only comparison',()=>{
  assert.equal(matrix.find(s=>s.id==='CLEAR_SKY_UV').products.length,1);
  assert.equal(policy.singleCamsException,'COPERNICUS_CAMS_UV_VIA_MET_NO');
  assert.deepEqual(policy.domesticComparisonOnly,['INMET','CEMADEN']);
  assert.deepEqual(policy.officialPublicLinks,['ALERTA_RIO','DEFESA_CIVIL_RJ','INMET','INPE_CPTEC']);
  assert.ok(policy.expresslyExcludedDirectSources.includes('COPERNICUS_DIRECT'));
  assert.ok(policy.expresslyExcludedDirectSources.includes('JAXA_GSMAP'));
  assert.ok(policy.expresslyExcludedDirectSources.includes('NASA_GPM_IMERG'));
  assert.ok(policy.expresslyExcludedDirectSources.includes('ZOOM_EARTH'));
  assert.equal(matrix.find(x=>x.id==='CLOUDS').products[0].sourceId,'NOAA_GOES');
  assert.equal(matrix.find(x=>x.id==='SATELLITE_VISUAL_RJ').products[0].sourceId,'RAMMB_CIRA_SLIDER');
  assert.equal(policy.currentRainObservation.maxAgeMinutes,30);
  assert.deepEqual(policy.currentRainObservation.acceptedKinds,['O']);
  assert.equal(policy.currentRainObservation.acceptedLicensedRainGaugeSources.length,0);
  assert.equal(policy.currentRainObservation.satelliteRainEstimateAllowed,false);
  assert.equal(policy.currentRainObservation.missingDataStatus,'UNAVAILABLE');
  const ids=matrix.flatMap(s=>s.products.map(p=>p.sourceId));
  for(const excluded of ['INEA','MARINHA_DO_BRASIL','WINDY','COPERNICUS_DIRECT','INMET','CEMADEN','JAXA_GSMAP','NASA_GPM_IMERG','NASA_MUR_SST','NASA_SAT','ZOOM_EARTH'])
    assert.ok(!ids.includes(excluded));
});
