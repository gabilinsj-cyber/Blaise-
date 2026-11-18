import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_SST_OFFSHORE_POINTS,verifyRjOsiSafSstAdmin
} from '../src/rj-osisaf-sst-admin-bridge.mjs';
const now=Date.parse('2026-11-18T12:00:00Z');
const sample=()=>({
 contract:'BLAISE_OSI_SAF_207C_RJ_SST_OFFSHORE_V1',
 sourceId:'EUMETSAT_OSI_SAF_SST',productId:'OSI-207-c',kind:'E',
 checkedAt:'2026-11-18T11:59:00Z',validAt:'2026-11-18T10:00:00Z',
 status:'FULL',measuredAsAirTemperature:false,
 publishedToAndroid:false,publishedToSubscriber:false,
 automaticCollection:false,oceanPoints:3,verifiedPoints:3,
 qualityThreshold:4,gridType:'GHRSST_L3C_1D_LATLON',
 requiredAttribution:'EUMETSAT OSI SAF, OSI-207-c, CC BY 4.0',
 sourceUrl:'https://osi-saf.ifremer.fr/sst/l3c/west_atlantic_east_pacific/2026/11/18/GOES19_20261118.nc',
 points:RJ_SST_OFFSHORE_POINTS.map(p=>({
  id:p.id,latitude:p.latitude,longitude:p.longitude,
  dataLatitude:p.latitude+0.01,dataLongitude:p.longitude+0.01,
  temperatureC:24.8,qualityLevel:5
 }))
});
test('administrative SST bridge accepts only quality checked E at fixed ocean points',()=>{
 const result=verifyRjOsiSafSstAdmin(sample(),{now,commercialUseAttributionReviewed:true});
 assert.equal(result.state,'FULL');
 assert.equal(result.acceptedPointCount,3);
 assert.deepEqual(result.records.map(r=>r.category),['E','E','E']);
 assert.equal(result.records[0].field,'seaSurfaceTemperatureC');
 assert.equal(result.records[0].physicalStationObservation,false);
 assert.equal(result.publishedToSubscribers,false);
 assert.equal(result.airTemperatureMeasurements,0);
});
test('missing one verified satellite cell means PARTIAL, not fabricated zero',()=>{
 const s=sample();s.status='PARTIAL';s.verifiedPoints=2;
 s.points[1].temperatureC=null;s.points[1].qualityLevel=null;
 const x=verifyRjOsiSafSstAdmin(s,{now,commercialUseAttributionReviewed:true});
 assert.equal(x.state,'PARTIAL');
 assert.equal(x.acceptedPointCount,2);
 assert.ok(!x.records.some(r=>r.pointId===s.points[1].id));
});
test('no contractual review, wrong source, land/air claim, expired or invalid QA fails closed',()=>{
 const accepted={now,commercialUseAttributionReviewed:true};
 assert.equal(verifyRjOsiSafSstAdmin(sample(),{now}).state,'UNAVAILABLE');
 for(const delta of [
  {sourceId:'NOAA_GFS'},{measuredAsAirTemperature:true},
  {validAt:'2026-11-17T00:00:00Z'},
  {sourceUrl:'https://example.org/product.nc'},
  {requiredAttribution:'none'},
  {verifiedPoints:99},
 ]){
  const s={...sample(),...delta};
  assert.equal(verifyRjOsiSafSstAdmin(s,accepted).state,'UNAVAILABLE');
 }
 const coord=sample();coord.points[0].dataLatitude=-21;
 assert.equal(verifyRjOsiSafSstAdmin(coord,accepted).state,'UNAVAILABLE');
 const qa=sample();qa.points[0].qualityLevel=1;
 assert.equal(verifyRjOsiSafSstAdmin(qa,accepted).state,'UNAVAILABLE');
});
