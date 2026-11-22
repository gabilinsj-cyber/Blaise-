import test from 'node:test';
import assert from 'node:assert/strict';
import {METEOBLUE_BASIC6H_FIELDS}
 from '../src/rj-meteoblue-basic6h-parse.mjs';
import {inspectHistoricalMeteoblueCacheRecord}
 from '../src/rj-meteoblue-free-historical-audit.mjs';

const now=Date.parse('2026-11-21T09:00:00Z');
const storedAt=Date.parse('2026-11-19T12:42:00Z');
const times=Array.from({length:29},(_,i)=>
 new Date(Date.parse('2026-11-19T12:00:00Z')+i*6*60*60_000).toISOString()
);
const createRecord=()=>({
 sourceId:'METEOBLUE_FREE_FORECAST',ibge:'3304557',storedAtMs:storedAt,
 forecast:{
   status:'FORECAST_PARSED_PRIVATE_STAGING',sourceId:'METEOBLUE_FREE_FORECAST',
   ibge:'3304557',category:'P',observational:false,forecastOnly:true,
   scientificallyHomologated:false,publishedToAndroid:false,
   publishedToSubscribers:false,
   metadataRunVerified:true,unitMetadataVerified:true,
   sourceCoordinatesVerified:true,completeFieldCoverage:true,
   auditReadyForPrivateReview:true,
   validTimes:[...times],
   values:Object.values(METEOBLUE_BASIC6H_FIELDS).map(d=>({
     field:d.name,unit:d.unit,semantics:d.meaning,
     values:Array.from({length:29},(_,i)=>Math.min(d.max,d.min+2+i/10))
   }))
 }
});
test('historical cached seven-field metrics are read-only and never current',()=>{
 const r=inspectHistoricalMeteoblueCacheRecord(createRecord(),{nowMs:now});
 assert.equal(r.status,'HISTORICAL_FORECAST_AUDITED_NOT_CURRENT');
 assert.equal(r.historicalOnly,true);
 assert.equal(r.cacheExpired,true);
 assert.equal(r.providerContacted,false);
 assert.equal(r.creditsReserved,0);
 assert.equal(r.sixHourForecastSlots,29);
 assert.equal(r.fields.length,7);
 assert.ok(r.fields.every(x=>x.count===29&&x.missingCount===0&&x.rangeValidated));
 assert.equal(r.fields[0].min,2);
 assert.equal(r.fields[0].max,4.8);
 assert.equal(r.fields[0].mean,3.4);
 assert.equal(r.fields[0].median,3.4);
 assert.equal(r.scientificallyHomologated,false);
 assert.equal(r.publishedToSubscribers,false);
});
test('missing Firestore document never triggers a provider retry',()=>{
 const r=inspectHistoricalMeteoblueCacheRecord(null,{nowMs:now});
 assert.equal(r.status,'NO_HISTORICAL_CACHE_DOCUMENT');
 assert.equal(r.shouldRetryProvider,false);
 assert.equal(r.providerContacted,false);
 assert.equal(r.creditsReserved,0);
});
test('rejects falsified provenance and shifted or malformed historical fields',()=>{
 const mutations=[
  r=>{r.forecast.publishedToSubscribers=true},
  r=>{r.forecast.category='O'},
  r=>{r.forecast.validTimes[1]=r.forecast.validTimes[0]},
  r=>{r.forecast.values[0].unit='inches'},
  r=>{r.forecast.values[0].values[0]=99999},
  r=>{r.forecast.values[0].values[0]='9'},
  r=>{r.forecast.values[0].field=r.forecast.values[1].field}
 ];
 for(const mutate of mutations){
   const r=createRecord();mutate(r);
   const out=inspectHistoricalMeteoblueCacheRecord(r,{nowMs:now});
   assert.equal(out.status,'HISTORICAL_RECORD_INVALID');
   assert.equal(out.providerContacted,false);
   assert.equal(out.publishedToSubscribers,false);
 }
});
test('nulls do not become zero and response remains exclusively historical',()=>{
 const rec=createRecord();rec.forecast.values[0].values[0]=null;
 const r=inspectHistoricalMeteoblueCacheRecord(rec,{nowMs:now});
 assert.equal(r.status,'HISTORICAL_FORECAST_AUDITED_NOT_CURRENT');
 assert.equal(r.fields[0].count,28);
 assert.equal(r.fields[0].missingCount,1);
 assert.equal(r.fields[0].min,2.1);
 assert.equal(r.neverUseAsCurrent,true);
});

test('compares precipitation and convective component per aligned six-hour period',()=>{
 const record=createRecord();
 const matched=inspectHistoricalMeteoblueCacheRecord(record,{nowMs:now});
 assert.deepEqual(matched.precipitationRelationship,{
   comparedSlots:29,equalSlots:29,wetSlots:29,equalWetSlots:29,
   convectiveGreaterThanTotalSlots:0,identicalAcrossAllWetSlots:true,
   needsScientificReview:true,forecastComponentDiagnosticOnly:true
 });
 // A difference in only one time slot must be detected even when a
 // misleading rounded aggregate average might suggest equality.
 record.forecast.values[1].values[0]=1;
 const different=inspectHistoricalMeteoblueCacheRecord(record,{nowMs:now});
 assert.equal(different.precipitationRelationship.equalSlots,28);
 assert.equal(different.precipitationRelationship.identicalAcrossAllWetSlots,false);
 assert.equal(different.precipitationRelationship.needsScientificReview,false);
 // Convective forecast component greater than total needs review, but
 // cannot automatically be called an actual observed rainfall event.
 record.forecast.values[1].values[0]=10.2;
 const exceeds=inspectHistoricalMeteoblueCacheRecord(record,{nowMs:now});
 assert.equal(exceeds.precipitationRelationship.convectiveGreaterThanTotalSlots,1);
 assert.equal(exceeds.precipitationRelationship.needsScientificReview,true);
 assert.equal(exceeds.scientificallyHomologated,false);
 assert.equal(exceeds.providerContacted,false);
});
