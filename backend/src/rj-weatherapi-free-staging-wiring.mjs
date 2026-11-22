/**
 * Blaise V6 RJ: WeatherAPI V2 -> private Firestore -> Agente 13 cache freshness
 * -> existing official dashboard interface, STAGED ONLY.
 *
 * This module never reads the API key, accesses a meteorological provider,
 * creates a scheduler, reserves a call, deploys or authorizes client release.
 * Any future release requires a separate reviewed change and explicit approval.
 */
import points from './rj-ibge-92-points.json' with {type:'json'};
import {createRjWeatherApiFreePrivateCache}
 from './rj-weatherapi-free-private-cache.mjs';
import {createRjWeatherApiFreeMonthlyBudget}
 from './rj-weatherapi-free-monthly-budget.mjs';
import {projectWeatherApiFreeCurrentForPaidDashboard}
 from './rj-weatherapi-free-client-projection.mjs';
import {WEATHERAPI_INTERNAL_MONTHLY_CEILING}
 from './rj-weatherapi-free-92-plan.mjs';

const CITIES=new Set(points.points.map(x=>String(x.ibge)));
const ONE_MINUTE=60_000;
const MAX_SOURCE_AGE=35*ONE_MINUTE;
export const RJ_WA_STAGING_SECRET_REF=Object.freeze({
 projectId:'blaise-v6-rj',name:'blaise-weatherapi-free-api-key',
 version:'2',accessAtRuntimeVerified:false
});
export const RJ_AGENT13_WA_CACHE_AUDIT_INTERVAL_MS=ONE_MINUTE;
export const RJ_WA_STAGING_AUTOMATIC_PROVIDER_CALLS=false;
export const RJ_WA_STAGING_SUBSCRIBER_RELEASE=false;
const round=n=>Math.round(n*10)/10;
const validClock=n=>Number.isSafeInteger(n)&&n>=0;

/**
 * An Agente 13-style freshness check that DOES NOT contact the provider.
 * A future independent scheduler may invoke it once/minute after approval.
 * Only already private, source-verified cache data are eligible.
 * Never interpret checkedAt as the observation's timestamp.
 */
export async function auditAgent13WeatherApiCache({
 municipalityIbges,readPrivateCache,now=Date.now()
}={}){
 const codes=municipalityIbges;
 if(!validClock(now)||!Array.isArray(codes)||codes.length<1||
    codes.length>2||new Set(codes.map(String)).size!==codes.length||
    codes.some(x=>typeof x!=='string'||!CITIES.has(x))||
    typeof readPrivateCache!=='function')
  return Object.freeze({
   status:'INVALID_AUDIT_SCOPE',auditPerformed:false,records:Object.freeze([])
  });
 const records=[];
 for(const ibge of codes){
  let privateRow=null;
  try{privateRow=await readPrivateCache(ibge);}catch{}
  const projected=projectWeatherApiFreeCurrentForPaidDashboard(
   privateRow,{ibge,now});
  if(!projected){
   records.push(Object.freeze({
    ibge,sourceId:'WEATHERAPI_FREE',status:'UNAVAILABLE_OR_EXPIRED',
    sourceValidAt:null,sourceAgeMinutes:null,
    notAnOfficialStation:true,officialAlertAllowed:false
   }));
   continue;
  }
  const sourceMs=Date.parse(projected.validAt);
  const age=(now-sourceMs)/ONE_MINUTE;
  records.push(Object.freeze({
   ibge,sourceId:'WEATHERAPI_FREE',status:'CACHE_MEASUREMENT_FRESH',
   sourceValidAt:projected.validAt,sourceAgeMinutes:round(age),
   // A newer cache check must never be labeled as a new measurement.
   checkedAt:projected.checkedAt,
   notAnOfficialStation:true,officialAlertAllowed:false
  }));
 }
 return Object.freeze({
  status:'CACHE_ONLY_AUDIT_COMPLETED',auditPerformed:true,
  records:Object.freeze(records),providerCalls:0,creditReservations:0,
  liveMinuteSchedulerEnabled:false,
  sourceFreshnessCeilingMs:MAX_SOURCE_AGE
 });
}

