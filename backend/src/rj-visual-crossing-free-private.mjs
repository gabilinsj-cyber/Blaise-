/**
 * Visual Crossing Timeline Free: one-operator, one-city private audit only.
 * OFF by default. Current conditions are supplier aggregates/estimates (E),
 * hourly forecast values are model predictions (P), never station readings O.
 * No client route, cron, paid fallback, or API key in Android/GitHub/logs.
 * Historical queries, alerts and event feeds are intentionally excluded.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
const POINTS=new Map(geo.points.map(x=>[x.ibge,x]));
const SOURCE='VISUAL_CROSSING_FREE';
export const VC_QUERY_COST_MAX=1;
export const VC_FIELD_SPEC=Object.freeze({
 temp:Object.freeze({field:'temperatureC',unit:'°C',min:-40,max:60}),
 feelslike:Object.freeze({field:'feelsLikeC',unit:'°C',min:-60,max:70}),
 humidity:Object.freeze({field:'relativeHumidityPct',unit:'%',min:0,max:100}),
 dew:Object.freeze({field:'dewPointC',unit:'°C',min:-60,max:60}),
 windspeed:Object.freeze({field:'windSpeedKmh',unit:'km/h',min:0,max:350}),
 windgust:Object.freeze({field:'windGustKmh',unit:'km/h',min:0,max:450}),
 precip:Object.freeze({field:'precipitationMm',unit:'mm',min:0,max:500}),
 precipprob:Object.freeze({field:'precipitationProbabilityPct',unit:'%',min:0,max:100}),
 pressure:Object.freeze({field:'pressureHpa',unit:'hPa',min:800,max:1100}),
 severerisk:Object.freeze({field:'severeRiskIndex',unit:'index 0-100',min:0,max:100}),
});
const unavailable=(reason, contacted=false)=>Object.freeze({
 status:'UNAVAILABLE',reason,sourceId:SOURCE,providerContacted:contacted,
 observationsPublished:false,paidApiUsed:false,publishedToSubscribers:false,
 current:null,forecast:null,queryCostVerified:false
});
const toValue=(v,rule)=>v===null||v===undefined?null:
 typeof v==='number'&&Number.isFinite(v)&&v>=rule.min&&v<=rule.max?v:null;
const parseFields=obj=>Object.freeze(Object.fromEntries(
 Object.entries(VC_FIELD_SPEC).map(([key,rule])=>[
  rule.field,toValue(obj?.[key],rule)
 ])
));
function normalizedTime(seconds,now,{maximumAgeMs=3*3600_000,maximumFutureMs=30*60_000}={}){
 if(typeof seconds!=='number'||!Number.isSafeInteger(seconds))return null;
 const ms=seconds*1000;
 if(!Number.isSafeInteger(ms)||now-ms>maximumAgeMs||ms-now>maximumFutureMs)return null;
 return new Date(ms).toISOString();
}
export function parseVisualCrossingPrivateSample(body,{
  ibge='3304557',now=Date.now()
}={}){
 if(!POINTS.has(String(ibge))||!Number.isSafeInteger(now)||now<0||
    !body||typeof body!=='object'||Array.isArray(body)||
    body.errorCode||body.error||body.message?.toLowerCase?.().includes('error')||
    body.queryCost!==VC_QUERY_COST_MAX)
  return unavailable('INVALID_SOURCE_RESPONSE_OR_QUERY_COST');
 const current=body.currentConditions;
 const time=normalizedTime(current?.datetimeEpoch,now);
 // Wrong timezone/source location cannot be treated as Rio conditions.
 const point=POINTS.get(String(ibge));
 const lat=body.latitude,lon=body.longitude;
 if(!point||typeof lat!=='number'||typeof lon!=='number'||
    Math.abs(lat-point.lat)>0.4||Math.abs(lon-point.lon)>0.4)
  return unavailable('CITY_COORDINATES_MISMATCH');
 if(!time)return unavailable('CURRENT_CONDITIONS_TIMESTAMP_UNAVAILABLE');
 const values=parseFields(current);
 if(Object.values(values).every(x=>x===null))
  return unavailable('CURRENT_FIELDS_ALL_UNAVAILABLE');
 // Past hourly records are never silently represented as future forecasts.
 const nextDay=Array.isArray(body.days)?body.days.slice(0,2):[];
 const future=[];
 for(const d of nextDay){
  for(const hour of Array.isArray(d?.hours)?d.hours:[]){
   const when=normalizedTime(hour?.datetimeEpoch,now,{
    maximumAgeMs:0,maximumFutureMs:48*3600_000
   });
   if(when&&future.length<49)future.push(Object.freeze({
    validAt:when,values:parseFields(hour),kind:'P'
   }));
  }
 }
 const seen=new Set();
 const hourly=future.filter(x=>{
  if(seen.has(x.validAt))return false;
  seen.add(x.validAt);return true;
 });
 return Object.freeze({
  status:'PRIVATE_REAL_SAMPLE_READY',
  sourceId:SOURCE,ibge:String(ibge),
  checkedAt:new Date(now).toISOString(),validAt:time,
  category:'E',current:Object.freeze({
   validAt:time,kind:'E',measurementStationVerified:false,
   values,sourceStationId:null,
   provenance:'VISUAL_CROSSING_AGGREGATED_CURRENT_CONDITIONS',
  }),
  forecast:Object.freeze(hourly),
  queryCost:body.queryCost,queryCostVerified:true,
  officialAlert:false,officialObservation:false,
  riskIndexNotOfficialAlert:true,
  snowOrSevereRiskNotInferredFromMissingFields:true,
  attribution:'Weather data by Visual Crossing',
  privateStagingOnly:true,publishedToAndroid:false,
  publishedToSubscribers:false,observationsPublished:false,
  paidApiUsed:false
 });
}
export function buildVisualCrossingPrivateUrl({ibge='3304557',apiKey}={}){
 const point=POINTS.get(String(ibge));
 if(!point||String(ibge)!=='3304557'|| // First trial: Rio ONLY
   typeof apiKey!=='string'||!/^[A-Za-z0-9_-]{8,180}$/.test(apiKey))
  throw Error('visual_crossing_private_config_invalid');
 const loc=point.lat.toFixed(4)+','+point.lon.toFixed(4);
 const url=new URL('https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/'+loc);
 url.searchParams.set('key',apiKey);
 url.searchParams.set('unitGroup','metric');
 url.searchParams.set('include','current,hours');
 url.searchParams.set('elements','datetime,datetimeEpoch,temp,feelslike,humidity,dew,windspeed,windgust,precip,precipprob,pressure,severerisk,conditions');
 url.searchParams.set('contentType','json');
 return url;
}
export async function collectVisualCrossingPrivateSample({
 env={},ibge='3304557',reserve=null,clock=()=>Date.now(),
 fetchImpl=globalThis.fetch
}={}){
 if(env.BLAISE_VISUAL_CROSSING_PRIVATE_ENABLED!=='true'||
    env.BLAISE_VISUAL_CROSSING_FREE_PLAN_CONFIRMED!=='true'||
    env.BLAISE_VISUAL_CROSSING_PAID_ALLOWED!=='false'||
    env.BLAISE_VISUAL_CROSSING_AUTOTOPUP_DISABLED!=='true'||
    env.BLAISE_VISUAL_CROSSING_ONESHOT_APPROVED!=='true'||
    env.BLAISE_VISUAL_CROSSING_PUBLISH_TO_SUBSCRIBERS==='true'||
    typeof reserve!=='function'||typeof fetchImpl!=='function')
  return unavailable('EXPLICIT_FREE_PRIVATE_GATES_REQUIRED');
 let url;
 try{url=buildVisualCrossingPrivateUrl({ibge,apiKey:env.BLAISE_VISUAL_CROSSING_FREE_API_KEY});}
 catch{return unavailable('SERVER_SECRET_OR_CITY_INVALID')}
 // Shared daily reservation BEFORE any provider call; never a process-local
 // quota, because autoscaling workers can run simultaneously.
 let reserved;
 try{reserved=await reserve(String(ibge),clock());}
 catch{return unavailable('ATOMIC_DAILY_BUDGET_UNAVAILABLE')}
 if(reserved?.approved!==true)return unavailable(reserved?.reason||'DAILY_BUDGET_BLOCKED');
 let response;
 try{
  response=await fetchImpl(url.href,{
   method:'GET',redirect:'error',headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(12000)
  });
  if(response?.status!==200)return unavailable('PROVIDER_HTTP_NOT_200',true);
  const length=Number(response.headers?.get?.('content-length')??0);
  if(!Number.isFinite(length)||length>300_000)
   return unavailable('PROVIDER_RESPONSE_TOO_LARGE',true);
  const text=await response.text();
  if(text.length>300_000)return unavailable('PROVIDER_RESPONSE_TOO_LARGE',true);
  const parsed=parseVisualCrossingPrivateSample(JSON.parse(text),{ibge,now:clock()});
  return Object.freeze({...parsed,providerContacted:true});
 }catch{
  // Never log exception stacks or URL: URL contains server-side API key.
  return unavailable('PROVIDER_FETCH_OR_JSON_UNAVAILABLE',true);
 }
}
