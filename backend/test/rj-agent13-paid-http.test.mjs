import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  AGENT13_PAID_HTTP_PATH,
  AGENT13_PAID_HTTP_CONTRACT,
  createPaidAgent13HttpHandler,
  projectAgent13CurrentEstimate,
  projectAgent13ThermalContingency,
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
  assert.deepEqual(Object.keys(result.values),['temperatureC','feelsLikeC']);
  assert.equal(Object.hasOwn(result.values,'rainMm1h'),false);
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
const fallbackSample = Object.freeze({
  status:'FALLBACK_ESTIMATE',
  contract:'RJ_AGENT13_TEMP_FEELSLIKE_FALLBACK_V1',
  ibge:targetIbge,
  source:'OpenWeather One Call 4.0',
  nature:'ESTIMATIVA_OPENWEATHER_CONTINGENCIA_NAO_OBSERVACAO',
  validAt:new Date(NOW-60_000).toISOString(),
  checkedAt:new Date(NOW).toISOString(),
  fields:Object.freeze({temperatureC:26.5,feelsLikeC:27.8}),
  officialObservation:false,officialAlert:false,
  otherWeatherFieldsUsed:false,automaticAlertsAuthorized:false,
});
const auditedPrimarySources=Object.freeze([
  {rank:1,sourceId:'DWD_ICON_GLOBAL',status:'UNAVAILABLE'},
  {rank:2,sourceId:'NOAA_GFS',status:'UNAVAILABLE'},
  {rank:3,sourceId:'ECMWF_IFS',status:'UNAVAILABLE'},
]);
test('legacy direct OpenWeather request blocked without independent primary-source audit',async()=>{
  let collections=0;
  const h=handlerWith({agent13Runtime:{configured:true,async collect(){
    collections++;return sample;
  }}});
  await withHttp(h,async base=>{
    const r=await request(base);
    assert.equal(r.status,503);
    assert.deepEqual(await r.json(),{error:'estimate_unavailable'});
  });
  assert.equal(collections,0);
});
test('approved thermal-only fallback requires server-only three-source audit and never publishes rain or wind',async()=>{
  let calls=0,audits=0;
  const h=handlerWith({
    readAuditedThermalPrimarySources:async ibge=>{
      audits++;
      assert.equal(ibge,targetIbge);
      return auditedPrimarySources;
    },
    agent13Runtime:{
      configured:true,temperatureContingencyConfigured:true,
      async collectTemperatureContingency({municipalityIbge,prioritySources}){
        calls++;
        assert.equal(municipalityIbge,targetIbge);
        assert.deepEqual(prioritySources,auditedPrimarySources);
        return fallbackSample;
      },
      async collect(){throw Error('bypass must not be called');}
    }
  });
  await withHttp(h,async base=>{
    const r=await request(base);
    assert.equal(r.status,200);
    assert.equal(r.headers.get('cache-control'),'no-store');
    const data=await r.json();
    assert.equal(data.nature,'ESTIMATIVA_DE_MODELO_CONTINGENCIA_TERMICA');
    assert.deepEqual(Object.keys(data.values),['temperatureC','feelsLikeC']);
    assert.equal(data.values.temperatureC,26.5);
    assert.equal(JSON.stringify(data).includes(purchase.purchaseToken),false);
  });
  assert.equal(calls,1);
  assert.equal(audits,1);
});
test('thermal projector fails closed on unverified kind, stale 35m value and unsupported source',()=>{
  assert.equal(projectAgent13ThermalContingency(fallbackSample,targetIbge,NOW).values.feelsLikeC,27.8);
  assert.equal(projectAgent13ThermalContingency({...fallbackSample,source:'NOAA GFS'},targetIbge,NOW),null);
  assert.equal(projectAgent13ThermalContingency({...fallbackSample,validAt:new Date(NOW-35*60_000-1).toISOString()},targetIbge,NOW),null);
  assert.equal(projectAgent13ThermalContingency({...fallbackSample,officialAlert:true},targetIbge,NOW),null);
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

test('HTTP projects thermal data using response time, not the request-start time',async()=>{
  let ticks=0;
  const later={...fallbackSample,
    validAt:new Date(NOW+1000).toISOString(),
    checkedAt:new Date(NOW+2000).toISOString()};
  const handler=handlerWith({
    clock:()=>{ticks++;return NOW+2000;},
    readAuditedThermalPrimarySources:async()=>auditedPrimarySources,
    agent13Runtime:{
      configured:true,temperatureContingencyConfigured:true,
      async collectTemperatureContingency(){return later;},
      async collect(){throw Error('legacy bypass')}
    }
  });
  await withHttp(handler,async base=>{
    const response=await request(base);
    assert.equal(response.status,200);
    const value=await response.json();
    assert.equal(value.validAt,new Date(NOW+1000).toISOString());
    assert.deepEqual(Object.keys(value.values),['temperatureC','feelsLikeC']);
  });
  assert.equal(ticks,1);
});
