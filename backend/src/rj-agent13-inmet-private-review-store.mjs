/**
 * Private Firestore adapter for human-reviewed INMET comparison evidence.
 *
 * No import side effects; no Firestore connection on import, no INMET HTTP,
 * no API key, no log of station readings, no Android/dashboard endpoints.
 * Runtime must inject service-account Firestore and independently validated
 * reviewer/worker authorization callbacks. Default configuration is OFF.
 */
import {createHash} from 'node:crypto';
import {
 fingerprintRjInmetDispute,reviewAgent13ConflictWithInmet,
 RJ_INMET_PANEL_URL
} from './rj-agent13-inmet-private-tiebreak.mjs';

export const RJ_AGENT13_INMET_PRIVATE_COLLECTION='blaise_rj_agent13_inmet_private_reviews';
export const RJ_AGENT13_INMET_AUDIT_COLLECTION='blaise_rj_agent13_inmet_review_audit';
export const RJ_AGENT13_INMET_STORE_ENABLED_BY_DEFAULT=false;
const fail=reason=>new Error('rj_inmet_private_'+reason);
const sha=v=>createHash('sha256').update(v).digest('hex');
const keyValid=k=>typeof k==='string'&&
 /^33\d{5}:(?:ALL|[A-Za-z0-9_-]{1,50}):(temperatureC|humidityPct)$/.test(k);
const instant=s=>typeof s==='string'&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)&&
 Number.isFinite(Date.parse(s))?Date.parse(s):NaN;
