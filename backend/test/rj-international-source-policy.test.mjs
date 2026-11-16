import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAZILIAN_REVIEW_INTERVAL_MS,
  planBrazilianInternalReview,
  internalDifferenceAction,
  permitPublicInternationalValue,
  privateVerificationAudit,
  arbitrateWithSecondInternationalSource,
  assessOfficialPublicAlert,
  OFFICIAL_PUBLIC_ALERT_SOURCES,
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
      type:'OBSERVATION', displayedAs:'OBSERVATION', observedAt: new Date(now.valueOf()-60000),
      expiresAt: new Date(now.valueOf()+60000), municipalityMatch:true,
      independentlyObtained:true, now,
    }), false);
  }
});
test('international provider also needs product licence, correct type, location and freshness',()=>{
  const sample={sourceId:'NOAA',productLicensedForCommercialApp:true,
    productAttributionSatisfied:true,type:'OBSERVATION',displayedAs:'OBSERVATION',
    observedAt:new Date(now.valueOf()-60000),
    expiresAt:new Date(now.valueOf()+60000),
    municipalityMatch:true,independentlyObtained:true,now};
  assert.equal(permitPublicInternationalValue(sample),true);
  for(const field of ['productLicensedForCommercialApp','productAttributionSatisfied','municipalityMatch','independentlyObtained']) {
    assert.equal(permitPublicInternationalValue({...sample,[field]:false}),false);
  }
  assert.equal(permitPublicInternationalValue({...sample,expiresAt:new Date(now.valueOf()-1)}),false);
  assert.equal(permitPublicInternationalValue({...sample,type:'UNKNOWN'}),false);
  assert.equal(permitPublicInternationalValue({...sample,type:'MODEL'}),false); // no model as observed
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


const cleanWeather = {
  sourceId:'NOAA', productLicensedForCommercialApp:true, productAttributionSatisfied:true,
  type:'OBSERVATION', displayedAs:'OBSERVATION', observedAt:new Date(now.getTime()-30000),
  expiresAt:new Date(now.getTime()+300000), municipalityMatch:true,
  independentlyObtained:true, phenomenon:'windKmh', unit:'km/h', scopeId:'3304557',
  qualityScore:0.62, independentProviderEvidence:true, verifiedOwnObservationTime:true,
};
test('Brazilian discrepancy can only trigger second international review with permission',()=>{
  const b={...cleanWeather,sourceId:'OPENWEATHER',qualityScore:0.85};
  assert.deepEqual(arbitrateWithSecondInternationalSource({
    discrepancyFlag:true, current:cleanWeather, alternative:b, now,
  }), {action:'UNAVAILABLE',reason:'COMPARISON_NOT_AUTHORIZED'});
  assert.deepEqual(arbitrateWithSecondInternationalSource({
    discrepancyFlag:true,comparisonPermissionConfirmed:true,
    current:cleanWeather,alternative:b,now,
  }), {action:'REPLACE_WITH_SECOND_INTERNATIONAL',sourceId:'OPENWEATHER',
    displayType:'OBSERVATION',reason:'HIGHER_VERIFIED_QUALITY'});
});
test('refuses invalid, stale, noncomparable or same international source',()=>{
  const base={discrepancyFlag:true,comparisonPermissionConfirmed:true,current:cleanWeather,now};
  assert.equal(arbitrateWithSecondInternationalSource({...base}).action,'KEEP_PRIMARY_RECHECK_PENDING');
  assert.equal(arbitrateWithSecondInternationalSource({...base,
    alternative:{...cleanWeather,sourceId:'OPENWEATHER',qualityScore:0.9,
      phenomenon:'temperatureC'}}).reason,'NON_COMPARABLE_INTERNATIONAL_PRODUCTS');
  assert.equal(arbitrateWithSecondInternationalSource({...base,
    alternative:{...cleanWeather,qualityScore:0.9}}).reason,'NON_COMPARABLE_INTERNATIONAL_PRODUCTS');
  assert.equal(arbitrateWithSecondInternationalSource({...base,
    alternative:{...cleanWeather,sourceId:'OPENWEATHER',expiresAt:new Date(now.getTime()-1)}}
  ).reason,'SECOND_INTERNATIONAL_SOURCE_UNAVAILABLE');
  assert.equal(arbitrateWithSecondInternationalSource({...base,
    alternative:{...cleanWeather,sourceId:'OPENWEATHER',qualityScore:0.9,
      independentProviderEvidence:false}}).reason,'INDEPENDENCE_OR_TIME_NOT_VERIFIED');
  assert.equal(arbitrateWithSecondInternationalSource({...base,
    alternative:{...cleanWeather,sourceId:'OPENWEATHER',qualityScore:0.5}}
  ).reason,'NO_VERIFIED_QUALITY_IMPROVEMENT');
});
test('approximate model value must retain model label during independent replacement',()=>{
  const model={...cleanWeather,type:'MODEL',displayedAs:'MODEL',phenomenon:'rainMm',
    sourceId:'NOAA'};
  const replacement={...model,sourceId:'JAXA_GSMAP',qualityScore:0.8};
  assert.equal(arbitrateWithSecondInternationalSource({
    discrepancyFlag:true,comparisonPermissionConfirmed:true,
    current:model,alternative:replacement,now,
  }).displayType,'MODEL');
  assert.equal(arbitrateWithSecondInternationalSource({
    discrepancyFlag:true,comparisonPermissionConfirmed:true,
    current:model,alternative:{...replacement,displayedAs:'OBSERVATION'},now,
  }).reason,'SECOND_INTERNATIONAL_SOURCE_UNAVAILABLE');
});
const validAlert = {
  sourceId:'INMET', officialUrl:'https://avisos.inmet.gov.br/',
  id:'sample-alert-1',event:'Aviso de tempestade',severity:'PERIGO_POTENCIAL',
  checkedAt:new Date(now.getTime()-5000), issuedAt:new Date(now.getTime()-60000),
  expiresAt:new Date(now.getTime()+3600000),
  affectedMunicipalities:[3304557], publiclyIssued:true,
  signatureOrTrustedFeedVerified:true,permissionToRepublish:true, now,
};
test('public alerts require a verified issuer, municipality, active issuance and permission',()=>{
  const publicResult=assessOfficialPublicAlert(validAlert);
  assert.equal(publicResult.action,'LINK_ONLY');
  assert.equal(publicResult.event,undefined);
  assert.equal(publicResult.severity,undefined);
  assert.equal(publicResult.municipalityIbges,undefined);
  assert.equal(publicResult.officialUrl,'https://avisos.inmet.gov.br/');
  assert.equal(assessOfficialPublicAlert({...validAlert,permissionToRepublish:false}).action,'LINK_ONLY');
  assert.equal(assessOfficialPublicAlert({...validAlert,withdrawn:true}).action,'BLOCK');
  assert.equal(assessOfficialPublicAlert({...validAlert,severity:''}).action,'BLOCK');
  assert.equal(assessOfficialPublicAlert({...validAlert,checkedAt:new Date(now.getTime()-600000)}).action,'BLOCK');
  assert.equal(assessOfficialPublicAlert({...validAlert,expiresAt:new Date(now.getTime()-1)}).action,'BLOCK');
  assert.equal(assessOfficialPublicAlert({...validAlert,publiclyIssued:false}).action,'BLOCK');
  assert.equal(assessOfficialPublicAlert({...validAlert,signatureOrTrustedFeedVerified:false}).action,'BLOCK');
  assert.equal(assessOfficialPublicAlert({...validAlert,affectedMunicipalities:[]}).action,'BLOCK');
  assert.equal(assessOfficialPublicAlert({...validAlert,officialUrl:'https://cor.rio.evil.example/'}).action,'BLOCK');
  assert.equal(assessOfficialPublicAlert({...validAlert,sourceId:'NOAA'}).action,'BLOCK');
});
test('official public alert policy includes four allowed publishers without silent fake notices',()=>{
  assert.deepEqual(Object.keys(OFFICIAL_PUBLIC_ALERT_SOURCES).sort(),
    ['INMET','ALERTA_RIO','COR_RIO','DEFESA_CIVIL_RJ'].sort());
  const rio=assessOfficialPublicAlert({...validAlert,sourceId:'ALERTA_RIO',
    officialUrl:'https://www.sistema-alerta-rio.com.br/alertas/',
    permissionToRepublish:false});
  assert.equal(rio.action,'LINK_ONLY');
  assert.equal(rio.issuedAt,undefined); // no false copied alert metadata
});
