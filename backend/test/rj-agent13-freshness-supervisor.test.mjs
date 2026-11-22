import test from 'node:test';
import assert from 'node:assert/strict';
import {
 auditAgent13Minute,AGENT13_MINUTE_AUDIT_MS,
 AGENT13_OWM_GLOBAL_DAILY_CALLS,AGENT13_REGISTERED_SOURCE_RULES,
 AGENT13_PUBLICATION_ENABLED
} from '../src/rj-agent13-freshness-supervisor.mjs';
const now=Date.parse('2026-11-22T15:15:00.000Z'); // 12:15 BRT
const iso=x=>new Date(x).toISOString();
const enabled={
 HG_BRASIL_WEATHER_PRO:{licensed:true,collectingAuthorized:true,clientReleaseAuthorized:true,serverVerified:true},
 WEATHERAPI_FREE:{licensed:true,collectingAuthorized:true,clientReleaseAuthorized:true,serverVerified:true},
 VISUAL_CROSSING_FREE:{licensed:true,collectingAuthorized:true,clientReleaseAuthorized:true,serverVerified:true}
}; // synthetic offline only, no entitlement granted.
const record=(overrides={})=>({
 ibge:'3304557',sourceId:'HG_BRASIL_WEATHER_PRO',
 field:'temperatureC',nature:'E',value:28,
 measuredAt:'2026-11-22T14:51:00.000Z',
 providerPublishedAt:'2026-11-22T14:55:00.000Z',
 ingestedAt:'2026-11-22T15:14:00.000Z',
 verifiedByBackend:true,municipalityMappingVerified:true,
 originalProviderTimestampVerified:true,qualityPass:true,
 wasIngestedFromAuthorizedCollector:true,...overrides
});
test('12h15 HG reading measured 11h51 is 24 minutes old, not 12h15',()=>{
 const result=auditAgent13Minute({
  nowMs:now,rows:[record()],enabledSources:enabled,
  existing:[{ibge:'3304557',field:'temperatureC',
    measuredAt:'2026-11-22T14:40:00.000Z'}]
 });
 assert.equal(result.previewLatest[0].ageMinutes,24);
 assert.equal(result.previewLatest[0].measuredAt,'2026-11-22T14:51:00.000Z');
 assert.equal(result.previewLatest[0].providerPublishedAt,'2026-11-22T14:55:00.000Z');
 assert.equal(result.proposedUpdates.length,1);
 assert.equal(result.providerNetworkCalls,0);
 assert.equal(result.creditsReserved,0);
 assert.equal(result.automaticClientPublication,false);
});
test('minute after minute can check cache but repeated source measurement never masquerades as new',()=>{
 const current={ibge:'3304557',field:'temperatureC',measuredAt:record().measuredAt};
 for(let offset=0;offset<15;offset++){
  const x=auditAgent13Minute({
   nowMs:now+offset*AGENT13_MINUTE_AUDIT_MS,
   rows:[record({ingestedAt:iso(now+offset*60_000)})],
   enabledSources:enabled,existing:[current]
  });
  assert.equal(x.proposedUpdates.length,0);
  assert.equal(x.providerNetworkCalls,0);
 }
});
test('prefer more recent actual measurement, never just later request/receipt timestamp',()=>{
 const a=record({sourceId:'HG_BRASIL_WEATHER_PRO',value:27,
  measuredAt:'2026-11-22T14:51:00.000Z',
  ingestedAt:'2026-11-22T15:14:00.000Z'});
 const b=record({sourceId:'WEATHERAPI_FREE',value:30,
  measuredAt:'2026-11-22T15:00:00.000Z',
  providerPublishedAt:null,
  ingestedAt:'2026-11-22T15:10:00.000Z'});
 const result=auditAgent13Minute({nowMs:now,rows:[a,b],enabledSources:enabled});
 assert.equal(result.previewLatest[0].value,30);
 assert.equal(result.previewLatest[0].sourceId,'WEATHERAPI_FREE');
 assert.equal(result.previewLatest[0].providerPublishedAt,null);
});
test('one source can update sky without overwriting a newer temperature or feels-like',()=>{
 const records=[
  record(),record({field:'skyCondition',value:'PARCIALMENTE_NUBLADO'}),
  record({sourceId:'WEATHERAPI_FREE',field:'feelsLikeC',value:31,
   measuredAt:'2026-11-22T15:00:00.000Z',providerPublishedAt:null})
 ];
 const x=auditAgent13Minute({nowMs:now,rows:records,enabledSources:enabled});
 assert.deepEqual(x.previewLatest.map(v=>v.field),
  ['skyCondition','temperatureC','feelsLikeC']);
 assert.ok(x.previewLatest.every(v=>v.alertLevel===null&&v.officialAlert===false));
});
test('stale, future, unlicensed and invalid-source records are excluded',()=>{
 const cases=[
  record({measuredAt:'2026-11-22T13:00:00.000Z'}),
  record({measuredAt:'2026-11-22T15:16:00.000Z'}),
  record({sourceId:'WEATHERAPI_FREE',field:'temperatureC',value:21,
   providerPublishedAt:null}),
  record({sourceId:'DWD_ICON_GLOBAL',field:'temperatureC',nature:'P'}),
  record({field:'skyCondition',value:'ALERTA_NIVEL_5'}),
  record({municipalityMappingVerified:false}),
 ];
 const r=auditAgent13Minute({nowMs:now,rows:cases,enabledSources:{
  HG_BRASIL_WEATHER_PRO:enabled.HG_BRASIL_WEATHER_PRO
 }});
 assert.equal(r.proposedUpdates.length,0);
 assert.equal(r.rejectedCount,cases.length);
 assert.equal(r.escalatedSafetyAlert,false);
});
test('HG one-hour maximum valid age but not relabeled a 25-minute update',()=>{
 const x=auditAgent13Minute({nowMs:now,enabledSources:enabled,
  rows:[record({measuredAt:'2026-11-22T14:20:00.000Z',
   providerPublishedAt:'2026-11-22T14:21:00.000Z'})]});
 assert.equal(x.previewLatest.length,1);
 assert.equal(x.previewLatest[0].ageMinutes,55);
 assert.equal(x.previewLatest[0].ageClass,'ACCEPTABLE_UP_TO_PROVIDER_LIMIT');
 const y=auditAgent13Minute({nowMs:now+6*60_000,enabledSources:enabled,
  rows:[record({measuredAt:'2026-11-22T14:20:00.000Z',
   providerPublishedAt:'2026-11-22T14:21:00.000Z',
   ingestedAt:'2026-11-22T15:20:00.000Z'})]});
 assert.equal(y.previewLatest.length,0);
});
test('all 92 RJ are covered as identifiers but no guarantee of 92 active sources',()=>{
 const x=auditAgent13Minute({nowMs:now,enabledSources:{}});
 assert.equal(x.monitoredRjMunicipalities,92);
 assert.equal(x.proposedUpdates.length,0);
 assert.equal(AGENT13_OWM_GLOBAL_DAILY_CALLS,1);
 assert.equal(AGENT13_PUBLICATION_ENABLED,false);
 assert.equal(AGENT13_REGISTERED_SOURCE_RULES.DWD_ICON_GLOBAL.nature,'P');
 assert.equal(x.checkIntervalSeconds,60);
});
