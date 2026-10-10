import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {resolveRjCompatibleSources,consultRjSourcesUntilTwo} from '../src/rj-hierarchical-weather-resolution.mjs';

const NOW=Date.parse('2026-10-10T18:00:00Z');
const measurement=(sourceId,stationId,value,mod={})=>({
  origin:'OFFICIAL_OBSERVATION',sourceId,stationId,ibge:'3304557',
  variable:'TEMPERATURA_C',unit:'°C',value,weight:1,
  observedAt:'2026-10-10T17:45:00Z',
  latitude:-22.90,longitude:-43.20,
  sourceUrl:'https://apitempo.inmet.gov.br/estacao/test-fixture',
  ...mod,
});
const forecast=(sourceId,value,mod={})=>({
  kind:'MODEL_FORECAST',sourceId,productId:sourceId+'-temp',
  modelRunId:'2026-10-10T12:00Z',ibge:'3304557',
  variable:'TEMPERATURA_C',unit:'°C',value,
  issuedAt:'2026-10-10T12:00:00Z',validAt:'2026-10-10T18:00:00Z',
  sourceUrl:'https://www.cptec.inpe.br/',
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  weight:0.5,weightBasis:'VERIFIED_HISTORICAL_SKILL_FOR_VARIABLE_LOCATION_AND_LEAD',
  skillEvidenceId:sourceId+'-historical-skill',
  ...mod,
});

