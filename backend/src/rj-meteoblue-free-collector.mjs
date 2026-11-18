/**
 * ONE city meteoblue Free API private comparison adapter (NO customer route).
 * Explicitly OFF by default. No scheduler, 92-city loop, paid fallback or
 * client publication. Requires secret-backed env and atomic Firestore budget.
 * The operator's current exposed key is not eligible for recurring polling.
 */
import {prepareMeteoblueFreeRjProbe} from './rj-meteoblue-free-connection.mjs';
import {parseMeteoblueBasic6h} from './rj-meteoblue-basic6h-parse.mjs';
import {createRjMeteoblueFreeFirestoreStore} from './rj-meteoblue-free-firestore-store.mjs';
const fail=reason=>Object.freeze({
 status:'UNAVAILABLE',reason,sourceId:'METEOBLUE_FREE_FORECAST',
 providerContacted:false,credentialsExposed:false,
 observationsPublished:false,publishedToSubscribers:false,
 forecast:null
});
const KEY_RE=/^[A-Za-z0-9_-]{8,180}$/;
const toSafeRead=(v)=>v&&typeof v==='object'?v:null;
export function createBlaiseRjMeteoblueFreeCollector({
 env={},db=null,clock=()=>Date.now(),fetchImpl=globalThis.fetch
}={}){
 const credential=typeof env.BLAISE_METEOBLUE_FREE_API_KEY==='string'
    ?env.BLAISE_METEOBLUE_FREE_API_KEY:'';
 const configured=env.BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED==='true'&&
   env.BLAISE_METEOBLUE_AUTOTOPUP_DISABLED==='true'&&
   env.BLAISE_METEOBLUE_PAID_ALLOWED!=='true'&&
   env.BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED==='true'&&
   env.BLAISE_METEOBLUE_PUBLISH_TO_SUBSCRIBERS!=='true'&&
   env.BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE==='true'&&
   env.BLAISE_METEOBLUE_ALLOW_REAL_CREDIT_SPEND==='true'&&
   KEY_RE.test(credential)&&!!db;
 let store=null;
 if(configured){
  try{store=createRjMeteoblueFreeFirestoreStore({db,clock});}
  catch{store=null;}
 }
 const collectOne=async({ibge}={})=>{
  if(!store)return fail('COLLECTOR_DISABLED_OR_SHARED_BUDGET_UNAVAILABLE');
  const prepared=prepareMeteoblueFreeRjProbe({
    ibge,
    freeTrialConfirmed:true,autoTopUpDisabled:true,
    operatorApprovedSingleCreditUse:true,
    serverEnvironment:true
  });
  if(!prepared.mayContactProvider)return fail('UNVERIFIED_MUNICIPAL_POINT');
  let cached;
  try{cached=await store.getCached(ibge);}catch{
   return fail('SHARED_CACHE_READ_FAILED');
  }
  if(cached)return Object.freeze({
   status:'PRIVATE_STAGING_CACHE_HIT',reason:null,
   sourceId:'METEOBLUE_FREE_FORECAST',
   providerContacted:false,credentialsExposed:false,
   creditsReservedThisInvocation:0,
   forecast:cached,observationsPublished:false,
   publishedToSubscribers:false
  });
  let permit;
  try{permit=await store.reserve(ibge,clock());}catch{
   return fail('ATOMIC_BUDGET_UNAVAILABLE');
  }
  if(!permit?.approved)return fail(permit?.reason??'BUDGET_DENIED');
  const url=new URL(prepared.expectedEndpoint);
  for(const [key,value] of new URLSearchParams(prepared.query))
    url.searchParams.set(key,value);
  url.searchParams.set('apikey',credential);
  let response,body;
  try{
   response=await fetchImpl(url.href,{
     method:'GET',redirect:'error',headers:{Accept:'application/json'},
     signal:AbortSignal.timeout(16000)
   });
   if(response?.status!==200)
    return Object.freeze({...fail('PROVIDER_HTTP_NON_200'),providerContacted:true,
      httpStatus:Number.isInteger(response?.status)?response.status:null,
      creditsReservedThisInvocation:permit.creditsReserved});
   const sz=Number(response.headers?.get?.('content-length')??0);
   if(sz>900_000)throw Error('oversized');
   const text=await response.text();
   if(text.length>900_000)throw Error('oversized');
   body=JSON.parse(text);
  }catch{
   return Object.freeze({...fail('PROVIDER_FETCH_OR_JSON_UNAVAILABLE'),
     providerContacted:true,
     creditsReservedThisInvocation:permit.creditsReserved});
  }
  const normalized=parseMeteoblueBasic6h({
   payload:toSafeRead(body),ibge:String(ibge),
   latitude:prepared.targetCoordinates.lat,
   longitude:prepared.targetCoordinates.lon,nowMs:clock()
  });
  if(normalized.status!=='FORECAST_PARSED_PRIVATE_STAGING')
    return Object.freeze({...fail(normalized.reason),
      providerContacted:true,creditsReservedThisInvocation:permit.creditsReserved});
  try{await store.setCached(ibge,normalized);}catch{
   // A failed shared cache write can lead to repeated upstream calls; the
   // daily budget/cooldown still provides a global fail-safe. Do not return
   // an untracked result as eligible for production/comparison.
   return Object.freeze({...fail('SHARED_CACHE_WRITE_FAILED'),
      providerContacted:true,creditsReservedThisInvocation:permit.creditsReserved});
  }
  return Object.freeze({
   status:'PRIVATE_STAGING_FORECAST_READY',reason:null,
   providerContacted:true,credentialsExposed:false,
   sourceId:'METEOBLUE_FREE_FORECAST',
   creditsReservedThisInvocation:permit.creditsReserved,
   localCreditsReservedCumulative:permit.localSpentCredits,
   providerRemainingBalanceUnknown:true,
   forecast:normalized,observationsPublished:false,
   publishedToSubscribers:false
  });
 };
 return Object.freeze({
  sourceId:'METEOBLUE_FREE_FORECAST',
  configured:!!store,
  privateStagingOnly:true,
  automaticPolling:false,
  scheduledCollection:false,
  subscriberEndpointEnabled:false,
  publishedToAndroid:false,
  paidUseAllowed:false,
  collectOne
 });
}
