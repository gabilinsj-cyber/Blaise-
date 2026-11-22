/**
 * Blaise V6 RJ - WeatherAPI.com Free one-call private audit.
 *
 * No public route, scheduler, secrets in Git/Android, paid upgrade, or
 * outbound request on import. Provider current weather = aggregated E,
 * forecast hours = predicted P. Never infer a station observation or a
 * government severe-weather alert from provider condition codes.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
const POINTS=new Map(geo.points.map(p=>[String(p.ibge),p]));
const SOURCE='WEATHERAPI_FREE';
export const WAPI_PRIVATE_ONE_SHOT_LIMIT=1;
export const WAPI_PRIVATE_MAX_AGE_MS=60*60_000;
export const WAPI_PRIVATE_DESIRED_AGE_MS=30*60_000;
const fields=Object.freeze({
 temp_c:['temperatureC',-60,65],
 feelslike_c:['feelsLikeC',-80,80],
 humidity:['relativeHumidityPct',0,100],
 cloud:['cloudPct',0,100],
 wind_kph:['windKmh',0,350],
 gust_kph:['gustKmh',0,450],
 pressure_mb:['pressureHpa',800,1150],
 precip_mm:['precipitationMm',0,500],
 uv:['uvIndex',0,20],
});
const bad=(reason,contacted=false)=>Object.freeze({
 status:'UNAVAILABLE',reason,providerContacted:contacted,
 publishedToSubscribers:false,usedPaidPlan:false,rawResponseSaved:false
});
const value=(obj,key,lo,hi)=>{
 const x=obj?.[key];
 return typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi?x:null;
};
function values(row) {
 return Object.freeze(Object.fromEntries(Object.entries(fields).map(
   ([key,[name,lo,hi]])=>[name,value(row,key,lo,hi)]
 )));
}
export const WAPI_SKY_CODES=Object.freeze({
 1000:'SOL_OU_CEU_LIMPO',
 1003:'PARCIALMENTE_NUBLADO',
 1006:'NUBLADO',
 1009:'ENCUBERTO',
});
export function classifyWeatherApiSky(code){
 if(!Number.isInteger(code))return null;
 if(Object.hasOwn(WAPI_SKY_CODES,code))return WAPI_SKY_CODES[code];
 if([1063,1150,1153,1168,1171,1180,1183,1186,1189,
 1192,1195,1198,1201,1240,1243,1246].includes(code))
  return 'CHUVA_INDICADA_PELO_PROVEDOR';
 if([1087,1273,1276,1279,1282].includes(code))
  return 'TROVOADA_INDICADA_NAO_ALERTA_OFICIAL';
 return 'OUTRA_CONDICAO';
}
export function buildWeatherApiPrivateUrl({ibge='3304557',apiKey}={}){
 const p=POINTS.get(String(ibge));
 if(String(ibge)!=='3304557'||!p||
   typeof apiKey!=='string'||!/^[a-zA-Z0-9_-]{8,160}$/.test(apiKey))
  throw Error('invalid_weatherapi_private_credentials_or_city');
 const u=new URL('https://api.weatherapi.com/v1/forecast.json');
 u.searchParams.set('key',apiKey); // Never log URL, query or exception stack.
 u.searchParams.set('q',p.lat.toFixed(4)+','+p.lon.toFixed(4));
 u.searchParams.set('days','1');
 u.searchParams.set('aqi','no');
 u.searchParams.set('alerts','no');
 u.searchParams.set('lang','pt');
 return u;
}
export function parseWeatherApiPrivateSample(payload,{
 ibge='3304557',now=Date.now()
}={}){
 const p=POINTS.get(String(ibge));
 if(!p||String(ibge)!=='3304557'||!Number.isSafeInteger(now)||now<0||
    !payload||typeof payload!=='object'||Array.isArray(payload)||
    payload.error||!payload.current||!payload.location)
  return bad('PROVIDER_RESPONSE_OR_CITY_INVALID');
 const loc=payload.location;
 if(typeof loc.lat!=='number'||typeof loc.lon!=='number'||
    !Number.isFinite(loc.lat)||!Number.isFinite(loc.lon)||
    Math.abs(loc.lat-p.lat)>0.4||Math.abs(loc.lon-p.lon)>0.4)
  return bad('PROVIDER_COORDINATES_MISMATCH');
 const current=payload.current;
 const epoch=current.last_updated_epoch;
 if(!Number.isSafeInteger(epoch)||epoch<0)
  return bad('SOURCE_TIME_UNAVAILABLE');
 const ms=epoch*1000;
 if(ms>now||now-ms>WAPI_PRIVATE_MAX_AGE_MS)
  return bad('CURRENT_SOURCE_TIME_STALE_OR_FUTURE');
 const currentValues=values(current);
 if(Object.values(currentValues).every(v=>v===null))
  return bad('NO_VALID_CURRENT_WEATHER_FIELDS');
 const code=current.condition?.code;
 const sky=classifyWeatherApiSky(code);
 const forecastDays=payload.forecast?.forecastday;
 if(!Array.isArray(forecastDays)||forecastDays.length!==1||
    !Array.isArray(forecastDays[0]?.hour)||
    forecastDays[0].hour.length>24)
  return bad('FORECAST_SHAPE_INVALID');
 const forecasts=[];
 for(const row of forecastDays[0].hour){
  const when=row?.time_epoch;
  if(!Number.isSafeInteger(when)||when<0)continue;
  const at=when*1000;
  if(at<=now||at>now+48*60*60_000)continue;
  const v=values(row);
  if(Object.values(v).every(x=>x===null))continue;
  forecasts.push(Object.freeze({
   validAt:new Date(at).toISOString(),kind:'P',
   skyCondition:classifyWeatherApiSky(row.condition?.code),
   values:v
  }));
 }
 forecasts.sort((a,b)=>a.validAt.localeCompare(b.validAt));
 if(new Set(forecasts.map(f=>f.validAt)).size!==forecasts.length)
  return bad('DUPLICATE_HOURLY_TIMESTAMPS');
 return Object.freeze({
  status:'PRIVATE_REAL_SAMPLE_READY',sourceId:SOURCE,
  ibge:String(ibge),sourceCoordinatesVerified:true,
  checkedAt:new Date(now).toISOString(),validAt:new Date(ms).toISOString(),
  currentKind:'E_AGGREGATED_NOT_INSTRUMENTAL',
  current:Object.freeze({values:currentValues,
   skyCondition:sky,conditionCode:Number.isInteger(code)?code:null}),
  hourly:Object.freeze(forecasts),
  ageMinutes:Math.round((now-ms)/60_000*10)/10,
  meets30MinuteTarget:now-ms<=WAPI_PRIVATE_DESIRED_AGE_MS,
  withinFreeCurrentAgeWindow:true,officialAlert:false,
  measuredAtIdentifiedStation:false,safetyCriticalApproved:false,
  attribution:'WeatherAPI.com',publishedToSubscribers:false,
  usedPaidPlan:false,rawResponseSaved:false
 });
}
export async function collectWeatherApiPrivateOnce({
 ibge='3304557',env={},reserve=null,fetchImpl=globalThis.fetch,
 clock=()=>Date.now()
}={}){
 const required={
  BLAISE_WAPI_PRIVATE_ENABLED:'true',
  BLAISE_WAPI_FREE_PLAN_CONFIRMED:'true',
  BLAISE_WAPI_NO_AUTOTOPUP_CONFIRMED:'true',
  BLAISE_WAPI_ONE_SHOT_APPROVED:'true',
  BLAISE_WAPI_PAID_ALLOWED:'false',
  BLAISE_WAPI_PUBLISH_TO_SUBSCRIBERS:'false'
 };
 if(Object.entries(required).some(([k,v])=>env[k]!==v)||
    typeof reserve!=='function'||typeof fetchImpl!=='function'||
    typeof clock!=='function')return bad('FREE_ACCOUNT_OR_MANUAL_APPROVAL_REQUIRED');
 let url;
 try{url=buildWeatherApiPrivateUrl({ibge,apiKey:env.BLAISE_WAPI_FREE_API_KEY});}
 catch{return bad('SECRET_OR_CITY_NOT_VERIFIED');}
 let ticket;
 try{ticket=await reserve(String(ibge),clock());}
 catch{return bad('ATOMIC_FREE_BUDGET_UNAVAILABLE');}
 if(ticket?.approved!==true)return bad(ticket?.reason??'ONE_CALL_BUDGET_USED');
 try{
  const response=await fetchImpl(url.href,{
   method:'GET',redirect:'error',headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(12000)
  });
  if(response?.status!==200)return bad('PROVIDER_HTTP_NOT_200',true);
  const length=Number(response.headers?.get?.('content-length')??0);
  if(!Number.isFinite(length)||length<0||length>400000)
   return bad('PROVIDER_RESPONSE_TOO_LARGE',true);
  const text=await response.text();
  if(text.length>400000)return bad('PROVIDER_RESPONSE_TOO_LARGE',true);
  const sample=parseWeatherApiPrivateSample(JSON.parse(text),{
   ibge,now:clock()
  });
  return Object.freeze({...sample,providerContacted:true});
 }catch{
  // Never expose API key-bearing request URLs, raw bodies or error stacks.
  return bad('PRIVATE_RESPONSE_UNAVAILABLE',true);
 }
}
