import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMeteoblueBasic6h}
 from '../src/rj-meteoblue-basic6h-parse.mjs';
import {prepareMeteoblueFreeRjProbe}
 from '../src/rj-meteoblue-free-connection.mjs';
import {
 METEOBLUE_FREE_PUBLICATION_CONTRACT,
 assessMeteoblueFreePublication,buildMeteoblueFreeClientPayload
} from '../src/rj-meteoblue-free-publication-contract.mjs';

const now=Date.parse('2026-11-19T13:00:00Z');
const point=prepareMeteoblueFreeRjProbe({
 ibge:'3304557',freeTrialConfirmed:true,autoTopUpDisabled:true,
 operatorApprovedSingleCreditUse:true,serverEnvironment:true
}).targetCoordinates;
assert.ok(point);
const n=29;
const makePayload=()=>({
 metadata:{
  latitude:point.lat,longitude:point.lon,
  modelrun_utc:'2026-11-19 06:00',
  modelrun_updatetime_utc:'2026-11-19 07:00'
 },
 units:{
  precipitation:'mm',windspeed:'km/h',
  relativehumidity:'%',sealevelpressure:'hPa'
 },
 data_6h:{
  time:Array.from({length:n},(_,i)=>
   new Date(Date.parse('2026-11-19T12:00:00Z')+i*6*60*60_000)
    .toISOString().slice(0,16).replace('T',' ')),
  precipitation:Array.from({length:n},(_,i)=>i%2?2:0),
  convective_precipitation:Array.from({length:n},(_,i)=>i%2?1:0),
  precipitation_probability:Array.from({length:n},(_,i)=>i%2?0:70),
  windspeed_mean:Array(n).fill(12),
  windspeed_max:Array(n).fill(18),
  relativehumidity_mean:Array(n).fill(80),
  sealevelpressure_mean:Array(n).fill(1008)
 }
});
const parse=p=>parseMeteoblueBasic6h({
 payload:p,ibge:'3304557',latitude:point.lat,
 longitude:point.lon,nowMs:now
});
const f=()=>parse(makePayload());

