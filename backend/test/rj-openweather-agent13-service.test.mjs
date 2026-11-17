import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjOpenWeatherAgent13Service} from '../src/rj-openweather-agent13-service.mjs';

const NOW=Date.parse('2026-11-14T00:00:00Z');
const target={ibge:'3304557',latitude:-22.91,longitude:-43.22};
const API_KEY='f'.repeat(32); // synthetic fixture only
const payload={lat:-22.91,lon:-43.22,data:[{
  dt:Math.floor((NOW-30_000)/1000),temp:28.5,feels_like:31.1,
  wind_speed:3.1,humidity:70,wind_gust:7.2
}]};
function fakeDatabase(){
  const map=new Map();let queue=Promise.resolve();
  return {
    collection(name){return {doc(id){const key=name+'/'+id;return {
      async get(){return {exists:map.has(key),data:()=>structuredClone(map.get(key))};},
      async set(x){map.set(key,structuredClone(x));},
      key
    };}};},
    async runTransaction(fn){
      const work=async()=>{
        const pending=[];
        const tx={
          async get(ref){return ref.get();},
          set(ref,value){pending.push([ref.key,structuredClone(value)]);}
        };
        const result=await fn(tx);
        for(const [key,value] of pending)map.set(key,value);
        return result;
      };
      const next=queue.then(work,work);
      queue=next.then(()=>{},()=>{});
      return next;
    }
  };
}
const readyEnv={
  BLAISE_OPENWEATHER_AGENT13_ENABLED:'true',
  BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED:'true',
  BLAISE_OPENWEATHER_API_KEY:API_KEY
};
test('no data source calls without explicit production gates and shared Firestore DB',async()=>{
  let calls=0;
  for(const opts of [
    {env:{},database:fakeDatabase()},
    {env:readyEnv,database:null},
    {env:{...readyEnv,BLAISE_OPENWEATHER_AGENT13_ENABLED:'false'},database:fakeDatabase()},
    {env:{...readyEnv,BLAISE_OPENWEATHER_API_KEY:''},database:fakeDatabase()}
  ]){
    const agent=createRjOpenWeatherAgent13Service({
      ...opts,clock:()=>NOW,fetchImpl:async()=>{calls++;throw Error('should not call');}
    });
    assert.equal(agent.configured,false);
    assert.equal((await agent.collect({target})).status,'UNAVAILABLE');
  }
  assert.equal(calls,0);
});
test('full service wiring uses Firestore quota/cache and never returns secret',async()=>{
  let fetches=0;
  const agent=createRjOpenWeatherAgent13Service({
    env:readyEnv,database:fakeDatabase(),clock:()=>NOW,
    fetchImpl:async()=>{fetches++;
      return new Response(JSON.stringify(payload),{
        status:200,headers:{'content-type':'application/json'}
      });
    }
  });
  assert.equal(agent.configured,true);
  assert.equal(agent.automaticSchedulingEnabled,false);
  assert.equal(agent.publishedToAndroid,false);
  const result=await agent.collect({target,now:NOW});
  assert.equal(result.status,'CURRENT_ESTIMATE_AVAILABLE');
  assert.equal(result.weather.values.temperatureC,28.5);
  assert.equal(result.weather.values.providerFeelsLikeC,31.1);
  assert.equal(result.weather.officialObservation,false);
  assert.equal(result.secretExposed,false);
  assert.equal(JSON.stringify(result).includes(API_KEY),false);
  const again=await agent.collect({target,now:NOW});
  assert.equal(again.status,'CURRENT_ESTIMATE_AVAILABLE');
  assert.equal(fetches,1); // cached across explicit calls
});
