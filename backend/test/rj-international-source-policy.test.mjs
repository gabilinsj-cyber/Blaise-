import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAZILIAN_REVIEW_INTERVAL_MS,
  planBrazilianInternalReview,
  internalDifferenceAction,
  permitPublicInternationalValue,
  privateVerificationAudit,
} from '../src/rj-international-source-policy.mjs';

const now = new Date('2026-11-16T12:00:00Z');

test('review disabled by default even when source is Brazilian and interval elapsed', () => {
  for (const sourceId of ['INMET', 'ALERTA_RIO', 'DEFESA_CIVIL_RJ']) {
    assert.deepEqual(planBrazilianInternalReview({sourceId, now}),
      {allowed: false, reason: 'AUTHORIZATION_REQUIRED'});
  }
});
test('authorized internal review no more frequently than every 30 minutes', () => {
  assert.equal(BRAZILIAN_REVIEW_INTERVAL_MS, 1800000);
  const base={sourceId: 'INMET', now, licenseAllowsInternalComparison: true};
  assert.deepEqual(planBrazilianInternalReview({...base, previousCheckAt:new Date(now.valueOf()-1799999)}),
    {allowed:false,reason:'THIRTY_MINUTE_INTERVAL'});
  assert.deepEqual(planBrazilianInternalReview({...base, previousCheckAt:new Date(now.valueOf()-1800000)}),
    {allowed:true,reason:'INTERNAL_COMPARISON_ONLY'});
});
test('no restricted source may be used as display provider', () => {
  for(const sourceId of ['INMET','ALERTA_RIO','DEFESA_CIVIL_RJ','INEA','MARINHA_BRASIL','WINDY','COPERNICUS']) {
    assert.equal(permitPublicInternationalValue({
      sourceId, productLicensedForCommercialApp:true, productAttributionSatisfied:true,
      type:'OBSERVATION', observedAt: new Date(now.valueOf()-60000),
      expiresAt: new Date(now.valueOf()+60000), municipalityMatch:true,
      independentlyObtained:true, now,
    }), false);
  }
});
test('international provider also needs product licence, correct type, location and freshness',()=>{
  const sample={sourceId:'NOAA',productLicensedForCommercialApp:true,
    productAttributionSatisfied:true,type:'OBSERVATION',
    observedAt:new Date(now.valueOf()-60000),
    expiresAt:new Date(now.valueOf()+60000),
    municipalityMatch:true,independentlyObtained:true,now};
  assert.equal(permitPublicInternationalValue(sample),true);
  for(const field of ['productLicensedForCommercialApp','productAttributionSatisfied','municipalityMatch','independentlyObtained']) {
    assert.equal(permitPublicInternationalValue({...sample,[field]:false}),false);
  }
  assert.equal(permitPublicInternationalValue({...sample,expiresAt:new Date(now.valueOf()-1)}),false);
  assert.equal(permitPublicInternationalValue({...sample,type:'UNKNOWN'}),false);
});
test('official difference never corrects or overwrites international value',()=>{
  assert.equal(internalDifferenceAction(), 'NO_COMPARISON_AUTHORIZED');
  assert.equal(internalDifferenceAction({permissionConfirmed:true,differenceFound:true}),
    'RECHECK_INTERNATIONAL_PROVIDERS_INDEPENDENTLY');
});
test('internal audit stores only source, timestamp and outcome',()=>{
  const r=privateVerificationAudit({sourceId:'INMET',checkedAt:now,outcome:'UNAVAILABLE'});
  assert.deepEqual(Object.keys(r),['sourceId','checkedAt','outcome']);
  assert.equal(JSON.stringify(r).includes('temperature'),false);
});
