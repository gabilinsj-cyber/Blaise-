import test from 'node:test';
import assert from 'node:assert/strict';

import {
  planWeatherApiMinute,
  planWeatherApiMonthly
} from '../src/rj-weatherapi-free-auto-plan.mjs';

const start = Date.UTC(2026,11,1);

function hourlySlots(){
  return Array.from({length:60},(_,i)=>
    planWeatherApiMinute({
      now:start+i*60000
    }).municipalities
  );
}

test('cobre os 92 municipios',()=>{
  assert.equal(
    new Set(hourlySlots().flat()).size,92
  );
});

test('programa 94 consultas por hora',()=>{
  assert.equal(hourlySlots().flat().length,94);
});

test('Rio e Niteroi a cada 30 minutos',()=>{
  const rows=hourlySlots().flat();

  for(const ibge of ['3304557','3303302']){
    assert.equal(
      rows.filter(c=>c===ibge).length,2
    );
  }
});

test('90 municipios com intervalo de 60 minutos',()=>{
  const rows=hourlySlots().flat();

  const regular=rows.filter(c=>
    !['3304557','3303302'].includes(c)
  );

  assert.equal(regular.length,90);
  assert.equal(new Set(regular).size,90);
});

test('distribui no maximo tres consultas por minuto',()=>{
  assert.ok(
    hourlySlots().every(s=>s.length<=3)
  );
});

test('preserva franquia mensal',()=>{
  const r=planWeatherApiMonthly();

  assert.equal(r.monthlyCalls,69936);
  assert.equal(r.internalMargin,10064);
  assert.equal(r.withinBudget,true);
});

test('preserva bloqueios de producao',()=>{
  const r=planWeatherApiMonthly();

  assert.equal(r.automaticCollection,false);
  assert.equal(r.publicationEnabled,false);
  assert.equal(r.paidCallsAllowed,false);
});

test('rejeita configuracoes invalidas',()=>{
  assert.throws(()=>planWeatherApiMonthly({
    month:13
  }));

  assert.throws(()=>planWeatherApiMinute({
    now:-1
  }));
});
