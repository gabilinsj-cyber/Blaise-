import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import { INMET_CAP_RSS_URL, INMET_SOURCE_ID } from '../src/inmet-source.mjs';
import {
  RJ_PUBLIC_STATUS_PATH,RJ_PUBLIC_STATUS_CONTRACT,
  buildRjPublicStatusSnapshot,createRjPublicStatusHandler,
} from '../src/rj-public-status-http.mjs';

const now=Date.parse('2026-10-10T18:00:00Z');
const stamp=new Date(now-60_000).toISOString();
const until=new Date(now+3_600_000).toISOString();
function worker({running=true, stale=false, allUnresolved=false}={}) {
  const age=stale?new Date(now-4_000_000).toISOString():stamp;
  const hydro={sourceId:'cemaden-rj-hydrological-risk',state:stale?'STALE':'CURRENT',fetchedAt:age,
    snapshot:{sourceId:'cemaden-rj-hydrological-risk',records:RJ_MUNICIPALITIES.map(c=>({
      ...c,observedAt:age,priority:c.ibge==='3304557'?4:1,
      risk:c.ibge==='3304557'?'ALTO':'MUITO BAIXO',redec:'Fixture',
    }))}};
  const cap={sourceId:INMET_SOURCE_ID,state:stale?'STALE':'CURRENT',fetchedAt:age,
    snapshot:{sourceId:INMET_SOURCE_ID,sourceUrl:INMET_CAP_RSS_URL,
      rjWarnings:[{
        identifier:'inmet-fixture-warning',msgType:'Alert',status:'Actual',
        sent:stamp,onset:stamp,expires:until,event:'Chuva intensa',severity:'Severe',
        rjMunicipalityIbges:allUnresolved?[]:['3304557'],
      }]}};
  return {
    status:()=>({enabled:running,started:running,sources:[hydro,cap]}),
    readSource: id=> id===hydro.sourceId?hydro:id===cap.sourceId?cap:null,
  };
}
function fakeResponse(){
  const headers={};
  return {headers,statusCode:null,body:null,
    setHeader(k,v){headers[k]=v;},end(v){this.body=JSON.parse(v);},
  };
}
test('public endpoint projects exactly 92 RJ official risk entries without credentials or premium fields',()=>{
  const result=buildRjPublicStatusSnapshot(worker(),{nowMillis:now});
  assert.equal(result.contract,RJ_PUBLIC_STATUS_CONTRACT);
  assert.equal(result.municipalities.length,92);
  assert.equal(result.municipalities.find(c=>c.ibge==='3304557').risk.level,4);
  assert.equal(result.municipalities.find(c=>c.ibge==='3303302').warningIds.length,0);
  assert.equal(result.warnings.length,1);
  assert.deepEqual(result.warnings[0].municipalityIbges,['3304557']);
  assert.equal(result.thirdPartyImagesIncluded,false);
  assert.equal(result.subscriberDataIncluded,false);
  assert.equal(JSON.stringify(result).includes('purchaseToken'),false);
  assert.equal(JSON.stringify(result).includes('entitlement'),false);
  assert.equal(JSON.stringify(result).includes('INEA'),false);
});
test('ambiguous INMET statewide warning remains unassigned and cannot be displayed in every city',()=>{
  const result=buildRjPublicStatusSnapshot(worker({allUnresolved:true}),{nowMillis:now});
  assert.equal(result.warnings.length,0);
  assert.ok(result.municipalities.every(c=>c.warningIds.length===0));
});
test('stale or disabled source worker has no fake municipal risk or freshness',()=>{
  const stale=buildRjPublicStatusSnapshot(worker({stale:true}),{nowMillis:now});
  assert.equal(stale.usableOfficialProducts,false);
  assert.ok(stale.municipalities.every(c=>c.risk===null));
  assert.equal(stale.warnings.length,0);
  assert.equal(buildRjPublicStatusSnapshot(worker({running:false}),{nowMillis:now}),null);
});
test('public API defaults off and requires independent operator data-usage approval, never billing',async()=>{
  let delegated=0;const delegate=()=>{delegated++};
  const res=fakeResponse();
  const disabled=createRjPublicStatusHandler(delegate,{sourceWorker:worker()});
  await disabled({url:RJ_PUBLIC_STATUS_PATH,method:'GET'},res);
  assert.equal(delegated,1);
  const unlicensed=createRjPublicStatusHandler(delegate,{
    enabled:true,licensingApproved:false,sourceWorker:worker(),
  });
  await unlicensed({url:RJ_PUBLIC_STATUS_PATH,method:'GET'},res);
  assert.equal(delegated,2);
  const enabled=createRjPublicStatusHandler(delegate,{
    enabled:true,licensingApproved:true,clock:()=>now,sourceWorker:worker(),
  });
  await enabled({url:RJ_PUBLIC_STATUS_PATH,method:'GET'},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal(res.body.contract,RJ_PUBLIC_STATUS_CONTRACT);
  assert.equal(res.body.municipalities.length,92);
  assert.equal(delegated,2);
});
test('public endpoint only supports GET and blocks stale status without claiming absence of danger',async()=>{
  const res=fakeResponse();
  const handler=createRjPublicStatusHandler(()=>{},{
    enabled:true,licensingApproved:true,clock:()=>now,sourceWorker:worker({stale:true}),
  });
  await handler({url:RJ_PUBLIC_STATUS_PATH,method:'GET'},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.error,'official_sources_not_validated');
  const other=fakeResponse();
  await handler({url:RJ_PUBLIC_STATUS_PATH,method:'POST'},other);
  assert.equal(other.statusCode,405);
});
