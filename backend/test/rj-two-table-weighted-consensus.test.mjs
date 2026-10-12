import test from 'node:test';
import assert from 'node:assert/strict';
import { rjTwoTableRouting } from '../src/rj-phenomenon-source-policy.mjs';
import { consultRjTwoTableSources } from '../src/rj-two-table-weighted-consensus.mjs';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';

const NOW=Date.parse('2026-10-12T18:00:00Z');
const observation=(sourceId,stationId,value,changes={})=>({
  sourceId,type:'OBSERVATION',origin:'OFFICIAL_OBSERVATION',
  stationId,originOrganization:sourceId,originObservationId:`${sourceId}-${stationId}-20261012T1745`,
  ibge:'3304557',variable:'TEMPERATURA_C',unit:'°C',value,
  weight:1,weightBasis:'DOCUMENTED_STATION_QC',
  observedAt:'2026-10-12T17:45:00Z',
  latitude:-22.9,longitude:-43.2,
  sourceUrl:'https://example.org/official-station-data',
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  ...changes,
});
const model=(sourceId,value,changes={})=>({
  sourceId,type:'FORECAST',kind:'MODEL_FORECAST',
  ibge:'3304557',variable:'TEMPERATURA_C',unit:'°C',value,
  modelFamilyId:sourceId==='OPENWEATHERMAP_API'?'OWM-ONECALL':'INPE-BRAMS',
  productId:`${sourceId}-product`,modelRunId:`${sourceId}-20261012T12`,
  issuedAt:'2026-10-12T12:00:00Z',
  validAt:'2026-10-12T18:00:00Z',
  latitude:-22.9,longitude:-43.2,gridResolutionKm:8,
  weight:0.5,weightBasis:'VERIFIED_HISTORICAL_SKILL_FOR_VARIABLE_LOCATION_AND_LEAD',
  skillEvidenceId:`${sourceId}-independent-historical-backtest`,
  sourceUrl:'https://example.org/model-data',
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  ...changes,
});
function adapterObs(...entries){return async()=>({observations:entries});}
function adapterModels(...entries){return async()=>({forecasts:entries});}
function run(adapters, ibge='3304557',phenomenon='TEMPERATURA') {
  return consultRjTwoTableSources({ibge,phenomenon,now:NOW,adapters});
}

test('Table1: Alerta Rio and Defesa Civil are P1, OpenWeatherMap third complementary source',()=>{
  const route=rjTwoTableRouting({ibge:'3304557',phenomenon:'TEMPERATURA'});
  assert.deepEqual(route.table1.map(s=>s.id),[
    'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','OPENWEATHERMAP_API']);
  assert.deepEqual(route.table2.map(s=>s.id),[
    'INPE_CPTEC_FORECAST','INMET_STATION','CEMADEN_RJ','WINDY_MODELO','NOAA']);
  assert.equal(route.maxInputsUsedInOneMean,2);
  assert.equal(route.table2InputsToConfirmOneTable1,1);
  assert.equal(route.realTimeConnectionsVerified,false);
});

test('compatible P1 Table1 pair gives mean of EXACTLY TWO and never contacts Table2',async()=>{
  const called=[];
  const r=await run({
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {observations:[
      observation('ALERTA_RIO','AR-01',24,{weight:1})]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA');return {observations:[
      observation('DEFESA_CIVIL_RJ_REGIONAL','DC-1',26,{weight:3})]};},
    OPENWEATHERMAP_API:async()=>{called.push('OPENWEATHER');throw Error('should not call');},
    INMET_STATION:async()=>{called.push('INMET');throw Error('should not call');},
  });
  assert.equal(r.status,'TWO_COMPATIBLE_OFFICIAL_OBSERVATIONS');
  assert.equal(r.agreementStage,'TABLE_1_JOINT_P1');
  assert.equal(r.weightedValue,25.5);
  assert.equal(r.weightedSourceCount,2);
  assert.deepEqual(r.usedSources.map(s=>s.sourceId),[
    'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']);
  assert.deepEqual(called,['ALERTA_RIO','DEFESA']);
  assert.equal(r.officialMeasurement,false);
  assert.equal(r.automaticAlertAuthorized,false);
});

