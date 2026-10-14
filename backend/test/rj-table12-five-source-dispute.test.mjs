import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  RJ_TABLE1_THREE,RJ_TABLE2_FIVE,RJ_TABLE2_PROVIDER_ROLES,
  rjTable2EligibleSources,
  resolveRjTable12FiveSourceDispute,consultRjTable12FiveSourceDispute,
} from '../src/rj-table12-five-source-dispute.mjs';

const NOW=Date.parse('2026-10-12T12:10:00Z');
const O=(sourceId,value,change={})=>({
  sourceId,origin:'OFFICIAL_OBSERVATION',
  stationId:sourceId+'-STATION',
  ibge:'3304557',variable:'TEMPERATURA_C',unit:'°C',value,
  observedAt:'2026-10-12T12:00:00Z',latitude:-22.9,longitude:-43.2,
  sourceUrl:'https://valid.example/stations/'+sourceId,
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',...change,
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
test('Table 2 roles remain INPE, INMET, CEMADEN, Windy, NOAA, preserving observed vs modeled nature',()=>{
  assert.deepEqual(RJ_TABLE2_PROVIDER_ROLES.map(x=>x.id),RJ_TABLE2_FIVE);
  assert.deepEqual(RJ_TABLE2_PROVIDER_ROLES.map(x=>x.order),[1,2,3,4,5]);
  assert.equal(RJ_TABLE2_PROVIDER_ROLES.find(x=>x.id==='INMET_STATION').kind,
    'OFFICIAL_STATION_OBSERVATION');
  assert.equal(RJ_TABLE2_PROVIDER_ROLES.find(x=>x.id==='WINDY_MODELO').kind,
    'THIRD_PARTY_MODEL_COMPARISON');
});
test('CEMADEN is third dispute check for rain but not a universal temp, pressure or wind sensor',()=>{
  assert.deepEqual(rjTable2EligibleSources({variable:'CHUVA_MM_1H'}),RJ_TABLE2_FIVE);
  for(const variable of ['TEMPERATURA_C','UMIDADE_PERCENTUAL','VENTO_KMH','RAJADA_KMH','PRESSAO_HPA']){
    const sources=rjTable2EligibleSources({variable});
    assert.equal(sources.includes('CEMADEN_RJ'),false);
    assert.deepEqual(sources,['INPE_CPTEC_FORECAST','INMET_STATION','WINDY_MODELO','NOAA']);
  }
  assert.throws(()=>rjTable2EligibleSources({variable:'TSUNAMI'}),TypeError);
});
test('temperature consultation skips CEMADEN, reaches Windy fourth, and stops before NOAA',async()=>{
  const called=[];
  const adapters={
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {observations:[O('ALERTA_RIO',22)]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA_CIVIL');return {observations:[O('DEFESA_CIVIL_RJ_REGIONAL',31)]};},
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE');return {forecasts:[M('INPE_CPTEC_FORECAST',26)]};},
    INMET_STATION:async()=>{called.push('INMET');return {observations:[O('INMET_STATION',25)]};},
    CEMADEN_RJ:async()=>{called.push('CEMADEN');throw Error('rain product must not be queried for temperature');},
    WINDY_MODELO:async()=>{called.push('WINDY');return {forecasts:[M('WINDY_MODELO',23)]};},
    NOAA:async()=>{called.push('NOAA');throw Error('NOAA must not be queried after Windy match');},
  };
  const result=await consultRjTable12FiveSourceDispute(input({adapters}));
  assert.deepEqual(called,['ALERTA_RIO','DEFESA_CIVIL','INPE','INMET','WINDY']);
  assert.deepEqual(result.selectedSources,['ALERTA_RIO','WINDY_MODELO']);
  assert.deepEqual(result.readingAndForecast.map(x=>x.type),
    ['OBSERVED_STATION','MODEL_FORECAST_NOT_A_SENSOR']);
  assert.equal(result.safeForAutomaticWarning,false);
});
test('rain-specific CEMADEN can corroborate existing P1 rain window after INPE and INMET cannot',async()=>{
  const rain=(sourceId,mm)=>O(sourceId,mm,{
    variable:'CHUVA_MM_1H',unit:'mm',measurementWindowMinutes:60,
  });
  const model=(sourceId,mm)=>M(sourceId,mm,{
    variable:'CHUVA_MM_1H',unit:'mm',forecastWindowMinutes:60,
  });
  const called=[];
  const adapters={
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {observations:[rain('ALERTA_RIO',2)]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA_CIVIL');return {observations:[rain('DEFESA_CIVIL_RJ_REGIONAL',20)]};},
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE');return {forecasts:[model('INPE_CPTEC_FORECAST',11)]};},
    INMET_STATION:async()=>{called.push('INMET');return {observations:[rain('INMET_STATION',32)]};},
    CEMADEN_RJ:async()=>{called.push('CEMADEN');return {observations:[rain('CEMADEN_RJ',21)]};},
    WINDY_MODELO:async()=>{called.push('WINDY');throw Error('stop after CEMADEN');},
  };
  const result=await consultRjTable12FiveSourceDispute({
    ibge:'3304557',variable:'CHUVA_MM_1H',adapters,now:NOW,
  });
  assert.deepEqual(called,['ALERTA_RIO','DEFESA_CIVIL','INPE','INMET','CEMADEN']);
  assert.deepEqual(result.selectedSources,['DEFESA_CIVIL_RJ_REGIONAL','CEMADEN_RJ']);
  assert.equal(result.estimatedValue,20.5);
  assert.equal(result.stage,'TABLE_2_OBSERVED_DISPUTE_RESOLVED');
  assert.equal(result.safeForAutomaticWarning,false);
});
test('two compatible independent Table 1 readings immediately calculate arithmetic mean without ANY dispute queries',async()=>{
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
  assert.equal(output.formula,'(value_a+value_b)/2');
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
  // Temperature is not a verified CEMADEN pluviometer variable:
  // the canonical Table 2 still has five sources, but this product-specific
  // consultation correctly skips CEMADEN (rainfall-only).
  assert.deepEqual(calls,['INPE','INMET','Windy','NOAA']);
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
