import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import { INMET_CAP_RSS_URL, INMET_SOURCE_ID } from '../src/inmet-source.mjs';
import {
  RJ_PUBLIC_STATUS_PATH,RJ_PUBLIC_STATUS_CONTRACT,
  buildRjPublicStatusSnapshot,createRjPublicStatusHandler,
  projectWarningInventories,
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
test('withdrawal evidence requires a complete recent successful source collection', () => {
  const w = worker();
  const cap = w.readSource(INMET_SOURCE_ID);
  cap.snapshot.warnings = [];
  cap.snapshot.feedShape = 'RSS_INDEX_RESOLVED_CAP';
  cap.snapshot.identityValidation = 'INMET_SENDER_DOMAIN+OFFICIAL_OID_PREFIX';
  cap.snapshot.temporalValidityValidation = 'BOUNDED_CAP_ONSET_EXPIRES_MAX_7D';
  cap.snapshot.activeWarningCount = 0;
  let evidence = projectWarningInventories(w, now);
  assert.equal(evidence.find(item => item.sourceId === 'inmet').complete, true);
  cap.state = 'CURRENT_DEGRADED';
  assert.equal(projectWarningInventories(w, now).length, 0);
  cap.state = 'CURRENT';
  cap.fetchedAt = new Date(now - 300001).toISOString();
  assert.equal(projectWarningInventories(w, now).length, 0);
  cap.fetchedAt = stamp;
  cap.snapshot.feedShape = 'CAP_ALERT';
  assert.equal(projectWarningInventories(w, now).find(item => item.sourceId === 'inmet').complete, false);
});
test('a fresh HTTP snapshot cannot revive a warning whose official emission is 12h old', () => {
  const w = worker();
  const warning = w.readSource(INMET_SOURCE_ID).snapshot.rjWarnings[0];
  warning.sent = new Date(now - 43_200_000).toISOString();
  warning.onset = warning.sent;
  const result = buildRjPublicStatusSnapshot(w, { nowMillis: now });
  assert.equal(result.warnings.length, 0);
  assert.ok(result.municipalities.every(city => city.warningIds.length === 0));
});
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
  assert.equal(delegated,0);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.error,'official_status_not_enabled');
  const unlicensed=createRjPublicStatusHandler(delegate,{
    enabled:true,licensingApproved:false,sourceWorker:worker(),
  });
  await unlicensed({url:RJ_PUBLIC_STATUS_PATH,method:'GET'},res);
  assert.equal(delegated,0);
  const enabled=createRjPublicStatusHandler(delegate,{
    enabled:true,licensingApproved:true,clock:()=>now,sourceWorker:worker(),
  });
  await enabled({url:RJ_PUBLIC_STATUS_PATH,method:'GET'},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal(res.body.contract,RJ_PUBLIC_STATUS_CONTRACT);
  assert.equal(res.body.municipalities.length,92);
  assert.equal(delegated,0);
});
test('excluded legacy marine warning never appears as a public current product',()=>{
  const baseline=worker();
  let prohibitedReads=0;
  const retiredProvider={
    status:()=>baseline.status(),
    readSource:id=>{
      if(id==='chm-marine-warnings') {
        prohibitedReads++;
        return {sourceId:'chm-marine',state:'CURRENT',fetchedAt:stamp,
          snapshot:{sourceId:'chm-marine',warningCount:1,warnings:[{
            id:'321/2026',warningType:'AVISO DE RESSACA',issuedAt:stamp,validUntil:until
          }]}};
      }
      return baseline.readSource(id);
    },
  };
  const result=buildRjPublicStatusSnapshot(retiredProvider,{nowMillis:now});
  assert.equal(result.marine,null);
  assert.equal(prohibitedReads,0);
  assert.equal(result.warningInventories.some(x=>x.sourceId==='chm'),false);
  assert.equal(JSON.stringify(result).includes('AVISO DE RESSACA'),false);
  assert.equal(result.warnings.length,1); // INMET remains accessible.
});
test('excluded marine bulletin cannot make stale INMET/CEMADEN appear healthy',async()=>{
  const baseline=worker({stale:true});
  const staleSourcesWithProhibitedMarine={
    status:()=>baseline.status(),
    readSource:id=>id==='chm-marine-warnings'
      ? {sourceId:'chm-marine',state:'CURRENT',fetchedAt:stamp,
          snapshot:{sourceId:'chm-marine',warnings:[]}}
      : baseline.readSource(id),
  };
  const snapshot=buildRjPublicStatusSnapshot(staleSourcesWithProhibitedMarine,{nowMillis:now});
  assert.equal(snapshot.marine,null);
  assert.equal(snapshot.usableOfficialProducts,false);
  assert.equal(snapshot.warningInventories.length,0);
  assert.equal(snapshot.warnings.length,0);
  const handler=createRjPublicStatusHandler(()=>{},{
    enabled:true,licensingApproved:true,clock:()=>now,
    sourceWorker:staleSourcesWithProhibitedMarine,
  });
  const res=fakeResponse();
  await handler({url:RJ_PUBLIC_STATUS_PATH,method:'GET'},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.error,'official_sources_not_validated');
});

test('absence of CHM source keeps regional marine information unavailable, not safe',()=>{
  const result=buildRjPublicStatusSnapshot(worker(),{nowMillis:now});
  assert.equal(result.marine,null);
  assert.equal(result.usableOfficialProducts,true);
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

test('a freshly generated wrapper cannot revive old or future hydrological bulletins',()=>{
  for(const observedAt of [new Date(now-301_000).toISOString(),new Date(now+1000).toISOString()]){
    const w=worker(),read=w.readSource;
    w.readSource=id=>{const feed=read(id);return feed?.snapshot?.records
      ?{...feed,snapshot:{...feed.snapshot,records:feed.snapshot.records.map(r=>({...r,observedAt}))}}:feed;};
    assert.ok(buildRjPublicStatusSnapshot(w,{nowMillis:now}).municipalities.every(r=>r.risk===null));
  }
});
