import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseFromThreeInternationalSources,
} from '../src/rj-international-source-policy.mjs';

const now=new Date('2026-11-16T13:00:00Z');
const candidate=(sourceId,value,qualityScore=0.8,type='OBSERVATION')=>({
  sourceId,value,qualityScore,type,displayedAs:type,
  phenomenon:'temperatureC',unit:'°C',scopeId:'3304557',
  productLicensedForCommercialApp:true,productAttributionSatisfied:true,
  observedAt:new Date(now.valueOf()-2*60_000),
  expiresAt:new Date(now.valueOf()+5*60_000),
  municipalityMatch:true,independentlyObtained:true,
  independentProviderEvidence:true,verifiedOwnObservationTime:true,
  comparisonTolerance:0.4,
});
const a=candidate('NOAA',26.0,0.8);
const b=candidate('OPENWEATHER',28.0,0.9);
const c=candidate('EUMETSAT',25.5,0.7);
const reference={
  value:25.7,phenomenon:'temperatureC',unit:'°C',scopeId:'3304557',
  observedAt:new Date(now.valueOf()-2*60_000),
};

test('divergent two international results request independent third, not unavailable',()=>{
  const r=chooseFromThreeInternationalSources({candidates:[a,b],now});
  assert.equal(r.action,'REQUEST_THIRD_INTERNATIONAL_SOURCE');
  assert.equal(r.provisionalSourceId,'OPENWEATHER');
  assert.equal(r.provisionalValue,28);
});

test('third international value closest to legally permitted Brazilian reference is chosen',()=>{
  const r=chooseFromThreeInternationalSources({
    candidates:[a,b,c],brazilianReference:reference,
    comparisonPermissionConfirmed:true,now,
  });
  assert.equal(r.action,'PUBLISH_VALID_INTERNATIONAL');
  assert.equal(r.sourceId,'EUMETSAT');
  assert.equal(r.value,25.5);
  assert.equal(r.strategy,'CLOSEST_TO_PERMITTED_BRAZILIAN_REFERENCE');
  assert.equal(r.brazilianReference,undefined);
  assert.equal(r.officialValue,undefined);
});
test('without legal permission use international consensus, not Brazilian reference',()=>{
  const r=chooseFromThreeInternationalSources({
    candidates:[a,b,c],brazilianReference:{...reference,value:28},
    comparisonPermissionConfirmed:false,now,
  });
  assert.equal(r.action,'PUBLISH_VALID_INTERNATIONAL');
  assert.equal(r.sourceId,'NOAA'); // 26.0 minimizes total international distance
  assert.equal(r.strategy,'INTERNATIONAL_CONSENSUS');
});
test('invalid Brazilian reference is ignored even with permission',()=>{
  const result=chooseFromThreeInternationalSources({
    candidates:[a,b,c],brazilianReference:{...reference,observedAt:new Date(now.valueOf()-86400000)},
    comparisonPermissionConfirmed:true,now,
  });
  assert.equal(result.sourceId,'NOAA');
  assert.equal(result.strategy,'INTERNATIONAL_CONSENSUS');
});
test('invalid international provider cannot be substituted for valid international values',()=>{
  const invalid={...c,productLicensedForCommercialApp:false};
  const r=chooseFromThreeInternationalSources({candidates:[a,b,invalid],now});
  assert.equal(r.action,'REQUEST_THIRD_INTERNATIONAL_SOURCE');
  assert.equal(r.provisionalSourceId,'OPENWEATHER');
});
test('third provider unavailable: publish the best remaining valid international source',()=>{
  const r=chooseFromThreeInternationalSources({
    candidates:[a,b],thirdAttempted:true,now,
  });
  assert.equal(r.action,'PUBLISH_VALID_INTERNATIONAL');
  assert.equal(r.sourceId,'OPENWEATHER');
  assert.equal(r.strategy,'INTERNATIONAL_QUALITY');
});

test('when one international observation is valid, divergence never causes unavailable',()=>{
  const r=chooseFromThreeInternationalSources({candidates:[a,{...b,expiresAt:new Date(now.valueOf()-1)}],now});
  assert.equal(r.action,'PUBLISH_VALID_INTERNATIONAL');
  assert.equal(r.sourceId,'NOAA');
});
test('all international products invalid means unavailable rather than fabricated measurement',()=>{
  const r=chooseFromThreeInternationalSources({
    candidates:[{...a,productLicensedForCommercialApp:false},
      {...b,expiresAt:new Date(now.valueOf()-1)}],now,
  });
  assert.equal(r.action,'UNAVAILABLE');
  assert.equal(r.reason,'NO_VALID_INTERNATIONAL_SOURCE');
});
test('different units, scope or model types cannot be confused during arbitration',()=>{
  const withMixed=[a,{...b,unit:'F'},{...c,type:'MODEL',displayedAs:'MODEL'}];
  const r=chooseFromThreeInternationalSources({candidates:withMixed,now});
  assert.equal(r.action,'PUBLISH_VALID_INTERNATIONAL');
  assert.equal(r.sourceId,'NOAA');
  assert.equal(r.displayType,'OBSERVATION');
});
test('model estimates remain model estimates and are never rebranded as observations',()=>{
  const m1=candidate('NOAA',12,0.8,'MODEL');
  const m2=candidate('JAXA_GSMAP',13,0.9,'MODEL');
  const m3=candidate('EUMETSAT',11.5,0.7,'MODEL');
  const r=chooseFromThreeInternationalSources({candidates:[m1,m2,m3],now});
  assert.equal(r.action,'PUBLISH_VALID_INTERNATIONAL');
  assert.equal(r.displayType,'MODEL');
});
test('only 3 international sources considered to avoid surprise provider charges',()=>{
  const r=chooseFromThreeInternationalSources({candidates:[a,b,c,c],now});
  assert.equal(r.action,'UNAVAILABLE');
  assert.equal(r.reason,'INVALID_INPUT');
});
