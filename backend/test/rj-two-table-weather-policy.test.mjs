import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  RJ_TABLE_1,RJ_TABLE_2,resolveRjTwoTables,rjTwoTableCadencePolicy,
} from '../src/rj-two-table-weather-policy.mjs';

const NOW=Date.parse('2026-10-12T18:00:00Z');
const observation=(sourceId,stationId,value,change={})=>({
  origin:'OFFICIAL_OBSERVATION',sourceId,stationId,ibge:'3304557',
  variable:'TEMPERATURA_C',unit:'°C',value,weight:1,
  observedAt:'2026-10-12T17:45:00Z',
  latitude:-22.9,longitude:-43.2,
  sourceUrl:'https://example.org/valid-independent-station',
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  ...change,
});
const forecast=(sourceId,value,change={})=>({
  kind:'MODEL_FORECAST',sourceId,ibge:'3304557',
  variable:'TEMPERATURA_C',unit:'°C',value,
  productId:sourceId+'-forecast',modelRunId:'2026-10-12T12Z',
  issuedAt:'2026-10-12T12:00:00Z',validAt:'2026-10-12T17:45:00Z',
  latitude:-22.9,longitude:-43.2,gridResolutionKm:5,
  sourceUrl:'https://example.org/valid-weather-model',
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
  ...change,
});

