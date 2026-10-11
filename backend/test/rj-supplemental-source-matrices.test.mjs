import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  RJ_TABLE1_OPENWEATHER_FIRST_TEN,
  RJ_MARINE_SOURCE_COMPLEMENT,
  rjOpenWeatherComplement,
} from '../src/rj-supplemental-source-matrices.mjs';

test('Table 1 first ten use OpenWeatherMap third-source, not an official alert source',()=>{
  assert.equal(RJ_TABLE1_OPENWEATHER_FIRST_TEN.length,10);
  const codes=RJ_TABLE1_OPENWEATHER_FIRST_TEN.map(x=>x.code);
  assert.equal(new Set(codes).size,10);
  assert.deepEqual(codes,[
    'TEMPERATURA','SENSACAO_TERMICA','CHUVA_ATUAL','CHUVA_ACUMULADA','TEMPORAL',
    'VENTO','RAJADA','PRESSAO_ATMOSFERICA','UMIDADE','GRANIZO',
  ]);
  assert.ok(RJ_TABLE1_OPENWEATHER_FIRST_TEN.every(x=>
    x.thirdSource==='OPENWEATHERMAP'
    &&x.thirdRole.includes('NOT_AN_OFFICIAL_WARNING')
    &&x.license==='PRODUCT_SPECIFIC_USAGE_TERMS_REQUIRED'
    &&x.alwaysIndependent===false
    &&x.availability==='UNVERIFIED'));
});

test('joint P1 applies only within Rio municipality, not all 92 places',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES){
    const policy=rjOpenWeatherComplement({ibge,phenomenon:'TEMPERATURA'});
    assert.equal(policy.thirdSource,'OPENWEATHERMAP');
    assert.equal(policy.notAnOfficialAlert,true);
    assert.equal(policy.sourceDataStatus,'NOT_FETCHED');
    assert.equal(policy.p1Sources.includes('ALERTA_RIO'),ibge==='3304557');
    assert.ok(policy.p1Sources.includes('DEFESA_CIVIL_RJ_REGIONAL'));
    assert.ok(policy.requiredChecks.includes('NO_REPUBLISHED_SOURCES_COUNTED_INDEPENDENTLY'));
  }
});

test('Table 1 complementary third source does not replace INMET, INPE or Windy',()=>{
  assert.ok(RJ_TABLE1_OPENWEATHER_FIRST_TEN.every(x=>
    x.doesNotSupersede.includes('INMET_STATION')
    &&x.doesNotSupersede.includes('INPE_CPTEC_FORECAST')
    &&x.doesNotSupersede.includes('WINDY_MODELO')));
  assert.throws(()=>rjOpenWeatherComplement({ibge:'4106902',phenomenon:'TEMPERATURA'}));
  assert.throws(()=>rjOpenWeatherComplement({ibge:'3304557',phenomenon:'INEA'}));
});

test('marine supplementary matrix lists 5 phenomena and exact specialized channels',()=>{
  assert.equal(RJ_MARINE_SOURCE_COMPLEMENT.length,5);
  const rows=Object.fromEntries(RJ_MARINE_SOURCE_COMPLEMENT.map(r=>[r.code,r]));
  assert.deepEqual(rows.CICLONE_OCEANICO.sources,
    ['MARINHA_CHM','NOAA','EUMETSAT_SATELLITE','COPERNICUS_MARINE']);
  assert.deepEqual(rows.TEMPESTADE_ATLANTICO.sources,
    ['MARINHA_CHM','NOAA','EUMETSAT_SATELLITE']);
  assert.deepEqual(rows.ONDAS_SWELL.sources,
    ['MARINHA_CHM','NOAA','COPERNICUS_MARINE']);
  assert.deepEqual(rows.RESSACA_LITORAL_RJ.sources,
    ['MARINHA_CHM','BOIAS_OCEANOGRAFICAS_AUTORIZADAS','COPERNICUS_MARINE','NOAA']);
  assert.deepEqual(rows.TSUNAMI.sources,
    ['NOAA','MARINHA_CHM','AUTORIDADES_BRASILEIRAS_COMPETENTES']);
  assert.ok(RJ_MARINE_SOURCE_COMPLEMENT.every(r=>
    r.automaticAlertAllowed===false && r.status==='CATALOG_ONLY_NOT_LIVE'));
});