/**
 * QA wiring can only run in a separately authorized non-service environment.
 * A Cloud Run SERVICE always remains closed, even if someone sets QA flags.
 * A future isolated Job approval/deploy is outside this module and PR.
 */
export async function initializeRjWeatherApiFreeStaging({
 env={},createDatabase=null,clock=()=>Date.now()
}={}){
 const disabled=Object.freeze({
  state:'DISABLED',configured:false,secret:RJ_WA_STAGING_SECRET_REF,
  automaticProviderCalls:false,creditReservationsPerformed:0,
  automaticPollingEnabled:false,clientReleaseApproved:false,
  clientThermalReleaseApproved:false,readPrivateCache:null,
  auditSelectedCities:async()=>Object.freeze({
   status:'NOT_CONFIGURED',auditPerformed:false,records:Object.freeze([])
  })
 });
 // Neither a production Cloud Run service nor an unapproved environment
 // may construct the Firestore adapter.
 if(env.K_SERVICE||env.K_REVISION)return disabled;
 const gate={
  BLAISE_WA_STAGING_PRIVATE_READ_ENABLED:'true',
  BLAISE_WA_STAGING_OPERATOR_APPROVED:'true',
  BLAISE_WA_STAGING_ISOLATED_NO_TRAFFIC_CONFIRMED:'true',
  BLAISE_WA_STAGING_PROJECT:'blaise-v6-rj',
  BLAISE_WA_STAGING_SECRET_VERSION:'2',
  BLAISE_WA_STAGING_PROVIDER_CALLS_DISABLED:'true',
  BLAISE_WA_STAGING_CLIENT_RELEASE_DISABLED:'true',
  BLAISE_WA_STAGING_QUOTA_RESERVATION_DISABLED:'true'
 };
 if(Object.entries(gate).some(([key,val])=>env[key]!==val))
  return disabled;
 if(typeof createDatabase!=='function'||typeof clock!=='function')
  return Object.freeze({...disabled,state:'QA_DATABASE_FACTORY_REQUIRED'});
 let db;
 try{
  db=await createDatabase({projectId:'blaise-v6-rj'});
  const cache=createRjWeatherApiFreePrivateCache({db,clock});
  // Constructing budget is read/write-FREE. Its reserve() is NOT exposed to
  // QA, to HTTP handlers, or to the freshness observer.
  const budget=createRjWeatherApiFreeMonthlyBudget({db,clock});
  if(budget.paidOveragesAllowed!==false||
     budget.autoCollectionEnabled!==false)return disabled;
  const readPrivateCache=async ibge=>cache.read(ibge);
  return Object.freeze({
   state:'PRIVATE_CACHE_QA_READY_NOT_RELEASED',configured:true,
   secret:RJ_WA_STAGING_SECRET_REF,
   sharedMonthlyBudgetGuardConfigured:true,
   maxReservedFreeCallsPerMonth:WEATHERAPI_INTERNAL_MONTHLY_CEILING,
   automaticProviderCalls:false,creditReservationsPerformed:0,
   automaticPollingEnabled:false,clientReleaseApproved:false,
   clientThermalReleaseApproved:false,readPrivateCache,
   // The dashboard accepts this reader via dependency injection, but its
   // release flags MUST remain false until a separate authorized change.
   dashboardOptions:Object.freeze({
    readWeatherApiPrivateCache,
    weatherApiSubscriberReleaseApproved:false,
    weatherApiThermalRedistributionApproved:false
   }),
   auditSelectedCities:async municipalityIbges=>auditAgent13WeatherApiCache({
    municipalityIbges,readPrivateCache,now:clock()
   })
  });
 }catch{
  return Object.freeze({...disabled,state:'QA_PRIVATE_FIRESTORE_UNAVAILABLE'});
 }
}
