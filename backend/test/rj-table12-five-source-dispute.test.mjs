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
  stationId:sourceId+'-STATION',
  ibge:'3304557',variable:'TEMPERATURA_C',unit:'°C',value,
  observedAt:'2026-10-12T12:09:00Z',latitude:-22.9,longitude:-43.2,
  sourceUrl:'https://valid.example/stations/'+sourceId,
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  qualityWeight:1,qualityWeightBasis:'VERIFIED_STATION_QC_AND_LOCAL_SKILL',
  qualityEvidenceId:'fixture-verified-qc',...change,
});
const M=(sourceId,value,change={})=>({
  sourceId,kind:'MODEL_FORECAST',ibge:'3304557',
  variable:'TEMPERATURA_C',unit:'°C',value,
  productId:sourceId+'-forecast',modelFamilyId:sourceId+'-model',
  observedAt:null,issuedAt:'2026-10-12T11:30:00Z',
  validAt:'2026-10-12T12:00:00Z',
  latitude:-22.9,longitude:-43.2,gridResolutionKm:10,
  sourceUrl:'https://models.example/'+sourceId,
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  weightBasis:'VERIFIED_HISTORICAL_SKILL_FOR_VARIABLE_LOCATION_AND_LEAD',
  skillEvidenceId:sourceId+'-backtest',...change,
});
const input=(extra={})=>({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,...extra});
test('Table 1 has three; dispute Table 2 has FIVE in priority order INPE INMET CEMADEN Windy NOAA',()=>{
  assert.deepEqual(RJ_TABLE1_THREE,[
    'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','OPENWEATHERMAP_API']);
  assert.deepEqual(RJ_TABLE2_FIVE,[
    'INPE_CPTEC_FORECAST','INMET_STATION','CEMADEN_RJ','WINDY_MODELO','NOAA']);
});
test('two compatible independent Table 1 readings immediately calculate verified weighted mean without ANY dispute queries',async()=>{
  const calls=[];
  const output=await consultRjTable12FiveSourceDispute(input({
    adapters:{
      ALERTA_RIO:async()=>{calls.push('ALERTA_RIO');return {
        observations:[O('ALERTA_RIO',28)]};},
      DEFESA_CIVIL_RJ_REGIONAL:async()=>{calls.push('DEFESA_CIVIL_RJ_REGIONAL');return {
        observations:[O('DEFESA_CIVIL_RJ_REGIONAL',29)]};},
      OPENWEATHERMAP_API:async()=>{throw Error('should not call third');},
      INPE_CPTEC_FORECAST:async()=>{throw Error('should not request models');},
    },
  }));
  assert.equal(output.state,'TWO_INDEPENDENT_COMPARABLE_OBSERVATIONS');
  assert.equal(output.stage,'TABLE_1_TWO_OF_THREE_CONVERGED');
  assert.equal(output.estimatedValue,28.5);
  assert.equal(output.formula,'SUM(weight*value)/SUM(weights)');
  assert.deepEqual(calls,['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']);
  assert.equal(output.selectedSources.length,2);
  assert.equal(output.originalPrimaryReadings.length,2);
  assert.equal(output.safeForAutomaticWarning,false);
});
test('justified weights use official observations, never model values',()=>{
  const q={qualityWeightBasis:'VERIFIED_STATION_QC_AND_LOCAL_SKILL',qualityEvidenceId:'backtest-valid'};
  const r=resolveRjTable12FiveSourceDispute(input({
    observations:[O('ALERTA_RIO',24,{...q,qualityWeight:3}),
      O('DEFESA_CIVIL_RJ_REGIONAL',26,{...q,qualityWeight:1})],
  }));
  assert.equal(r.state,'TWO_INDEPENDENT_COMPARABLE_OBSERVATIONS');
  assert.equal(r.estimatedValue,24.5);
  assert.equal(r.weighted,true);
  assert.equal(r.formula,'SUM(weight*value)/SUM(weights)');
});
test('in dispute INPE FIRST supports one of three primaries, exposing reading + FORECAST with no mixed mean',async()=>{
  const calls=[],observations=[O('ALERTA_RIO',22),O('DEFESA_CIVIL_RJ_REGIONAL',31)];
  const byId=Object.fromEntries(observations.map(x=>[x.sourceId,x]));
  const adapters={
    ALERTA_RIO:async()=>{calls.push('ALERTA_RIO');return {observations:[byId.ALERTA_RIO]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{calls.push('DEFESA_CIVIL');return {observations:[byId.DEFESA_CIVIL_RJ_REGIONAL]};},
    OPENWEATHERMAP_API:async()=>{calls.push('OPENWEATHERMAP');return {forecasts:[M('OPENWEATHERMAP_API',26)]};},
    INPE_CPTEC_FORECAST:async()=>{calls.push('INPE');return {forecasts:[M('INPE_CPTEC_FORECAST',23)]};},
    INMET_STATION:async()=>{throw Error('INMET should be skipped after INPE comparator success');},
  };
  const r=await consultRjTable12FiveSourceDispute(input({adapters}));
  assert.deepEqual(calls,['ALERTA_RIO','DEFESA_CIVIL','OPENWEATHERMAP','INPE']);
  assert.deepEqual(r.selectedSources,['ALERTA_RIO','INPE_CPTEC_FORECAST']);
  assert.equal(r.estimatedValue,null);
  assert.equal(r.weighted,false);
  assert.deepEqual(r.readingAndForecast.map(x=>x.type),[
    'OBSERVED_STATION','MODEL_FORECAST_NOT_A_SENSOR']);
  assert.equal(r.originalPrimaryReadings.length,2);
});
test('when INPE inconclusive, INMET comparison confirms one of the three primaries with observed average',async()=>{
  const calls=[];
  const adapters={
    ALERTA_RIO:async()=>{calls.push('ALERTA_RIO');return {observations:[O('ALERTA_RIO',21)]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{calls.push('DEFESA_CIVIL');return {observations:[O('DEFESA_CIVIL_RJ_REGIONAL',31)]};},
    INPE_CPTEC_FORECAST:async()=>{calls.push('INPE');return {forecasts:[M('INPE_CPTEC_FORECAST',26)]};},
    INMET_STATION:async()=>{calls.push('INMET');return {observations:[O('INMET_STATION',22)]};},
    CEMADEN_RJ:async()=>{throw Error('should stop after INMET');},
  };
  const r=await consultRjTable12FiveSourceDispute(input({adapters}));
  assert.deepEqual(calls,['ALERTA_RIO','DEFESA_CIVIL','INPE','INMET']);
  assert.deepEqual(r.selectedSources,['ALERTA_RIO','INMET_STATION']);
  assert.equal(r.estimatedValue,21.5);
  assert.equal(r.stage,'TABLE_2_OBSERVED_DISPUTE_RESOLVED');
});
test('NOAA last: if prior four comparators do not match a Table 1 reading, NOAA product may provide labeled model context',async()=>{
  const calls=[];
  const adapters={
    ALERTA_RIO:async()=>({observations:[O('ALERTA_RIO',19)]}),
    DEFESA_CIVIL_RJ_REGIONAL:async()=>({observations:[O('DEFESA_CIVIL_RJ_REGIONAL',32)]}),
    INPE_CPTEC_FORECAST:async()=>{calls.push('INPE');return {forecasts:[M('INPE_CPTEC_FORECAST',25)]};},
    INMET_STATION:async()=>{calls.push('INMET');return {observations:[O('INMET_STATION',25)]};},
    CEMADEN_RJ:async()=>{calls.push('CEMADEN');return {observations:[O('CEMADEN_RJ',25)]};},
    WINDY_MODELO:async()=>{calls.push('Windy');return {forecasts:[M('WINDY_MODELO',25)]};},
    NOAA:async()=>{calls.push('NOAA');return {forecasts:[M('NOAA',31)]};},
  };
  const r=await consultRjTable12FiveSourceDispute(input({adapters}));
  assert.deepEqual(calls,['INPE','INMET','CEMADEN','Windy','NOAA']);
  assert.equal(r.state,'OFFICIAL_OR_VETTED_READING_WITH_MODEL_REFERENCE');
  assert.deepEqual(r.selectedSources,['DEFESA_CIVIL_RJ_REGIONAL','NOAA']);
  assert.equal(r.estimatedValue,null);
  assert.equal(r.originalPrimaryReadings.length,2);
});
test('OWM as a raw third provider must prove independent sensor, license and unique upstream ID',()=>{
  const primary=[O('ALERTA_RIO',20),O('DEFESA_CIVIL_RJ_REGIONAL',29)];
  const fake=O('OPENWEATHERMAP_API',21,{
    origin:'INDEPENDENT_STATION_OBSERVATION',rawStationObservation:true,
    independenceVerified:false,underlyingProviderId:'INDEPENDENT',
    upstreamMeasurementId:'OWM-STATION-1',
  });
  const r=resolveRjTable12FiveSourceDispute(input({observations:[...primary,fake]}));
  assert.equal(r.state,'NO_VERIFIABLE_CONVERGENCE');
  const real=resolveRjTable12FiveSourceDispute(input({
    observations:[...primary,{...fake,independenceVerified:true}],
  }));
  assert.equal(real.state,'TWO_INDEPENDENT_COMPARABLE_OBSERVATIONS');
  assert.equal(real.estimatedValue,20.5);
  assert.deepEqual(real.selectedSources,['ALERTA_RIO','OPENWEATHERMAP_API']);
  assert.equal(real.mayClaimOfficialMunicipalMeasurement,false);
  const copied=resolveRjTable12FiveSourceDispute(input({
    observations:[...primary,{...fake,independenceVerified:true,
      underlyingProviderId:'ALERTA_RIO'}],
  }));
  assert.equal(copied.state,'NO_VERIFIABLE_CONVERGENCE');
});
test('never average stale, cross-city, incomplete accumulation or divergent model and station readings',()=>{
  for(const change of [
    {observedAt:'2026-10-11T11:59:00Z'},
    {ibge:'4106902'},{unit:'m/s'},
    {usagePermissionStatus:'UNKNOWN'},
    {latitude:0},
  ]){
    const r=resolveRjTable12FiveSourceDispute(input({observations:[
      O('ALERTA_RIO',28),
      O('DEFESA_CIVIL_RJ_REGIONAL',29,change),
    ]}));
    assert.equal(r.state,'NO_VERIFIABLE_CONVERGENCE');
    assert.equal(r.safeForAutomaticWarning,false);
  }
  const rain=resolveRjTable12FiveSourceDispute({
    ibge:'3304557',variable:'CHUVA_MM_1H',now:NOW,
    observations:[O('ALERTA_RIO',10,{variable:'CHUVA_MM_1H',unit:'mm',
      measurementWindowMinutes:60}),O('DEFESA_CIVIL_RJ_REGIONAL',11,{
        variable:'CHUVA_MM_1H',unit:'mm',measurementWindowMinutes:15})],
  });
  assert.equal(rain.estimatedValue,null);
});
test('municipal hierarchy never assigns Alerta Rio to the other 91 municipalities',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const city of RJ_MUNICIPALITIES){
    const r=resolveRjTable12FiveSourceDispute({
      ibge:city.ibge,variable:'TEMPERATURA_C',now:NOW,
    });
    assert.equal(r.state,'NO_VERIFIABLE_CONVERGENCE');
    assert.equal(r.consultedSources.includes('ALERTA_RIO'),city.ibge==='3304557');
  }
});
test('alerts, granizo, tsunami and qualitative storms are never numerically averaged',()=>{
  for(const variable of ['TEMPORAL','GRANIZO','TSUNAMI','SENSACAO_TERMICA']){
    assert.throws(()=>resolveRjTable12FiveSourceDispute(input({variable})),
      /rj_table12_variable_not_numeric_or_not_supported/);
  }
});

test('missing weight evidence displays two real readings without inventing weights or a mean',()=>{
  const r=resolveRjTable12FiveSourceDispute(input({observations:[
    O('ALERTA_RIO',28,{qualityWeight:undefined}),
    O('DEFESA_CIVIL_RJ_REGIONAL',29),
  ]}));
  assert.equal(r.estimatedValue,null);
  assert.equal(r.weighted,false);
  assert.equal(r.measurementPair.length,2);
  assert.equal(r.calculationStatus,'WEIGHT_EVIDENCE_MISSING_SHOW_READINGS');
});
test('a stale primary is skipped and a current independent INMET reading replaces it',async()=>{
  const calls=[];
  const r=await consultRjTable12FiveSourceDispute(input({adapters:{
    ALERTA_RIO:async()=>({observations:[O('ALERTA_RIO',28)]}),
    DEFESA_CIVIL_RJ_REGIONAL:async()=>({observations:[
      O('DEFESA_CIVIL_RJ_REGIONAL',29,{observedAt:'2026-10-12T12:04:00Z'})]}),
    INMET_STATION:async()=>{calls.push('INMET');return {observations:[O('INMET_STATION',29)]};},
  }}));
  assert.deepEqual(calls,['INMET']);
  assert.deepEqual(r.selectedSources,['ALERTA_RIO','INMET_STATION']);
  assert.equal(r.weighted,true);
});
test('recent HTTP consultation cannot revive an old or future observation',()=>{
  for(const observedAt of ['2026-10-12T12:04:59Z','2026-10-12T12:10:01Z']){
    const r=resolveRjTable12FiveSourceDispute(input({observations:[
      O('ALERTA_RIO',28),O('DEFESA_CIVIL_RJ_REGIONAL',29,{observedAt,fetchedAt:'2026-10-12T12:10:00Z'}),
    ]}));
    assert.equal(r.estimatedValue,null);
    assert.equal(r.state,'NO_VERIFIABLE_CONVERGENCE');
  }
});
