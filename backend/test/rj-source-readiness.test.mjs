import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRjSourceReadiness,
  createRjSourceReadinessHandler,
  RJ_SOURCE_READINESS_PATH,
} from '../src/rj-source-readiness.mjs';
const NOW=Date.parse('2026-10-11T04:00:00.000Z');
const status=({enabled=true,started=true,runCount=1,sourceState='CURRENT',
  fetchedAt='2026-10-11T03:59:00.000Z'}={})=>({
  enabled,started,
  scheduler:{mode:'normal',refreshIntervalMs:60_000,
    tasks:[{taskId:'inmet-cap-warnings',runCount,
      lastOutcome:runCount?'SUCCESS':'NOT_STARTED',
      lastFinishedAt:fetchedAt}]},
  sources:[{sourceId:'inmet-cap-warnings',state:sourceState,fetchedAt,
    lastErrorCode:null,observedAt:fetchedAt}],
});
test('enabled-but-not-running is NOT confirmed real-time collection',()=>{
  const r=buildRjSourceReadiness({status:()=>status({enabled:false,started:false})},{nowMillis:NOW});
  assert.equal(r.collectionState,'DISABLED_BY_CONFIGURATION');
  assert.equal(r.continuousUptimeProven,false);
  assert.equal(r.sourceLicensingProven,false);
  assert.equal(r.thirdPartyDataIncluded,false);
  assert.equal(r.purchaseTokenIncluded,false);
});
test('configuration, running process and one successful fresh source task required',()=>{
  const r=buildRjSourceReadiness({status:()=>status()},{nowMillis:NOW});
  assert.equal(r.collectionState,'LIVE_SOURCES_WITH_FRESH_VALIDATED_DATA');
  assert.equal(r.freshSourceCount,1);
  assert.equal(r.schedulerRefreshMs,60_000);
  assert.equal(r.radarSpatialFrameReady,false);
  assert.equal(r.inpeApiReady,false);
  assert.equal(Object.hasOwn(r,'windyLicensedModelApiReady'),false);
  assert.equal(r.homologationRegister.id,'BLAISE-RJ-METEO-HOMOLOG-01');
  assert.equal(r.homologationRegister.registeredPhenomena,30);
  assert.equal(r.homologationRegister.documentedDisputeStages,13);
  assert.equal(r.homologationRegister.sourceProductsVerifiedForCommercialUse,false);
  assert.equal(r.homologationRegister.allThirtyPhenomenaLive,false);
  assert.equal(Object.hasOwn(r.homologationRegister,'openWeatherMapLiveProof'),false);
  assert.equal(Object.hasOwn(r.homologationRegister,'copernicusMarineLiveProof'),false);
  assert.equal(r.homologationRegister.eumetsatSatelliteLiveProof,false);
  assert.equal(r.homologationRegister.liveSourceTasksWithRecentData,1);
});
test('stale station data and no successful tasks cannot masquerade as live',()=>{
  for(const snapshot of [
    status({fetchedAt:'2026-10-10T23:00:00.000Z'}),
    status({runCount:0}),
    status({sourceState:'STALE'}),
    status({enabled:true,started:false}),
  ]){
    const r=buildRjSourceReadiness({status:()=>snapshot},{nowMillis:NOW});
    assert.notEqual(r.collectionState,'LIVE_SOURCES_WITH_FRESH_VALIDATED_DATA');
  }
});
test('retired sources and mismatched task IDs cannot establish live readiness',()=>{
  const approved=status();
  const malicious={
    ...approved,
    scheduler:{...approved.scheduler,tasks:[{
      taskId:'chm-marine-warnings',runCount:1,lastOutcome:'SUCCESS',
      lastFinishedAt:approved.sources[0].fetchedAt,
    }]},
    sources:[{sourceId:'chm-marine',state:'CURRENT',
      fetchedAt:approved.sources[0].fetchedAt,
      observedAt:approved.sources[0].fetchedAt}],
  };
  const report=buildRjSourceReadiness({status:()=>malicious},{nowMillis:NOW});
  assert.equal(report.collectionState,'NO_FRESH_VALIDATED_SOURCE_EVIDENCE');
  assert.equal(report.freshSourceCount,0);
  assert.equal(report.sourceCount,0);
  assert.equal(report.completedSourceTaskCount,0);
  const mismatched={...approved,scheduler:{...approved.scheduler,tasks:[{
    taskId:'cemaden-rj-hydrological-risk',runCount:1,lastOutcome:'SUCCESS',
    lastFinishedAt:approved.sources[0].fetchedAt,
  }]}};
  assert.equal(buildRjSourceReadiness({status:()=>mismatched},{nowMillis:NOW})
    .collectionState,'NO_FRESH_VALIDATED_SOURCE_EVIDENCE');
});
test('old successful task cannot validate a newly refreshed but unrelated cache',()=>{
  const good=status();
  good.scheduler.tasks[0].lastFinishedAt='2026-10-10T20:00:00.000Z';
  assert.equal(buildRjSourceReadiness({status:()=>good},{nowMillis:NOW})
    .collectionState,'NO_FRESH_VALIDATED_SOURCE_EVIDENCE');
});
const response=()=>({
  statusCode:null,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;},
  end(value){this.body=JSON.parse(value);},
});
test('read-only internal endpoint refuses anonymous users, no OIDC verifier and other methods',async()=>{
  const worker={status:()=>status()};
  const called=[];
  const denied=createRjSourceReadinessHandler((req,res)=>{called.push(req.url);res.end('{}')},{
    worker,verifyOperatorOidc:async token=>token==='Bearer trusted',clock:()=>NOW,
  });
  let res=response();
  await denied({method:'GET',url:RJ_SOURCE_READINESS_PATH,headers:{}},res);
  assert.equal(res.statusCode,403);
  assert.equal('sourceStates' in res.body,false);
  res=response();
  await denied({method:'POST',url:RJ_SOURCE_READINESS_PATH,headers:{}},res);
  assert.equal(res.statusCode,405);
  res=response();
  await denied({method:'GET',url:RJ_SOURCE_READINESS_PATH,headers:{authorization:'Bearer trusted'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.sourceStates.length,1);
  assert.equal(res.body.thirdPartyDataIncluded,false);
  res=response();
  await denied({method:'GET',url:'/healthz',headers:{}},res);
  assert.deepEqual(called,['/healthz']);
  const disabled=createRjSourceReadinessHandler(()=>{}, {worker,clock:()=>NOW});
  res=response();
  await disabled({method:'GET',url:RJ_SOURCE_READINESS_PATH,headers:{}},res);
  assert.equal(res.statusCode,503);
});
test('authorized endpoint still reports unhealthy with 503 when disabled',async()=>{
  const fn=createRjSourceReadinessHandler(()=>{},{
    worker:{status:()=>status({enabled:false,started:false})},
    verifyOperatorOidc:async()=>true,clock:()=>NOW,
  });
  const res=response();
  await fn({method:'GET',url:RJ_SOURCE_READINESS_PATH,headers:{}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.collectionState,'DISABLED_BY_CONFIGURATION');
});