const ALLOWED_REVIEW_KEYS=Object.freeze([
 'accessMode','publicPanelUrl','inspectedByAuthorizedReviewer',
 'officialInmetStationVerified','stationRepresentativeForTargetArea',
 'geographyAndAltitudeVerified','sameMeteorologicalVariableAndUnitsVerified',
 'originalObservationTimeVerified','referenceQualityApproved',
 'targetIbge','targetRegionId','parameter','stationCode','stationDistanceKm',
 'observedValue','observedAt','reviewedAt','conflictFingerprint'
]);
const getReview=r=>{
 if(!r||typeof r!=='object'||Array.isArray(r)||
    Object.keys(r).some(k=>!ALLOWED_REVIEW_KEYS.includes(k))||
    ALLOWED_REVIEW_KEYS.some(k=>!Object.hasOwn(r,k)))
  throw fail('review_schema_not_approved');
 const clean=Object.fromEntries(ALLOWED_REVIEW_KEYS.map(k=>[k,r[k]]));
 if(clean.publicPanelUrl!==RJ_INMET_PANEL_URL)
  throw fail('not_official_panel');
 return clean;
};
function matchingKey(key,candidates){
 if(!keyValid(key)||!Array.isArray(candidates)||candidates.length<2)return false;
 const c=candidates[0];
 return key===c?.ibge+':'+(c?.regionId??'ALL')+':'+c?.field;
}
export function createRjAgent13InmetPrivateReviewStore({
 db,clock=()=>Date.now(),authorizeReviewer,authorizeWorker,
 allowPrivateWrites=false,allowPrivateReads=false
}={}){
 if(!db||typeof db.collection!=='function'||typeof db.runTransaction!=='function'||
    typeof clock!=='function'||typeof authorizeReviewer!=='function'||
    typeof authorizeWorker!=='function')
  throw fail('secure_server_dependencies_required');
 const references=db.collection(RJ_AGENT13_INMET_PRIVATE_COLLECTION);
 const history=db.collection(RJ_AGENT13_INMET_AUDIT_COLLECTION);
 if(typeof references?.doc!=='function'||typeof history?.doc!=='function')
  throw fail('private_firestore_collections_required');
 const grant=async(authorizer,actorContext,role)=>{
  // Client-supplied booleans/roles alone never count. The injected verifier
  // MUST verify the authentication token outside this module.
  const result=await authorizer({actorContext,requiredRole:role});
  if(result?.verifiedByServer!==true||result?.authorized!==true||
     typeof result?.principalId!=='string'||
     !/^[A-Za-z0-9@._:-]{3,200}$/.test(result.principalId))
   throw fail('access_denied');
  return result.principalId;
 };
 async function storeReviewedEvidence({conflictKey,candidates,review,actorContext}={}){
  if(!allowPrivateWrites)throw fail('private_writes_disabled');
  const principal=await grant(authorizeReviewer,actorContext,'rj_inmet_review_writer');
  if(!matchingKey(conflictKey,candidates))throw fail('conflict_not_comparable');
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0)throw fail('invalid_clock');
  const safeReview=getReview(review);
  let fp;
  try{fp=fingerprintRjInmetDispute(candidates)}
  catch{throw fail('conflict_not_comparable')}
  if(fp!==safeReview.conflictFingerprint)
   throw fail('conflict_fingerprint_mismatch');
  const decision=reviewAgent13ConflictWithInmet({
   ibge:candidates[0].ibge,regionId:candidates[0].regionId??null,
   field:candidates[0].field,candidates,review:safeReview,nowMs:now
  });
  if(decision.status!=='PRIVATE_DISPUTE_RESOLVED')
   throw fail('human_review_did_not_resolve_dispute');
  const reviewedAt=instant(safeReview.reviewedAt);
  const observedAt=instant(safeReview.observedAt);
  // Recent human checks only; reject delayed/replayed submissions.
  if(!Number.isFinite(reviewedAt)||!Number.isFinite(observedAt)||
     reviewedAt>now||now-reviewedAt>2*60_000)
   throw fail('review_not_recently_submitted');
  const expiresAtMs=Math.min(reviewedAt+15*60_000,observedAt+90*60_000);
  if(expiresAtMs<=now)throw fail('review_expired');
  const docId=sha('inmet-private:'+conflictKey);
  const auditId=sha(JSON.stringify([conflictKey,fp,safeReview.reviewedAt]));
  const reviewerHash=sha(principal);
  const data={
   contract:'RJ_PRIVATE_INMET_REVIEW_V1',
   conflictKey,conflictFingerprint:fp,review:safeReview,
   savedAtMs:now,expiresAtMs,reviewerHash,
   publicReleaseAuthorized:false,privateComparisonOnly:true
  };
  const ref=references.doc(docId);
  const auditRef=history.doc(auditId);
  // Index update + immutable audit event must be atomic.
  await db.runTransaction(async tx=>{
   const previous=await tx.get(ref);
   if(previous?.exists){
    const prior=previous.data();
    if(!Number.isSafeInteger(prior?.savedAtMs)||
       prior.savedAtMs>now||
       instant(prior?.review?.reviewedAt)>reviewedAt)
      throw fail('prior_private_review_newer');
   }
   tx.create(auditRef,{
    contract:'RJ_PRIVATE_INMET_AUDIT_V1',
    conflictKeyHash:docId,conflictFingerprint:fp,
    reviewerHash,reviewedAtMs:reviewedAt,
    writtenAtMs:now,referenceDigest:sha(JSON.stringify(safeReview)),
    publicReleaseAuthorized:false
   });
   tx.set(ref,data);
  });
  return Object.freeze({
   status:'PRIVATE_REVIEW_STORED',reviewAccepted:true,
   expiresAt:new Date(expiresAtMs).toISOString(),
   inmetObservationReturned:false,
   publicReleaseAuthorized:false,providerCalls:0
  });
 }
 function createWorkerReader({actorContext}={}){
  // No cache of authorization: verify worker identity every read.
  return async function readPrivateInmetConflictReviews({conflictKeys=[],at}={}){
   if(!allowPrivateReads)throw fail('private_reads_disabled');
   await grant(authorizeWorker,actorContext,'rj_agent13_internal_worker');
   if(!Array.isArray(conflictKeys)||conflictKeys.length<1||
      conflictKeys.length>100||new Set(conflictKeys).size!==conflictKeys.length||
      conflictKeys.some(x=>!keyValid(x))||
      !Number.isSafeInteger(at)||at<0)
    throw fail('invalid_read_request');
   const result=Object.create(null);
   for(const key of conflictKeys){
    const snapshot=await references.doc(sha('inmet-private:'+key)).get();
    if(!snapshot?.exists)continue;
    const data=snapshot.data();
    if(data?.contract!=='RJ_PRIVATE_INMET_REVIEW_V1'||
       data.conflictKey!==key||data.privateComparisonOnly!==true||
       data.publicReleaseAuthorized!==false||
       !Number.isSafeInteger(data.expiresAtMs)||data.expiresAtMs<=at||
       data.savedAtMs>at||data.expiresAtMs>at+90*60_000)continue;
    try{
     const review=getReview(data.review);
     if(review.conflictFingerprint!==data.conflictFingerprint)continue;
     result[key]=Object.freeze(review);
    }catch{continue;}
   }
   // NOTE: result is PRIVATE data to an approved server-side comparison only.
   // Never serialize or log this object to clients or Cloud Run response.
   return Object.freeze(result);
  };
 }
 return Object.freeze({
  configured:allowPrivateWrites===true&&allowPrivateReads===true,
  storeReviewedEvidence,createWorkerReader,
  hasPublicEndpoint:false,hasInmetHttpClient:false,
  mayPublishToSubscribers:false,canScrapeInmet:false
 });
}
