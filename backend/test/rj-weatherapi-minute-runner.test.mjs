import test from 'node:test';
import assert from 'node:assert/strict';

import {runWeatherApiMinute}
from '../src/rj-weatherapi-minute-runner.mjs';

const now = Date.UTC(2026,11,1,12,0);

function setup(){
  let calls=0;

  return {
    calls:()=>calls,
    options:{
      enabled:true,
      operatorApproved:true,
      clock:()=>now,
      reserve:async()=>({approved:true}),
      cache:{save:async()=>({saved:true})},
      fetchImpl:async()=>{
        throw Error('REDE REAL PROIBIDA');
      },
      collect:async()=>{
        calls++;
        return {
          status:'PRIVATE_CACHE_SAVED',
          providerContacted:true
        };
      }
    }
  };
}

test('desativado por padrao',async()=>{
  const r=await runWeatherApiMinute({
    clock:()=>now
  });

  assert.equal(r.status,'DRY_RUN');
  assert.equal(r.providerCalls,0);
});

test('bloqueia sem autorizacao',async()=>{
  const s=setup();
  s.options.operatorApproved=false;

  const r=await runWeatherApiMinute(s.options);

  assert.equal(r.attempts,0);
  assert.equal(s.calls(),0);
});

test('executa somente municipios do minuto',async()=>{
  const s=setup();

  const r=await runWeatherApiMinute(s.options);

  assert.equal(r.status,'MINUTE_COMPLETED');
  assert.equal(r.saved,3);
  assert.equal(r.providerCalls,3);
});

test('interrompe quando franquia bloqueada',async()=>{
  const s=setup();

  s.options.collect=async()=>({
    status:'DISABLED_OR_UNAVAILABLE',
    reason:'SHARED_FREE_BUDGET_EXHAUSTED',
    providerContacted:false
  });

  const r=await runWeatherApiMinute(s.options);

  assert.equal(r.attempts,1);
  assert.equal(r.providerCalls,0);
  assert.equal(r.status,'SAFETY_STOP');
});

test('interrompe quando provedor falha',async()=>{
  const s=setup();

  s.options.collect=async()=>({
    status:'DISABLED_OR_UNAVAILABLE',
    providerContacted:true
  });

  const r=await runWeatherApiMinute(s.options);

  assert.equal(r.attempts,1);
  assert.equal(r.saved,0);
  assert.equal(r.status,'SAFETY_STOP');
});

test('coletor original bloqueia sem credenciais',async()=>{
  const s=setup();

  delete s.options.collect;

  const r=await runWeatherApiMinute(s.options);

  assert.equal(r.providerCalls,0);
  assert.equal(r.status,'SAFETY_STOP');
});

test('preserva publicacao desativada',async()=>{
  const s=setup();

  const r=await runWeatherApiMinute(s.options);

  assert.equal(r.publicationEnabled,false);
  assert.equal(r.paidCallsAllowed,false);
});

test('bloqueia sem contador de franquia',async()=>{
  const s=setup();

  delete s.options.reserve;

  const r=await runWeatherApiMinute(s.options);

  assert.equal(r.status,'SAFETY_GATE_CLOSED');
  assert.equal(r.attempts,0);
});
