/**
 * Future Visual Crossing Free per-municipality collector.
 *
 * No route/cron/scheduler calls this module. In particular it is NOT wired
 * into an existing Cloud Run worker. All approvals are required per call;
 * even after approvals the Firestore atomic budget runs BEFORE provider GET.
 * Retiring/rotating keys is an explicit operator decision, not performed here.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
import {parseVisualCrossingPrivateSample} from './rj-visual-crossing-free-private.mjs';
const points=new Map(geo.points.map(x=>[String(x.ibge),x]));
const unavailable=(reason,contacted=false)=>Object.freeze({
 status:'DISABLED_OR_UNAVAILABLE',reason,providerContacted:contacted,
 clientPublishingEnabled:false,paidUsed:false
});
export function buildVisualCrossing92FutureUrl({ibge,key}={}){
 const p=points.get(String(ibge));
 if(!p||typeof key!=='string'||!/^[A-Za-z0-9_-]{8,180}$/.test(key))
  throw Error('invalid_city_or_secret');
 const u=new URL('https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/'+
   p.lat.toFixed(4)+','+p.lon.toFixed(4));
 // Never print this URL — it includes the provider credential.
 u.searchParams.set('key',key);
 u.searchParams.set('unitGroup','metric');
 u.searchParams.set('include','current,hours');
 u.searchParams.set('elements','datetime,datetimeEpoch,temp,feelslike,humidity,dew,windspeed,windgust,precip,precipprob,pressure,severerisk,conditions');
 u.searchParams.set('contentType','json');
 return u;
}
export async function collectVisualCrossing92FutureOne({
 ibge,env={},reserve=null,cache=null,
 fetchImpl=globalThis.fetch,clock=()=>Date.now()
}={}){
 const required={
  BLAISE_VC_92_COLLECTION_ENABLED:'true',
  BLAISE_VC_FREE_PLAN_CONFIRMED:'true',
  BLAISE_VC_NO_BILLING_CONFIRMED:'true',
  BLAISE_VC_KEY_ROTATED_AFTER_EXPOSURE:'true',
  BLAISE_VC_PROVIDER_EXTRA_CREDITS_REVIEWED:'true',
  BLAISE_VC_92_OPERATOR_APPROVED:'true',
  BLAISE_VC_PAID_ALLOWED:'false',
  BLAISE_VC_PUBLISH_CLIENT:'false'
 };
 if(Object.entries(required).some(([k,v])=>env[k]!==v)||
    typeof reserve!=='function'||typeof cache?.save!=='function'||
    typeof fetchImpl!=='function')
  return unavailable('KEY_ROTATION_BILLING_REVIEW_OR_ADMIN_APPROVAL_REQUIRED');
 let url;
 try{url=buildVisualCrossing92FutureUrl({ibge,key:env.BLAISE_VC_FREE_API_KEY});}
 catch{return unavailable('INVALID_SERVER_CONFIGURATION');}
 let ticket;
 try{ticket=await reserve(String(ibge));}catch{return unavailable('FIRESTORE_BUDGET_UNAVAILABLE');}
 if(ticket?.approved!==true)return unavailable(ticket?.reason??'DAILY_QUOTA_BLOCKED');
 try {
  const response=await fetchImpl(url.href,{method:'GET',redirect:'error',
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(response?.status!==200)return unavailable('PROVIDER_HTTP_UNAVAILABLE',true);
  const bytes=Number(response.headers?.get?.('content-length')??0);
  if(!Number.isFinite(bytes)||bytes>300_000)return unavailable('PROVIDER_RESPONSE_TOO_LARGE',true);
  const text=await response.text();
  if(text.length>300_000)return unavailable('PROVIDER_RESPONSE_TOO_LARGE',true);
  const sample=parseVisualCrossingPrivateSample(JSON.parse(text),{ibge,now:clock()});
  if(sample.status!=='PRIVATE_REAL_SAMPLE_READY'||sample.queryCost!==1)
   return unavailable('SOURCE_RESPONSE_INVALID_OR_COST_NOT_ONE',true);
  const saved=await cache.save(sample);
  return Object.freeze({
   status:'PRIVATE_CACHE_SAVED',ibge:String(ibge),
   forecastSlots:saved.forecastSlots,currentFields:saved.currentFields,
   expiresAt:saved.expiresAt,providerContacted:true,
   queryCost:1,clientPublishingEnabled:false,paidUsed:false
  });
 }catch{
  // Never print exception: an HTTP error can contain the key-bearing URL.
  return unavailable('FETCH_PARSE_OR_PRIVATE_STORAGE_FAILED',true);
 }
}
