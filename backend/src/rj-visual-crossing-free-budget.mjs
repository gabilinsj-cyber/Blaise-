/**
 * Shared Firestore Free-tier trial budget for Visual Crossing.
 * One manual Rio one-shot TOTAL while validating account and queryCost.
 * The supplier's 1,000 records/day is not permission to spend freely;
 * the long-term 92-city rollout requires a separate audited 900-record/day
 * atomic budget and operator approval, not this staging trial.
 */
export const VC_BUDGET_COLLECTION='blaise_rj_visual_crossing_free_trial_budget_v1';
export const VC_TRIAL_ID='staging_one_rio_20261119';
export const VC_OPERATOR_FREE_RECORDS_PER_DAY=1000;
export const VC_INTERNAL_FUTURE_CEILING=900;
export const VC_PRIVATE_STAGING_MAX_TOTAL_CALLS=1;
export function createRjVisualCrossingFreeBudget({
 db,clock=()=>Date.now()
}={}){
 if(typeof db?.collection!=='function'||typeof db?.runTransaction!=='function')
  throw Error('visual_crossing_shared_firestore_required');
 const doc=db.collection(VC_BUDGET_COLLECTION).doc(VC_TRIAL_ID);
 const reserve=async(ibge='3304557',now=clock())=>{
  if(ibge!=='3304557'||!Number.isSafeInteger(now)||now<0)
    return {approved:false,reason:'ONLY_RIO_PRIVATE_TRIAL'};
  return db.runTransaction(async tx=>{
   const snap=await tx.get(doc);
   const row=snap.exists?snap.data():null;
   const count=row===null?0:row?.calls;
   if(!Number.isSafeInteger(count)||count<0||count>1)
    throw Error('visual_crossing_budget_corrupt');
   if(count>=VC_PRIVATE_STAGING_MAX_TOTAL_CALLS)
    return {approved:false,reason:'ONE_STAGING_CALL_ALREADY_RESERVED'};
   tx.set(doc,{
    contract:'RJ_VISUAL_CROSSING_FREE_PRIVATE_TRIAL_V1',
    campaign:VC_TRIAL_ID,calls:1,recordsReserved:1,
    dayUtc:new Date(now).toISOString().slice(0,10),
    ibge:'3304557',lastReservationAt:new Date(now).toISOString(),
    paidAllowed:false,customerPublishingEnabled:false
   });
   return {approved:true,reason:'ONE_FREE_STAGING_RECORD_RESERVED',
    recordsReserved:1,providerBalanceChecked:false};
  });
 };
 const readBudget=async()=>{
  const snap=await doc.get();
  const r=snap.exists?snap.data():null;
  const count=r===null?0:r.calls;
  if(!Number.isSafeInteger(count)||count<0||count>1)
    throw Error('visual_crossing_budget_corrupt');
  return Object.freeze({campaign:VC_TRIAL_ID,
   sourceOfCounts:'LOCAL_FIRESTORE_RESERVATIONS_ONLY',
   providerRecordsUsed:'UNVERIFIED_IN_PROVIDER_DASHBOARD',
   localCallsReserved:count,localRecordsReserved:count,
   maxTrialCalls:1,automaticPolling:false,
   paidAllowed:false,publishedToSubscribers:false});
 };
 return Object.freeze({reserve,readBudget,automaticPolling:false,
  publicationEnabled:false});
}
