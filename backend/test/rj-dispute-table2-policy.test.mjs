import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  RJ_TABLE2_DISPUTE_PRIORITY,
  RJ_TABLE2_VERSION,
  rjDisputeTable2,
} from '../src/rj-dispute-table2-policy.mjs';
import {rjSourceRouting} from '../src/rj-phenomenon-source-policy.mjs';

const requestedOrder=[
  'INPE_CPTEC_FORECAST','INMET_STATION','CEMADEN_RJ','WINDY_MODELO','NOAA',
];
test('Tabela 2 has the EXACT five-step priority requested by Blaise RJ owner',()=>{
  assert.deepEqual(RJ_TABLE2_DISPUTE_PRIORITY.map(s=>s.sourceId),requestedOrder);
  assert.deepEqual(RJ_TABLE2_DISPUTE_PRIORITY.map(s=>s.label),
    ['INPE/CPTEC','INMET','CEMADEN','Windy','NOAA']);
  assert.equal(RJ_TABLE2_DISPUTE_PRIORITY.length,5);
  assert.equal(new Set(requestedOrder).size,5);
  assert.ok(RJ_TABLE2_VERSION.includes('2026-10-14'));
  assert.ok(RJ_TABLE2_DISPUTE_PRIORITY.every(s=>s.connected===false
    &&s.automaticallyAuthorizesAlert===false));
});
test('all five priority sources can be considered for hourly rainfall with product validation',()=>{
  const t=rjDisputeTable2({phenomenon:'CHUVA_ACUMULADA'});
  assert.deepEqual(t.order,requestedOrder);
  assert.deepEqual(t.eligibleSources.map(s=>s.sourceId),requestedOrder);
  assert.deepEqual(t.rows.map(s=>s.rank),[1,2,3,4,5]);
  assert.ok(t.rows.every(s=>s.dataStatus==='NOT_VERIFIED_LIVE'));
  assert.equal(t.table1Unaffected,true);
  assert.equal(t.officialAlertOverride,false);
  assert.equal(t.mayWeightForecastWithOfficialObservation,false);
});
test('CEMADEN is not invented as a temperature station or cyclone observation source',()=>{
  for(const phenomenon of ['TEMPERATURA','SENSACAO_TERMICA','VENTO','RAJADA','CICLONE_EXTRATROPICAL']){
    const t=rjDisputeTable2({phenomenon});
    assert.deepEqual(t.order,requestedOrder);
    assert.equal(t.rows.find(r=>r.sourceId==='CEMADEN_RJ').eligible,false);
    assert.equal(t.eligibleSources.includes(t.rows[2]),false);
  }
  for(const phenomenon of ['TEMPORAL','GRANIZO','ALAGAMENTO','RISCO_HIDROLOGICO']) {
    assert.equal(rjDisputeTable2({phenomenon}).rows[2].eligible,true);
  }
});
test('specialist sismology, tsunami, river flow and tide authority is never replaced by Table 2',()=>{
  for(const phenomenon of ['SISMO','TSUNAMI','VAZAO_RIO','MARE','RADAR']){
    const t=rjDisputeTable2({phenomenon,region:'ATLANTICO'});
    assert.deepEqual(t.order,requestedOrder);
    assert.equal(t.eligibleSources.length,0);
    assert.equal(t.officialAlertOverride,false);
  }
});
test('all 92 cities expose unchanged primary collection routes PLUS independent Table 2 metadata',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge}of RJ_MUNICIPALITIES) {
    for(const phenomenon of ['TEMPERATURA','CHUVA_ACUMULADA','TEMPORAL','VENTO']){
      const route=rjSourceRouting({ibge,phenomenon});
      assert.deepEqual(route.disputeTable2Priority,requestedOrder);
      assert.ok(route.disputeTable2Eligible.includes('INPE_CPTEC_FORECAST'));
      assert.equal(route.disputeTable2NeverOverridesOfficialAlert,true);
      assert.equal(route.sources.some(s=>s.id==='ALERTA_RIO'),ibge==='3304557');
      assert.equal(route.ineaPolicy,'EXCLUDED');
      assert.equal(route.liveData,'NOT_CONFIRMED');
    }
  }
});
test('Table 2 does not convert model outputs into measured observations',()=>{
  const t=rjDisputeTable2({phenomenon:'TEMPERATURA'});
  assert.equal(t.rows.find(s=>s.sourceId==='INPE_CPTEC_FORECAST').kind,
    'OFFICIAL_FORECAST_OR_SATELLITE');
  assert.equal(t.rows.find(s=>s.sourceId==='WINDY_MODELO').kind,
    'MODEL_COMPARISON_ONLY');
  assert.equal(t.rows.find(s=>s.sourceId==='NOAA').kind,
    'OFFICIAL_FORECAST_SATELLITE_OR_MARINE_PRODUCT');
  assert.equal(t.mayWeightForecastWithOfficialObservation,false);
  assert.equal(t.neverCountDuplicateModelAsIndependentSource,true);
});
test('reject invalid table regions or missing phenomenon',()=>{
  assert.throws(()=>rjDisputeTable2({phenomenon:'CHUVA',region:'PARANA'}),TypeError);
  assert.throws(()=>rjDisputeTable2({}),TypeError);
});
