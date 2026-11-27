import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWeatherApiMinuteLock,
  runLockedWeatherApiMinute
} from '../src/rj-weatherapi-minute-lock.mjs';

const now=Date.UTC(2026,11,1,12,0);

function setup(){

  let row;
  let calls=0;
  let writes=0;
  let queue=Promise.resolve();

  const db={
    collection:()=>({doc:()=>({})}),

    runTransaction(fn){
      const task=queue.then(()=>fn({
        get:async()=>({
          exists:row!==undefined,
          data:()=>row
        }),

        set:(_,value)=>{
          row=value;
          writes++;
        }
      }));

      queue=task.catch(()=>{});
      return task;
    }
  };

  const lock=createWeatherApiMinuteLock({db});

  return {
    db,lock,
    calls:()=>calls,
    writes:()=>writes,

    options:{
      lock,
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
  const s=setup();

  const r=await runLockedWeatherApiMinute({
    ...s.options,enabled:false
  });

  assert.equal(r.status,'DRY_RUN');
  assert.equal(s.calls(),0);
  assert.equal(s.writes(),0);
});

test('bloqueia duas execucoes simultaneas',async()=>{
  const s=setup();

  const rows=await Promise.all([
    runLockedWeatherApiMinute(s.options),
    runLockedWeatherApiMinute(s.options)
  ]);

  assert.equal(s.calls(),3);
  assert.equal(s.writes(),1);

  assert.ok(rows.some(
    r=>r.status==='DUPLICATE_MINUTE_BLOCKED'
  ));

  assert.ok(rows.some(
    r=>r.status==='MINUTE_COMPLETED'
  ));
});

test('permite o minuto seguinte',async()=>{
  const s=setup();

  assert.equal(await s.lock.claim(now),true);
  assert.equal(await s.lock.claim(now+60000),true);
  assert.equal(s.writes(),2);
});

test('rejeita minutos anteriores',async()=>{
  const s=setup();

  assert.equal(await s.lock.claim(now),true);
  assert.equal(await s.lock.claim(now-60000),false);
});

test('bloqueia quando Firestore falha',async()=>{
  const s=setup();

  s.options.lock={
    claim:async()=>{
      throw Error('FIRESTORE_UNAVAILABLE');
    }
  };

  const r=await runLockedWeatherApiMinute(s.options);

  assert.equal(r.status,'LOCK_UNAVAILABLE');
  assert.equal(s.calls(),0);
});

test('preserva bloqueio apos reinicializacao',async()=>{
  const s=setup();

  assert.equal(await s.lock.claim(now),true);

  const restarted=createWeatherApiMinuteLock({
    db:s.db
  });

  assert.equal(await restarted.claim(now),false);
});

test('mantem publicacao desativada',async()=>{
  const s=setup();

  const r=await runLockedWeatherApiMinute(s.options);

  assert.equal(r.publicationEnabled,false);
  assert.equal(r.paidCallsAllowed,false);
});
