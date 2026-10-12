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
  assert.equal(r.windyLicensedModelApiReady,false);
  assert.equal(r.homologationRegister.id,'BLAISE-RJ-METEO-HOMOLOG-01');
  assert.equal(r.homologationRegister.registeredPhenomena,30);
  assert.equal(r.homologationRegister.documentedDisputeStages,13);
  assert.equal(r.homologationRegister.sourceProductsVerifiedForCommercialUse,false);
  assert.equal(r.homologationRegister.allThirtyPhenomenaLive,false);
  assert.equal(r.homologationRegister.openWeatherMapLiveProof,false);
  assert.equal(r.homologationRegister.copernicusMarineLiveProof,false);
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
test('OWM flag alone cannot prove recent live data, but actual fresh validated product can',()=>{
  const active=(time,sourceTime,productStatus)=>({
    status:()=>({
      sourceId:'OPENWEATHERMAP_API',
      enabled:true,configured:true,licensedForApp:true,
      lastSuccessAt:time,lastSourceTime:sourceTime,lastStatus:productStatus,
    }),
  });
  const good=buildRjSourceReadiness({status:()=>status()},{
    nowMillis:NOW,
    supplementalAdapters:[active('2026-10-11T03:59:00Z','2026-10-11T03:30:00Z',
      'FRESH_VALIDATED_COMPLEMENTARY_PRODUCT')],
  });
  assert.equal(good.homologationRegister.openWeatherMapLiveProof,true);
  assert.equal(good.supplementalSources.length,1);
  assert.equal(good.supplementalSources[0].recentValidProduct,true);
  assert.equal(JSON.stringify(good).includes('apiKey'),false);
  assert.equal(good.homologationRegister.copernicusMarineLiveProof,false);
  assert.equal(good.homologationRegister.eumetsatSatelliteLiveProof,false);
  for(const adapter of [
    active(null,null,'FRESH_VALIDATED_COMPLEMENTARY_PRODUCT'),
    active('2026-10-10T22:00:00Z','2026-10-10T21:00:00Z','FRESH_VALIDATED_COMPLEMENTARY_PRODUCT'),
    active('2026-10-11T03:59:00Z','2026-10-11T03:50:00Z','NOT_QUERIED'),
  ]){
    const r=buildRjSourceReadiness({status:()=>status()},{
      nowMillis:NOW,supplementalAdapters:[adapter],
    });
    assert.equal(r.homologationRegister.openWeatherMapLiveProof,false);
  }
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
