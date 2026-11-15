import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';

const src=new URL('../src/',import.meta.url);
const file=(name)=>{
  const direct=new URL(name,src);
  const isolated=new URL('admin-integration/'+name,src);
  const selected=existsSync(direct)?direct:isolated;
  if(!existsSync(selected))throw Error('AGENT13_REQUIRED_MODULE_MISSING:'+name);
  return selected.href;
};
const [
  {createRjAgent13SupervisedIntegration},
  {createRjOpenWeatherAgent13Service},
  {createRjAgentSupervisor}
]=await Promise.all([
  import(file('rj-agent13-supervised-integration.mjs')),
  import(file('rj-openweather-agent13-service.mjs')),
  import(file('blaise-rj-agent-supervisor.mjs'))
]);

const NOW=Date.parse('2026-11-15T12:00:00Z');
const DAY='2026-11-15',KEY='f'.repeat(32); // synthetic fixture
const TARGET={ibge:'3304557',latitude:-22.91,longitude:-43.22};
const QUOTA='blaise_rj_openweather_daily_quota/'+DAY;
const ENV={
  BLAISE_OPENWEATHER_ENABLED:'true',
  BLAISE_OPENWEATHER_USAGE_APPROVED:'true',
  BLAISE_PUBLIC_OPENWEATHER_APPROVED:'true',
  BLAISE_OPENWEATHER_AGENT13_ENABLED:'true',
  BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED:'true',
  BLAISE_AGENT13_EXCLUSIVE_RUNNER_CONFIRMED:'true',
  BLAISE_OPENWEATHER_API_KEY:KEY
};
function dbFake({quotaCount=0,failTransactions=false,failReads=false}={}) {
  const data=new Map();
  if(quotaCount>0)data.set(QUOTA,{provider:'OPENWEATHER_ONECALL4_CURRENT',utcDay:DAY,count:quotaCount,maximum:900,updatedAtMs:NOW});
  let chain=Promise.resolve();
  const makeRef=key=>({
    key,
    async get(){
      if(failReads)throw Error('FIRESTORE_READ_UNAVAILABLE');
      return {exists:data.has(key),data:()=>structuredClone(data.get(key))};
    },
    async set(v){data.set(key,structuredClone(v));}
  });
  return {
    data,
    collection(name){return {doc(id){return makeRef(name+'/'+id);}};},
    async runTransaction(fn){
      if(failTransactions)throw Error('FIRESTORE_TRANSACTION_UNAVAILABLE');
      const work=async()=>{
        const updates=[];
        const tx={get:ref=>ref.get(),set:(ref,value)=>updates.push([ref.key,structuredClone(value)])};
        const result=await fn(tx);
        for(const [key,value] of updates)data.set(key,value);
        return result;
      };
      const current=chain.then(work,work);
      chain=current.then(()=>{},()=>{});
      return current;
    }
  };
}
const payload={
  lat:TARGET.latitude,lon:TARGET.longitude,
  data:[{dt:Math.floor((NOW-30_000)/1000),temp:28.5,feels_like:31.1,wind_speed:3.1,humidity:70}]
};
function createTestBridge({database=dbFake(), env=ENV, targetProvider=async()=>TARGET, fetchImpl}={}) {
  return createRjAgent13SupervisedIntegration({
    database,env,targetProvider,
    fetchImpl:fetchImpl??(async()=>new Response(JSON.stringify(payload),{
      status:200,headers:{'content-type':'application/json'}
    })),
    serviceFactory:createRjOpenWeatherAgent13Service,
    supervisorFactory:createRjAgentSupervisor,
    now:()=>NOW
  });
}
test('real Agent13 service and supervisor: admin gate blocks the provider',async()=>{
  let calls=0;
  const s=createTestBridge({fetchImpl:async()=>{calls++;throw Error('NO_NETWORK');}});
  assert.equal((await s.onDemand()).status,'BLOCKED');
  assert.equal(calls,0);
  s.stop();
});
test('real Agent13 wiring: Firestore transaction outage prevents provider calls',async()=>{
  let calls=0;
  const s=createTestBridge({database:dbFake({failTransactions:true}),
    fetchImpl:async()=>{calls++;throw Error('NO_NETWORK');}});
  const r=await s.onDemand({adminAuthorized:true});
  assert.equal(r.status,'UNAVAILABLE');assert.equal(calls,0);
  s.stop();
});
test('real Agent13 wiring: cache read outage prevents provider calls',async()=>{
  let calls=0;
  const s=createTestBridge({database:dbFake({failReads:true}),
    fetchImpl:async()=>{calls++;throw Error('NO_NETWORK');}});
  const r=await s.onDemand({adminAuthorized:true});
  assert.equal(r.status,'UNAVAILABLE');assert.equal(calls,0);
  s.stop();
});
test('real Agent13 wiring: quota at 900 rejects 901st external request',async()=>{
  let calls=0;
  const s=createTestBridge({database:dbFake({quotaCount:900}),
    fetchImpl:async()=>{calls++;throw Error('NO_NETWORK');}});
  const r=await s.onDemand({adminAuthorized:true});
  assert.equal(r.status,'UNAVAILABLE');assert.equal(calls,0);
  s.stop();
});
test('real Agent13 wiring: two instances share quota and cache',async()=>{
  const database=dbFake();let calls=0;
  const fetchImpl=async()=>{calls++;return new Response(JSON.stringify(payload),{
    status:200,headers:{'content-type':'application/json'}
  });};
  const a=createTestBridge({database,fetchImpl});
  const b=createTestBridge({database,fetchImpl});
  const r1=await a.onDemand({adminAuthorized:true});
  const r2=await b.onDemand({adminAuthorized:true});
  assert.equal(r1.status,'COMPLETED');
  assert.equal(r1.result.status,'CURRENT_ESTIMATE_AVAILABLE');
  assert.equal(r1.result.weather.officialObservation,false);
  assert.equal(r2.status,'COMPLETED');
  assert.equal(r2.result.status,'CURRENT_ESTIMATE_AVAILABLE');
  assert.equal(calls,1);
  assert.equal(database.data.get(QUOTA)?.count,1);
  assert.equal(JSON.stringify(r1).includes(KEY),false);
  a.stop();b.stop();
});
test('real Agent13 wiring: exclusive-runner policy missing means no collection',async()=>{
  let calls=0;
  const s=createTestBridge({env:{...ENV,BLAISE_AGENT13_EXCLUSIVE_RUNNER_CONFIRMED:'false'},
    fetchImpl:async()=>{calls++;throw Error('NO_NETWORK');}});
  assert.equal(s.configured,false);
  assert.equal((await s.onDemand({adminAuthorized:true})).status,'DISABLED');
  assert.equal(calls,0);s.stop();
});
