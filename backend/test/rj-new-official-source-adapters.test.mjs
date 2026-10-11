import test from 'node:test';
import assert from 'node:assert/strict';
import {collectRjOfficialProduct,validateRjOfficialProduct} from '../src/rj-new-official-source-adapters.mjs';
const now=Date.parse('2026-10-11T05:00:00Z');
const heat={sourceId:'MONITORA_RJ_SES',sourceUrl:'https://monitorar.saude.rj.gov.br/',
  observedAt:'2026-10-11T04:00:00Z',ibge:'3304557',productKind:'HEAT_HEALTH_RISK',riskLabel:'Excesso de calor'};
test('SES adapter requires approved licensed endpoint and transport',async()=>{
  const missing=await collectRjOfficialProduct('MONITORA_RJ_SES');
  assert.equal(missing.state,'UNAVAILABLE');
  assert.equal(missing.reason,'LICENSE_NOT_APPROVED');
  const blocked=await collectRjOfficialProduct('MONITORA_RJ_SES',{licensed:true,endpoint:'http://127.0.0.1/internal',fetcher:async()=>({observations:[heat]})});
  assert.equal(blocked.reason,'VERIFIED_HTTPS_ENDPOINT_REQUIRED');
});
test('SES validates source provenance and marks INMET dependence',()=>{
  const r=validateRjOfficialProduct('MONITORA_RJ_SES',{observations:[heat]},{nowMillis:now});
  assert.equal(r.observations.length,1);
  assert.equal(r.observations[0].independence,'NOT_INDEPENDENT_OF_INMET_UNTIL_PROVEN');
  assert.equal(r.state,'CANDIDATE_VALIDATED_NOT_AUTHORIZED_FOR_ALERTS');
});
test('stale, wrong source and incorrect municipal station scope fail closed',()=>{
  const old={...heat,observedAt:'2026-10-10T04:00:00Z'};
  assert.equal(validateRjOfficialProduct('MONITORA_RJ_SES',{observations:[old]},{nowMillis:now}).state,'UNAVAILABLE');
  const bad={...heat,sourceId:'MONITORAR_RIO_SMAC',productKind:'AIR_QUALITY',stationId:'test',ibge:'3303302'};
  assert.equal(validateRjOfficialProduct('MONITORAR_RIO_SMAC',{observations:[bad]},{nowMillis:now}).state,'UNAVAILABLE');
});
test('licensed injected JSON transport can supply candidate but never alert',async()=>{
  const r=await collectRjOfficialProduct('MONITORA_RJ_SES',{
    licensed:true,endpoint:'https://monitorar.saude.rj.gov.br/',fetcher:async()=>({observations:[heat]}),nowMillis:now,
  });
  assert.equal(r.observations.length,1);
  assert.notEqual(r.state,'CURRENT');
});