test('when first two official sources disagree, just ONE compatible INMET in Table2 validates the weighted pair',async()=>{
  const called=[];
  const r=await run({
    ALERTA_RIO:async()=>{called.push('AR');return {observations:[observation('ALERTA_RIO','AR-1',23)]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DC');return {
      observations:[observation('DEFESA_CIVIL_RJ_REGIONAL','DC-1',32)]};},
    OPENWEATHERMAP_API:async()=>{called.push('OWM');return {
      forecasts:[model('OPENWEATHERMAP_API',29)]};},
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE');return {
      forecasts:[model('INPE_CPTEC_FORECAST',28)]};},
    INMET_STATION:async()=>{called.push('INMET');return {
      observations:[observation('INMET_STATION','IN-1',24,{weight:3})]};},
    CEMADEN_RJ:async()=>{called.push('CEMADEN');throw Error('should not call');},
    WINDY_MODELO:async()=>{called.push('WINDY');throw Error('should not call');},
  });
  assert.equal(r.status,'TWO_COMPATIBLE_OFFICIAL_OBSERVATIONS');
  assert.equal(r.agreementStage,'ONE_TABLE_1_PLUS_ONE_TABLE_2');
  assert.deepEqual(r.usedSources.map(s=>s.sourceId),['ALERTA_RIO','INMET_STATION']);
  assert.equal(r.weightedValue,23.75);
  assert.equal(r.table2UsedCount,1);
  assert.deepEqual(called,['AR','DC','OWM','INPE','INMET']);
  assert.equal(r.weightedSourceCount,2);
  assert.equal(r.municipalCoverageImplied,false);
});

test('CEMADEN is eligible as the one Table2 official confirmation when INMET fails',async()=>{
  const r=await run({
    ALERTA_RIO:adapterObs(observation('ALERTA_RIO','AR-1',25)),
    DEFESA_CIVIL_RJ_REGIONAL:adapterObs(
      observation('DEFESA_CIVIL_RJ_REGIONAL','DC-1',37)),
    INMET_STATION:adapterObs(observation('INMET_STATION','IN-1',40)),
    CEMADEN_RJ:adapterObs(observation('CEMADEN_RJ','CM-1',26)),
  });
  assert.equal(r.status,'TWO_COMPATIBLE_OFFICIAL_OBSERVATIONS');
  assert.equal(r.weightedValue,25.5);
  assert.deepEqual(r.usedSources.map(s=>s.sourceId),['ALERTA_RIO','CEMADEN_RJ']);
  assert.equal(r.table2UsedCount,1);
});

test('if Table1 station and INPE forecast agree numerically, show BOTH types but NEVER compute measured mean',async()=>{
  const r=await run({
    ALERTA_RIO:adapterObs(observation('ALERTA_RIO','AR-1',25)),
    INPE_CPTEC_FORECAST:adapterModels(model('INPE_CPTEC_FORECAST',25.4)),
  });
  assert.equal(r.status,'OFFICIAL_READING_CORROBORATED_BY_MODEL_NO_WEIGHTED_MEASUREMENT');
  assert.equal(r.weightedValue,null);
  assert.equal(r.usedSources.length,2);
  assert.deepEqual(r.usedSources.map(s=>s.type),['OBSERVATION','FORECAST']);
  assert.equal(r.automaticAlertAuthorized,false);
});

