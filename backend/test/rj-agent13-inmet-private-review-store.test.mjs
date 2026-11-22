import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjAgent13InmetPrivateReviewStore} from
 '../src/rj-agent13-inmet-private-review-store.mjs';
import {fingerprintRjInmetDispute,RJ_INMET_PANEL_URL} from
 '../src/rj-agent13-inmet-private-tiebreak.mjs';
import {createAgent13ReadOnlyMinuteWorker} from
 '../src/rj-agent13-freshness-worker.mjs';

const NOW=Date.parse('2026-11-22T15:15:00.000Z');
const base=(sourceId,value,measuredAt)=>({
 ibge:'3304557',regionId:null,field:'temperatureC',
 nature:'E',sourceId,value,measuredAt,
 providerPublishedAt:null,
 ingestedAt:'2026-11-22T15:13:00.000Z',
 verifiedByBackend:true,municipalityMappingVerified:true,
 originalProviderTimestampVerified:true,qualityPass:true,
 wasIngestedFromAuthorizedCollector:true
});
const a=base('VISUAL_CROSSING_FREE',24,'2026-11-22T15:00:00.000Z');
const b=base('WEATHERAPI_FREE',30,'2026-11-22T15:05:00.000Z');
const key='3304557:ALL:temperatureC';
const evidence=(candidates=[a,b])=>({
 accessMode:'HUMAN_VERIFIED_PUBLIC_INMET_PANEL',
 publicPanelUrl:RJ_INMET_PANEL_URL,
 inspectedByAuthorizedReviewer:true,officialInmetStationVerified:true,
 stationRepresentativeForTargetArea:true,
 geographyAndAltitudeVerified:true,
 sameMeteorologicalVariableAndUnitsVerified:true,
 originalObservationTimeVerified:true,referenceQualityApproved:true,
 targetIbge:'3304557',targetRegionId:null,parameter:'temperatureC',
 conflictFingerprint:fingerprintRjInmetDispute(candidates),
 stationCode:'A601',stationDistanceKm:8,
 observedValue:25,observedAt:'2026-11-22T15:00:00.000Z',
 reviewedAt:'2026-11-22T15:14:00.000Z'
});
function fakeFirestore(){
 const stored=new Map();
 const makeSnapshot=k=>({
  exists:stored.has(k),
  data:()=>structuredClone(stored.get(k))
 });
 const db={
  collection(name){return {
   doc(id){
    const key=name+'/'+id;
    return {key,get:async()=>makeSnapshot(key)}
   }
  };},
  async runTransaction(fn){
   const ops=[];
   const tx={
    get:async ref=>makeSnapshot(ref.key),
    create:(ref,value)=>ops.push(['create',ref.key,structuredClone(value)]),
    set:(ref,value)=>ops.push(['set',ref.key,structuredClone(value)])
   };
   const result=await fn(tx);
   for(const [type,id] of ops)
    if(type==='create'&&stored.has(id))throw Error('existing-audit');
   for(const [,id,value] of ops)stored.set(id,value);
   return result;
  }
 };
 return {db,stored};
}
const authorizeReviewer=async({actorContext,requiredRole})=>
 actorContext==='verified-admin'&&requiredRole==='rj_inmet_review_writer'
 ?{verifiedByServer:true,authorized:true,principalId:'authorized_admin_1'}
 :{verifiedByServer:false,authorized:false};
const authorizeWorker=async({actorContext,requiredRole})=>
 actorContext==='verified-worker'&&requiredRole==='rj_agent13_internal_worker'
 ?{verifiedByServer:true,authorized:true,principalId:'blaise_runtime_1'}
 :{verifiedByServer:false,authorized:false};
function adapter(extra={}){
 const {db,stored}=fakeFirestore();
 const bridge=createRjAgent13InmetPrivateReviewStore({
  db,clock:()=>NOW,authorizeReviewer,authorizeWorker,
  allowPrivateWrites:true,allowPrivateReads:true,...extra
 });
 return {bridge,stored};
}
const save=(bridge,review=evidence(),candidates=[a,b],actorContext='verified-admin')=>
 bridge.storeReviewedEvidence({conflictKey:key,review,candidates,actorContext});
