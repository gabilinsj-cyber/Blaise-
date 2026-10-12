import test from 'node:test';
import assert from 'node:assert/strict';
import {
  USGS_RJ_TASK_ID, USGS_RJ_SOURCE_ID,USGS_RJ_FEED_URL,
  parseUsgsRjFeed,probeUsgsRjEarthquakes,createUsgsRjCache,UsgsRjError,
} from '../src/usgs-rj-earthquakes.mjs';
import { createOfficialSourceWorker,loadOfficialSourceWorkerConfig } from '../src/official-source-worker.mjs';
import {
  RJ_EARTHQUAKES_PUBLIC_PATH,RJ_EARTHQUAKES_PUBLIC_CONTRACT,
  createRjEarthquakesPublicHandler,buildRjEarthquakesPublicSnapshot,
} from '../src/rj-earthquakes-http.mjs';

const NOW=Date.parse('2026-10-12T03:00:00.000Z');
const quake=(id,mag,minutesBefore=30)=>({
  type:'Feature',id,
  properties:{
    mag,time:NOW-minutesBefore*60_000,
    place:`${id} test earthquake`,
    url:`https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    status:'reviewed',tsunami:1,
  },
  geometry:{type:'Point',coordinates:[-43.2,-22.8,12]},
});
const payload=(items=[quake('us001',4.3),quake('us002',5.2),quake('us003',3.1)])=>({
  type:'FeatureCollection',
  metadata:{generated:NOW-60_000,status:200,count:items.length},
  features:items,
});
const mockResponse=()=>({
  statusCode:null,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;},
  end(v){this.body=JSON.parse(v);},
});
test('USGS GeoJSON selects two strongest actual earthquakes and does not infer RJ tsunami',()=>{
  const parsed=parseUsgsRjFeed(payload(),{nowMs:NOW});
  assert.equal(parsed.sourceId,USGS_RJ_SOURCE_ID);
  assert.equal(parsed.earthquakeCount,2);
  assert.deepEqual(parsed.events.map(e=>e.magnitude),[5.2,4.3]);
  assert.ok(parsed.events.every(e=>e.officialTsunamiWarning===false
    &&e.mayTriggerRjAlert===false));
  assert.equal(parsed.events[0].tsunamiFlag,'USGS_EVENT_FLAG_NOT_A_TSUNAMI_WARNING');
  assert.equal(parsed.thirdPartyImagery,false);
});
test('USGS parser rejects stale generated feeds and invalid/oversized contracts',()=>{
  assert.throws(()=>parseUsgsRjFeed(payload(),{nowMs:NOW+3*3_600_000}),UsgsRjError);
  assert.throws(()=>parseUsgsRjFeed({...payload(),type:'Other'},{nowMs:NOW}),UsgsRjError);
  assert.throws(()=>parseUsgsRjFeed(payload(Array(2501).fill(quake('us001',5))),{nowMs:NOW}),UsgsRjError);
  const invalid=parseUsgsRjFeed(payload([
    quake('us001',4),{...quake('us002',5),properties:{...quake('us002',5).properties,
      url:'https://untrusted.example.test/quake'}},quake('us001',4),
  ]),{nowMs:NOW});
  assert.equal(invalid.earthquakeCount,1);
});
test('HTTPS allowlisted USGS feed can be checked through injectable transport, never redirects',async()=>{
  const got=[];
  const res=await probeUsgsRjEarthquakes({nowMs:NOW,fetchImpl:async url=>{
    got.push(url.toString());
    return new Response(JSON.stringify(payload()),{headers:{'Content-Type':'application/json'}});
  }});
  assert.deepEqual(got,[USGS_RJ_FEED_URL]);
  assert.equal(res.events.length,2);
  await assert.rejects(()=>probeUsgsRjEarthquakes({nowMs:NOW,fetchImpl:async()=>new Response('',{
    status:302,headers:{location:'https://malicious.example.test/redirect'},
  })}),/source_redirect_rejected/);
});
test('worker optional source remains off by default, starts only on explicit flags, exposes no payload in status',async()=>{
  assert.deepEqual(loadOfficialSourceWorkerConfig({}),{enabled:false,initialMode:'normal'});
  const configured=loadOfficialSourceWorkerConfig({
    BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED:'true',
    BLAISE_USGS_EARTHQUAKES_ENABLED:'true',
  });
  assert.equal(configured.usgsEarthquakesEnabled,true);
  let calls=0;
  const worker=createOfficialSourceWorker({
    config:configured,now:()=>NOW,autoSchedule:false,
    probeUsgsEarthquakesLive:async()=>{calls++;return parseUsgsRjFeed(payload(),{nowMs:NOW});},
    probeAlertaRio:async()=>{throw Error('unavailable test alert station');},
  });
  assert.equal(worker.start(),true);
  const run=await worker.tick();
  assert.ok(run.includes(USGS_RJ_TASK_ID));
  assert.equal(calls,1);
  const source=worker.readSource(USGS_RJ_TASK_ID);
  assert.equal(source.state,'CURRENT');
  assert.equal(source.snapshot.events.length,2);
  const status=worker.status();
  assert.equal(status.usgsEarthquakesConfigured,true);
  assert.ok(status.sources.some(x=>x.sourceId===USGS_RJ_TASK_ID&&x.state==='CURRENT'));
  assert.equal(JSON.stringify(status).includes('test earthquake'),false);
  const publicResult=buildRjEarthquakesPublicSnapshot(worker,{nowMs:NOW});
  assert.equal(publicResult.events.length,2);
  assert.equal(publicResult.impactOnRioConfirmed,false);
  assert.equal(publicResult.tsunamiWarningConfirmed,false);
});
test('expired USGS cache is not exposed by public API',()=>{
  let now=NOW;
  const cache=createUsgsRjCache({now:()=>now});
  cache.recordSuccess(parseUsgsRjFeed(payload(),{nowMs:NOW}),{
    fetchedAt:new Date(NOW).toISOString(),
  });
  assert.equal(cache.read().state,'CURRENT');
  now+=90*60_000;
  assert.equal(cache.read().state,'UNAVAILABLE');
  assert.equal(cache.read().snapshot,null);
});
test('public seismic endpoint never needs Play purchases and fails closed if not live',async()=>{
  const active={
    status:()=>({enabled:true,started:true,usgsEarthquakesConfigured:true}),
    readSource:()=>({state:'CURRENT',snapshot:parseUsgsRjFeed(payload(),{nowMs:NOW})}),
  };
  let delegated=0;const delegate=()=>{delegated++;};
  const disabled=createRjEarthquakesPublicHandler(delegate,{sourceWorker:active});
  await disabled({url:RJ_EARTHQUAKES_PUBLIC_PATH,method:'GET'},mockResponse());
  assert.equal(delegated,1);
  const h=createRjEarthquakesPublicHandler(delegate,{
    sourceWorker:active,enabled:true,clock:()=>NOW,
  });
  let res=mockResponse();
  await h({url:RJ_EARTHQUAKES_PUBLIC_PATH,method:'GET'},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.contract,RJ_EARTHQUAKES_PUBLIC_CONTRACT);
  assert.equal(res.body.events.length,2);
  assert.equal(JSON.stringify(res.body).includes('purchaseToken'),false);
  assert.equal(res.body.tsunamiWarningConfirmed,false);
  res=mockResponse();
  await h({url:RJ_EARTHQUAKES_PUBLIC_PATH,method:'POST'},res);
  assert.equal(res.statusCode,405);
  res=mockResponse();
  const stale=createRjEarthquakesPublicHandler(delegate,{
    sourceWorker:active,enabled:true,clock:()=>NOW+2*3_600_000,
  });
  await stale({url:RJ_EARTHQUAKES_PUBLIC_PATH,method:'GET'},res);
  assert.equal(res.statusCode,503);
});
