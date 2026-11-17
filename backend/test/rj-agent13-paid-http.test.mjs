import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  AGENT13_PAID_HTTP_PATH,
  AGENT13_PAID_HTTP_CONTRACT,
  createPaidAgent13HttpHandler,
  projectAgent13CurrentEstimate,
} from '../src/rj-agent13-paid-http.mjs';

const NOW = Date.parse('2026-11-17T09:00:00Z');
const config = {
  packageName:'br.com.blaise.rj',
  monthlyProductId:'monthly.test',
  annualProductId:'annual.test',
  allowTestPurchases: false,
  requireSubscriberIdentity: false,
};
const originalSecret = 'not-an-api-key-fixture';
const targetIbge = '3304557';
const sample = ({
  status:'CURRENT_ESTIMATE_AVAILABLE',
  weather:{
    status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
    sourceId:'OPENWEATHER_ONECALL4_CURRENT',
    ibge:targetIbge,
    type:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT',
    officialObservation:false,
    officialAlert:false,
    validAt:new Date(NOW - 60_000).toISOString(),
    retrievedAt:new Date(NOW).toISOString(),
    values:{
      temperatureC:26.5,providerFeelsLikeC:27.8,relativeHumidityPct:60,
      windKmh:0,gustKmh:null,pressureHpa:1015,rainMm1h:null
    },
    rawKey:originalSecret,
  },
});
const purchase = {
  packageName:config.packageName,
  purchaseToken:'purchase-token-123456',
  productIds:['monthly.test'],
  municipalityIbge:3304557,
};
const gateway={
  async getSubscription(){return {
    subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    lineItems:[{productId:'monthly.test',expiryTime:'2099-01-01T00:00:00Z'}],
  }},
  async acknowledge(){},
};
function handlerWith(overrides={}){
  const upstream=(req,res)=>{res.statusCode=404;res.end();};
  return createPaidAgent13HttpHandler(upstream,{
    config,gateway,clock:()=>NOW,
    agent13Runtime:{
      configured:true,
      async collect(){return sample;},
    },
    ...overrides
  });
}
async function withHttp(handler,fn){
  const s=http.createServer(handler);
  await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
  try{return await fn(`http://127.0.0.1:${s.address().port}`);}
  finally{await new Promise(resolve=>s.close(resolve));}
}
async function request(base,body=purchase){
  return fetch(base+AGENT13_PAID_HTTP_PATH,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}
test('read-only display contract filters provider secret and labels model, not observation',()=>{
  const result=projectAgent13CurrentEstimate(sample,targetIbge,NOW);
  assert.equal(result.contract,AGENT13_PAID_HTTP_CONTRACT);
  assert.equal(result.nature,'ESTIMATIVA_DE_MODELO');
  assert.equal(result.values.temperatureC,26.5);
  assert.equal(result.values.windKmh,0);
  assert.equal(result.values.rainMm1h,null);
  assert.equal(JSON.stringify(result).includes(originalSecret),false);
  assert.equal(result.officialObservation,false);
  assert.equal(result.officialAlert,false);
});
test('rejects model reading older than 12 minutes and reading from future',()=>{
  for(const offset of [12*60_000+1,-1]){
    const stale=structuredClone(sample);
    stale.weather.validAt=new Date(NOW-offset).toISOString();
    assert.equal(projectAgent13CurrentEstimate(stale,targetIbge,NOW),null);
  }
});
test('active purchase may explicitly request one bounded city model estimate',async()=>{
  let collectionCount=0;
  await withHttp(handlerWith({agent13Runtime:{configured:true,async collect({target,now}){
    collectionCount++;assert.equal(target.ibge,targetIbge);assert.equal(now,undefined);
    return sample;
  }}}),async base=>{
    const r=await request(base);
    assert.equal(r.status,200);
    assert.equal(r.headers.get('cache-control'),'no-store');
    const data=await r.json();
    assert.equal(data.contract,AGENT13_PAID_HTTP_CONTRACT);
    assert.equal(data.status,'CURRENT_ESTIMATE_AVAILABLE');
    assert.equal(data.values.rainMm1h,null);
    assert.equal(JSON.stringify(data).includes(purchase.purchaseToken),false);
  });
  assert.equal(collectionCount,1);
});
test('never calls provider when purchase entitlement is inactive',async()=>{
  let collections=0;
  const h=handlerWith({
    gateway:{
      ...gateway,
      async getSubscription(){return null;},
    },
    agent13Runtime:{configured:true,async collect(){collections++;return sample;}}
  });
  await withHttp(h,async base=>{
    const r=await request(base);assert.equal(r.status,403);
    assert.deepEqual(await r.json(),{error:'access_denied'});
  });
  assert.equal(collections,0);
});
test('subscriber identity gate rejects unauthenticated client before provider lookup',async()=>{
  let purchaseChecks=0;
  const h=handlerWith({
    config:{...config,requireSubscriberIdentity:true},
    gateway:{async getSubscription(){purchaseChecks++;return null;}},
    subscriberVerifier:async()=>null,
  });
  await withHttp(h,async base=>{const r=await request(base);assert.equal(r.status,401);});
  assert.equal(purchaseChecks,0);
});
test('does not call provider for non-calibrated but valid RJ city; no made-up coordinates',async()=>{
  let collections=0;
  const h=handlerWith({agent13Runtime:{configured:true,async collect(){collections++;return sample;}}});
  await withHttp(h,async base=>{
    const r=await request(base,{...purchase,municipalityIbge:3300100});
    assert.equal(r.status,503);
    assert.deepEqual(await r.json(),{error:'estimate_unavailable'});
  });
  assert.equal(collections,0);
});
test('disabled or malformed request never calls provider',async()=>{
  let collections=0;
  const h=handlerWith({agent13Runtime:{configured:false,async collect(){collections++;return sample;}}});
  await withHttp(h,async base=>{
    const disabled=await request(base);
    assert.equal(disabled.status,503);
    const invalid=await request(base,{...purchase,latitude:0,longitude:0});
    assert.equal(invalid.status,400);
    const invalidCity=await request(base,{...purchase,municipalityIbge:9999999});
    assert.equal(invalidCity.status,400);
  });
  assert.equal(collections,0);
});

test('HTTP projects current data using clock after collecting, never request-start time',async()=>{
  let ticks=0;
  const later=structuredClone(sample);
  later.weather.validAt=new Date(NOW+1000).toISOString();
  later.weather.retrievedAt=new Date(NOW+2000).toISOString();
  const clock=()=>{ticks++;return NOW+2000;};
  const handler=handlerWith({
    clock,
    agent13Runtime:{configured:true,async collect({now}){
      assert.equal(now,undefined);
      return later;
    }}
  });
  await withHttp(handler,async base=>{
    const response=await request(base);
    assert.equal(response.status,200);
    assert.equal((await response.json()).validAt,new Date(NOW+1000).toISOString());
  });
  assert.equal(ticks,1);
});