test('seven scientific checks do not silently grant consumer publication',()=>{
 const data=f();
 assert.equal(data.status,'FORECAST_PARSED_PRIVATE_STAGING');
 const a=assessMeteoblueFreePublication(data,{nowMs:now,storedAtMs:now});
 assert.equal(a.status,'BLOCKED_PRIVATE_STAGING_ONLY');
 assert.equal(a.structuralChecksPassed,true);
 assert.equal(a.additionalScientificReviewRequired,false);
 assert.equal(a.fields.length,7);
 assert.ok(a.fields.every(v=>v.numericCount===29&&v.missingCount===0));
 assert.deepEqual(a.errors,[]);
 assert.deepEqual(a.warnings,[]);
 assert.equal(a.clientPublicationAllowed,false);
 assert.equal(a.canGenerateOfficialAlerts,false);
 assert.equal(a.canPopulateRiskCalculator,false);
 assert.equal(a.clientPayload,null);
 assert.equal(a.alertPayload,null);
 assert.equal(a.mapLayerPayload,null);
 assert.equal(a.providerContacted,false);
 assert.equal(a.creditsReserved,0);
 assert.equal(METEOBLUE_FREE_PUBLICATION_CONTRACT.publicReleaseApproved,false);
 assert.equal(METEOBLUE_FREE_PUBLICATION_CONTRACT.commercialRightsVerified,false);
});
test('probability can differ from deterministic amount without false scientific rejection',()=>{
 const p=makePayload();
 // At wet slots deterministic rain 2mm but ensemble probability 0%;
 // at dry slots probability 70%. Meteoblue documents this possibility.
 const a=assessMeteoblueFreePublication(parse(p),{nowMs:now});
 assert.equal(a.structuralChecksPassed,true);
 assert.ok(!a.warnings.some(x=>/PROBABILITY/.test(x)));
 assert.equal(a.clientPublicationAllowed,false);
});
test('identical total and convective wet series trigger review rather than auto-mutation',()=>{
 const p=makePayload();
 p.data_6h.convective_precipitation=[...p.data_6h.precipitation];
 const forecast=parse(p);
 assert.equal(forecast.auditReadyForPrivateReview,true);
 const a=assessMeteoblueFreePublication(forecast,{nowMs:now});
 assert.ok(a.warnings.includes(
  'CONVECTIVE_COMPONENT_MATCHES_TOTAL_IN_ALL_WET_PERIODS_REVIEW'));
 assert.equal(a.additionalScientificReviewRequired,true);
 assert.equal(a.clientPublicationAllowed,false);
});
test('convective exceeds total and wind maximum below mean trigger scientific review',()=>{
 const p=makePayload();
 p.data_6h.convective_precipitation[1]=3;
 p.data_6h.windspeed_max[2]=10;
 const a=assessMeteoblueFreePublication(parse(p),{nowMs:now});
 assert.equal(a.structuralChecksPassed,true);
 assert.ok(a.warnings.includes('CONVECTIVE_COMPONENT_EXCEEDS_TOTAL_REVIEW'));
 assert.ok(a.warnings.includes('SIX_HOUR_WIND_MAX_BELOW_MEAN_REVIEW'));
});
test('missing values remain missing and historical model runs are not advertised as current',()=>{
 const p=makePayload();
 p.data_6h.relativehumidity_mean[3]=null;
 const a=assessMeteoblueFreePublication(parse(p),{
  nowMs:now+48*60*60_000,storedAtMs:now
 });
 assert.ok(a.warnings.includes('INCOMPLETE_PERIOD_VALUES_RELATIVEHUMIDITY_MEAN'));
 assert.ok(a.warnings.includes('MODEL_RUN_NOT_CURRENT_FOR_CLIENT'));
 assert.ok(a.warnings.includes('PRIVATE_CACHE_EXPIRED_OR_CLOCK_INVALID'));
 const rh=a.fields.find(x=>x.sourceKey==='relativehumidity_mean');
 assert.equal(rh.numericCount,28);
 assert.equal(rh.missingCount,1);
 assert.equal(a.clientPayload,null);
});
test('source-key traceability is explicit; older cached records cannot gain fabricated provenance',()=>{
 const src=f();
 const old={...src,values:src.values.map(x=>{
  const {sourceField,...rest}=x;return rest;
 })};
 const a=assessMeteoblueFreePublication(old,{nowMs:now});
 assert.equal(a.structuralChecksPassed,true);
 assert.ok(a.warnings.some(x=>x.startsWith('SOURCE_KEY_PROVENANCE_NOT_PERSISTED')));
 assert.equal(a.clientPublicationAllowed,false);
 const forged={...src,values:src.values.map(x=>
  x.sourceField==='convective_precipitation'
   ?{...x,sourceField:'precipitation'}:x)};
 const b=assessMeteoblueFreePublication(forged,{nowMs:now});
 assert.ok(b.warnings.includes(
  'SOURCE_KEY_PROVENANCE_NOT_PERSISTED_OR_MISMATCH_CONVECTIVE_PRECIPITATION'));
});
test('invalid field range, mismatched time and client flag tampering fail closed',()=>{
 const src=f();
 for(const dirty of [
  {...src,validTimes:[...src.validTimes.slice(0,1),src.validTimes[0],
    ...src.validTimes.slice(2)]},
  {...src,values:src.values.map(x=>x.sourceField==='windspeed_mean'
    ?{...x,values:[-100,...x.values.slice(1)]}:x)},
  {...src,publishedToSubscribers:true},
  {...src,values:src.values.slice(1)}
 ]){
  const a=assessMeteoblueFreePublication(dirty,{nowMs:now});
  assert.equal(a.clientPublicationAllowed,false);
  assert.ok(a.errors.length>0);
 }
});
test('future subscriber projection cannot be enabled through options or fake approval',()=>{
 const source=f();
 const attempt=buildMeteoblueFreeClientPayload(
  {...source,scientificallyHomologated:true,publishedToAndroid:true},
  {nowMs:now,commercialRightsVerified:true,releaseApproved:true,
   publishToSubscribers:true,skipScientificValidation:true}
 );
 assert.equal(attempt.status,'BLOCKED_PRIVATE_STAGING_ONLY');
 assert.equal(attempt.forecast,null);
 assert.equal(attempt.weather,null);
 assert.equal(attempt.alerts,null);
 assert.equal(attempt.clientPayload,null);
 assert.equal(attempt.providerContacted,false);
 assert.equal(attempt.creditsReserved,0);
 assert.equal(JSON.stringify(attempt).includes('apikey'),false);
});
test('no forecast also denies without touching provider or publishing data',()=>{
 const x=buildMeteoblueFreeClientPayload(null,{nowMs:now});
 assert.equal(x.forecast,null);
 assert.equal(x.publishedToSubscribers,false);
 assert.ok(x.reasons.includes('NO_PRIVATE_FORECAST'));
});
