import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjLicensedFusionExecutor} from '../src/rj-licensed-fusion-executor.mjs';
const NOW=Date.parse('2026-11-13T18:00:00Z');
const target={ibge:'3304557',latitude:-22.91,longitude:-43.22,elevationM:35};
const grant=(id)=>({
  sourceId:id,productId:id+'-temp',status:'VERIFIED',
  permission:'COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION',
  evidenceId:'registry-confirmed-licence-'+id,
  attribution:'SYNTHETIC TEST ONLY - NO REAL PERMISSION',
  licenseUrl:id==='inmet'?'https://apitempo.inmet.gov.br/license':
    'https://alertario.rio.rj.gov.br/license',validUntil:'2026-12-31T00:00:00Z',
});
const grants=[grant('alerta-rio'),grant('inmet')];
const sample=(id,value,longitude)=>({
  kind:'STATION_OBSERVATION',metric:'TEMPERATURE_C',unit:'°C',
  sourceId:id,originalSourceId:id,productId:id+'-temp',stationId:id+'-station',
  ibge:'3304557',latitude:-22.91,longitude,elevationM:40,quality:.9,
  observedAt:'2026-11-13T17:59:00Z',value,
  sourceUrl:id==='inmet'?'https://apitempo.inmet.gov.br/station/test':
    'https://alertario.rio.rj.gov.br/station/test'
});
test('agent12 disabled by default, no remote retrieval, no bypass',async()=>{
  let fetched=0;
  const r=createRjLicensedFusionExecutor({
    target,authorizeOperator:async()=>true,
    loadVerifiedGrants:async()=>grants,
    loadAuthorizedObservations:async()=>{fetched++;return {}}
  });
  assert.equal(r.configured,false);
  assert.equal((await r.run()).status,'UNAVAILABLE');
  assert.equal(fetched,0);
});
test('unauthorized identity denied before source or license access',async()=>{
  let grantsRead=0,retrievals=0;
  const r=createRjLicensedFusionExecutor({
    enabled:true,target,authorizeOperator:async()=>false,
    loadVerifiedGrants:async()=>{grantsRead++;return grants},
    loadAuthorizedObservations:async()=>{retrievals++;return {}},
    now:()=>NOW
  });
  assert.equal((await r.run()).reason,'OPERATOR_NOT_AUTHORIZED');
  assert.equal(grantsRead,0);
  assert.equal(retrievals,0);
});
test('forbidden products are excluded BEFORE network adapter is called',async()=>{
  let requested;
  const r=createRjLicensedFusionExecutor({
    enabled:true,target,authorizeOperator:async()=>true,
    loadVerifiedGrants:async()=>[...grants,{
      ...grant('noaa'),permission:'NON_COMMERCIAL_ONLY'}],
    loadAuthorizedObservations:async({approvedProducts})=>{
      requested=approvedProducts;return {temperature:[
        sample('alerta-rio',27,-43.215),sample('inmet',28,-43.225)
      ]};
    },
    now:()=>NOW
  });
  const result=await r.run({operatorContext:{testAuth:true}});
  assert.equal(result.status,'PARTIAL_OR_FULL_AUTHORIZED_ESTIMATES');
  assert.deepEqual(requested.map(x=>x.sourceId),['alerta-rio','inmet']);
  assert.equal(result.metrics.temperature.sourceCount,2);
  assert.equal(result.metrics.temperature.provenanceMustBeDisplayed,true);
});
test('no valid grants means no collector call; no hidden data collection',async()=>{
  let fetched=false;
  const r=createRjLicensedFusionExecutor({
    enabled:true,target,authorizeOperator:async()=>true,
    loadVerifiedGrants:async()=>grants.map(g=>({...g,permission:'NON_COMMERCIAL_ONLY'})),
    loadAuthorizedObservations:async()=>{fetched=true;return {}},now:()=>NOW
  });
  assert.equal((await r.run()).reason,'VERIFIED_COMMERCIAL_PRODUCT_GRANTS_REQUIRED');
  assert.equal(fetched,false);
});
test('audit contains only event, time, status and available metrics, never values or subscriber identity',async()=>{
  let audit=null;
  const r=createRjLicensedFusionExecutor({
    enabled:true,target,authorizeOperator:async()=>true,
    loadVerifiedGrants:async()=>grants,
    loadAuthorizedObservations:async()=>({temperature:[
      sample('alerta-rio',27,-43.215),sample('inmet',28,-43.225)
    ]}),now:()=>NOW,onAudit:event=>{audit=event}
  });
  await r.run({operatorContext:{email:'secret-subscriber@example.test'}});
  assert.equal(audit.event,'licensed_fusion_attempt');
  assert.deepEqual(audit.availableMetrics,['temperature']);
  assert.ok(!JSON.stringify(audit).includes('27'));
  assert.ok(!JSON.stringify(audit).includes('subscriber'));
});
