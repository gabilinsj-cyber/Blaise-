import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RJ_SOURCE_SECTOR_MATRIX,RJ_SOURCE_MATRIX_POLICY
} from '../src/rj-source-sector-matrix.mjs';
import {
 RJ_METEOROLOGY_SOURCE_CATEGORIES,RJ_METEOROLOGICAL_FIELDS,
 buildInternalRjMeteorologyCoverage
} from '../src/rj-meteorological-completeness-audit.mjs';
const banned=['EUMETSAT','EUMETSAT_SAT','EUMETSAT_OSI_SAF','EUMETSAT_OSI_SAF_SST'];
test('EUMETSAT is excluded across all active weather sectors',()=>{
 const sources=RJ_SOURCE_SECTOR_MATRIX.flatMap(x=>x.products.map(p=>p.sourceId));
 for(const id of banned){
  assert.equal(sources.includes(id),false);
  assert.ok(RJ_SOURCE_MATRIX_POLICY.expresslyExcludedDirectSources.includes(id));
  assert.equal(RJ_METEOROLOGY_SOURCE_CATEGORIES[id],undefined);
  assert.ok(RJ_METEOROLOGICAL_FIELDS.every(field=>
    field.candidates.every(c=>c.sourceId!==id)));
 }
 assert.equal(RJ_SOURCE_MATRIX_POLICY.marineSstValidatedLive,false);
});
test('NOAA CoastWatch is sole SST candidate, NOAA GOES is cloud imagery candidate',()=>{
 const sst=RJ_SOURCE_SECTOR_MATRIX.find(s=>s.id==='SST');
 assert.deepEqual(sst.products.map(x=>x.sourceId),['NOAA_COASTWATCH_SST']);
 assert.deepEqual(RJ_SOURCE_MATRIX_POLICY.marineSstApprovedSources,['NOAA_COASTWATCH_SST']);
 assert.deepEqual(RJ_METEOROLOGICAL_FIELDS.find(x=>x.id==='seaSurfaceTemperatureC')
  .candidates.map(x=>x.sourceId),['NOAA_COASTWATCH_SST']);
 assert.ok(RJ_SOURCE_SECTOR_MATRIX.find(s=>s.id==='CLOUDS').products
  .some(x=>x.sourceId==='NOAA_GOES'));
});
test('NOAA is NOT a temperature-air or feels-like source; missing sea readings stay absent',()=>{
 const weather=RJ_METEOROLOGICAL_FIELDS;
 for(const id of ['temperatureC','feelsLikeC']){
  const field=weather.find(x=>x.id===id);
  assert.ok(field.candidates.every(x=>
    !['NOAA_GFS','NOAA_GFS_WAVE','NOAA_COASTWATCH_SST','NOAA_GOES'].includes(x.sourceId)));
 }
 const audit=buildInternalRjMeteorologyCoverage();
 assert.equal(audit.fields.find(x=>x.field==='seaSurfaceTemperatureC').state,'UNAVAILABLE');
 assert.equal(audit.publishedToSubscriber,false);
});
test('meteoblue trial is confirmed by account screenshot but backend ingestion remains inactive',()=>{
 const p=RJ_SOURCE_MATRIX_POLICY.meteoblueComparison;
 assert.equal(p.freeWeatherApi2026.totalCredits,10000000);
 assert.equal(p.freeWeatherApi2026.trialDurationMonths,12);
 assert.equal(p.freeWeatherApi2026.approximateLowestCostCallsTotal,2500);
 assert.equal(p.freeWeatherApi2026.freeTrialActivated,false);
 assert.equal(p.freeWeatherApi2026.serverApiKeyInstalled,false);
 assert.equal(p.freeWeatherApi2026.eligibleForObservedRain,false);
 assert.equal(p.liveNumericIngestionEnabled,false);
 assert.equal(p.commercialApiLicenseVerified,false);
});
