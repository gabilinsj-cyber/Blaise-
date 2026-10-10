import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import { planRjPhenomenonCase, reconcileRjWeatherCase } from '../src/rj-agent-orchestration.mjs';

test('all 92 municipalities receive policy routing, never fabricated live data',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES) {
    for(const phenomenon of ['TEMPERATURA','RAJADA','CHUVA_ACUMULADA','TEMPORAL','GRANIZO','DESLIZAMENTO','ALAGAMENTO']) {
      const plan=planRjPhenomenonCase({ibge,phenomenon,level:4});
      assert.equal(plan.sourceStatus,'NOT_CONFIRMED_LIVE');
      assert.equal(plan.autoSourcePolling,false);
      assert.equal(plan.publishersTriggered,false);
      assert.equal(plan.audibleAlert,false);
      assert.equal(plan.calculatedValues,null);
      assert.deepEqual(plan.rosterNumbers,[1,2,3,4,5,6,7,8,9,10]);
      assert.equal(plan.agents.some(a=>a.number===1),true);
      assert.equal(plan.agents.some(a=>a.number===8),true);
      assert.equal(plan.agents.some(a=>a.number===10),true);
      assert.equal(plan.eligibleSources.some(s=>/INEA/.test(s.id)),false);
    }
  }
});
test('litoral/Atlantic cyclone, marine and earthquake cases select the relevant agents',()=>{
  const cyclone=planRjPhenomenonCase({region:'ATLANTICO',phenomenon:'CICLONE_EXTRATROPICAL',level:5});
  assert.ok(cyclone.agents.some(a=>a.number===4));
  assert.ok(cyclone.agents.some(a=>a.number===6));
  assert.ok(cyclone.eligibleSources.some(a=>a.id==='MARINHA_CHM'));
  assert.equal(cyclone.cadence.observationUpdateMs,60000);
  assert.equal(cyclone.audibleAlert,false);
  const seismic=planRjPhenomenonCase({region:'ATLANTICO',phenomenon:'SISMO',level:4});
  assert.ok(seismic.agents.some(a=>a.number===7));
  assert.ok(seismic.eligibleSources.some(a=>a.id==='USGS_EARTHQUAKE'));
  const tsunami=planRjPhenomenonCase({region:'ATLANTICO',phenomenon:'TSUNAMI',level:5});
  assert.ok(tsunami.agents.some(a=>a.number===7));
  assert.ok(tsunami.agents.some(a=>a.number===6));
});
test('unknown city/state and missing phenomenon are blocked',()=>{
  assert.throws(()=>planRjPhenomenonCase({ibge:'4106902',phenomenon:'TEMPORAL'}),TypeError);
  assert.throws(()=>planRjPhenomenonCase({ibge:'3304557'}),TypeError);
  assert.throws(()=>planRjPhenomenonCase({ibge:'3304557',phenomenon:'RAJADA',level:7}),RangeError);
});

test('Sentinel-Fusion-Vector consultation uses first compatible hierarchy pair and never sends alerts',async()=>{
  const now=Date.parse('2026-10-10T18:00:00Z');
  const record=(sourceId,stationId,value)=>({
    origin:'OFFICIAL_OBSERVATION',sourceId,stationId,ibge:'3304557',
    variable:'TEMPERATURA_C',unit:'°C',value,weight:1,
    observedAt:'2026-10-10T17:45:00Z',
    latitude:-22.9,longitude:-43.2,
    sourceUrl:'https://apitempo.inmet.gov.br/estacao/synthetic-test-fixture',
  });
  const r=await reconcileRjWeatherCase({
    ibge:'3304557',variable:'TEMPERATURA_C',now,level:4,
    adapters:{
      ALERTA_RIO:async()=>({observations:[record('ALERTA_RIO','AR-1',25)]}),
      DEFESA_CIVIL_RJ_REGIONAL:async()=>({observations:[record('DEFESA_CIVIL','DC-1',34)]}),
      INMET_STATION:async()=>({observations:[record('INMET','IN-1',26)]}),
    },
  });
  assert.equal(r.observedOrEstimatedValue,25.5);
  assert.deepEqual(r.latestVerifiedResult.selectedSourceIds,['ALERTA_RIO','INMET_STATION']);
  assert.equal(r.verifiedSourceCount,2);
  assert.equal(r.audibleAlert,false);
  assert.equal(r.publishersTriggered,false);
  assert.equal(r.purchasesTriggered,false);
  assert.deepEqual(r.dataHandlingAgents,[1,3,2,8]);
});
test('no installed source adapter gives no weather value rather than an invented estimate',async()=>{
  const r=await reconcileRjWeatherCase({ibge:'3304557',
    variable:'TEMPERATURA_C',adapters:{}});
  assert.equal(r.latestVerifiedResult.value,null);
  assert.equal(r.verifiedSourceCount,0);
  assert.equal(r.sourceStatus,'NO_VERIFIABLE_SOURCE_VALUE');
  assert.equal(r.publishersTriggered,false);
});
