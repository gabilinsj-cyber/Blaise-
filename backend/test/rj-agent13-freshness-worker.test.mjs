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
test('INMET panel review is read only on actual conflict; only Blaise winning field is privately staged',async()=>{
 let reviewReads=0,staged=null;
 const inmetReview={
  accessMode:'HUMAN_VERIFIED_PUBLIC_INMET_PANEL',
  publicPanelUrl:'https://mapas.inmet.gov.br/',
  inspectedByAuthorizedReviewer:true,
  officialInmetStationVerified:true,
  stationRepresentativeForTargetArea:true,
  geographyAndAltitudeVerified:true,
  sameMeteorologicalVariableAndUnitsVerified:true,
  originalObservationTimeVerified:true,
  referenceQualityApproved:true,
  targetIbge:'3304557',targetRegionId:null,parameter:'temperatureC',
  stationCode:'A123',stationDistanceKm:9,observedValue:29,
  observedAt:'2026-11-22T14:50:00.000Z',
  reviewedAt:'2026-11-22T15:14:00.000Z'
 };
 const weatherApi={
  ...(await cfg.readSharedSourceCache())[0],
  sourceId:'WEATHERAPI_FREE',value:35,
  measuredAt:'2026-11-22T14:54:00.000Z',
  providerPublishedAt:null
 };
 const worker=createAgent13ReadOnlyMinuteWorker({
  ...cfg,
  readSharedSourceCache:async()=>[...(await cfg.readSharedSourceCache()),weatherApi],
  readPrivateInmetConflictReviews:async({conflictKeys})=>{
   reviewReads++;
   assert.deepEqual(conflictKeys,['3304557:ALL:temperatureC']);
   return {'3304557:ALL:temperatureC':inmetReview};
  },
  stagePrivateProposals:async({proposals})=>{
   staged=proposals;return {staged:true};
  }
 });
 const enabled={
  ...active,WEATHERAPI_FREE:{
   licensed:true,collectingAuthorized:true,
   clientReleaseAuthorized:true,serverVerified:true
  }
 };
 const r=await worker.tick({enabledSources:enabled});
 assert.equal(reviewReads,1);
 assert.equal(r.conflictsResolvedWithPrivateInmetReview,1);
 assert.equal(r.conflictsHeld,0);
 assert.equal(r.proposalsStaged,1);
 assert.equal(staged[0].sourceId,'HG_BRASIL_WEATHER_PRO');
 assert.equal(staged[0].value,28);
 assert.equal(JSON.stringify(staged).includes('A123'),false);
 assert.equal(JSON.stringify(staged).includes('observedValue'),false);
 assert.equal(r.publishedToClients,false);
});
test('no conflicting sources means no request for the INMET panel review record',async()=>{
 let reads=0;
 const worker=createAgent13ReadOnlyMinuteWorker({
  ...cfg,readPrivateInmetConflictReviews:async()=>{reads++;return {};}
 });
 const result=await worker.tick({enabledSources:active});
 assert.equal(result.proposalsStaged,1);
 assert.equal(reads,0);
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
