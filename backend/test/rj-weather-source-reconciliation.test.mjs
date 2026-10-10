import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import {
  assessRjMeteorologicalDisagreement,
  weightedComparableForecastMean,
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
