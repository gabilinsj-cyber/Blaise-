import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  RJ_TABLE1_THREE,RJ_TABLE2_FIVE,
  resolveRjTable12FiveSourceDispute,consultRjTable12FiveSourceDispute,
} from '../src/rj-table12-five-source-dispute.mjs';

const NOW=Date.parse('2026-10-12T12:10:00Z');
const O=(sourceId,value,change={})=>({
  sourceId,origin:'OFFICIAL_OBSERVATION',
  stationId:sourceId+'-STATION',ibge:'3304557',
  variable:'TEMPERATURA_C',unit:'°C',value,
  observedAt:'2026-10-12T12:00:00Z',latitude:-22.9,longitude:-43.2,
  sourceUrl:'https://valid.example/stations/'+sourceId,
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',...change,
});
const M=(sourceId,value,change={})=>({
  sourceId,kind:'MODEL_FORECAST',ibge:'3304557',
  variable:'TEMPERATURA_C',unit:'°C',value,
  productId:sourceId+'-forecast',modelFamilyId:sourceId+'-model',
  issuedAt:'2026-10-12T11:30:00Z',validAt:'2026-10-12T12:00:00Z',
  latitude:-22.9,longitude:-43.2,gridResolutionKm:10,
  sourceUrl:'https://models.example/'+sourceId,
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  weightBasis:'VERIFIED_HISTORICAL_SKILL_FOR_VARIABLE_LOCATION_AND_LEAD',
  skillEvidenceId:sourceId+'-backtest',...change,
});
const input=(extra={})=>({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,...extra});