test('approved table 1 and table 2 have exactly the user-defined source hierarchy',()=>{
  assert.deepEqual(RJ_TABLE_1.map(x=>x.id),[
    'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','OPENWEATHERMAP_API']);
  assert.deepEqual(RJ_TABLE_2.map(x=>x.id),[
    'INPE_CPTEC_FORECAST','INMET_STATION','CEMADEN_RJ','WINDY_MODELO','NOAA']);
  assert.equal(RJ_TABLE_1[2].type,'FORECAST_OR_DERIVED_PRODUCT');
});
test('two independent comparable observations in Table 1 are sufficient for weighted mean, without Table 2',()=>{
  const r=resolveRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    table1:[observation('ALERTA_RIO','AR01',28),
      observation('DEFESA_CIVIL','DC02',29),forecast('OPENWEATHERMAP_API',40)],
    table2:[forecast('INPE_CPTEC_FORECAST',40)],
  });
  assert.equal(r.state,'TABLE_1_TWO_COMPATIBLE_OFFICIAL_OBSERVATIONS');
  assert.equal(r.weightedMean,28.5);
  assert.equal(r.value,28.5);
  assert.deepEqual(r.sourcePair.map(x=>x.sourceId),[
    'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']);
  assert.deepEqual(r.reviewedTable2Sources,[]);
  assert.equal(r.triggersOfficialAlert,false);
  assert.equal(r.claimsLiveIntegration,false);
});
test('disagreement in Table 1 triggers INPE first; model match is comparison not official weighted mean',()=>{
  const r=resolveRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    table1:[observation('ALERTA_RIO','AR01',23),
      observation('DEFESA_CIVIL','DC02',30)],
    table2:[forecast('INPE_CPTEC_FORECAST',24),
      observation('INMET','IN01',30)],
  });
  assert.equal(r.state,'TABLE_2_MATCHES_TABLE_1_FOR_COMPARISON');
  assert.equal(r.kind,'MIXED_PRODUCT_COMPARISON_NOT_WEIGHTED');
  assert.equal(r.weightedMean,null);
  assert.equal(r.value,null);
  assert.deepEqual(r.sourcePair.map(x=>x.sourceId),['ALERTA_RIO','INPE_CPTEC_FORECAST']);
  assert.deepEqual(r.sourcePair.map(x=>x.dataType),[
    'OFFICIAL_STATION_OBSERVATION','FORECAST_MODEL_NOT_STATION']);
  assert.deepEqual(r.checkedTable2Sources,['INPE_CPTEC_FORECAST']);
});
test('INPE mismatch means seek next INMET: two independent observations may then be weighted',()=>{
  const r=resolveRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    table1:[observation('ALERTA_RIO','AR01',22),
      observation('DEFESA_CIVIL','DC02',30)],
    table2:[forecast('INPE_CPTEC_FORECAST',27),
      observation('INMET','IN01',29)],
  });
  assert.equal(r.state,'TABLE_2_CONFIRMS_INDEPENDENT_OFFICIAL_OBSERVATION');
  assert.equal(r.weightedMean,29.5);
  assert.deepEqual(r.sourcePair.map(x=>x.sourceId),[
    'DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']);
  assert.deepEqual(r.checkedTable2Sources,['INPE_CPTEC_FORECAST','INMET_STATION']);
});
test('CEMADEN data only eligible for rain and matching accumulation interval',()=>{
  const rain={variable:'CHUVA_MM_1H',unit:'mm',measurementWindowMinutes:60};
  const r=resolveRjTwoTables({ibge:'3304557',variable:'CHUVA_MM_1H',now:NOW,
    table1:[observation('DEFESA_CIVIL','DC02',12,rain)],
    table2:[observation('CEMADEN','CM02',13,rain)],
  });
  assert.equal(r.state,'TABLE_2_CONFIRMS_INDEPENDENT_OFFICIAL_OBSERVATION');
  assert.equal(r.weightedMean,12.5);
  const invalid=resolveRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    table1:[observation('DEFESA_CIVIL','DC02',28)],
    table2:[observation('CEMADEN','CM02',29)]});
  assert.equal(invalid.state,'NO_COMPATIBLE_PAIR_VERIFIED');
  assert.equal(invalid.weightedMean,null);
});
test('OpenWeatherMap is a derived product, never a second official station',()=>{
  const r=resolveRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    table1:[observation('ALERTA_RIO','AR01',27),
      observation('OPENWEATHERMAP_API','OWM01',28),
      forecast('OPENWEATHERMAP_API',28)],
  });
  assert.equal(r.state,'NO_COMPATIBLE_PAIR_VERIFIED');
  assert.equal(r.value,null);
  assert.equal(r.table1Available.length,2);
  assert.equal(r.table1Available[1].dataType,'FORECAST_MODEL_NOT_STATION');
});
test('Windy and NOAA are used as subsequent comparison references without pretending to observe',()=>{
  const r=resolveRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
    table1:[observation('DEFESA_CIVIL','DC02',20)],
    table2:[forecast('INPE_CPTEC_FORECAST',30),
      forecast('WINDY_MODELO',21),forecast('NOAA',20)],
  });
  assert.equal(r.state,'TABLE_2_MATCHES_TABLE_1_FOR_COMPARISON');
  assert.deepEqual(r.sourcePair.map(x=>x.sourceId),['DEFESA_CIVIL_RJ_REGIONAL','WINDY_MODELO']);
  assert.equal(r.weightedMean,null);
  assert.deepEqual(r.checkedTable2Sources,[
    'INPE_CPTEC_FORECAST','INMET_STATION','CEMADEN_RJ','WINDY_MODELO']);
});
test('Rio-only Alerta Rio never supplies station data to other RJ municipalities',()=>{
  const r=resolveRjTwoTables({ibge:'3303302',variable:'TEMPERATURA_C',now:NOW,
    table1:[observation('ALERTA_RIO','AR01',26,{ibge:'3303302'}),
      observation('DEFESA_CIVIL','DC02',28,{ibge:'3303302'})],
    table2:[observation('INMET','IN01',29,{ibge:'3303302'})],
  });
  assert.equal(r.state,'TABLE_2_CONFIRMS_INDEPENDENT_OFFICIAL_OBSERVATION');
  assert.deepEqual(r.sourcePair.map(x=>x.sourceId),[
    'DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']);
});
test('stale, unlicensed, wrong city, non-numeric or re-published same station cannot produce official mean',()=>{
  for(const change of [
    {observedAt:'2026-10-12T13:00:00Z'},
    {usagePermissionStatus:'PUBLIC'},
    {ibge:'4106902'},{value:9999},
    {stationId:'AR01'}, {latitude:0},
  ]) {
    const r=resolveRjTwoTables({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW,
      table1:[observation('ALERTA_RIO','AR01',28),
        observation('DEFESA_CIVIL','DC02',29,change)],
    });
    assert.equal(r.weightedMean,null);
    assert.equal(r.triggersOfficialAlert,false);
  }
});
test('all RJ municipalities have valid routing, not fabricated coverage or live data',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES){
    const r=resolveRjTwoTables({ibge,variable:'TEMPERATURA_C',now:NOW});
    assert.equal(r.state,'NO_COMPATIBLE_PAIR_VERIFIED');
    assert.equal(r.weightedMean,null);
    assert.equal(r.claimsLiveIntegration,false);
  }
  assert.throws(()=>resolveRjTwoTables({ibge:'4106902',variable:'TEMPERATURA_C',now:NOW}));
});
test('refresh frequency requirements are targets, not claims of actually deployed live acquisition',()=>{
  assert.equal(rjTwoTableCadencePolicy(1).recommendedRefreshMs,300_000);
  assert.equal(rjTwoTableCadencePolicy(5).severeTargetCollectMs,30_000);
  assert.equal(rjTwoTableCadencePolicy(5).severeTargetRecalculateMs,30_000);
  assert.equal(rjTwoTableCadencePolicy(5).actuallyScheduled,false);
  assert.throws(()=>rjTwoTableCadencePolicy(6));
});