test('Rio city uses the first independent compatible official pair in hierarchy',()=>{
  const resolved=resolveRjCompatibleSources({
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    observations:[
      measurement('ALERTA_RIO','A-RJ',28),
      measurement('INMET','A652',29),
      measurement('DEFESA_CIVIL','DC-1',30),
    ],
  });
  assert.equal(resolved.state,'TWO_COMPATIBLE_OFFICIAL_SOURCES');
  assert.deepEqual(resolved.selectedSourceIds,['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']);
  assert.equal(resolved.value,29);
  assert.equal(resolved.officialMeasurement,false); // output is a calculation, not an observation
  assert.equal(resolved.automaticAlertAuthorized,false);
  assert.equal(resolved.audibleAlertAuthorized,false);
});
test('first two sources disagree so continue to third and choose first compatible pair',()=>{
  const resolved=resolveRjCompatibleSources({
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    observations:[
      measurement('ALERTA_RIO','A-RJ',24),
      measurement('INMET','A652',25),
      measurement('DEFESA_CIVIL','DC-1',32),
    ],
  });
  assert.equal(resolved.state,'TWO_COMPATIBLE_OFFICIAL_SOURCES');
  assert.deepEqual(resolved.selectedSourceIds,['ALERTA_RIO','INMET_STATION']);
  assert.equal(resolved.value,24.5);
  assert.ok(resolved.conflictsEncountered.some(x=>x.sourceB==='DEFESA_CIVIL_RJ_REGIONAL'));
});
test('skips stale or invalid priority source then uses two fresh compatible independent sources',()=>{
  const r=resolveRjCompatibleSources({
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    observations:[
      measurement('ALERTA_RIO','AR-RJ',31,{observedAt:'2026-10-10T12:00:00Z'}),
      measurement('DEFESA_CIVIL','DC-1',25),
      measurement('INMET','A652',26),
    ],
  });
  assert.equal(r.state,'TWO_COMPATIBLE_OFFICIAL_SOURCES');
  assert.deepEqual(r.selectedSourceIds,['DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']);
  assert.equal(r.value,25.5);
  assert.equal(r.automaticAlertAuthorized,false);
});
test('different units, source types, times or station distances cannot be blended just to obtain a value',()=>{
  for(const changed of [
    {observedAt:'2026-10-10T16:55:00Z'},
    {latitude:-22.35,longitude:-42.40},
    {weight:-1},
    {unit:'km/h'},
  ]) {
    const r=resolveRjCompatibleSources({
      ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
      observations:[measurement('ALERTA_RIO','AR-RJ',25),
        measurement('DEFESA_CIVIL','DC-1',25.5,changed)],
    });
    assert.equal(r.state,'ONE_VERIFIED_OFFICIAL_SOURCE');
    assert.equal(r.value,25);
    assert.equal(r.automaticAlertAuthorized,false);
  }
});
test('a second station from the SAME provider is not a second independent source',()=>{
  const r=resolveRjCompatibleSources({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    observations:[measurement('INMET','A652',27),measurement('INMET','A621',28)]});
  assert.equal(r.state,'ONE_VERIFIED_OFFICIAL_SOURCE');
  assert.equal(r.value,27);
  assert.deepEqual(r.selectedSourceIds,['INMET_STATION']);
  assert.equal(r.missingSecondCompatibleSource,true);
});
test('if two official sources differ too much, preserve best verified station not false mean',()=>{
  const r=resolveRjCompatibleSources({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    observations:[measurement('INMET','A652',29),measurement('DEFESA_CIVIL','DC-1',36)],
    forecasts:[forecast('INPE_CPTEC_FORECAST',30),forecast('WINDY_MODELO',30)]});
  assert.equal(r.state,'ONE_VERIFIED_OFFICIAL_SOURCE');
  assert.equal(r.value,29);
  assert.equal(r.resultKind,'OBSERVACAO_PONTUAL_OFICIAL_FONTE_UNICA');
  assert.equal(r.automaticAlertAuthorized,false);
  assert.ok(r.conflictsEncountered.length>0);
});
test('if no station exists, INPE and Windy independent models can provide separate calibrated forecast estimate',()=>{
  const r=resolveRjCompatibleSources({
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    forecasts:[forecast('INPE_CPTEC_FORECAST',29,{weight:0.6}),
      forecast('WINDY_MODELO',30,{weight:0.4})],
  });
  assert.equal(r.state,'TWO_COMPATIBLE_FORECAST_SOURCES');
  assert.equal(r.value,29.4);
  assert.equal(r.resultKind,'PREVISAO_PONDERADA_BLAISE_NAO_OBSERVACAO');
  assert.deepEqual(r.selectedSourceIds,['INPE_CPTEC_FORECAST','WINDY_MODELO']);
  assert.equal(r.automaticAlertAuthorized,false);
  assert.equal(r.provenance.notOfficialObservation,true);
});
test('unverified forecast weights or noncontemporary products return one clearly labeled source',()=>{
  const r=resolveRjCompatibleSources({
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    forecasts:[forecast('INPE_CPTEC_FORECAST',28),
      forecast('WINDY_MODELO',29,{weightBasis:'UNKNOWN_SKILL'})],
  });
  assert.equal(r.state,'ONE_VERIFIED_FORECAST_SOURCE');
  assert.equal(r.value,28);
  assert.equal(r.resultKind,'PREVISAO_ISOLADA_NAO_MEDICAO');
});
test('a single station cannot be converted into a fake municipality-wide estimate',()=>{
  const r=resolveRjCompatibleSources({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    observations:[measurement('INMET','A652',26)]});
  assert.equal(r.value,26);
  assert.equal(r.sourceMeasurementsAreNotMunicipalAverages,true);
  assert.equal(r.automaticAlertAuthorized,false);
});
test('stale, out-of-range, out-of-state, wrong city or unknown-source inputs do not generate weather numbers',()=>{
  const altered=[
    {observedAt:'2026-10-10T14:00:00Z'}, {value:9999}, {ibge:'4106902'},
    {latitude:0},{sourceId:'INPE_CPTEC_FORECAST'},
    {origin:'MODEL_FORECAST'},{sourceUrl:'http://example.test'},
  ];
  for(const change of altered){
    const r=resolveRjCompatibleSources({ibge:'3304557',variable:'TEMPERATURA_C',
      observations:[measurement('INMET','A652',28,change)],now:NOW});
    assert.equal(r.state,'NO_VERIFIABLE_SOURCE_VALUE');
    assert.equal(r.value,null);
    assert.equal(r.automaticAlertAuthorized,false);
  }
});
test('sequential adapters stop after first validated pair and never call lower-priority sources',async()=>{
  const called=[];
  const adapters={
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {observations:[measurement('ALERTA_RIO','A-RJ',28)]};},
    INMET_STATION:async()=>{called.push('INMET_STATION');throw Error('should not be contacted');},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA_CIVIL_RJ_REGIONAL');return {observations:[measurement('DEFESA_CIVIL','DC-1',29)]};},
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE_CPTEC_FORECAST');throw Error('should not be contacted');},
    WINDY_MODELO:async()=>{called.push('WINDY_MODELO');throw Error('should not be contacted');},
  };
  const r=await consultRjSourcesUntilTwo({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,adapters});
  assert.equal(r.state,'TWO_COMPATIBLE_OFFICIAL_SOURCES');
  assert.deepEqual(called,['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']);
  assert.deepEqual(r.connectorFailures,[]);
});
test('sequential adapters continue after first incompatible source and retry remaining hierarchy',async()=>{
  const called=[];
  const adapters={
    ALERTA_RIO:async()=>{called.push('ALERTA_RIO');return {observations:[measurement('ALERTA_RIO','A-RJ',20)]};},
    INMET_STATION:async()=>{called.push('INMET_STATION');return {observations:[measurement('INMET','A652',21)]};},
    DEFESA_CIVIL_RJ_REGIONAL:async()=>{called.push('DEFESA_CIVIL_RJ_REGIONAL');return {observations:[measurement('DEFESA_CIVIL','DC-1',32)]};},
    INPE_CPTEC_FORECAST:async()=>{called.push('INPE_CPTEC_FORECAST');return {forecasts:[forecast('INPE_CPTEC_FORECAST',29)]};},
  };
  const r=await consultRjSourcesUntilTwo({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,adapters});
  assert.equal(r.state,'TWO_COMPATIBLE_OFFICIAL_SOURCES');
  assert.equal(r.value,20.5);
  assert.deepEqual(called,['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']);
});
test('one adapter cannot spoof two independent source providers',async()=>{
  const r=await consultRjSourcesUntilTwo({
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    adapters:{
      ALERTA_RIO:async()=>({observations:[
        measurement('ALERTA_RIO','AR-RJ',28),
        measurement('DEFESA_CIVIL','FAKE-DC',29),
      ]}),
    },
  });
  assert.equal(r.state,'ONE_VERIFIED_OFFICIAL_SOURCE');
  assert.deepEqual(r.selectedSourceIds,['ALERTA_RIO']);
  assert.deepEqual(r.consultedSourceIds,['ALERTA_RIO']);
  assert.equal(r.automaticAlertAuthorized,false);
});
test('missing/failing adapters cannot be misrepresented as real-time measurements',async()=>{
  const r=await consultRjSourcesUntilTwo({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    adapters:{INMET_STATION:async()=>{throw Error('network failed');}}});
  assert.equal(r.state,'NO_VERIFIABLE_SOURCE_VALUE');
  assert.deepEqual(r.connectorFailures,['INMET_STATION']);
  assert.equal(r.value,null);
});
test('all 92 municipalities accept RJ routing and have no cross-state fallback',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES){
    const r=resolveRjCompatibleSources({ibge,variable:'TEMPERATURA_C',now:NOW});
    assert.equal(r.value,null);
    assert.equal(r.state,'NO_VERIFIABLE_SOURCE_VALUE');
    assert.equal(r.examinedSourceIds.includes('ALERTA_RIO'),ibge==='3304557');
  }
});
