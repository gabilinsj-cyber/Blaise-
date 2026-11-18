import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRjNoaaCoastwatchSst} from '../src/rj-noaa-coastwatch-sst-admin.mjs';
import {RJ_SST_OFFSHORE_POINTS} from '../src/rj-osisaf-sst-admin-bridge.mjs';
const now=Date.parse('2026-11-18T13:00:00Z');
const data=()=>({
 contract:'BLAISE_NOAA_ACSPO_G19_RJ_SST_OFFSHORE_V1',
 status:'FULL',sourceId:'NOAA_COASTWATCH_SST',productId:'GOES19_ABI_ACSPO_L3C',
 satelliteFamily:'GOES19_ABI',underlyingSensorIndependentOfEumetsat:false,
 kind:'E',officialObservation:false,airTemperatureMeasurements:0,
 publishedToAndroid:false,publishedToSubscriber:false,automaticCollection:false,
 qualityThreshold:5,gridType:'GHRSST_L3C_1D_LATLON',
 attribution:'NOAA CoastWatch / NOAA STAR ACSPO',
 expectedPoints:3,verifiedPoints:3,
 checkedAt:'2026-11-18T12:59:00Z',validAt:'2026-11-18T11:00:00Z',
 sourceUrl:'https://coastwatch.noaa.gov/data/pub0014/coastwatch/sst/nrt/abi/g19/l3c/2026/11/18/20261118110000-STAR-L3C_GHRSST-SSTsubskin-ABI_G19-ACSPO_V3.00-v02.1-fv01.0.nc',
 points:RJ_SST_OFFSHORE_POINTS.map(p=>({
  id:p.id,latitude:p.latitude,longitude:p.longitude,
  dataLatitude:p.latitude,dataLongitude:p.longitude,
  temperatureC:24.1,qualityLevel:5
 }))
});
test('NOAA ACSPO accepts only high-quality E ocean values and never land readings',()=>{
 const r=verifyRjNoaaCoastwatchSst(data(),{
  now,rightsAttributionReviewed:true
 });
 assert.equal(r.state,'FULL');
 assert.equal(r.approvedValues,3);
 assert.ok(r.records.every(x=>x.category==='E'&&
   x.field==='seaSurfaceTemperatureC'&&
   x.sameSensorFamilyAsEumetsat===true));
 assert.equal(r.airTemperatureMeasurements,0);
 assert.equal(r.publishedToSubscribers,false);
});
test('quality 4, stale evidence, unsupported domain, wrong location never get published',()=>{
 const opts={now,rightsAttributionReviewed:true};
 assert.equal(verifyRjNoaaCoastwatchSst(data(),{now}).state,'UNAVAILABLE');
 const examples=[
  {checkedAt:'2026-11-18T10:00:00Z'},
  {validAt:'2026-11-17T00:00:00Z'},
  {sourceUrl:'https://example.com/acspo.nc'},
  {underlyingSensorIndependentOfEumetsat:true},
  {officialObservation:true},
  {productId:'GFS_ATMOS'},
 ];
 for(const change of examples){
  assert.equal(verifyRjNoaaCoastwatchSst({...data(),...change},opts).state,'UNAVAILABLE');
 }
 const a=data();a.points[2].temperatureC=25;a.points[2].qualityLevel=4;
 assert.equal(verifyRjNoaaCoastwatchSst(a,opts).state,'UNAVAILABLE');
 const b=data();b.status='PARTIAL';b.verifiedPoints=2;
 b.points[1].temperatureC=null;b.points[1].qualityLevel=null;
 assert.equal(verifyRjNoaaCoastwatchSst(b,opts).approvedValues,2);
});
