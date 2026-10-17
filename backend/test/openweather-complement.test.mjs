import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeOpenWeatherRio,createOpenWeatherCache,probeOpenWeatherRio} from '../src/openweather-complement.mjs';
const now=Date.parse('2026-10-16T16:45:00Z');
const raw={cod:200,sys:{country:'BR'},name:'Rio de Janeiro',coord:{lat:-22.9068,lon:-43.1729},dt:now/1000-60,main:{temp:29,feels_like:33,humidity:80,pressure:1008},wind:{speed:2},rain:{'1h':4}};
test('metric complement preserves time wind conversion and rain rate',()=>{const r=normalizeOpenWeatherRio(raw,{now});assert.equal(r.windKmh,7.2);assert.equal(r.gustKmh,null);assert.equal(r.rainRateMmPerHour,4);assert.equal(r.rainAccumulationMm,null);assert.equal(r.independentStationProven,false);});
test('scope and timestamp validation',()=>{for(const changes of [{name:'Niterói'},{dt:now/1000+1},{dt:now/1000-301}])assert.throws(()=>normalizeOpenWeatherRio({...raw,...changes},{now}));assert.equal(normalizeOpenWeatherRio({...raw,rain:undefined},{now}).rainRateMmPerHour,null);});
test('cache expires product timestamp',()=>{let clock=now;const c=createOpenWeatherCache({now:()=>clock});c.recordSuccess(normalizeOpenWeatherRio(raw,{now}));assert.equal(c.read().state,'CURRENT');clock+=241000;assert.equal(c.read().snapshot,null);});
test('adapter keeps credential out of published data',async()=>{let requested;const r=await probeOpenWeatherRio({apiKey:'a'.repeat(32),usageApproved:true,now:()=>now,fetchImpl:async u=>{requested=String(u);return new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});}});assert.ok(requested.includes('units=metric'));assert.equal(JSON.stringify(r).includes('a'.repeat(32)),false);});

import {restrictPublicProducts} from '../src/rj-public-status-http.mjs';
test('public product approval gates the supplemental collector separately',()=>{
 const worker={status:()=>({sources:[{sourceId:'openweather-rio-complement'}]}),readSource:()=>({snapshot:'fixture'})};
 assert.equal(restrictPublicProducts(worker,{inmetWarnings:true}).readSource('openweather-rio-complement'),null);
 assert.deepEqual(restrictPublicProducts(worker,{openWeather:true}).readSource('openweather-rio-complement'),{snapshot:'fixture'});
});
