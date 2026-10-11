import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import { INMET_SOURCE_ID,INMET_CAP_RSS_URL } from '../src/inmet-source.mjs';
import {createRjSevereCadenceController}
  from '../src/rj-severe-cadence-controller.mjs';

const now=Date.parse('2026-10-11T03:00:00Z');
const stamp=new Date(now-60_000).toISOString();
function fixture({high=true,connected=true,hydroPriority=1}={}){
  let mode='normal';
  const changes=[];
  const hydro={sourceId:'cemaden-rj-hydrological-risk',
    fetchedAt:stamp,state:'CURRENT',snapshot:{
      sourceId:'cemaden-rj-hydrological-risk',
      records:RJ_MUNICIPALITIES.map(c=>({
        ibge:c.ibge,observedAt:stamp,priority:
          c.ibge==='3304557'?hydroPriority:1,
        risk:'Fixture risk',redec:'Capital',
      })),
    }};
  const cap={sourceId:INMET_SOURCE_ID,fetchedAt:stamp,state:'CURRENT',
    snapshot:{sourceId:INMET_SOURCE_ID,sourceUrl:INMET_CAP_RSS_URL,
      rjWarnings:high?[{
        identifier:'fixture-cap',msgType:'Alert',status:'Actual',
        sent:stamp,onset:stamp,
        expires:new Date(now+3600_000).toISOString(),
        event:'Chuva intensa',severity:'Severe',
        rjMunicipalityIbges:['3304557'],
      }]:[],
    }};
  return {worker:{
    status:()=>({enabled:connected,started:connected,mode,sources:[hydro,cap]}),
    readSource:id=>id===hydro.sourceId?hydro:id===cap.sourceId?cap:null,
    setMode:next=>{changes.push(next);mode=next;},
  },changes};
}
test('current official high severity switches from 60s to 30s refresh (not faster) and recalculates Vector',()=>{
  const f=fixture();
  const levels=[];
  const ctl=createRjSevereCadenceController({
    worker:f.worker,vector:{setSeverity:l=>levels.push(l)},
    now:()=>now,enabled:true,
  });
  const result=ctl.evaluate();
  assert.equal(result.status,'VERIFIED_SOURCE_DRIVEN_CADENCE');
  assert.equal(result.mode,'severe');
  assert.equal(result.highestCurrentOfficialScale,4);
  assert.equal(result.sourceRefreshTargetMs,30_000);
  assert.deepEqual(f.changes,['severe']);
  assert.deepEqual(levels,[4]);
  assert.equal(result.alertPublished,false);
  assert.equal(result.audioTriggered,false);
  assert.equal(ctl.snapshot()['25SecondPollingAuthorized'],false);
});
test('officially lower subsequent risk can return refresh mode to normal without pretending total safety',()=>{
  const f=fixture({high:false});
  f.worker.setMode('severe');
  const ctl=createRjSevereCadenceController({
    worker:f.worker,now:()=>now,enabled:true,
  });
  const result=ctl.evaluate();
  assert.equal(result.mode,'normal');
  assert.deepEqual(f.changes,['severe','normal']);
  assert.equal(result.highestCurrentOfficialScale,1);
  assert.equal(result.alertPublished,false);
});
test('high CEMADEN municipal hydrological risk changes cadence even without a storm warning',()=>{
  const f=fixture({high:false,hydroPriority:5});
  const result=createRjSevereCadenceController({
    worker:f.worker,now:()=>now,enabled:true,
  }).evaluate();
  assert.equal(result.mode,'severe');
  assert.equal(result.highestCurrentOfficialScale,5);
  assert.equal(result.audioTriggered,false);
});
test('loss of official worker availability NEVER downgrades current severe mode nor emits false all-clear',()=>{
  const f=fixture({connected:false});
  f.worker.setMode('severe');
  const ctl=createRjSevereCadenceController({
    worker:f.worker,now:()=>now,enabled:true,
  });
  const r=ctl.evaluate();
  assert.equal(r.status,'PRESERVE_EXISTING_MODE_DURING_SOURCE_OUTAGE');
  assert.deepEqual(f.changes,['severe']);
  assert.equal(r.externalSourcePolling,false);
});
test('off by default, manual severe override allowed only with enabled operator configuration',()=>{
  const f=fixture({high:false});
  const disabled=createRjSevereCadenceController({
    worker:f.worker,now:()=>now,
  });
  assert.equal(disabled.evaluate().status,'DISABLED_BY_OPERATOR');
  assert.deepEqual(f.changes,[]);
  const forced=createRjSevereCadenceController({
    worker:f.worker,now:()=>now,enabled:true,operatorSevereOverride:true,
  });
  assert.equal(forced.evaluate().mode,'severe');
});
