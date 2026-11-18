/**
 * Atomic Firestore budget + short-lived PRIVATE cache for meteoblue Free API.
 * Exactly one basic-6h package per call = 4,000 credits per official OpenAPI.
 * Quota is conservative: 8M of 10M trial credits reserved for this collector
 * at most, leaving >=2M not assigned to this collector; pre-existing use is
 * NOT included, so the supplier's dashboard limit remains mandatory.
 * No service on import; Firestore DB must be injected by trusted backend.
 */
import {METEOBLUE_BASIC6H_FIELDS} from './rj-meteoblue-basic6h-parse.mjs';
import geo from './rj-ibge-92-points.json' with {type:'json'};
export const METEOBLUE_BUDGET_COLLECTION='blaise_rj_meteoblue_free_budget_v1';
export const METEOBLUE_CACHE_COLLECTION='blaise_rj_meteoblue_free_private_cache_v1';
export const METEOBLUE_CAMPAIGN='trial_2026_11_18';
export const METEOBLUE_FREE_TOTAL_CREDITS=10_000_000;
export const METEOBLUE_BASIC6H_CREDITS=4_000;
export const METEOBLUE_PRIVATE_CEILING_CREDITS=8_000_000;
export const METEOBLUE_MAX_DAILY_CALLS=4;
export const METEOBLUE_CITY_COOLDOWN_MS=24*60*60_000;
export const METEOBLUE_CACHE_TTL_MS=6*60*60_000;
export const METEOBLUE_FREE_EXPIRY_MS=Date.parse('2027-11-18T00:00:00.000Z');
export const METEOBLUE_FREE_START_MS=Date.parse('2026-11-18T00:00:00.000Z');
const CODES=new Set(geo.points.map(x=>x.ibge));
const deny=reason=>Object.freeze({
 approved:false,reason,creditsReserved:0,providerBalanceChecked:false
});
const invariant=(v)=>{if(!v)throw Error('rj_meteoblue_firestore_invalid_state')};
const validClock=n=>Number.isSafeInteger(n)&&n>=METEOBLUE_FREE_START_MS&&n<METEOBLUE_FREE_EXPIRY_MS;
const forecastFieldNames=new Set(Object.values(METEOBLUE_BASIC6H_FIELDS).map(x=>x.name));
export function createRjMeteoblueFreeFirestoreStore({db,clock=()=>Date.now()}={}){
 if(!db||typeof db.collection!=='function'||typeof db.runTransaction!=='function'||
    typeof clock!=='function')throw Error('rj_meteoblue_firestore_backend_required');
 const quota=db.collection(METEOBLUE_BUDGET_COLLECTION).doc(METEOBLUE_CAMPAIGN);
 const cacheCollection=db.collection(METEOBLUE_CACHE_COLLECTION);
 invariant(typeof quota?.get==='function'&&typeof cacheCollection?.doc==='function');
 const checkIbge=(ibge)=>{
  if(!CODES.has(String(ibge)))throw Error('rj_meteoblue_unknown_ibge');
  return String(ibge);
 };
 const reserve=async(ibge,whenMs=clock(),{temporaryExposedKey=false}={})=>{
  const id=checkIbge(ibge);
  if(!validClock(whenMs))return deny('TRIAL_NOT_VALID_AT_REQUEST_TIME');
  const day=new Date(whenMs).toISOString().slice(0,10);
  // Single shared Firestore transaction works across all Cloud Run instances.
  // There is NO in-memory fallback or process-local daily quota.
  return db.runTransaction(async tx=>{
    const snap=await tx.get(quota);
    const prev=snap.exists?snap.data():null;
    const spent=prev===null?0:prev?.spentCredits;
    const calls=prev===null?0:prev?.calls;
    const lastDay=prev===null?null:prev?.day;
    const dayCalls=prev===null?0:prev?.dayCalls;
    const cities=prev===null?{}:prev?.cityLastReserved;
    invariant(Number.isSafeInteger(spent)&&spent>=0&&
      spent<=METEOBLUE_PRIVATE_CEILING_CREDITS&&
      spent%METEOBLUE_BASIC6H_CREDITS===0&&
      Number.isSafeInteger(calls)&&calls===spent/METEOBLUE_BASIC6H_CREDITS&&
      Number.isSafeInteger(dayCalls)&&dayCalls>=0&&
      dayCalls<=METEOBLUE_MAX_DAILY_CALLS&&
      (lastDay===null||/^\d{4}-\d{2}-\d{2}$/.test(lastDay))&&
      cities&&typeof cities==='object'&&!Array.isArray(cities)&&
      Object.keys(cities).every(k=>CODES.has(k)&&
        Number.isSafeInteger(cities[k])&&cities[k]>=METEOBLUE_FREE_START_MS&&
        cities[k]<=whenMs));
    // Non-rotated previously pictured key: ONE additional staging probe
    // for the whole Firestore campaign, never a recurring source.
    if(temporaryExposedKey===true&&calls>=1)
      return deny('TEMPORARY_KEY_ONESHOT_SPENT');
    if(spent+METEOBLUE_BASIC6H_CREDITS>METEOBLUE_PRIVATE_CEILING_CREDITS)
      return deny('LOCAL_CAMPAIGN_CREDIT_CEILING');
    if(lastDay===day&&dayCalls>=METEOBLUE_MAX_DAILY_CALLS)
      return deny('LOCAL_DAILY_CALL_CEILING');
    if(cities[id]!==undefined&&whenMs-cities[id]<METEOBLUE_CITY_COOLDOWN_MS)
      return deny('MUNICIPAL_COOLDOWN');
    const nextCities={...cities,[id]:whenMs};
    tx.set(quota,{
      schemaVersion:1,campaign:METEOBLUE_CAMPAIGN,
      spentCredits:spent+METEOBLUE_BASIC6H_CREDITS,
      calls:calls+1,day,dayCalls:lastDay===day?dayCalls+1:1,
      cityLastReserved:nextCities,
      updatedAtMs:whenMs,
      // No key, URL, account identity, raw forecasts or personal locations.
    });
    return Object.freeze({
      approved:true,reason:'ONE_REQUEST_RESERVED',
      creditsReserved:METEOBLUE_BASIC6H_CREDITS,
      localSpentCredits:spent+METEOBLUE_BASIC6H_CREDITS,
      localRemainingAllowance:METEOBLUE_PRIVATE_CEILING_CREDITS-spent-METEOBLUE_BASIC6H_CREDITS,
      providerBalanceChecked:false
    });
  });
 };
 const getCached=async ibge=>{
  const id=checkIbge(ibge);
  const snap=await cacheCollection.doc(id).get();
  if(!snap?.exists)return null;
  const x=snap.data(),now=clock();
  if(!validClock(now)||!x||
     x?.ibge!==id||x?.sourceId!=='METEOBLUE_FREE_FORECAST'||
     !Number.isSafeInteger(x?.storedAtMs)||x.storedAtMs>now||
     now-x.storedAtMs>METEOBLUE_CACHE_TTL_MS||
     x?.forecast?.status!=='FORECAST_PARSED_PRIVATE_STAGING'||
     x?.forecast?.publishedToSubscribers!==false||
     x?.forecast?.publishedToAndroid!==false)return null;
  return x.forecast;
 };
 const setCached=async(ibge,forecast)=>{
  const id=checkIbge(ibge);
  const now=clock();
  if(!validClock(now)||
     forecast?.ibge!==id||
     forecast?.status!=='FORECAST_PARSED_PRIVATE_STAGING'||
     forecast?.publishedToSubscribers!==false||
     forecast?.publishedToAndroid!==false||
     !Array.isArray(forecast?.validTimes)||
     !Array.isArray(forecast?.values)||
     forecast.values.some(x=>!forecastFieldNames.has(x.field)))
    throw Error('rj_meteoblue_invalid_private_cache_write');
  const json=JSON.stringify(forecast);
  if(Buffer.byteLength(json,'utf8')>90_000)throw Error('rj_meteoblue_cache_too_large');
  await cacheCollection.doc(id).set({
    sourceId:'METEOBLUE_FREE_FORECAST',ibge:id,storedAtMs:now,
    forecast:JSON.parse(json)
  });
 };
 const readLocalBudgetStatus=async()=>{
  const snap=await quota.get();
  const x=snap.exists?snap.data():null;
  const spent=x===null?0:x?.spentCredits;
  const calls=x===null?0:x?.calls;
  if(!Number.isSafeInteger(spent)||spent<0||
     spent>METEOBLUE_PRIVATE_CEILING_CREDITS||
     !Number.isSafeInteger(calls)||calls!==spent/METEOBLUE_BASIC6H_CREDITS)
    throw Error('rj_meteoblue_budget_state_invalid');
  const today=new Date(clock()).toISOString().slice(0,10);
  const callsToday=x?.day===today?x.dayCalls:0;
  if(!Number.isSafeInteger(callsToday)||callsToday<0||
     callsToday>METEOBLUE_MAX_DAILY_CALLS)
    throw Error('rj_meteoblue_budget_day_invalid');
  return Object.freeze({
    campaign:METEOBLUE_CAMPAIGN,
    providerCreditBalance:'UNVERIFIED_IN_PROVIDER_DASHBOARD',
    providerChargeAuthorized:false,
    sourceOfCounts:'LOCAL_FIRESTORE_RESERVATIONS_ONLY',
    creditCostPerBasic6h:METEOBLUE_BASIC6H_CREDITS,
    localSpentCredits:spent,
    localCreditCeiling:METEOBLUE_PRIVATE_CEILING_CREDITS,
    localRemainingReservedAllowance:METEOBLUE_PRIVATE_CEILING_CREDITS-spent,
    localCallsReserved:calls,
    callsReservedToday:callsToday,
    maxCallsPerUtcDay:METEOBLUE_MAX_DAILY_CALLS,
    freeExpiryUtc:'2027-11-18T00:00:00.000Z'
  });
 };
 return Object.freeze({
  reserve,getCached,setCached,readLocalBudgetStatus,
  automaticPolling:false,
  publishedToSubscribers:false,automaticTtlDeletes:false,
  totalCredits:METEOBLUE_FREE_TOTAL_CREDITS,
  reservedCeilingCredits:METEOBLUE_PRIVATE_CEILING_CREDITS,
  providerBalanceChecked:false
 });
}
