import test from 'node:test';
import assert from 'node:assert/strict';
import { probeAlertaRioMeteorology, createAlertaRioMeteorologyCache, ALERTA_RIO_METEOROLOGY_TASK } from '../src/alerta-rio-meteorology-live.mjs';
import { createOfficialSourceWorker, loadOfficialSourceWorkerConfig } from '../src/official-source-worker.mjs';
import { buildRjPublicStatusSnapshot, restrictPublicProducts } from '../src/rj-public-status-http.mjs';
const at=Date.parse('2026-10-17T02:00:00Z');
const page=(date='16/10/2026 - 22:58:00')=>`<h3>Dados Meteorológicos</h3><table><tr><th>Umi. do Ar</th><th>P. de Orvalho</th></tr><tr>${['32','São Cristóvão',date,'25,2','94,2','1009,8','24,2','8,5','322,1'].map(x=>`<td>${x}</td>`).join('')}</tr></table>`;
const fetchPage=html=>async()=>new Response(html,{headers:{'content-type':'text/html'}});
test('actual observation time, station scope and missing mean are preserved',async()=>{
 const s=await probeAlertaRioMeteorology({now:()=>at,fetchImpl:fetchPage(page())});
 assert.equal(s.stations[0].observedAt,'2026-10-17T01:58:00.000Z');
 assert.equal(s.stations[0].temperatureC,25.2); assert.equal(s.weightedMean,null);
 assert.equal(s.qualityWeightsVerified,false); assert.equal(s.mayIssueWarning,false);
 assert.equal(s.stations[0].feelsLikeC,null);
});
test('rejection page, stale and future readings cannot become current',async()=>{
 for(const html of ['<html>Request Rejected</html>',page('16/10/2026 - 20:58:00'),page('16/10/2026 - 23:58:00')])
  await assert.rejects(()=>probeAlertaRioMeteorology({now:()=>at,fetchImpl:fetchPage(html)}));
});
test('cache expires by original observation clock and hides readings after failure',async()=>{
 let time=at; const cache=createAlertaRioMeteorologyCache({now:()=>time});
 const s=await probeAlertaRioMeteorology({now:()=>at,fetchImpl:fetchPage(page())});cache.recordSuccess(s);
 assert.equal(cache.read().state,'CURRENT_STATION_OBSERVATIONS');time+=180001;
 assert.equal(cache.read().snapshot,null);time=at;cache.recordSuccess(s);cache.recordFailure('source_network_error');
 assert.equal(cache.read().snapshot,null);
});
test('worker collects meteorology only with explicit flag and public approval; cannot create averages or warnings',async()=>{
 const worker=createOfficialSourceWorker({config:{enabled:true,initialMode:'normal',alertaRioMeteorologyEnabled:true},now:()=>at,autoSchedule:false,
  probeAlertaRio:async()=>{throw Error('fixture_offline');},fetchImpl:fetchPage(page())});
 worker.start();await worker.tick();
 assert.equal(restrictPublicProducts(worker,{}).readSource(ALERTA_RIO_METEOROLOGY_TASK),null);
 const s=buildRjPublicStatusSnapshot(restrictPublicProducts(worker,{alertaRioMeteorology:true}),{nowMillis:at});
 assert.equal(s.stationMeteorology.stations.length,1);assert.equal(s.usableOfficialProducts,true);
 assert.equal(s.stationMeteorology.weightedMean,null);assert.deepEqual(s.warnings,[]);worker.stop();
});
