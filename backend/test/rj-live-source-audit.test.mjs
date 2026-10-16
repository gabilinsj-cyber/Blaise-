import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjLiveSourceAudit} from '../src/rj-live-source-audit.mjs';

test('runtime hourly audit preserves source timestamps and records failure without repair',async()=>{
 let clock=Date.parse('2026-10-14T16:00:00Z');const observedAt=new Date(clock-120000).toISOString();
 const audit=createRjLiveSourceAudit({autoSchedule:false,now:()=>clock,worker:{status:()=>({started:true,sources:[
  {sourceId:'inmet',state:'CURRENT',fetchedAt:new Date(clock-60000).toISOString(),observedAt},
  {sourceId:'cemaden',state:'UNAVAILABLE',fetchedAt:null,observedAt:null},
 ]})}});
 audit.start();await audit.tick();
 let reports=audit.snapshot().reports;
 assert.equal(reports.length,1);assert.equal(reports[0].sources[0].observedAt,observedAt);
 assert.deepEqual(reports[0].failures,['cemaden']);assert.equal(reports[0].automaticRepairPerformed,false);
 clock+=30000;await audit.tick();assert.equal(audit.snapshot().reports.length,1);
 clock+=3600000;await audit.tick();assert.equal(audit.snapshot().reports.length,2);audit.stop();
});
test('01h audit uses Sao Paulo clock and runs once per local day',async()=>{
 let clock=Date.parse('2026-10-15T04:00:00Z');
 const audit=createRjLiveSourceAudit({autoSchedule:false,now:()=>clock,worker:{status:()=>({started:true,sources:[]})}});
 audit.start();await audit.tick();assert.equal(audit.snapshot().reports.filter(r=>r.agentNumber===10).length,1);
 clock+=30000;await audit.tick();assert.equal(audit.snapshot().reports.filter(r=>r.agentNumber===10).length,1);
 assert.equal(audit.snapshot().reports[1].fullSecurityAuditPerformed,false);audit.stop();
});
test('future collection times never appear current in the agent report',async()=>{
 const clock=Date.parse('2026-10-14T16:00:00Z');
 const audit=createRjLiveSourceAudit({autoSchedule:false,now:()=>clock,worker:{status:()=>({sources:[
  {sourceId:'future',state:'CURRENT',fetchedAt:new Date(clock+1).toISOString()},
 ]})}});audit.start();await audit.tick();assert.deepEqual(audit.snapshot().reports[0].failures,['future']);audit.stop();
});