test('approved RJ hierarchy keeps three first OFFICIAL feeds, then INPE, then Windy; OWM is separate supplement',()=>{
  assert.deepEqual(RJ_TABLE1_THREE,['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']);
  assert.deepEqual(RJ_TABLE2_FIVE,
    ['INPE_CPTEC_FORECAST','WINDY_MODELO','CEMADEN_RJ','NOAA','OPENWEATHERMAP_API']);
});
test('two compatible official observations stop before INMET/INPE/Windy and produce an arithmetic estimate',async()=>{
  const called=[];
  const r=await consultRjTable12FiveSourceDispute(input({adapters:{
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {observations:[O('ALERTA_RIO',28)]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA_CIVIL');return {observations:[O('DEFESA_CIVIL_RJ_REGIONAL',29)]};},
    INMET_STATION:async()=>{throw Error('must not query INMET after first valid pair');},
    INPE_CPTEC_FORECAST:async()=>{throw Error('must not query INPE after first valid pair');},
  }}));
  assert.equal(r.state,'TWO_INDEPENDENT_COMPARABLE_OBSERVATIONS');
  assert.equal(r.stage,'TABLE_1_TWO_OF_THREE_CONVERGED');
  assert.equal(r.estimatedValue,28.5);
  assert.equal(r.formula,'(value_a+value_b)/2');
  assert.deepEqual(called,['ALERTA_RIO','DEFESA_CIVIL']);
  assert.equal(r.calculatedNotOfficialMeasurement,true);
  assert.equal(r.safeForAutomaticWarning,false);
});
test('INMET (third official) is queried before INPE if Alerta Rio and Defesa Civil disagree',async()=>{
  const called=[];
  const r=await consultRjTable12FiveSourceDispute(input({adapters:{
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {observations:[O('ALERTA_RIO',21)]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA_CIVIL');return {observations:[O('DEFESA_CIVIL_RJ_REGIONAL',31)]};},
    INMET_STATION:async()=>{called.push('INMET');return {observations:[O('INMET_STATION',22)]};},
    INPE_CPTEC_FORECAST:async()=>{throw Error('INPE not needed');},
  }}));
  assert.deepEqual(called,['ALERTA_RIO','DEFESA_CIVIL','INMET']);
  assert.deepEqual(r.selectedSources,['ALERTA_RIO','INMET_STATION']);
  assert.equal(r.estimatedValue,21.5);
  assert.equal(r.stage,'TABLE_1_TWO_OF_THREE_CONVERGED');
});
test('weighted mean requires explicit quality weights and never uses an INPE/Windy model as sensor',()=>{
  const q={qualityWeightBasis:'VERIFIED_STATION_QC_AND_LOCAL_SKILL',qualityEvidenceId:'backtest'};
  const r=resolveRjTable12FiveSourceDispute(input({
    observations:[O('ALERTA_RIO',24,{...q,qualityWeight:3}),
      O('DEFESA_CIVIL_RJ_REGIONAL',26,{...q,qualityWeight:1})],
    forecasts:[M('INPE_CPTEC_FORECAST',50)],
  }));
  assert.equal(r.estimatedValue,24.5);
  assert.equal(r.weighted,true);
  assert.deepEqual(r.selectedSources,['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']);
});
test('INPE is the first forecast tie-break after all three official sources fail to converge',async()=>{
  const called=[];
  const r=await consultRjTable12FiveSourceDispute(input({adapters:{
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {observations:[O('ALERTA_RIO',22)]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA_CIVIL');return {observations:[O('DEFESA_CIVIL_RJ_REGIONAL',31)]};},
    INMET_STATION:async()=>{called.push('INMET');return {observations:[O('INMET_STATION',40)]};},
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE');return {forecasts:[M('INPE_CPTEC_FORECAST',23)]};},
    WINDY_MODELO:async()=>{throw Error('should not consult Windy after useful INPE product');},
  }}));
  assert.deepEqual(called,['ALERTA_RIO','DEFESA_CIVIL','INMET','INPE']);
  assert.equal(r.state,'OFFICIAL_OR_VETTED_READING_WITH_MODEL_REFERENCE');
  assert.deepEqual(r.selectedSources,['ALERTA_RIO','INPE_CPTEC_FORECAST']);
  assert.equal(r.estimatedValue,null);
  assert.equal(r.weighted,false);
  assert.deepEqual(r.readingAndForecast.map(x=>x.type),
    ['OBSERVED_STATION','MODEL_FORECAST_NOT_A_SENSOR']);
  assert.equal(r.originalPrimaryReadings.length,3);
});
test('if INPE is inconclusive Windy is consulted next before CEMADEN/NOAA/OWM',async()=>{
  const called=[];
  const r=await consultRjTable12FiveSourceDispute(input({adapters:{
    ALERTA_RIO:async()=>({observations:[O('ALERTA_RIO',20)]}),
    DEFESA_CIVIL_RJ_REGIONAL:async()=>({observations:[O('DEFESA_CIVIL_RJ_REGIONAL',32)]}),
    INMET_STATION:async()=>({observations:[O('INMET_STATION',44)]}),
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE');return {forecasts:[M('INPE_CPTEC_FORECAST',26)]};},
    WINDY_MODELO:async()=>{called.push('WINDY');return {forecasts:[M('WINDY_MODELO',21)]};},
    CEMADEN_RJ:async()=>{throw Error('stop after matching Windy');},
  }}));
  assert.deepEqual(called,['INPE','WINDY']);
  assert.deepEqual(r.selectedSources,['ALERTA_RIO','WINDY_MODELO']);
  assert.equal(r.estimatedValue,null);
  assert.equal(r.safeForAutomaticWarning,false);
});
test('specialist CEMADEN and NOAA remain eligible only after primary and comparison steps fail',async()=>{
  const called=[];
  const r=await consultRjTable12FiveSourceDispute(input({adapters:{
    ALERTA_RIO:async()=>({observations:[O('ALERTA_RIO',19)]}),
    DEFESA_CIVIL_RJ_REGIONAL:async()=>({observations:[O('DEFESA_CIVIL_RJ_REGIONAL',32)]}),
    INMET_STATION:async()=>({observations:[O('INMET_STATION',44)]}),
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE');return {forecasts:[M('INPE_CPTEC_FORECAST',25)]};},
    WINDY_MODELO:async()=>{called.push('WINDY');return {forecasts:[M('WINDY_MODELO',25)]};},
    CEMADEN_RJ:async()=>{called.push('CEMADEN');return {observations:[O('CEMADEN_RJ',25)]};},
    NOAA:async()=>{called.push('NOAA');return {forecasts:[M('NOAA',31)]};},
    OPENWEATHERMAP_API:async()=>{throw Error('stop before optional OWM');},
  }}));
  assert.deepEqual(called,['INPE','WINDY','CEMADEN','NOAA']);
  assert.deepEqual(r.selectedSources,['DEFESA_CIVIL_RJ_REGIONAL','NOAA']);
  assert.equal(r.estimatedValue,null);
});
test('OpenWeatherMap model product never becomes a second official station',()=>{
  const r=resolveRjTable12FiveSourceDispute(input({
    observations:[O('ALERTA_RIO',20)],
    forecasts:[M('OPENWEATHERMAP_API',20)],
  }));
  assert.equal(r.estimatedValue,null);
  assert.equal(r.state,'OFFICIAL_OR_VETTED_READING_WITH_MODEL_REFERENCE');
  assert.deepEqual(r.readingAndForecast.map(x=>x.type),
    ['OBSERVED_STATION','MODEL_FORECAST_NOT_A_SENSOR']);
});
test('independent OpenWeatherMap raw station requires distinct upstream origin, product license and station identity',()=>{
  const official=[O('ALERTA_RIO',20),O('DEFESA_CIVIL_RJ_REGIONAL',29)];
  const raw=O('OPENWEATHERMAP_API',21,{
    origin:'INDEPENDENT_STATION_OBSERVATION',rawStationObservation:true,
    independenceVerified:true,underlyingProviderId:'INDEPENDENT_NETWORK',
    upstreamMeasurementId:'OWM-TEST-1',
  });
  const successful=resolveRjTable12FiveSourceDispute(input({
    observations:[...official,raw],
  }));
  assert.equal(successful.state,'TWO_INDEPENDENT_COMPARABLE_OBSERVATIONS');
  assert.equal(successful.stage,'TABLE_2_OBSERVED_DISPUTE_RESOLVED');
  assert.deepEqual(successful.selectedSources,['ALERTA_RIO','OPENWEATHERMAP_API']);
  const reused=resolveRjTable12FiveSourceDispute(input({
    observations:[...official,{...raw,underlyingProviderId:'ALERTA_RIO'}],
  }));
  assert.equal(reused.state,'NO_VERIFIABLE_CONVERGENCE');
});
test('cross-city stale incomplete hourly rainfall wrong units and missing license never yield a blended value',()=>{
  for(const change of [
    {observedAt:'2026-10-11T11:59:00Z'}, {ibge:'4106902'},
    {unit:'m/s'}, {usagePermissionStatus:'UNKNOWN'}, {latitude:0},
  ]) {
    const r=resolveRjTable12FiveSourceDispute(input({observations:[
      O('ALERTA_RIO',28),O('DEFESA_CIVIL_RJ_REGIONAL',29,change),
    ]}));
    assert.equal(r.estimatedValue,null);
    assert.equal(r.safeForAutomaticWarning,false);
  }
  const rain=resolveRjTable12FiveSourceDispute({
    ibge:'3304557',variable:'CHUVA_MM_1H',now:NOW,
    observations:[O('ALERTA_RIO',10,{variable:'CHUVA_MM_1H',unit:'mm',measurementWindowMinutes:60}),
      O('DEFESA_CIVIL_RJ_REGIONAL',11,{variable:'CHUVA_MM_1H',unit:'mm',measurementWindowMinutes:15})],
  });
  assert.equal(rain.estimatedValue,null);
});
test('all 92 RJ cities support local selection and Alerta Rio never appears as an observation outside Rio city',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const city of RJ_MUNICIPALITIES) {
    const r=resolveRjTable12FiveSourceDispute({ibge:city.ibge,variable:'TEMPERATURA_C',now:NOW});
    assert.equal(r.state,'NO_VERIFIABLE_CONVERGENCE');
    assert.equal(r.consultedSources.includes('ALERTA_RIO'),city.ibge==='3304557');
  }
});
test('warnings, storms and tsunami cannot be assigned an observed weighted-average meteorological value',()=>{
  for(const variable of ['TEMPORAL','GRANIZO','TSUNAMI','SENSACAO_TERMICA']){
    assert.throws(()=>resolveRjTable12FiveSourceDispute(input({variable})),
      /rj_table12_variable_not_numeric_or_not_supported/);
  }
});
