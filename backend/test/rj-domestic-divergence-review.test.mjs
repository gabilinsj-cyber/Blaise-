import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRjInternationalDivergence} from '../src/rj-domestic-divergence-review.mjs';
const now=Date.parse('2026-11-17T16:00:00Z');
const stamp=new Date(now-60_000).toISOString();
const location={latitude:-22.9068,longitude:-43.1729,municipalityGeoVerifiedByBackend:true};
const intl=(sourceId,value,field='temperatureC',unit='°C')=>({
 sourceId,value,field,unit,nature:'P',latitude:-22.9,longitude:-43.17,
 verifiedByBackend:true,commercialUseAuthorized:true,municipalityGeoVerified:true,
 validAt:stamp,checkedAt:stamp
});
const domestic=(sourceId,value,field='temperatureC',unit='°C')=>({
 sourceId,value,field,unit,nature:'O',latitude:-22.82,longitude:-43.17,
 countryCode:'BR',countryVerifiedByBackend:true,
 stationGeoVerifiedByBackend:true,verifiedByBackend:true,
 commercialUseAuthorized:true,dataRole:'DIVERGENCE_COMPARISON_ONLY',
 validAt:stamp,checkedAt:stamp,stationId:'SYNTHETIC_STATION'
});
const args=(a,b,d)=>({
 field:'temperatureC',unit:'°C',location,now,discrepancyTolerance:2,
 internationalReadings:[intl('DWD_ICON_GLOBAL',a),intl('NOAA_GFS',b)],
 domesticReadings:d
});
test('close international model results do not use Brazilian reference',()=>{
 const r=reviewRjInternationalDivergence(args(25,26,[domestic('INMET',40)]));
 assert.equal(r.state,'INTERNATIONAL_CONSISTENT');
 assert.equal(r.domesticLookupNeeded,false);
 assert.equal(r.publishedToSubscriber,false);
 assert.equal(r.replacementWeatherValue,null);
});
test('when international values diverge, use nearest verified Brazilian observation for admin review only',()=>{
 const r=reviewRjInternationalDivergence(args(25,31,[domestic('INMET',27)]));
 assert.equal(r.state,'DOMESTIC_CONTEXT_FOR_ADMIN_REVIEW');
 assert.equal(r.comparisonSource,'INMET');
 assert.equal(r.comparisonReading,27);
 assert.equal(r.decision,'REVIEW_ONLY_NO_OVERRIDE');
 assert.equal(r.maySupplyBlaiseWeather,false);
 assert.equal(r.openWeatherAuthorized,false);
 assert.equal(r.publishedToSubscriber,false);
});
test('CEMADEN rain comparison can never masquerade as temperature',()=>{
 const r=reviewRjInternationalDivergence(args(25,31,[domestic('CEMADEN',29)]));
 assert.equal(r.state,'DOMESTIC_COMPARATOR_NOT_AVAILABLE');
 const rain=reviewRjInternationalDivergence({
   field:'rainAccumulatedMm',unit:'mm',location,now,discrepancyTolerance:5,
   internationalReadings:[
     intl('JAXA_GSMAP',5,'rainAccumulatedMm','mm'),
     intl('NOAA_GFS',15,'rainAccumulatedMm','mm')],
   domesticReadings:[domestic('CEMADEN',9,'rainAccumulatedMm','mm')]
 });
 assert.equal(rain.state,'DOMESTIC_CONTEXT_FOR_ADMIN_REVIEW');
 assert.equal(rain.comparisonSource,'CEMADEN');
});
test('reject unchecked, unlicensed, foreign or geographically remote domestic references',()=>{
 const base=domestic('INMET',27);
 for(const d of [
  {...base,commercialUseAuthorized:false},
  {...base,countryCode:'AR'},
  {...base,countryVerifiedByBackend:false},
  {...base,stationGeoVerifiedByBackend:false},
  {...base,dataRole:'SUPPLIER'},
  {...base,latitude:-8,longitude:-35},
  {...base,validAt:new Date(now-13*60_000).toISOString()}
 ]){
  const r=reviewRjInternationalDivergence(args(25,31,[d]));
  assert.equal(r.state,'DOMESTIC_COMPARATOR_NOT_AVAILABLE');
 }
});
test('one international model duplicated through visualizers is not independent',()=>{
 const r=reviewRjInternationalDivergence({
 ...args(25,31,[]),
 internationalReadings:[intl('NOAA_GFS',25),intl('NOAA_GFS',31),
                         intl('METEOLOGIX',29)]
 });
 assert.equal(r.state,'INDEPENDENT_INTERNATIONAL_SOURCES_INSUFFICIENT');
});
