import test from 'node:test';
import assert from 'node:assert/strict';
import {collectRjWeatherApiFreeOne,createWeatherApiFreeUrl}
 from '../src/rj-weatherapi-free-92-collector.mjs';
const NOW=Date.parse('2026-11-22T15:00:00Z');
const env={
 BLAISE_WA_FREE_COLLECTION_ENABLED:'true',
 BLAISE_WA_FREE_PLAN_AND_BALANCE_CONFIRMED:'true',
 BLAISE_WA_KEY_IN_SECRET_MANAGER_VERIFIED:'true',
 BLAISE_WA_COMMERCIAL_TERMS_VERIFIED:'true',
 BLAISE_WA_ACCOUNT_EXTERNAL_USAGE_REVIEWED:'true',
 BLAISE_WA_OPERATOR_APPROVED:'true',
 BLAISE_WA_PAID_CALLS_ALLOWED:'false',
 BLAISE_WA_CLIENT_RELEASE_APPROVED:'false',
 BLAISE_WA_FREE_API_KEY:'VALID_SERVER_ONLY_KEY_123'
};
const raw=()=>({
 location:{lat:-22.91,lon:-43.20},
 current:{last_updated_epoch:Math.floor((NOW-15*60_000)/1000),
  temp_c:28.4,feelslike_c:31.0,humidity:65,wind_kph:14,
  gust_kph:25,precip_mm:0.6,cloud:45,pressure_mb:1012,
  uv:7,condition:{code:1003,text:'Partly cloudy'}}
});
test('without approvals it makes zero weather provider calls and no quota reservations',async()=>{
 let calls=0,reserves=0;
 const result=await collectRjWeatherApiFreeOne({
  ibge:'3304557',env:{},fetchImpl:async()=>{calls++},
  reserve:async()=>{reserves++},cache:{save:async()=>({saved:true})}
 });
 assert.equal(result.status,'DISABLED_OR_UNAVAILABLE');
 assert.equal(result.providerContacted,false);
 assert.equal(calls,0);
 assert.equal(reserves,0);
});
test('with controlled synthetic response it saves private, dated fields and never publishes',async()=>{
 let reservation=0,urlObserved=false,saved=null;
 const result=await collectRjWeatherApiFreeOne({
  ibge:'3304557',env,clock:()=>NOW,
  reserve:async a=>{reservation++;assert.equal(a.maxMonthlyCalls,80000);return {approved:true}},
  cache:{save:async data=>{saved=data;return {saved:true}}},
  fetchImpl:async(url,opts)=>{
   urlObserved=url.includes('current.json?');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.method,'GET');
   return {status:200,headers:{get:()=>null},text:async()=>JSON.stringify(raw())};
  }
 });
 assert.equal(result.status,'PRIVATE_CACHE_SAVED');
 assert.equal(reservation,1);
 assert.equal(urlObserved,true);
 assert.equal(result.clientPublishingEnabled,false);
 assert.equal(result.providerContacted,true);
 assert.equal(saved.status,'PRIVATE_CACHE_VALID');
 assert.equal(saved.sourceId,'WEATHERAPI_FREE');
 assert.equal(saved.data.last_updated_epoch,Math.floor((NOW-15*60_000)/1000));
 assert.equal(saved.data.condition.text,undefined);
 assert.equal(JSON.stringify(result).includes(env.BLAISE_WA_FREE_API_KEY),false);
});
test('quota-denied or stale source data never creates public live values',async()=>{
 let calls=0;
 const denied=await collectRjWeatherApiFreeOne({
  ibge:'3304557',env,reserve:async()=>({approved:false}),
  cache:{save:async()=>({saved:true})},
  fetchImpl:async()=>{calls++}
 });
 assert.equal(denied.providerContacted,false);
 assert.equal(calls,0);
 let saved=0;
 const stale=raw();stale.current.last_updated_epoch=Math.floor((NOW-40*60_000)/1000);
 const result=await collectRjWeatherApiFreeOne({
  ibge:'3304557',env,clock:()=>NOW,
  reserve:async()=>({approved:true}),
  cache:{save:async()=>{saved++;return {saved:true}}},
  fetchImpl:async()=>({status:200,headers:{get:()=>null},
   text:async()=>JSON.stringify(stale)})
 });
 assert.equal(result.status,'DISABLED_OR_UNAVAILABLE');
 assert.equal(saved,0);
});
test('url is an internal secret-bearing object never returned to dashboard',()=>{
 const u=createWeatherApiFreeUrl({ibge:'3304557',apiKey:env.BLAISE_WA_FREE_API_KEY});
 assert.equal(u.hostname,'api.weatherapi.com');
 assert.equal(u.pathname,'/v1/current.json');
 assert.equal(u.searchParams.get('aqi'),'no');
 assert.throws(()=>createWeatherApiFreeUrl({ibge:'unknown',apiKey:env.BLAISE_WA_FREE_API_KEY}));
});
