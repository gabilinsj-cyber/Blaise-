/**
 * Future WeatherAPI.com FREE 92-municipality current collector.
 * No runtime, cron or Cloud Run startup imports this module. It cannot run
 * without explicit operator/plan/secret verification and atomic quota reserve.
 * Never log URL, response, key or provider error.
 */
import points from './rj-ibge-92-points.json' with {type:'json'};
import {WEATHERAPI_INTERNAL_MONTHLY_CEILING}
 from './rj-weatherapi-free-92-plan.mjs';
import {projectWeatherApiFreeCurrentForPaidDashboard}
 from './rj-weatherapi-free-client-projection.mjs';

export const RJ_WEATHERAPI_COLLECTOR_AUTO_ENABLED=false;
const cities=new Map(points.points.map(p=>[String(p.ibge),p]));
const unavailable=(reason,contacted=false)=>Object.freeze({
 status:'DISABLED_OR_UNAVAILABLE',reason,providerContacted:contacted,
 customerPublishingEnabled:false,paidCallsAllowed:false
});
export function createWeatherApiFreeUrl({ibge,apiKey}={}){
 const p=cities.get(String(ibge));
 if(!p||typeof apiKey!=='string'||
    !/^[A-Za-z0-9_-]{8,180}$/.test(apiKey))
  throw Error('invalid_server_configuration');
 const u=new URL('https://api.weatherapi.com/v1/current.json');
 u.searchParams.set('key',apiKey);
 u.searchParams.set('q',p.lat.toFixed(4)+','+p.lon.toFixed(4));
 u.searchParams.set('aqi','no');
 return u; // Secret-bearing, never print or expose.
}
function readResponse(raw,ibge,now){
 const location=raw?.location,cur=raw?.current;
 if(!location||!cur||raw?.error||typeof location!=='object'||
    typeof cur!=='object'||Array.isArray(cur))return null;
 const allowed=[
  'last_updated_epoch','temp_c','feelslike_c','humidity','wind_kph',
  'gust_kph','precip_mm','cloud','pressure_mb','uv','condition'
 ];
 const fields=Object.fromEntries(allowed.map(k=>[k,cur[k]??null]));
 // Only allow numeric code from conditions, no externally provided text.
 fields.condition={code:cur.condition?.code};
 const payload={
  status:'PRIVATE_CACHE_VALID',sourceId:'WEATHERAPI_FREE',
  ibge:String(ibge),nature:'E',providerDataVerified:true,
  municipalityGeographyVerified:true,publicReleaseEnabled:false,
  checkedAt:new Date(now).toISOString(),
  location:{lat:location.lat,lon:location.lon},
  data:fields
 };
 return projectWeatherApiFreeCurrentForPaidDashboard(payload,{
  ibge,now}) ?payload:null;
}
export async function collectRjWeatherApiFreeOne({
 ibge,env={},reserve=null,cache=null,
 fetchImpl=globalThis.fetch,clock=()=>Date.now()
}={}){
 const required={
  BLAISE_WA_FREE_COLLECTION_ENABLED:'true',
  BLAISE_WA_FREE_PLAN_AND_BALANCE_CONFIRMED:'true',
  BLAISE_WA_KEY_IN_SECRET_MANAGER_VERIFIED:'true',
  BLAISE_WA_COMMERCIAL_TERMS_VERIFIED:'true',
  BLAISE_WA_ACCOUNT_EXTERNAL_USAGE_REVIEWED:'true',
  BLAISE_WA_OPERATOR_APPROVED:'true',
  BLAISE_WA_PAID_CALLS_ALLOWED:'false',
  BLAISE_WA_CLIENT_RELEASE_APPROVED:'false'
 };
 if(Object.entries(required).some(([k,v])=>env[k]!==v)||
    typeof reserve!=='function'||typeof cache?.save!=='function'||
    typeof fetchImpl!=='function')
  return unavailable('PROVIDER_KEY_QUOTA_TERMS_OR_OPERATOR_GATE_MISSING');
 let u;
 try {u=createWeatherApiFreeUrl({ibge,apiKey:env.BLAISE_WA_FREE_API_KEY});}
 catch{return unavailable('INVALID_PRIVATE_KEY_OR_IBGE');}
 let ticket;
 try{ticket=await reserve({ibge:String(ibge),
   source:'WEATHERAPI_FREE',maxMonthlyCalls:WEATHERAPI_INTERNAL_MONTHLY_CEILING});}
 catch{return unavailable('SHARED_MONTHLY_BUDGET_UNAVAILABLE');}
 if(ticket?.approved!==true)return unavailable('SHARED_FREE_BUDGET_EXHAUSTED');
 try{
  const response=await fetchImpl(u.href,{
   method:'GET',redirect:'error',headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(9000)
  });
  if(response?.status!==200)return unavailable('PROVIDER_HTTP_UNAVAILABLE',true);
  const len=Number(response.headers?.get?.('content-length')??0);
  if(!Number.isFinite(len)||len>64_000)
    return unavailable('PROVIDER_RESPONSE_TOO_LARGE',true);
  const body=await response.text();
  if(body.length>64_000)return unavailable('PROVIDER_RESPONSE_TOO_LARGE',true);
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0)
    return unavailable('INVALID_CLOCK',true);
  const sanitized=readResponse(JSON.parse(body),ibge,now);
  if(!sanitized)return unavailable('PROVIDER_FIELDS_AGE_OR_GEO_INVALID',true);
  const receipt=await cache.save(sanitized);
  if(receipt?.saved!==true)return unavailable('PRIVATE_CACHE_REJECTED',true);
  return Object.freeze({
   status:'PRIVATE_CACHE_SAVED',ibge:String(ibge),
   providerContacted:true,recordsReserved:1,
   sourceValidAt:new Date(sanitized.data.last_updated_epoch*1000).toISOString(),
   clientPublishingEnabled:false,paidCallsAllowed:false
  });
 }catch {
  // Never reveal exception or URL because they can contain the key.
  return unavailable('PROVIDER_FETCH_OR_PRIVATE_STORAGE_FAILED',true);
 }
}
