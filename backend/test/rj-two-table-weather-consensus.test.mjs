import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  RJ_TABLE1_SOURCES,RJ_TABLE2_SOURCES,
  RJ_TABLE2_FOURTH_SOURCE_STATUS,
  reconcileRjTwoTables,consultRjTwoTables,
} from '../src/rj-two-table-weather-consensus.mjs';
const NOW=Date.parse('2026-10-12T18:00:00Z');
const observation=(sourceId,value,more={})=>({
  sourceId,ibge:'3304557',variable:'TEMPERATURA_C',unit:'°C',
  kind:'OFFICIAL_OBSERVATION',value,
  observedAt:'2026-10-12T17:40:00Z',
  stationId:sourceId==='ALERTA_RIO'?'AR-1':'DC-1',
  latitude:-22.9,longitude:-43.2,qualityWeight:1,
  sourceUrl:'https://observacoes.exemplo.br/teste',
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  ...more,
});
const model=(sourceId,value,more={})=>({
  sourceId,ibge:'3304557',variable:'TEMPERATURA_C',unit:'°C',
  kind:'MODEL_FORECAST',value,
  issuedAt:'2026-10-12T14:00:00Z',
  validAt:'2026-10-12T18:00:00Z',
  productId:sourceId+'-prediction',
  modelFamilyId:sourceId+'-base-model',
  latitude:-22.9,longitude:-43.2,gridResolutionKm:10,
  sourceUrl:'https://previsoes.exemplo.br/teste',
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  ...more,
});
const inputs=(records,ibge='3304557',variable='TEMPERATURA_C')=>
  reconcileRjTwoTables({ibge,variable,records,now:NOW});

