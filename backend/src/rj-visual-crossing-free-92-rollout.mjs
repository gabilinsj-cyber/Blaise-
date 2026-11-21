/**
 * Visual Crossing Free 92-municipality future rollout:
 *   DRY RUN by default, no cron, no fetch, no publishing.
 *
 * A single forecast request costs 1 provider record *only if* verified for
 * the exact Timeline request. Never mistake "extra free credits: 0" for the
 * daily allowance. Operator must reconcile the provider UI before enabling.
 *
 * This module has no API key, HTTP method or Cloud Scheduler. It can only
 * plan and atomically reserve future requests, with strict opt-in gates.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
export const VC_RJ_CITY_COUNT=92;
export const VC_DAILY_FREE_LIMIT=1000;
export const VC_RJ_INTERNAL_DAY_CAP=800;
export const VC_RJ_MAX_ROUNDS_PER_UTC_DAY=8;
export const VC_RJ_PER_CITY_MIN_INTERVAL_MS=3*60*60_000;
export const VC_RJ_BUDGET_COLLECTION='blaise_rj_vc_free_92_future_budget_v1';
export const VC_RJ_AUTOMATIC_COLLECTION_DEFAULT=false;
const CITIES=Object.freeze(geo.points.map(x=>String(x.ibge)).sort());
const CODES=new Set(CITIES);
if(CITIES.length!==92||CODES.size!==92)throw Error('IBGE_92_NOT_VERIFIED');

export function createVisualCrossing92DryRunPlan({dayUtc='2026-11-20'}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dayUtc)||
    !Number.isFinite(Date.parse(dayUtc+'T00:00:00Z')))
  throw Error('invalid UTC day');
 const days=[];
 for(let round=0;round<VC_RJ_MAX_ROUNDS_PER_UTC_DAY;round++){
  const at=new Date(Date.parse(dayUtc+'T00:00:00Z')+
   round*VC_RJ_PER_CITY_MIN_INTERVAL_MS).toISOString();
  days.push(Object.freeze({
    round:round+1,plannedUtc:at,municipalities:CITIES.length,
    forecastRecordsExpected:CITIES.length,
    cities:CITIES
  }));
 }
 const forecastRecords=days.reduce((n,r)=>n+r.forecastRecordsExpected,0);
 if(forecastRecords>VC_RJ_INTERNAL_DAY_CAP)
  throw Error('unsafe_rollout_plan');
 return Object.freeze({
  mode:'PREVIEW_ONLY_NO_PROVIDER_CALLS',dayUtc,
  municipalityCount:CITIES.length,rounds:days.length,
  proposedCadenceHours:3,expectedRecordCostPerCity:1,
  expectedDailyRecords:forecastRecords,
  maximumInternalRecords:VC_RJ_INTERNAL_DAY_CAP,
  freePlanAdvertisedRecords:VC_DAILY_FREE_LIMIT,
  internalBudgetHeadroom:VC_RJ_INTERNAL_DAY_CAP-forecastRecords,
  providerQuotaHeadroomIfNoOtherCalls:VC_DAILY_FREE_LIMIT-forecastRecords,
  keyRotatedAndVerified:false,providerCreditIndicatorClarified:false,
  supplierBalanceSynchronized:false,automaticEnabled:false,
  customerPublishingEnabled:false,approved:false,roundPlans:days
 });
}
function approvedPolicy(policy,now){
 const utcDay=new Date(now).toISOString().slice(0,10);
 return policy?.collectionEnabled===true&&
  policy.keyReplacedAfterExposure===true&&
  policy.freePlanConfirmed===true&&policy.noPaymentMethodConfirmed===true&&
  policy.extraCreditIndicatorReviewed===true&&
  policy.providerDailyQuotaConfirmed===true&&
  policy.forecastQueryCostConfirmed===1&&
  policy.operatorApproved92Rollout===true&&
  policy.billingAllowed===false&&
  policy.clientPublishingEnabled===false&&
  policy.accountUsageDayUtc===utcDay&&
  Number.isSafeInteger(policy.providerUsageAlreadyToday)&&
  policy.providerUsageAlreadyToday>=0&&
  policy.providerUsageAlreadyToday<=VC_RJ_INTERNAL_DAY_CAP&&
  typeof policy.providerUsageConfirmedAt==='string'&&
  Number.isFinite(Date.parse(policy.providerUsageConfirmedAt))&&
  Date.parse(policy.providerUsageConfirmedAt)<=now&&
  now-Date.parse(policy.providerUsageConfirmedAt)<=60*60_000;
}
export function createVisualCrossing92Budget({
 db,clock=()=>Date.now(),policy=null
}={}){
 if(typeof db?.collection!=='function'||typeof db?.runTransaction!=='function')
  throw Error('shared_firestore_required');
 const collection=db.collection(VC_RJ_BUDGET_COLLECTION);
 const reserve=async(ibge)=>{
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0||!CODES.has(String(ibge)))
   return Object.freeze({approved:false,reason:'CITY_OR_CLOCK_INVALID'});
  if(!approvedPolicy(policy,now))
   return Object.freeze({approved:false,reason:'ROTATION_ACCOUNT_REVIEW_OR_OPERATOR_APPROVAL_REQUIRED'});
  const day=new Date(now).toISOString().slice(0,10);
  const dayRef=collection.doc('day_'+day);
  const cityRef=collection.doc('city_'+String(ibge));
  return db.runTransaction(async tx=>{
   const [ds,cs]=await Promise.all([tx.get(dayRef),tx.get(cityRef)]);
   const d=ds.exists?ds.data():null,c=cs.exists?cs.data():null;
   if(d&&d.dayUtc!==day)throw Error('corrupt_day_document');
   if(c&&c.ibge!==String(ibge))throw Error('corrupt_city_document');
   const used=d?.recordsReserved??0;
   const prevCount=c?.dayUtc===day?c?.dayCalls??0:0;
   const prior=c?.lastReservedAt;
   if(!Number.isSafeInteger(used)||used<0||used>VC_RJ_INTERNAL_DAY_CAP||
      !Number.isSafeInteger(prevCount)||prevCount<0||prevCount>8||
      (prior!==undefined&&(!Number.isFinite(Date.parse(prior))||
       Date.parse(prior)>now)))
    throw Error('corrupt_shared_budget');
   if(used+policy.providerUsageAlreadyToday+1>VC_RJ_INTERNAL_DAY_CAP)
    return Object.freeze({approved:false,reason:'INTERNAL_DAILY_CAP'});
   if(prevCount>=VC_RJ_MAX_ROUNDS_PER_UTC_DAY)
    return Object.freeze({approved:false,reason:'CITY_DAILY_MAX'});
   if(prior!==undefined&&now-Date.parse(prior)<VC_RJ_PER_CITY_MIN_INTERVAL_MS)
    return Object.freeze({approved:false,reason:'CITY_THREE_HOUR_COOLDOWN'});
   const stamp=new Date(now).toISOString();
   tx.set(dayRef,{contract:'RJ_VC_FUTURE_DAY_LEDGER_V1',
    dayUtc:day,recordsReserved:used+1,
    providerBaselineAtApproval:policy.providerUsageAlreadyToday,
    updatedAt:stamp,automaticPublishing:false},{merge:false});
   tx.set(cityRef,{contract:'RJ_VC_FUTURE_CITY_LEDGER_V1',
    ibge:String(ibge),dayUtc:day,dayCalls:prevCount+1,lastReservedAt:stamp,
    customerPublishingEnabled:false},{merge:false});
   return Object.freeze({approved:true,source:'LOCAL_FIRESTORE_RESERVATION',
    dayUtc:day,ibge:String(ibge),reservedCost:1,
    dayReservations:used+1,clientPublishingEnabled:false});
  });
 };
 return Object.freeze({reserve,automaticCollectionStarted:false,
  publicationEnabled:false,providerKeyAccess:false});
}
