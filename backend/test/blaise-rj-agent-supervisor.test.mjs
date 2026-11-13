import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjAgentSupervisor,rjAgentDueIntervalMs}
  from '../src/blaise-rj-agent-supervisor.mjs';

test('eleven agents have bounded normal/severe/extreme cadence without timers',()=>{
  assert.equal(rjAgentDueIntervalMs('calculos-severos'),300000);
  assert.equal(rjAgentDueIntervalMs('calculos-severos',{severity:3}),60000);
  assert.equal(rjAgentDueIntervalMs('calculos-severos',{severity:5}),30000);
  assert.equal(rjAgentDueIntervalMs('calculos-severos',{severity:5,doubleRed:true}),25000);
  assert.equal(rjAgentDueIntervalMs('transito-rj'),300000);
  assert.equal(rjAgentDueIntervalMs('voz-perguntas'),null);
  assert.equal(rjAgentDueIntervalMs('blaise-ia-pesquisa'),null);
  assert.throws(()=>rjAgentDueIntervalMs('unknown'));
});
test('supervisor never runs handlers without explicit enable',async()=>{
  let runs=0;
  const s=createRjAgentSupervisor({handlers:{'transito-rj':{run:()=>runs++}}});
  assert.equal((await s.tick()).status,'DISABLED');
  assert.equal(runs,0);
  assert.equal(s.snapshot().length,11);
  assert.ok(s.snapshot().every(x=>x.lastAttemptAt===null));
});
test('supervisor throttles duplicate polls and never auto-activates nonexistent agents',async()=>{
  let now=Date.parse('2026-11-13T15:00:00Z'),calls=0;
  const s=createRjAgentSupervisor({enabled:true,now:()=>now,handlers:{
    'calculos-severos':{sourceId:'noaa',run:()=>{calls++;return {ok:true};}}
  }});
  assert.equal((await s.tick({severity:5})).results.length,1);
  now+=10000;assert.equal((await s.tick({severity:5})).results.length,0);
  now+=20000;assert.equal((await s.tick({severity:5})).results.length,1);
  assert.equal(calls,2);
  assert.equal(s.snapshot().find(x=>x.id==='voz-perguntas').status,'NOT_STARTED');
  s.stop();assert.equal((await s.tick()).status,'STOPPED');
});
test('source exclusions are enforced by the agent dispatcher',async()=>{
  let calls=0;
  const s=createRjAgentSupervisor({enabled:true,now:()=>Date.parse('2026-11-13T15:00:00Z'),handlers:{
    'maritimo-rj':{sourceId:'chm',run:()=>{calls++;}}
  }});
  const r=await s.tick();
  assert.equal(r.results[0].status,'BLOCKED');
  assert.equal(calls,0);
});
test('01h BRT daily job respects local clock and is not a continuous live worker',async()=>{
  let at=Date.parse('2026-11-13T03:59:00Z'),calls=0;
  const s=createRjAgentSupervisor({enabled:true,now:()=>at,handlers:{
    'rotina-01h':{run:()=>{calls++;}}
  }});
  assert.equal((await s.tick()).results.length,0);
  at=Date.parse('2026-11-13T04:00:00Z');
  assert.equal((await s.tick()).results.length,1);
  assert.equal((await s.tick()).results.length,0);
  at=Date.parse('2026-11-14T04:00:00Z');
  assert.equal((await s.tick()).results.length,1);
  assert.equal(calls,2);
});
