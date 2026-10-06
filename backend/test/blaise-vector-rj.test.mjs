import test from 'node:test';
import assert from 'node:assert/strict';
import {advectLocal,windComponents,fuseComparableReadings,createBlaiseVectorRjAgent} from '../src/blaise-vector-rj.mjs';
const now=Date.parse('2026-10-06T20:00:00Z');
const policy={version:'test-fixture',status:'CALIBRATED',weights:{a:1,b:3},maxAgeMs:60000,maxSkewMs:10000,maxSpread:3};
const rows=['a','b'].map((id,i)=>({sourceId:id,independentSourceId:id,sourceUrl:'https://example.org/'+id,scopeId:'station:1',variable:'temperature',unit:'C',nature:'OBSERVADO',observedAt:'2026-10-06T19:59:50Z',value:25+2*i}));
test('local SI advection bounded horizon',()=>{assert.equal(advectLocal({xMeters:0,yMeters:0,uMetersPerSecond:2,vMetersPerSecond:1,seconds:60}).xMeters,120);assert.throws(()=>advectLocal({xMeters:0,yMeters:0,uMetersPerSecond:1,vMetersPerSecond:1,seconds:9000}));});
test('wind FROM direction wraps correctly',()=>{assert.ok(Math.abs(windComponents(10,0).northKmh+10)<1e-8);assert.ok(Math.abs(windComponents(10,360).eastKmh)<1e-8);assert.ok(Math.abs(windComponents(10,90).eastKmh+10)<1e-8);});
test('explicit weights preserve provenance without claiming confidence',()=>{const r=fuseComparableReadings(rows,policy,now);assert.equal(r.value,26.5);assert.equal(r.confidencePercent,null);assert.equal(r.officialAlert,false);});
test('rejects invented policy and incompatible scope/nature',()=>{assert.throws(()=>fuseComparableReadings(rows,{...policy,status:'PENDING'},now));for(const patch of [{scopeId:'Niteroi'},{nature:'MODELO'}])assert.throws(()=>fuseComparableReadings([rows[0],{...rows[1],...patch}],policy,now));});
test('rejects stale future duplicate and divergent observations',()=>{for(const patch of [{observedAt:'2026-10-06T18:00:00Z'},{observedAt:'2026-10-06T21:00:00Z'},{independentSourceId:'a'},{value:40}])assert.throws(()=>fuseComparableReadings([rows[0],{...rows[1],...patch}],policy,now));});
test('agent cadence and unavailable state',async()=>{const a=createBlaiseVectorRjAgent({now:()=>now,fetchImpl:async()=>{throw Error('down');}});assert.equal(a.snapshot().scheduler.refreshIntervalMs,300000);a.setSeverity(5);assert.equal(a.snapshot().scheduler.refreshIntervalMs,30000);a.start();await a.tick();assert.equal(a.snapshot().result.status,'UNAVAILABLE');a.stop();});
test('scientific jobs run through the agent without treating source outage as a validated live forecast',async()=>{
 const source={sourceId:'test',sourceUrl:'https://example.org',scopeId:'state:RJ',quality:'VALIDATED',nature:'OBSERVADO',observedAt:'2026-10-06T19:59:00Z',validAt:'2026-10-06T19:59:00Z'};
 const a=createBlaiseVectorRjAgent({now:()=>now,fetchImpl:async()=>{throw Error('down');},readScientificJobs:()=>[{id:'test-stress',method:'oceanWindStress',scopeId:'state:RJ',validAt:source.validAt,maxAgeMs:300000,sources:[source],inputs:{airDensityKgm3:1.2,dragCoefficient:0.001,wind10mMs:10}}]});
 a.start();try{await a.tick();const result=a.snapshot().result;assert.equal(result.status,'UNAVAILABLE');assert.equal(result.scientificCalculations[0].status,'CALCULATED_INPUTS_ONLY');assert.equal(result.scientificCalculations[0].result.value,0.12);assert.equal(result.officialAlert,false);}finally{a.stop();}
});
test('scientific provider failure leaves live observation failure explicit and stops cleanly',async()=>{
 const a=createBlaiseVectorRjAgent({now:()=>now,fetchImpl:async()=>{throw Error('down');},readScientificJobs:()=>{throw Error('provider down');}});
 a.start();try{await a.tick();assert.equal(a.snapshot().result.scientificCalculations[0].reason,'scientific_provider_failed');}finally{a.stop();}
});
