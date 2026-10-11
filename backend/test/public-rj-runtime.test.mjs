import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicRjRuntime } from '../src/public-rj-runtime.mjs';

function response() {
  return {
    statusCode:0,headers:{},body:null,
    setHeader(key,value){this.headers[key]=value},
    end(body){this.body=JSON.parse(body)},
  };
}
const makeWorker=()=>{
  let started=0,stopped=0;
  const worker={
    status(){return {enabled:true,started:true,sources:[]}},
    readSource(){return null},
    start(){started++;return true},
    stop(){stopped++;return true},
    get starts(){return started},
    get stops(){return stopped},
  };
  return worker;
};
test('public runtime works without ANY Google Play monthly/annual products or credentials',async()=>{
  const worker=makeWorker();
  const runtime=createPublicRjRuntime({
    env:{PORT:'8080'},worker,fetchImpl:async()=>{throw Error('must never fetch')},
  });
  assert.equal(runtime.state.billingConfigured,false);
  assert.equal(runtime.state.statusEndpointEnabled,false);
  assert.equal(runtime.state.stationWeatherEndpointEnabled,false);
  const health=response();
  await runtime.handler({url:'/healthz',method:'GET'},health);
  assert.equal(health.statusCode,200);
  assert.equal(health.body.service,'blaise-v6-rj-public');
  const ready=response();
  await runtime.handler({url:'/readyz',method:'GET'},ready);
  assert.equal(ready.statusCode,200);
  const noPurchase=response();
  await runtime.handler({url:'/v1/entitlements/verify',method:'POST'},noPurchase);
  assert.equal(noPurchase.statusCode,404);
  const inaccessible=response();
  await runtime.handler({url:'/v1/public/rj-meteorology?ibge=3304557&variable=TEMPERATURA_C',method:'GET'},inaccessible);
  assert.equal(inaccessible.statusCode,404);
  assert.equal(worker.starts,0);
  assert.equal(runtime.stop(),true);
  assert.equal(worker.stops,1);
  const after=response();
  await runtime.handler({url:'/healthz',method:'GET'},after);
  assert.equal(after.statusCode,503);
});
test('licensed weather route never bypasses source failure into imaginary observations',async()=>{
  const runtime=createPublicRjRuntime({
    env:{BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED:'true',
      BLAISE_RJ_INMET_STATION_TERMS_APPROVED:'true',
      BLAISE_RJ_METEOROLOGY_ENABLED:'true'},
    worker:makeWorker(),now:()=>Date.parse('2026-10-10T18:00:00Z'),
    fetchImpl:async()=>{throw Error('offline')},
  });
  assert.equal(runtime.state.stationWeatherEndpointEnabled,true);
  const reply=response();
  await runtime.handler({url:'/v1/public/rj-meteorology?ibge=3304557&variable=TEMPERATURA_C',
    method:'GET'},reply);
  assert.equal(reply.statusCode,503);
  assert.equal(reply.body.error,'official_weather_integration_unavailable');
});
test('public weather source term flag alone never turns on permission',async()=>{
  const runtime=createPublicRjRuntime({
    env:{BLAISE_RJ_METEOROLOGY_ENABLED:'true',
      BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED:'true'},
    worker:makeWorker(),
  });
  assert.equal(runtime.state.stationWeatherEndpointEnabled,false);
  const result=response();
  await runtime.handler({url:'/v1/public/rj-meteorology?ibge=3304557&variable=TEMPERATURA_C',
    method:'GET'},result);
  assert.equal(result.statusCode,404);
});
test('retired INEA source is always refused and does not initiate polling',()=>{
  assert.throws(()=>createPublicRjRuntime({
    env:{BLAISE_INEA_STATION_URL:'https://any.example.org/inea'},
    worker:makeWorker(),
  }),/retired_inea_source_forbidden/);
});
