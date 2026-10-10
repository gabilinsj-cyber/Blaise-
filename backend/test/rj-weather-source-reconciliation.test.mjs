import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import {
  assessRjMeteorologicalDisagreement,
  weightedComparableForecastMean,
  compareInpeWindyToDiscrepantObservations,
} from '../src/rj-weather-source-reconciliation.mjs';

const NOW=Date.parse('2026-10-10T18:00:00Z');
const obs=(id,value,change={})=>({
  origin:'OFFICIAL_OBSERVATION',
  sourceId:id==='A652'?'INMET':'DEFESA_CIVIL',
  stationId:id, ibge:'3304557',variable:'TEMPERATURA_C',unit:'°C',value,
  weight:1,observedAt:'2026-10-10T17:30:00Z',
  latitude:-22.9,longitude:-43.2,
  sourceUrl:'https://apitempo.inmet.gov.br/estacao/simulated-test-only',
  ...change,
});
const forecast=(sourceId,value,change={})=>({
  kind:'MODEL_FORECAST',sourceId,productId:`${sourceId}_TEMP_PRODUCT`,
  modelRunId:'2026-10-10T12:00Z',ibge:'3304557',variable:'TEMPERATURA_C',unit:'°C',value,
  issuedAt:'2026-10-10T12:00:00Z', validAt:'2026-10-10T18:00:00Z',
  sourceUrl:'https://www.cptec.inpe.br/',
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  weight:0.5,weightBasis:'VERIFIED_HISTORICAL_SKILL_FOR_VARIABLE_LOCATION_AND_LEAD',
  skillEvidenceId:'historical-backtest-id',
  ...change,
});
const triangulation=(sourceId,value,changes={})=>forecast(sourceId,value,{
  modelFamilyId:sourceId==='INPE_CPTEC_FORECAST'?'INPE-BRAMS':'ECMWF-IFS',
  skillEvidenceId:'documented-independent-local-skill-test',
  latitude:-22.9,longitude:-43.2,gridResolutionKm:10,
  ...changes,
});
test('INPE and Windy independently favor closer official measurement, without hiding either original value',()=>{
  const readings=[obs('A652',25),obs('DEF-1',33)];
  const tie=compareInpeWindyToDiscrepantObservations({
    observations:readings,
    forecasts:[
      triangulation('INPE_CPTEC_FORECAST',26),
      triangulation('WINDY_MODELO',27,{sourceUrl:'https://www.windy.com/'}),
    ],ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(tie.state,'BOTH_OFFICIAL_VALUES_WITH_MODEL_FAVORED_REFERENCE');
  assert.equal(tie.favoredSourceId,'INMET');
  assert.equal(tie.favoredOfficialValue,25);
  assert.equal(tie.officialMeasurements.length,2);
  assert.deepEqual(tie.officialMeasurements.map(o=>o.value),[25,33]);
  assert.equal(tie.weightedOfficialValue,null);
  assert.equal(tie.weightedModelForecastValue,26.5);
  assert.equal(tie.weightedModelForecastNature,'FORECAST_ONLY_NOT_A_MEASURED_VALUE');
  assert.equal(tie.automaticAlertAuthorized,false);
  const integrated=assessRjMeteorologicalDisagreement({
    observations:readings,
    forecasts:[triangulation('INPE_CPTEC_FORECAST',26),
      triangulation('WINDY_MODELO',27,{sourceUrl:'https://www.windy.com/'})],
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(integrated.calculatedValue,null);
  assert.equal(integrated.modelTieBreak.favoredStationId,'A652');
});
test('split model votes present BOTH discrepant official readings with source and time',()=>{
  const tie=compareInpeWindyToDiscrepantObservations({
    observations:[obs('A652',25),obs('DEF-1',33)],
    forecasts:[
      triangulation('INPE_CPTEC_FORECAST',26),
      triangulation('WINDY_MODELO',32,{sourceUrl:'https://www.windy.com/'}),
    ],ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(tie.state,'SHOW_BOTH_OFFICIAL_MEASUREMENTS');
  assert.equal(tie.reason,'INPE_WINDY_DISAGREE_OR_NEARLY_TIED');
  assert.equal(tie.favoredOfficialValue,null);
  assert.equal(tie.officialMeasurements[0].sourceId,'INMET');
  assert.equal(tie.officialMeasurements[1].stationId,'DEF-1');
  assert.equal(tie.automaticAlertAuthorized,false);
});
test('two models favor the same sensor but disagree significantly: show both rather than claim a decisive tie break',()=>{
  const tie=compareInpeWindyToDiscrepantObservations({
    observations:[obs('A652',25),obs('DEF-1',40)],
    forecasts:[triangulation('INPE_CPTEC_FORECAST',26),
      triangulation('WINDY_MODELO',32,{sourceUrl:'https://www.windy.com/'})],
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(tie.state,'SHOW_BOTH_OFFICIAL_MEASUREMENTS');
  assert.equal(tie.reason,'INPE_WINDY_FORECAST_VALUES_TOO_DIFFERENT');
  assert.equal(tie.favoredOfficialValue,null);
  assert.equal(tie.weightedModelForecastValue,null);
  assert.equal(tie.officialMeasurements.length,2);
});
test('one model or duplicate underlying models never creates a false independent tie breaker',()=>{
  const records=[obs('A652',25),obs('DEF-1',33)];
  for(const inputs of [
    [triangulation('INPE_CPTEC_FORECAST',25)],
    [triangulation('INPE_CPTEC_FORECAST',25),
      triangulation('WINDY_MODELO',26,{modelFamilyId:'INPE-BRAMS'})],
    [triangulation('INPE_CPTEC_FORECAST',25),
      triangulation('WINDY_MODELO',26,{skillEvidenceId:'X'})],
    [triangulation('INPE_CPTEC_FORECAST',25),
      triangulation('WINDY_MODELO',26,{latitude:-20.75,longitude:-41})],
    [triangulation('INPE_CPTEC_FORECAST',25),
      triangulation('WINDY_MODELO',26,{usagePermissionStatus:'UNKNOWN'})],
  ]) {
    const result=compareInpeWindyToDiscrepantObservations({
      observations:records,forecasts:inputs,ibge:'3304557',
      variable:'TEMPERATURA_C',now:NOW,
    });
    assert.equal(result.state,'SHOW_BOTH_OFFICIAL_MEASUREMENTS');
    assert.equal(result.officialMeasurements.length,2);
    assert.equal(result.weightedOfficialValue,null);
  }
});
test('geographically distant or asynchronous official readings cannot be model-certified',()=>{
  for(const change of [
    {observedAt:'2026-10-10T17:00:00Z'},
    {latitude:-22.4,longitude:-42.4},
  ]){
    const result=compareInpeWindyToDiscrepantObservations({
      observations:[obs('A652',25),obs('DEF-1',33,change)],
      forecasts:[triangulation('INPE_CPTEC_FORECAST',26),
        triangulation('WINDY_MODELO',27)],
      ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    });
    assert.equal(result.state,'SHOW_BOTH_OFFICIAL_MEASUREMENTS');
    assert.equal(result.reason,'STATIONS_TOO_FAR_APART_OR_DIFFERENT_OBSERVATION_TIMES');
  }
});
test('all 92 RJ municipalities can retain official provenance with no invented model preference',()=>{
  for(const {ibge} of RJ_MUNICIPALITIES) {
    const tie=compareInpeWindyToDiscrepantObservations({
      observations:[],forecasts:[],ibge,variable:'TEMPERATURA_C',now:NOW,
    });
    assert.equal(tie.favoredOfficialValue,null);
    assert.equal(tie.state,'SHOW_BOTH_OFFICIAL_MEASUREMENTS');
    assert.equal(tie.automaticAlertAuthorized,false);
  }
});

test('INPE CPTEC is consulted as third source for discrepant official readings; does not erase discrepancy',()=>{
  const result=assessRjMeteorologicalDisagreement({
    observations:[obs('A652',25),obs('DEF-1',32)],
    forecasts:[forecast('INPE_CPTEC_FORECAST',29)],ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(result.state,'SIGNIFICANT_OFFICIAL_DATA_DISAGREEMENT');
  assert.equal(result.spread,7);
  assert.equal(result.inpeAvailable,true);
  assert.equal(result.calculatedValue,null);
  assert.equal(result.action,'REVIEW_DIVERGENCE_WITH_INPE_AS_FORECAST_CONTEXT');
  assert.equal(result.automaticAlertAuthorized,false);
});
test('conflict without usable INPE third source requests consultation without inventing a result',()=>{
  const result=assessRjMeteorologicalDisagreement({
    observations:[obs('A652',22),obs('DEF-1',27)],
    forecasts:[],ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(result.action,'CONSULT_INPE_CPTEC_AND_WINDY_IF_AUTHORIZED_AND_AVAILABLE');
  assert.equal(result.inpeAvailable,false);
  assert.equal(result.officialMeasurement,false);
});
test('Windy aids review of two divergent station readings but cannot decide which is true',()=>{
  const result=assessRjMeteorologicalDisagreement({
    observations:[obs('A652',23),obs('DEF-1',30)],
    forecasts:[
      forecast('INPE_CPTEC_FORECAST',29),
      forecast('WINDY_MODELO',24,{sourceUrl:'https://www.windy.com/'}),
    ],
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(result.state,'SIGNIFICANT_OFFICIAL_DATA_DISAGREEMENT');
  assert.equal(result.windyAvailable,true);
  assert.equal(result.windyComparison.sourceId,'WINDY_MODELO');
  assert.equal(result.windyComparison.preferredOfficialMeasurement,null);
  assert.equal(result.windyComparison.permissibleAsOfficialObservation,false);
  assert.equal(result.windyComparison.comparedReadings.length,2);
  assert.equal(result.windyComparison.comparedReadings[0].absoluteDifference,1);
  assert.equal(result.calculatedValue,null);
  assert.equal(result.observedRange.minimum,23);
  assert.equal(result.observedRange.maximum,30);
  assert.equal(result.automaticAlertAuthorized,false);
  assert.equal(result.action,'REVIEW_OFFICIAL_DIVERGENCE_WITH_WINDY_AS_NONAUTHORITATIVE_COMPARISON');
});
test('Windy forecast outside observed interval or lacking permission cannot act as a dispute tie break',()=>{
  const incompatible=forecast('WINDY_MODELO',24,{
    validAt:'2026-10-10T23:00:00Z',sourceUrl:'https://www.windy.com/',
  });
  const missingLicense=forecast('WINDY_MODELO',24,{
    usagePermissionStatus:'PUBLICLY_ACCESSIBLE',sourceUrl:'https://www.windy.com/',
  });
  for (const w of [incompatible,missingLicense]) {
    const r=assessRjMeteorologicalDisagreement({
      observations:[obs('A652',23),obs('DEF-1',30)],
      forecasts:[w],ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    });
    assert.equal(r.windyComparison,null);
    assert.equal(r.calculatedValue,null);
    assert.equal(r.automaticAlertAuthorized,false);
  }
});
test('RJ boundary municipality retains its own municipality record, never interpolates neighboring states',()=>{
  for (const ibge of ['3300100','3306305']) {
    const r=assessRjMeteorologicalDisagreement({
      observations:[],forecasts:[],ibge,variable:'TEMPERATURA_C',now:NOW,
    });
    // Valid if this IBGE exists in canonical 92-municipality catalog.
    assert.equal(r.ibge,ibge);
    assert.equal(r.calculatedValue,null);
    assert.equal(r.inpeAvailable,false);
    assert.equal(r.windyAvailable,false);
  }
});
test('weighted observational mean only when matching official stations with QC weights and no substantial discrepancy',()=>{
  const result=assessRjMeteorologicalDisagreement({
    observations:[obs('A652',30,{weight:1}),obs('DEF-1',31,{weight:3})],
    forecasts:[forecast('INPE_CPTEC_FORECAST',40)],
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(result.state,'COMPARABLE_OFFICIAL_OBSERVATIONS');
  assert.equal(result.calculatedValue,30.75);
  assert.equal(result.calculatedEstimate.officialMeasurement,false);
  assert.equal(result.calculatedEstimate.mayTriggerAlert,false);
  assert.equal(result.inpeAvailable,true);
});
test('INPE forecast cannot spoof a station observation or enter measured weighted averages',()=>{
  const misleading=obs('CPTEC-MODEL',31,{sourceId:'INPE_CPTEC_FORECAST'});
  const r=assessRjMeteorologicalDisagreement({
    observations:[obs('A652',30),misleading],
    forecasts:[forecast('INPE_CPTEC_FORECAST',31)],
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(r.state,'INSUFFICIENT_OFFICIAL_OBSERVATIONS');
  assert.equal(r.calculatedValue,null);
});
test('stale observations, different cities, duplicated station and invalid units block averaging',()=>{
  const variants=[
    obs('DEF-1',31,{observedAt:'2026-10-10T13:00:00Z'}),
    obs('DEF-1',31,{ibge:'3303302'}),
    obs('DEF-1',31,{unit:'km/h'}),
    obs('A652',31,{sourceId:'INMET'}),
  ];
  for(const other of variants){
    const r=assessRjMeteorologicalDisagreement({
      observations:[obs('A652',30),other],ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    });
    assert.equal(r.calculatedValue,null);
  }
});
test('INPE CPTEC and NOAA same forecast horizon can be averaged only with independent providers and verified historical skill weights',()=>{
  const samples=[forecast('INPE_CPTEC_FORECAST',29,{weight:0.6,skillEvidenceId:'skill-INPE-tested'}),
    forecast('NOAA',27,{weight:0.4,skillEvidenceId:'skill-NOAA-tested'})];
  const result=weightedComparableForecastMean({
    forecasts:samples,ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
  });
  assert.equal(result.state,'COMPARABLE_FORECAST_MODELS');
  assert.equal(result.calculatedValue,28.2);
  assert.equal(result.officialMeasurement,false);
  assert.equal(result.automaticAlertAuthorized,false);
  assert.equal(result.calculatedEstimate.notOfficialObservation,true);
  assert.deepEqual(result.calculatedEstimate.providers,['INPE_CPTEC_FORECAST','NOAA']);
});
test('unweighted or incompatible forecast models cannot fabricate a blended prediction',()=>{
  const cases=[
    [forecast('INPE_CPTEC_FORECAST',30),forecast('NOAA',26,{weightBasis:'UNTESTED'})],
    [forecast('INPE_CPTEC_FORECAST',30),forecast('NOAA',26,{validAt:'2026-10-10T23:00:00Z'})],
    [forecast('INPE_CPTEC_FORECAST',30),forecast('INPE_CPTEC_FORECAST',31)],
    [forecast('INPE_CPTEC_FORECAST',30),obs('DEF-1',31)],
  ];
  for(const forecasts of cases){
    const r=weightedComparableForecastMean({forecasts,ibge:'3304557',variable:'TEMPERATURA_C',now:NOW});
    assert.equal(r.calculatedValue,null);
  }
});
test('every RJ municipality can request review without falsely claiming INPE data already exist',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES){
    const x=assessRjMeteorologicalDisagreement({observations:[],forecasts:[],ibge,variable:'CHUVA_MM_1H',now:NOW});
    assert.equal(x.state,'INSUFFICIENT_OFFICIAL_OBSERVATIONS');
    assert.equal(x.inpeAvailable,false);
    assert.equal(x.automaticAlertAuthorized,false);
  }
  assert.throws(()=>assessRjMeteorologicalDisagreement({ibge:'4106902',variable:'TEMPERATURA_C'}));
});