test('OpenWeatherMap + INPE forecasts can average as TWO FORECASTS only when independent and calibrated',async()=>{
  const r=await run({
    OPENWEATHERMAP_API:adapterModels(model('OPENWEATHERMAP_API',25,{weight:0.4})),
    INPE_CPTEC_FORECAST:adapterModels(model('INPE_CPTEC_FORECAST',26,{weight:0.6})),
  });
  assert.equal(r.status,'TWO_INDEPENDENT_COMPATIBLE_FORECASTS');
  assert.equal(r.weightedSourceCount,2);
  assert.equal(r.weightedValue,25.6);
  assert.deepEqual(r.usedSources.map(s=>s.sourceId),[
    'OPENWEATHERMAP_API','INPE_CPTEC_FORECAST']);
  assert.equal(r.officialMeasurement,false);
  assert.equal(r.estimateKind,'WEIGHTED_FORECAST_ONLY_NOT_OFFICIAL_OBSERVATION');
});

test('two brands carrying same underlying official observation do not provide two independent measurements',async()=>{
  const same={
    originOrganization:'ALERTA_RIO',
    originObservationId:'ALERTA_RIO-AR-1-20261012T1745',
  };
  const r=await run({
    ALERTA_RIO:adapterObs(observation('ALERTA_RIO','AR-1',26)),
    DEFESA_CIVIL_RJ_REGIONAL:adapterObs(
      observation('DEFESA_CIVIL_RJ_REGIONAL','DC-1',26.5,same)),
  });
  assert.equal(r.weightedValue,null);
  assert.equal(r.status,'TWO_COMPATIBLE_SOURCES_NOT_FOUND');
  assert.equal(r.automaticAlertAuthorized,false);
});

test('single provider cannot forge Table2 confirmation through Table1 adapter response',async()=>{
  const r=await run({
    ALERTA_RIO:async()=>({observations:[
      observation('ALERTA_RIO','AR-1',25),
      observation('INMET_STATION','FORGED',25.1),
    ]}),
  });
  assert.equal(r.weightedValue,null);
  assert.equal(r.usedSources.length,0);
});

test('one model does not count as a second measured value, and repeated forecast family blocks model average',async()=>{
  const r=await run({
    OPENWEATHERMAP_API:adapterModels(model('OPENWEATHERMAP_API',25)),
    INPE_CPTEC_FORECAST:adapterModels(model('INPE_CPTEC_FORECAST',25,{
      modelFamilyId:'OWM-ONECALL',
    })),
  });
  assert.equal(r.weightedValue,null);
  assert.equal(r.status,'NO_VERIFIED_OBSERVATION_AVAILABLE');
});

test('stale, wrong municipality, unlicensed or badly timed products cannot generate calculations',async()=>{
  const invalid=[
    {ibge:'4106902'},{usagePermissionStatus:'PUBLICLY_AVAILABLE'},
    {observedAt:'2026-10-11T15:00:00Z'},{weightBasis:'UNKNOWN'},
    {latitude:0},{sourceUrl:'http://example.org/data'},
  ];
  for(const change of invalid){
    const r=await run({
      ALERTA_RIO:adapterObs(observation('ALERTA_RIO','AR-1',25,change)),
      INMET_STATION:adapterObs(observation('INMET_STATION','IN-1',25.4)),
    });
    assert.equal(r.weightedValue,null);
  }
});

test('warning category, hail and thermal sensation require distinct hazard or physical derivation, never mean',async()=>{
  for(const phenomenon of ['TEMPORAL','GRANIZO','SENSACAO_TERMICA']){
    const r=await run({},'3304557',phenomenon);
    assert.equal(r.status,'NON_NUMERIC_OR_DERIVED_PHENOMENON_NO_WEIGHTED_MEAN');
    assert.equal(r.weightedValue,null);
    assert.equal(r.automaticAlertAuthorized,false);
  }
});

test('all 92 RJ municipalities route with Alerta Rio excluded outside the city of Rio',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES) {
    const route=rjTwoTableRouting({ibge,phenomenon:'TEMPERATURA'});
    assert.equal(route.table1.some(x=>x.id==='ALERTA_RIO'),ibge==='3304557');
    assert.equal(route.table2.length,5);
  }
  assert.throws(()=>rjTwoTableRouting({ibge:'4106902',phenomenon:'TEMPERATURA'}));
});