test('three primary sources are distinct from five priority tie-break sources; NOAA is last',()=>{
  assert.deepEqual(RJ_TABLE1_SOURCES,
    ['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','OPENWEATHERMAP_API']);
  assert.deepEqual(RJ_TABLE2_SOURCES,
    ['INPE_CPTEC_FORECAST','INMET_STATION','WINDY_MODELO','CEMADEN_RJ','NOAA']);
  assert.equal(RJ_TABLE2_FOURTH_SOURCE_STATUS,'CEMADEN_CONFIRMED_BY_PROJECT_OWNER');
  assert.equal(new Set([...RJ_TABLE1_SOURCES,...RJ_TABLE2_SOURCES]).size,8);
});
test('two compatible official readings in table one stop without any tie breaker and allow simple mean',()=>{
  const result=inputs([observation('ALERTA_RIO',26),
    observation('DEFESA_CIVIL_RJ_REGIONAL',28)]);
  assert.equal(result.state,'TABLE1_TWO_COMPATIBLE_SOURCES');
  assert.equal(result.estimate,27);
  assert.equal(result.estimateKind,'SIMPLE_OBSERVATION_MEAN');
  assert.deepEqual(result.matchedSources.map(x=>x.sourceId),
    ['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']);
  assert.deepEqual(result.checkedSourceIds,RJ_TABLE1_SOURCES);
  assert.equal(result.autoAlert,false);
});
test('when verified QC weights are present, use weighted mean only for matching observations',()=>{
  const result=inputs([
    observation('ALERTA_RIO',27,{qualityWeight:1,qualityWeightBasis:'VERIFIED_STATION_QC'}),
    observation('DEFESA_CIVIL_RJ_REGIONAL',28,{qualityWeight:3,qualityWeightBasis:'VERIFIED_STATION_QC'}),
  ]);
  assert.equal(result.state,'TABLE1_TWO_COMPATIBLE_SOURCES');
  assert.equal(result.estimate,27.75);
  assert.equal(result.estimateKind,'QUALITY_WEIGHTED_OBSERVATION_MEAN');
});
test('on table one discrepancy INPE first is consulted and can supply forecast comparison with one primary',()=>{
  const result=inputs([
    observation('ALERTA_RIO',24),
    observation('DEFESA_CIVIL_RJ_REGIONAL',32),
    model('INPE_CPTEC_FORECAST',25),
    model('WINDY_MODELO',31),
    model('NOAA',30),
  ]);
  assert.equal(result.state,'TABLE2_FIRST_COMPATIBLE_PAIR');
  assert.deepEqual(result.matchedSources.map(x=>x.sourceId),
    ['ALERTA_RIO','INPE_CPTEC_FORECAST']);
  assert.equal(result.estimate,null);
  assert.equal(result.estimateKind,'OFFICIAL_OR_COMPLEMENTARY_READING_PLUS_FORECAST_CONTEXT');
  assert.equal(result.matchedSources[0].kind,'OFFICIAL_OBSERVATION');
  assert.equal(result.matchedSources[1].kind,'MODEL_FORECAST');
  assert.equal(result.table1Readings.length,2);
});
test('INPE incompatible, INMET next reconciles with one of the first three, no request for Windy',()=>{
  const result=inputs([
    observation('ALERTA_RIO',24),
    observation('DEFESA_CIVIL_RJ_REGIONAL',33),
    model('INPE_CPTEC_FORECAST',29),
    observation('INMET_STATION',25,{stationId:'A652'}),
    model('WINDY_MODELO',33),
  ]);
  assert.equal(result.state,'TABLE2_FIRST_COMPATIBLE_PAIR');
  assert.deepEqual(result.matchedSources.map(x=>x.sourceId),
    ['ALERTA_RIO','INMET_STATION']);
  assert.equal(result.estimate,24.5);
  assert.equal(result.estimateKind,'SIMPLE_OBSERVATION_MEAN');
  assert.equal(result.autoAlert,false);
});
test('Windy is consulted after INPE and INMET if both disagree, still no measured mean',()=>{
  const result=inputs([
    observation('ALERTA_RIO',24),observation('DEFESA_CIVIL_RJ_REGIONAL',33),
    model('INPE_CPTEC_FORECAST',29),observation('INMET_STATION',29,{stationId:'A652'}),
    model('WINDY_MODELO',33.5),
  ]);
  assert.equal(result.state,'TABLE2_FIRST_COMPATIBLE_PAIR');
  assert.equal(result.matchedSources[0].sourceId,'DEFESA_CIVIL_RJ_REGIONAL');
  assert.equal(result.matchedSources[1].sourceId,'WINDY_MODELO');
  assert.equal(result.estimate,null);
});
test('NOAA remains final fallback if every preceding tie-break candidate is incompatible',()=>{
  const result=inputs([
    observation('ALERTA_RIO',24),observation('DEFESA_CIVIL_RJ_REGIONAL',33),
    model('INPE_CPTEC_FORECAST',29),
    observation('INMET_STATION',29,{stationId:'A652'}),
    model('WINDY_MODELO',28),observation('CEMADEN_RJ',29,{stationId:'CE-1'}),
    model('NOAA',24.5),
  ]);
  assert.equal(result.state,'TABLE2_FIRST_COMPATIBLE_PAIR');
  assert.deepEqual(result.matchedSources.map(x=>x.sourceId),['ALERTA_RIO','NOAA']);
  assert.equal(result.estimate,null);
  assert.deepEqual(result.checkedSourceIds.at(-1),'NOAA');
});
test('OWM republishing Alerta Rio station cannot be double-counted as independent provider',()=>{
  const a=observation('ALERTA_RIO',25);
  const echoed=observation('OPENWEATHERMAP_API',26,{
    productKind:'INDEPENDENT_OBSERVATION',
    originalProviderVerified:true,
    originalProviderId:'ALERTA_RIO',stationId:'AR-1',
  });
  const result=inputs([a,echoed]);
  assert.notEqual(result.state,'TABLE1_TWO_COMPATIBLE_SOURCES');
  assert.equal(result.estimate,null);
});
test('Table one OWM independently sourced instrument can be counted only if provenance verified',()=>{
  const a=observation('ALERTA_RIO',25);
  const second=observation('OPENWEATHERMAP_API',26,{
    productKind:'INDEPENDENT_OBSERVATION',originalProviderVerified:true,
    originalProviderId:'INDEPENDENT_ORIGINAL_NETWORK',stationId:'OTH-1',
  });
  const result=inputs([a,second]);
  assert.equal(result.state,'TABLE1_TWO_COMPATIBLE_SOURCES');
  assert.equal(result.estimate,25.5);
});
test('table one model forecast cannot be counted as two matching measured sensors',()=>{
  const result=inputs([
    observation('ALERTA_RIO',25),
    model('OPENWEATHERMAP_API',26),
  ]);
  assert.notEqual(result.state,'TABLE1_TWO_COMPATIBLE_SOURCES');
  assert.equal(result.estimate,null);
});
test('no source can be faked to produce an observation, and stale/unauthorized are discarded',()=>{
  for(const altered of [
    {value:9000},{observedAt:'2026-10-12T11:00:00Z'},
    {usagePermissionStatus:'PUBLICLY_AVAILABLE'},
    {sourceUrl:'http://not-secure.test'},
    {ibge:'4106902'},{latitude:0},{kind:'MODEL_FORECAST'},
  ]){
    const result=inputs([observation('ALERTA_RIO',24,altered)]);
    assert.equal(result.state,'NO_VALID_CURRENT_TABLE1_READING');
    assert.equal(result.estimate,null);
  }
});
test('Alerta Rio is Rio city only; valid coverage of all 92 municipalities does not imply 92 observed stations',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES){
    const result=reconcileRjTwoTables({ibge,variable:'TEMPERATURA_C',records:[],now:NOW});
    assert.equal(result.estimate,null);
    assert.equal(result.autoAlert,false);
    assert.equal(result.checkedSourceIds.includes('ALERTA_RIO'),String(ibge)==='3304557');
  }
});
test('different time, different variable and remote station are not comparable',()=>{
  for(const change of [
    {observedAt:'2026-10-12T17:05:00Z'},
    {variable:'VENTO_KMH'},
    {latitude:-22.3,longitude:-42.4},
  ]){
    const result=inputs([
      observation('ALERTA_RIO',25),
      observation('DEFESA_CIVIL_RJ_REGIONAL',26,change),
    ]);
    assert.equal(result.estimate,null);
    assert.notEqual(result.state,'TABLE1_TWO_COMPATIBLE_SOURCES');
  }
});
test('sequential adapter consultation does not contact any tie breakers when first two are compatible',async()=>{
  const called=[];
  const adapters={
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {records:[observation('ALERTA_RIO',26)]}},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA_CIVIL_RJ_REGIONAL');return {records:[observation('DEFESA_CIVIL_RJ_REGIONAL',27)]}},
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE_CPTEC_FORECAST');return {records:[model('INPE_CPTEC_FORECAST',26)]}},
  };
  const result=await consultRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',adapters,now:NOW});
  assert.deepEqual(called,['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']);
  assert.equal(result.estimate,26.5);
});
test('sequential consultation follows 3+5 hierarchy and stops at first compatible model',async()=>{
  const called=[];
  const adapters={
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {records:[observation('ALERTA_RIO',23)]}},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA_CIVIL_RJ_REGIONAL');return {records:[observation('DEFESA_CIVIL_RJ_REGIONAL',32)]}},
    OPENWEATHERMAP_API:async()=>{called.push('OPENWEATHERMAP_API');return {records:[model('OPENWEATHERMAP_API',29)]}},
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE_CPTEC_FORECAST');return {records:[model('INPE_CPTEC_FORECAST',24)]}},
    INMET_STATION:async()=>{called.push('INMET_STATION');return {records:[observation('INMET_STATION',24)]}},
    NOAA:async()=>{called.push('NOAA');return {records:[model('NOAA',24)]}},
  };
  const result=await consultRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',adapters,now:NOW});
  assert.equal(result.state,'TABLE2_FIRST_COMPATIBLE_PAIR');
  assert.deepEqual(result.matchedSources.map(x=>x.sourceId),['ALERTA_RIO','INPE_CPTEC_FORECAST']);
  assert.deepEqual(called,['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','OPENWEATHERMAP_API','INPE_CPTEC_FORECAST']);
  assert.equal(result.estimate,null);
});
test('adapter cannot impersonate second data source',async()=>{
  const adapters={ALERTA_RIO:async()=>({records:[
    observation('ALERTA_RIO',24),
    observation('DEFESA_CIVIL_RJ_REGIONAL',25)]})};
  const result=await consultRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',adapters,now:NOW});
  assert.notEqual(result.state,'TABLE1_TWO_COMPATIBLE_SOURCES');
});
