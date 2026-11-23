import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWeatherApiFreePrivateCache,
 evaluateWeatherApiFreePrivateCache,createRjWeatherApiFreePrivateCache}
 from '../src/rj-weatherapi-free-private-cache.mjs';
import {projectWeatherApiFreeCurrentForPaidDashboard}
 from '../src/rj-weatherapi-free-client-projection.mjs';
const NOW=Date.parse('2026-11-22T15:00:00Z');
const sample=()=>({
 sourceId:'WEATHERAPI_FREE',status:'PRIVATE_CACHE_VALID',
 ibge:'3304557',nature:'E',providerDataVerified:true,
 municipalityGeographyVerified:true,publicReleaseEnabled:false,
 checkedAt:new Date(NOW).toISOString(),
 location:{lat:-22.91,lon:-43.20},
 data:{last_updated_epoch:Math.floor((NOW-10*60_000)/1000),
  temp_c:28,feelslike_c:31,humidity:68,wind_kph:15,
  gust_kph:21,precip_mm:0.5,cloud:40,pressure_mb:1011,
  uv:6,condition:{code:1003,text:'SHOULD_NOT_PERSIST'}}
});
function memoryFirestore(){
 const files=new Map();
 return {files,db:{collection:coll=>({doc:id=>({
  set:async value=>{files.set(coll+'/'+id,structuredClone(value))},
  get:async()=>({exists:files.has(coll+'/'+id),
   data:()=>structuredClone(files.get(coll+'/'+id))})
 })})}};
}
test('private save keeps bounded numbers and condition CODE only; no provider text or secret',async()=>{
 const {db,files}=memoryFirestore();
 const cache=createRjWeatherApiFreePrivateCache({db,clock:()=>NOW});
 const result=await cache.save(sample());
 assert.equal(result.saved,true);
 assert.equal(cache.automaticProviderFetch,false);
 assert.equal(cache.clientPublicationEnabled,false);
 const row=[...files.values()][0];
 assert.equal(row.contract,'RJ_WEATHERAPI_FREE_PRIVATE_CURRENT_CACHE_V1');
 assert.equal(row.data.condition.code,1003);
 assert.equal(row.data.condition.text,undefined);
 assert.equal(JSON.stringify(row).includes('SHOULD_NOT_PERSIST'),false);
 assert.equal(row.publicReleaseEnabled,false);
 const current=await cache.read('3304557');
 const projected=projectWeatherApiFreeCurrentForPaidDashboard(current,{ibge:'3304557',now:NOW});
 assert.equal(projected.temperatureC,28);
 assert.equal(projected.feelsLikeC,31);
 assert.equal(projected.officialAlert,false);
});
test('same observation remains eligible at 25min with timestamp unchanged; expires at 35min',()=>{
 const s=sample();
 const row=normalizeWeatherApiFreePrivateCache(s,{now:NOW});
 const at25=evaluateWeatherApiFreePrivateCache(row,{ibge:'3304557',now:NOW+15*60_000});
 assert.equal(at25.status,'PRIVATE_CACHE_VALID');
 assert.equal(at25.data.last_updated_epoch,s.data.last_updated_epoch);
 const at36=evaluateWeatherApiFreePrivateCache(row,{ibge:'3304557',now:NOW+26*60_000});
 assert.equal(at36.status,'UNAVAILABLE');
});
test('future, stale, wrong city and fake approval cannot pass private cache normalizer',()=>{
 for(const s of [
  {...sample(),ibge:'0'},
  {...sample(),providerDataVerified:false},
  {...sample(),municipalityGeographyVerified:false},
  {...sample(),publicReleaseEnabled:true},
  {...sample(),location:{lat:0,lon:0}},
  {...sample(),checkedAt:new Date(NOW-20*60_000).toISOString()},
  {...sample(),data:{...sample().data,last_updated_epoch:Math.floor((NOW-40*60_000)/1000)}},
  {...sample(),data:{...sample().data,last_updated_epoch:Math.floor((NOW+60_000)/1000)}}
 ])assert.equal(normalizeWeatherApiFreePrivateCache(s,{now:NOW}),null);
});
test('missing cache and unsupported IBGE do not make network calls',async()=>{
 const {db}=memoryFirestore();
 const cache=createRjWeatherApiFreePrivateCache({db,clock:()=>NOW});
 assert.equal((await cache.read('3304557')).status,'UNAVAILABLE');
 assert.equal((await cache.read('123')).reason,'UNKNOWN_IBGE');
});
