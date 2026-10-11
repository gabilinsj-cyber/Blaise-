import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_ATLANTIC_MATRIX_25, RJ_ATLANTIC_25_NAME, RJ_ATLANTIC_25_VERSION,
  RJ_ATLANTIC_25_PROVIDERS, rjAtlanticMatrixRow,
  europeanProductUsableForPhenomenon,
} from '../src/rj-matriz-atlantico-25.mjs';
import {RJ_EVENT_SOURCE_POLICY} from '../src/rj-user-source-priority-policy.mjs';

const EURO=[11,12,13,14,15,16,22,24];
test('matrix has exactly 25 unique, ordered core RJ phenomena, preserving all 28 extended source rules',()=>{
  assert.equal(RJ_ATLANTIC_MATRIX_25.length,25);
  assert.deepEqual(RJ_ATLANTIC_MATRIX_25.map(x=>x.number),Array.from({length:25},(_,i)=>i+1));
  assert.equal(new Set(RJ_ATLANTIC_MATRIX_25.map(x=>x.id)).size,25);
  assert.match(RJ_ATLANTIC_25_NAME,/Blaise V6 RJ/);
  assert.match(RJ_ATLANTIC_25_VERSION,/2026-10-11/);
  assert.equal(Object.keys(RJ_EVENT_SOURCE_POLICY).length,28);
  assert.equal(rjAtlanticMatrixRow(25).title,'Qualidade do ar');
  assert.throws(()=>rjAtlanticMatrixRow(26),RangeError);
});
test('only phenomena 1 to 10 register OpenWeatherMap as complementary, never official P0 publisher',()=>{
  for(const row of RJ_ATLANTIC_MATRIX_25) {
    const owm=row.newComplementarySources.filter(x=>x.sourceId==='OPENWEATHER');
    assert.equal(owm.length,row.number<=10?1:0);
    assert.equal(row.canPublishP0FromNewSource,false);
    if(owm.length){
      assert.equal(owm[0].canConfirmOfficialWarning,false);
      assert.equal(owm[0].role,'COMPLEMENTARY_WEATHER_AGGREGATE_OR_MODEL');
    }
  }
  assert.equal(RJ_ATLANTIC_25_PROVIDERS.OPENWEATHER.credentialEnvName,'OPENWEATHER_API_KEY');
  assert.equal(RJ_ATLANTIC_25_PROVIDERS.OPENWEATHER.status,
    'NOT_CONNECTED_SECRET_NOT_CONFIGURED_IN_BACKEND');
  assert.equal(RJ_ATLANTIC_25_PROVIDERS.OPENWEATHER.keyPolicy,
    'SERVER_SIDE_ONLY_NO_APP_OR_GITHUB_PUBLIC_SOURCE');
});
test('only requested rows 11–16, 22 and 24 register both European providers, without overwriting official priorities',()=>{
  const actual=RJ_ATLANTIC_MATRIX_25.filter(x=>x.newComplementarySources.some(
    s=>s.sourceId==='EUMETSAT')).map(x=>x.number);
  assert.deepEqual(actual,EURO);
  for(const row of RJ_ATLANTIC_MATRIX_25){
    const ids=row.newComplementarySources.map(x=>x.sourceId);
    assert.equal(ids.includes('COPERNICUS_MARINE'),EURO.includes(row.number));
    assert.equal(ids.includes('EUMETSAT'),EURO.includes(row.number));
    assert.equal(row.dataStatus,'REQUIRES_PRODUCT_SPECIFIC_LIVE_VALIDATION');
    for(const key of row.sourcePolicyKeys){
      const policy=RJ_EVENT_SOURCE_POLICY[key];
      assert.ok(policy);
      for(const id of policy.primary)assert.ok(row.priorityOfficialAndSpecialized.includes(id));
    }
  }
  assert.deepEqual(rjAtlanticMatrixRow(17).priorityOfficialAndSpecialized.slice(0,3),
    ['NOAA_TSUNAMI','MARINHA_CHM','AUTORIDADE_BRASILEIRA_COMPETENTE']);
  assert.ok(rjAtlanticMatrixRow(21).priorityOfficialAndSpecialized.includes('USGS'));
  assert.equal(rjAtlanticMatrixRow(11).newComplementarySources.find(x=>
    x.sourceId==='COPERNICUS_MARINE').role,'NON_APPLICABLE_DIRECT');
});
test('European product must prove real RJ-Atlantic footprint, relevant variable, product ID and licensing',()=>{
  const valid={productId:'catalog-product-id',dataLicenseVerified:true,
    spatialCoverageRjAtlantic:true,georeferenced:true,freshForPhenomenon:true,
    variableMatchesPhenomenon:true,provenanceIndependent:true};
  assert.equal(europeanProductUsableForPhenomenon(13,'COPERNICUS_MARINE',valid),true);
  assert.equal(europeanProductUsableForPhenomenon(12,'EUMETSAT',valid),true);
  assert.equal(europeanProductUsableForPhenomenon(24,'EUMETSAT',{...valid,spatialCoverageRjAtlantic:false}),false);
  assert.equal(europeanProductUsableForPhenomenon(22,'COPERNICUS_MARINE',
    {...valid,variableMatchesPhenomenon:false}),false);
  assert.equal(europeanProductUsableForPhenomenon(11,'COPERNICUS_MARINE',valid),false);
  assert.equal(europeanProductUsableForPhenomenon(1,'OPENWEATHER',valid),false);
});
test('matrix never exposes a credential value and requires source timestamp/provenance',()=>{
  const serialized=JSON.stringify(RJ_ATLANTIC_MATRIX_25)+JSON.stringify(RJ_ATLANTIC_25_PROVIDERS);
  assert.ok(!/apiKeyValue|accessTokenValue|passwordValue/i.test(serialized));
  assert.ok(RJ_ATLANTIC_MATRIX_25.every(x=>
    x.originAndObservationTimeMandatory && x.avoidDoubleCountingRepublishedData));
});