test('adapter requires independently verified server authentication and starts closed',async()=>{
 const {db}=fakeFirestore();
 const off=createRjAgent13InmetPrivateReviewStore({
  db,clock:()=>NOW,authorizeReviewer,authorizeWorker
 });
 assert.equal(off.configured,false);
 await assert.rejects(()=>save(off),/private_writes_disabled/);
 const {bridge,stored}=adapter();
 await assert.rejects(()=>save(bridge,evidence(),[a,b],'client-supplied-admin'),/access_denied/);
 assert.equal(stored.size,0);
 await assert.rejects(()=>bridge.createWorkerReader({actorContext:'ordinary-client'})({
  conflictKeys:[key],at:NOW
 }),/access_denied/);
});
test('writes one private review plus immutable digest audit; returns no INMET value',async()=>{
 const {bridge,stored}=adapter();
 const r=await save(bridge);
 assert.equal(r.status,'PRIVATE_REVIEW_STORED');
 assert.equal(r.inmetObservationReturned,false);
 assert.equal(r.publicReleaseAuthorized,false);
 assert.equal(r.providerCalls,0);
 assert.equal(JSON.stringify(r).includes('25'),false); // expiresAt may include 25? review fixture on 22nd
 assert.equal(stored.size,2);
 const docs=[...stored.entries()];
 assert.equal(docs.filter(([k])=>k.startsWith('blaise_rj_agent13_inmet_review_audit/')).length,1);
 const raw=docs.find(([k])=>k.startsWith('blaise_rj_agent13_inmet_private_reviews/'))[1];
 assert.equal(raw.review.observedValue,25);
 assert.equal(raw.review.stationCode,'A601');
 assert.equal(raw.publicReleaseAuthorized,false);
 const result=await bridge.createWorkerReader({actorContext:'verified-worker'})({
  conflictKeys:[key],at:NOW
 });
 assert.equal(result[key].observedValue,25);
 await assert.rejects(()=>save(bridge),/existing-audit/);
});
test('review proof cannot be replayed for changed Blaise value or another region',async()=>{
 const {bridge}=adapter();
 await assert.rejects(()=>save(bridge,evidence(),[a,{...b,value:33}]),
  /conflict_fingerprint_mismatch/);
 await assert.rejects(()=>bridge.storeReviewedEvidence({
  conflictKey:'3304557:exposed-region:temperatureC',
  candidates:[a,b],review:evidence(),actorContext:'verified-admin'
 }),/conflict_not_comparable/);
 await assert.rejects(()=>save(bridge,{...evidence(),apikey:'do-not-store'}),
  /review_schema_not_approved/);
});
test('private Firestore read is scoped and expires without extending observation age',async()=>{
 const {bridge}=adapter();
 await save(bridge);
 const reader=bridge.createWorkerReader({actorContext:'verified-worker'});
 const fresh=await reader({conflictKeys:[key],at:NOW});
 assert.equal(Object.keys(fresh).length,1);
 const expired=await reader({conflictKeys:[key],at:NOW+16*60_000});
 assert.equal(Object.keys(expired).length,0);
 await assert.rejects(()=>reader({conflictKeys:['not-valid'],at:NOW}),/invalid_read_request/);
});
test('Agent13 worker uses stored reviewer evidence only after conflict, stages Blaise source, never INMET',async()=>{
 const {bridge}=adapter();
 await save(bridge);
 let readCount=0,proposals=[];
 const worker=createAgent13ReadOnlyMinuteWorker({
  enabled:true,operatorApproved:true,clock:()=>NOW,
  readSharedSourceCache:async()=>[a,b],
  readLastPublishedMetadata:async()=>[],
  tryAcquireMinuteLease:async()=>({acquired:true}),
  readPrivateInmetConflictReviews:async args=>{
   readCount++;
   return bridge.createWorkerReader({actorContext:'verified-worker'})(args);
  },
  stagePrivateProposals:async({proposals:next})=>{
   proposals=next;return {staged:true};
  }
 });
 const flags=Object.fromEntries([a,b].map(x=>[x.sourceId,{
  licensed:true,collectingAuthorized:true,clientReleaseAuthorized:true,serverVerified:true
 }]));
 const out=await worker.tick({enabledSources:flags});
 assert.equal(readCount,1);
 assert.equal(out.conflictsResolvedWithPrivateInmetReview,1);
 assert.equal(out.conflictsHeld,0);
 assert.equal(out.proposalsStaged,1);
 assert.equal(proposals[0].sourceId,'VISUAL_CROSSING_FREE');
 assert.equal(proposals[0].value,24);
 assert.equal(proposals[0].measuredAt,a.measuredAt);
 assert.equal(proposals[0].officialAlert,false);
 assert.equal(JSON.stringify(proposals).includes('observedValue'),false);
 assert.equal(JSON.stringify(proposals).includes('A601'),false);
 assert.equal(out.publishedToClients,false);
 assert.equal(out.providerCalls,0);
});
