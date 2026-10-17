import test from 'node:test';import assert from 'node:assert/strict';
import {parseNoaaRjWaves,noaaRjWaveQuery,createNoaaRjWaveCache,probeNoaaRjWaves,NOAA_RJ_WAVE_TASK} from '../src/noaa-rj-wave-forecast.mjs';
import {buildRjPublicStatusSnapshot,restrictPublicProducts} from '../src/rj-public-status-http.mjs';
import {createOfficialSourceWorker} from '../src/official-source-worker.mjs';
const now=Date.parse('2026-10-16T22:55:00Z');
const fixture=()=>({table:{columnNames:['time','depth','latitude','longitude','Thgt','Tper','Tdir','shgt','sper','sdir'],columnUnits:['UTC','m','degrees_north','degrees_east','meters','second','degrees','meters','seconds','degrees'],rows:[['2026-10-16T22:00:00Z',0,-23.5,317,1.61,8.264462,144,1.3399999,8.2699995,146]]}});
test('NOAA subset preserves forecast validity and explicitly unknown issuance; cannot create coastal alerts or tides',()=>{
 const s=parseNoaaRjWaves(fixture(),{now});assert.equal(s.forecasts[0].heightM,1.61);assert.equal(s.forecasts[0].validAt,'2026-10-16T22:00:00.000Z');
 assert.equal(s.issuedAt,null);assert.equal(s.issuanceTimeKnown,false);assert.equal(s.providesTides,false);assert.equal(s.providesCurrents,false);assert.equal(s.mayIssueWarning,false);assert.equal(s.longitude,-43);assert.equal(s.gridResolutionDegrees,.5);
 assert.ok(decodeURIComponent(noaaRjWaveQuery(now)).includes('[(317.0)]'));
});
test('wrong ocean point, units, missing measurements and obsolete valid time are rejected',()=>{
 for(const change of [p=>p.table.rows[0][2]=-20,p=>p.table.columnUnits[4]='cm',p=>p.table.rows[0][0]='2026-10-15T22:00:00Z',p=>p.table.rows[0][4]=null,p=>p.table.rows[0][4]=-1,p=>p.table.rows.push([...p.table.rows[0]])]){
  const p=fixture();change(p);assert.throws(()=>parseNoaaRjWaves(p,{now}));
 }
 const p=fixture();p.table.rows[0][7]=null;assert.equal(parseNoaaRjWaves(p,{now}).forecasts[0].swellHeightM,null);
});
test('NOAA cache expires with fetch or validity and hides data after failure',()=>{
 let at=now;const c=createNoaaRjWaveCache({now:()=>at});c.recordSuccess(parseNoaaRjWaves(fixture(),{now}));
 assert.equal(c.read().state,'FORECAST_VALID_TIME_ISSUANCE_UNKNOWN');at+=300001;assert.equal(c.read().snapshot,null);
 at=now;c.recordFailure('source_http_error');assert.equal(c.read().snapshot,null);
});
test('real adapter-to-worker-to-public projection is gated and never synthesizes municipal or maritime warnings',async()=>{
 const worker=createOfficialSourceWorker({config:{enabled:true,initialMode:'normal',noaaWavesEnabled:true},now:()=>now,autoSchedule:false,
  probeAlertaRio:async()=>{throw Error('fixture_offline');},fetchImpl:async url=>{assert.equal(new URL(url).hostname,'pae-paha.pacioos.hawaii.edu');return new Response(JSON.stringify(fixture()),{headers:{'content-type':'application/json'}});}});
 worker.start();await worker.tick();
 const blocked=restrictPublicProducts(worker,{});assert.equal(blocked.readSource(NOAA_RJ_WAVE_TASK),null);
 const allowed=restrictPublicProducts(worker,{noaaWaves:true});const s=buildRjPublicStatusSnapshot(allowed,{nowMillis:now});
 assert.equal(s.oceanWaveForecast.forecasts[0].heightM,1.61);assert.equal(s.usableOfficialProducts,true);assert.deepEqual(s.warnings,[]);assert.equal(s.marine,null);
 assert.ok(s.municipalities.every(c=>c.risk===null));worker.stop();
});
