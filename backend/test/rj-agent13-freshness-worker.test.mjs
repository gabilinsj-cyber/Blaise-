import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgent13ReadOnlyMinuteWorker} from '../src/rj-agent13-freshness-worker.mjs';
const NOW=Date.parse('2026-11-22T15:15:00Z');
const cfg={
 enabled:true,operatorApproved:true,clock:()=>NOW,
 tryAcquireMinuteLease:async()=>({acquired:true}),
 readLastPublishedMetadata:async()=>[],
 stagePrivateProposals:async()=>({staged:true}),
 readSharedSourceCache:async()=>[{
  ibge:'3304557',sourceId:'HG_BRASIL_WEATHER_PRO',
  nature:'E',field:'temperatureC',value:28,
  measuredAt:'2026-11-22T14:51:00.000Z',
  providerPublishedAt:'2026-11-22T14:55:00.000Z',
  ingestedAt:'2026-11-22T15:14:00.000Z',
  verifiedByBackend:true,municipalityMappingVerified:true,
  originalProviderTimestampVerified:true,qualityPass:true,
  wasIngestedFromAuthorizedCollector:true,
 }]
};
const active={
 HG_BRASIL_WEATHER_PRO:{
  licensed:true,collectingAuthorized:true,
  clientReleaseAuthorized:true,serverVerified:true}
};
test('worker cannot run without explicit shared-lease, source cache and approval',async()=>{
 const off=createAgent13ReadOnlyMinuteWorker();
 assert.equal(off.configured,false);
 assert.equal(off.automaticSchedulingEnabled,false);
 assert.equal(off.canCallWeatherProviders,false);
 assert.equal(off.canPublishToSubscribers,false);
 assert.equal((await off.tick()).status,'BLOCKED');
});
test('one minute audit reads cached provider results and stages private proposals only',async()=>{
 let acquired=0,staged=0,read=0;
 const worker=createAgent13ReadOnlyMinuteWorker({
  ...cfg,
  readSharedSourceCache:async()=>{read++;return cfg.readSharedSourceCache();},
  tryAcquireMinuteLease:async()=>({acquired:++acquired===1}),
  stagePrivateProposals:async({proposals})=>{
   staged+=proposals.length;return {staged:true};
  }
 });
 const a=await worker.tick({enabledSources:active});
 assert.equal(a.status,'PRIVATE_MINUTE_AUDIT_COMPLETED');
 assert.equal(a.proposalsStaged,1);
 assert.equal(a.providerCalls,0);
 assert.equal(a.creditReservations,0);
 assert.equal(a.publishedToClients,false);
 const b=await worker.tick({enabledSources:active});
 assert.equal(b.status,'BLOCKED');
 assert.equal(b.reason,'MINUTE_ALREADY_CLAIMED');
 assert.equal(read,1);
 assert.equal(staged,1);
});
test('shared lease missing means zero source accesses or staging',async()=>{
 let read=0;
 const worker=createAgent13ReadOnlyMinuteWorker({
  ...cfg,
  tryAcquireMinuteLease:async()=>{throw Error('no firestore');},
  readSharedSourceCache:async()=>{read++;return [];}
 });
 const out=await worker.tick({enabledSources:active});
 assert.equal(out.reason,'SHARED_LEASE_UNAVAILABLE');
 assert.equal(read,0);
});
test('unsupported source permissions cause no updates and no provider fetch',async()=>{
 let staged=0;
 const worker=createAgent13ReadOnlyMinuteWorker({...cfg,
  stagePrivateProposals:async()=>{staged++;return {staged:true};}
 });
 const out=await worker.tick({enabledSources:{}});
 assert.equal(out.status,'PRIVATE_MINUTE_AUDIT_COMPLETED');
 assert.equal(out.proposalsStaged,0);
 assert.equal(out.providerCalls,0);
 assert.equal(staged,0);
});
