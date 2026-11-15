import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjAgent13SupervisedIntegration as create} from '../src/rj-agent13-supervised-integration.mjs';

const KEY='f'.repeat(32); // synthetic, NOT a real credential
const TARGET={ibge:'3304557',latitude:-22.9068,longitude:-43.1729};
const ENV={
 BLAISE_OPENWEATHER_ENABLED:'true',
 BLAISE_OPENWEATHER_USAGE_APPROVED:'true',
 BLAISE_PUBLIC_OPENWEATHER_APPROVED:'true',
 BLAISE_OPENWEATHER_AGENT13_ENABLED:'true',
 BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED:'true',
 BLAISE_AGENT13_EXCLUSIVE_RUNNER_CONFIRMED:'true',
 BLAISE_OPENWEATHER_API_KEY:KEY,
};
function fakeDb({start=0,offline=false}={}) {
 let queue=Promise.resolve(); let count=start;
 return {
   read:()=>count,
   collection(name){return {doc(id){return {name,id};}};},
   async runTransaction(fn){
     if(offline) throw Error('FIRESTORE_DOWN');
     const next=queue.then(async()=>{
       const tx={
         async get(){return {exists:count>0,data:()=>({count})};},
         set(ref, doc){count=doc.count;}
       };
       return fn(tx);
     });
     queue=next.then(()=>{},()=>{});return next;
   }
 };
}
function fakeService({env,database,fetchImpl}) {
 const configured=env.BLAISE_OPENWEATHER_AGENT13_ENABLED==='true' && !!database;
 return {configured,async collect({target,now}) {
   if(!configured) return {status:'UNAVAILABLE'};
   try {
     const permitted=await database.runTransaction(async tx=>{
       const snapshot=await tx.get();
       const n=snapshot.exists?snapshot.data().count:0;
       if(n>=900)return false;
       tx.set(null,{count:n+1});return true;
     });
     if(!permitted)return {status:'UNAVAILABLE',reason:'QUOTA_EXHAUSTED'};
     return await fetchImpl({target,now});
   } catch {return {status:'UNAVAILABLE',reason:'FIRESTORE_UNAVAILABLE'};}
 }};
}
function fakeSupervisor({enabled,handlers}) {
 let stopped=false;
 return {
   snapshot:()=>[{id:'openweather-rj',configured:Boolean(handlers['openweather-rj'])}],
   stop:()=>{stopped=true;},
   onDemandOpenWeather:async()=> !enabled||stopped ? {status:'DISABLED'} :
     handlers['openweather-rj'].run({now:Date.parse('2026-11-15T12:00:00Z')})
 };
}
function setup(overrides={}) {
 const opts={env:ENV,database:fakeDb(),
   targetProvider:async()=>TARGET,serviceFactory:fakeService,
   supervisorFactory:fakeSupervisor,
   now:()=>Date.parse('2026-11-15T12:00:00Z'),
   fetchImpl:async()=>({status:'CURRENT_ESTIMATE_AVAILABLE',weather:{source:'OpenWeather'}}),...overrides};
 return create(opts);
}
test('no trigger without administrator authentication',async()=>{
 let calls=0;const s=setup({fetchImpl:async()=>{calls++;return {};}});
 assert.deepEqual(await s.onDemand(),{status:'BLOCKED',reason:'ADMIN_AUTH_REQUIRED'});
 assert.equal(calls,0);
});
test('requires all six policy gates and secret',async()=>{
 for(const key of Object.keys(ENV)){
   let calls=0;const s=setup({env:{...ENV,[key]:''},fetchImpl:async()=>{calls++;return {};}});
   assert.equal(s.configured,false,key);
   assert.equal((await s.onDemand({adminAuthorized:true})).status,'DISABLED');
   assert.equal(calls,0);
 }
});
test('Firestore absent blocks configuration and provider',async()=>{
 let calls=0;
 const s=setup({database:null,fetchImpl:async()=>{calls++;return {};}});
 assert.equal(s.configured,false);
 await s.onDemand({adminAuthorized:true});assert.equal(calls,0);
});
test('Firestore transaction failure fails closed with zero provider requests',async()=>{
 let calls=0;
 const s=setup({database:fakeDb({offline:true}),fetchImpl:async()=>{calls++;return {};}});
 const r=await s.onDemand({adminAuthorized:true});
 assert.equal(r.status,'UNAVAILABLE');assert.equal(calls,0);
});
test('quota at 900 fails closed and 901st request is not made',async()=>{
 let calls=0;
 const db=fakeDb({start:899});
 const s=setup({database:db,fetchImpl:async()=>{calls++;return {status:'CURRENT_ESTIMATE_AVAILABLE'};}});
 assert.equal((await s.onDemand({adminAuthorized:true})).status,'CURRENT_ESTIMATE_AVAILABLE');
 assert.equal((await s.onDemand({adminAuthorized:true})).status,'UNAVAILABLE');
 assert.equal(calls,1);assert.equal(db.read(),900);
});
test('server-only valid municipality target; no guessed coordinates',async()=>{
 let calls=0;
 const s=setup({targetProvider:async()=>({ibge:'3304557',latitude:null,longitude:null}),fetchImpl:async()=>{calls++;return {};}});
 const r=await s.onDemand({adminAuthorized:true});
 assert.equal(r.reason,'NO_VERIFIED_SERVER_TARGET');assert.equal(calls,0);
});
test('keeps scheduling and public publication disabled',async()=>{
 const s=setup();
 assert.equal(s.automaticSchedulingEnabled,false);
 assert.equal(s.publishedToAndroid,false);
 assert.equal(s.snapshot()[0].configured,true);
 s.stop();assert.equal((await s.onDemand({adminAuthorized:true})).status,'DISABLED');
});
test('outage while determining server target is handled without provider call',async()=>{
 let calls=0;
 const s=setup({targetProvider:async()=>{throw Error('DB_OFFLINE');},fetchImpl:async()=>{calls++;return {};}});
 const r=await s.onDemand({adminAuthorized:true});
 assert.equal(r.status,'UNAVAILABLE');assert.equal(calls,0);
});

test('supervisor does not report unavailable weather as successful weather',async()=>{
 const s=setup({supervisorFactory:()=>({
   snapshot:()=>[],stop:()=>{},
   onDemandOpenWeather:async()=>({status:'COMPLETED',result:{status:'UNAVAILABLE',reason:'ATOMIC_QUOTA_UNAVAILABLE'}})
 })});
 const r=await s.onDemand({adminAuthorized:true});
 assert.equal(r.status,'UNAVAILABLE');
 assert.equal(r.reason,'ATOMIC_QUOTA_UNAVAILABLE');
 assert.equal(r.officialAlert,false);
});
