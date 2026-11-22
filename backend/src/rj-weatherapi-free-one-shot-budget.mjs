/**
 * Firestore-private ONE WeatherAPI Free request for first Rio audit.
 * A unique campaign document prevents repeat spending across days/retries.
 * No use by the customer, no subscription, no API call on import.
 */
export const WAPI_PRIVATE_BUDGET_COLLECTION='blaise_rj_weatherapi_free_private_one_shot_v1';
export const WAPI_PRIVATE_BUDGET_ID='rio_free_first_test_20261122';
export const WAPI_PRIVATE_CAMPAIGN_CALL_LIMIT=1;

export function createWeatherApiPrivateBudget({db,clock=()=>Date.now()}={}){
 if(typeof db?.collection!=='function'||typeof db?.runTransaction!=='function')
  throw Error('weatherapi_shared_firestore_required');
 const doc=db.collection(WAPI_PRIVATE_BUDGET_COLLECTION).doc(WAPI_PRIVATE_BUDGET_ID);
 const reserve=async(ibge,now=clock())=>{
  if(String(ibge)!=='3304557'||!Number.isSafeInteger(now)||now<0)
    return Object.freeze({approved:false,reason:'RIO_ONLY_FOR_PRIVATE_FIRST_TEST'});
  return db.runTransaction(async tx=>{
   const record=await tx.get(doc);
   const data=record.exists?record.data():null;
   const count=data===null?0:data?.callsReserved;
   if(!Number.isSafeInteger(count)||count<0||count>WAPI_PRIVATE_CAMPAIGN_CALL_LIMIT)
    throw Error('weatherapi_budget_counter_invalid');
   if(count>=WAPI_PRIVATE_CAMPAIGN_CALL_LIMIT)
    return Object.freeze({approved:false,reason:'ONE_FREE_CALL_ALREADY_RESERVED'});
   tx.set(doc,{
    contract:'RJ_WAPI_PRIVATE_FREE_ONE_SHOT_V1',
    callsReserved:1,ibge:'3304557',
    reservedAt:new Date(now).toISOString(),
    dayUtc:new Date(now).toISOString().slice(0,10),
    clientPublishingEnabled:false,paidAllowed:false
   });
   return Object.freeze({approved:true,callsReserved:1,usesFreeAccount:true});
  });
 };
 const read=async()=>{
  const snapshot=await doc.get();
  const r=snapshot.exists?snapshot.data():null;
  const count=r===null?0:r.callsReserved;
  if(!Number.isSafeInteger(count)||count<0||count>WAPI_PRIVATE_CAMPAIGN_CALL_LIMIT)
   throw Error('weatherapi_budget_counter_invalid');
  return Object.freeze({
   sourceOfCounts:'SHARED_FIRESTORE_RESERVATIONS_NOT_PROVIDER_MONTHLY_BALANCE',
   callsReserved:count,remainingAllowedByThisCampaign:1-count,
   providerBalanceVerified:false,providerSampleDownloaded:false,
   automaticCollectionEnabled:false,publishedToClients:false,
   paidPlanEnabled:false
  });
 };
 return Object.freeze({reserve,read,mayAutomaticallyPoll:false});
}
