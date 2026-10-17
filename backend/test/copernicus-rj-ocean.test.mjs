import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCopernicusRjOcean,createCopernicusRjCache,probeCopernicusRjOcean,COPERNICUS_RJ_TASK} from '../src/copernicus-rj-ocean.mjs';
import {restrictPublicProducts} from '../src/rj-public-status-http.mjs';
const now=Date.parse('2026-10-17T03:30:00Z');
function fixture(){return {productId:'GLOBAL_ANALYSISFORECAST_PHY_001_024',fetchedAt:new Date(now).toISOString(),products:{
 seaLevel:{datasetId:'cmems_mod_glo_phy_anfc_merged-sl_PT1H-i',latitude:-23.5,longitude:-43,depthM:null,units:{ocean_tide:'m',total_sea_level:'m'},rows:[{validAt:'2026-10-17T03:00:00Z',ocean_tide:-0.2,total_sea_level:0.1}]},
 currents:{datasetId:'cmems_mod_glo_phy_anfc_merged-uv_PT1H-i',latitude:-23.5,longitude:-43,depthM:0.494,units:{utotal:'m s-1',vtotal:'m s-1'},rows:[{validAt:'2026-10-17T03:00:00Z',utotal:0.3,vtotal:0.4}]}}};}
test('model datum, original clocks, vector speed and towards bearing',()=>{
 const s=parseCopernicusRjOcean(fixture(),{now});assert.equal(s.kind,'MODEL_FORECAST_NOT_OBSERVATION');assert.equal(s.issuedAt,null);assert.equal(s.mayIssueWarning,false);
 assert.equal(s.products.seaLevel.rows[0].ocean_tide,-0.2);assert.equal(s.products.currents.rows[0].speedMs,0.5);assert.ok(Math.abs(s.products.currents.rows[0].towardsDegrees-36.869897645844)<1e-10);
 assert.equal(s.products.seaLevel.rows[0].validAt,'2026-10-17T03:00:00.000Z');
});
test('reject wrong grid, units, depth, missing values, stale and future fetch, duplicated times',()=>{
 for(const mutate of [r=>r.products.currents.longitude=-42,r=>r.products.currents.units.utotal='km/h',r=>r.products.currents.depthM=20,r=>r.products.seaLevel.rows[0].ocean_tide=999,r=>r.products.currents.rows[0].utotal=null,r=>r.products.currents.rows[0].vtotal=NaN,r=>r.fetchedAt=new Date(now+1).toISOString(),r=>r.fetchedAt=new Date(now-300001).toISOString(),r=>r.products.seaLevel.rows.push({...r.products.seaLevel.rows[0]})]){const r=fixture();mutate(r);assert.throws(()=>parseCopernicusRjOcean(r,{now}));}
});
test('cache expiry, failure and independent publication approval',()=>{
 let clock=now;const cache=createCopernicusRjCache({now:()=>clock});cache.recordSuccess(parseCopernicusRjOcean(fixture(),{now}));assert.ok(cache.read().snapshot);
 const worker={readSource:()=>cache.read(),status:()=>({sources:[cache.read()]})};assert.equal(restrictPublicProducts(worker,{}).readSource(COPERNICUS_RJ_TASK),null);assert.ok(restrictPublicProducts(worker,{copernicusOcean:true}).readSource(COPERNICUS_RJ_TASK).snapshot);
 clock+=300001;assert.equal(cache.read().snapshot,null);clock=now;cache.recordFailure('network_error');assert.equal(cache.read().snapshot,null);
});
test('credentials absent does not spawn; subprocess errors hide secrets',async()=>{
 await assert.rejects(probeCopernicusRjOcean({env:{},run:()=>assert.fail('must not run')}),{code:'copernicus_credentials_missing'});
 const env={COPERNICUSMARINE_SERVICE_USERNAME:'test-user',COPERNICUSMARINE_SERVICE_PASSWORD:'synthetic-test-secret'};
 await assert.rejects(probeCopernicusRjOcean({env,run:async()=>{throw new Error(env.COPERNICUSMARINE_SERVICE_PASSWORD);}}),e=>e.code==='copernicus_collection_failed'&&!e.message.includes('secret'));
 const s=await probeCopernicusRjOcean({env,now:()=>now,run:async()=>({stdout:JSON.stringify(fixture())})});assert.equal(s.products.currents.rows[0].speedMs,0.5);
});
