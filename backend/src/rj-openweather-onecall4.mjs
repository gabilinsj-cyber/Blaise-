/**
 * Blaise V6 RJ — optional OpenWeather One Call 4.0 CURRENT connector.
 *
 * The secret is injected at runtime (never in Git, the APK, JSON responses,
 * logs, or tests). This module DOES NOT enable itself or run background jobs.
 * The OpenWeather One Call subscription is separate from an active API key.
 * Operator must rotate any key disclosed in conversation before configuring.
 *
 * Safety gates: explicit subscription, shared cache, SHARED ATOMIC UTC-day
 * quota reservation, 900/day internal budget, 10-minute polling interval.
 * 900 is reserved solely for this integration; 1,000/day is the published
 * free One Call allowance, but other account usage can still incur charges.
 *
 * Provider "current" is a modeled/current weather estimate, never an INMET
 * station observation, true radar frame or Brazilian official alert.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';
import {fetchJsonContract} from './source-contract.mjs';

export const RJ_OPENWEATHER_ONECALL4_CONTRACT='BLAISE_RJ_OPENWEATHER_CURRENT_4_V1';
export const RJ_OPENWEATHER_HOST='api.openweathermap.org';
export const RJ_OPENWEATHER_SOURCE_ID='OPENWEATHER_ONECALL4_CURRENT';
export const RJ_OPENWEATHER_DAILY_INTERNAL_MAX=900;
export const RJ_OPENWEATHER_CACHE_MS=10*60_000;
const RJ_CODES=new Set(RJ_MUNICIPALITIES.map(c=>String(c.ibge)));
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const missing=(reason)=>Object.freeze({
  contract:RJ_OPENWEATHER_ONECALL4_CONTRACT,status:'UNAVAILABLE',reason,
  data:null,officialObservation:false,officialAlert:false,radarFrame:false,
  automaticAlertAuthorized:false
});
function verifiedTarget(target){
  return target&&RJ_CODES.has(String(target.ibge))&&
    finite(target.latitude,-23.37,-20.75)&&
    finite(target.longitude,-44.9,-40.9);
}
function presentNumber(value,min,max){
  return finite(value,min,max)?value:null;
}
function normalize(payload,target,now){
  if(!payload||!finite(payload.lat,-90,90)||!finite(payload.lon,-180,180)||
    Math.abs(payload.lat-target.latitude)>0.1||
    Math.abs(payload.lon-target.longitude)>0.1||
    !Array.isArray(payload.data)||payload.data.length!==1)
    return missing('PROVIDER_LOCATION_OR_CURRENT_RECORD_UNVERIFIED');
  const item=payload.data[0];
  if(!item||!Number.isSafeInteger(item.dt)||item.dt<0||
    !finite(item.temp,-60,65))
    return missing('PROVIDER_CURRENT_TEMPERATURE_INVALID');
  const validMs=item.dt*1000;
  if(validMs>now+60_000||now-validMs>30*60_000)
    return missing('PROVIDER_CURRENT_VALUE_STALE_OR_FUTURE');
  const windMs=presentNumber(item.wind_speed,0,110);
  const gustMs=presentNumber(item.wind_gust,0,140);
  const humidity=presentNumber(item.humidity,0,100);
  const rainMm1h=presentNumber(item.rain?.['1h'],0,500);
  const result=Object.freeze({
    contract:RJ_OPENWEATHER_ONECALL4_CONTRACT,
    status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
    sourceId:RJ_OPENWEATHER_SOURCE_ID,
    provider:'OpenWeather',
    sourceCredit:'Weather data: OpenWeather (One Call API 4.0)',
    documentationUrl:'https://openweathermap.org/api/one-call-4',
    ibge:String(target.ibge),
    latitude:payload.lat,longitude:payload.lon,
    validAt:new Date(validMs).toISOString(),
    retrievedAt:new Date(now).toISOString(),
    type:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT',
    values:Object.freeze({
      temperatureC:item.temp,
      providerFeelsLikeC:presentNumber(item.feels_like,-80,80),
      relativeHumidityPct:humidity,
      windKmh:windMs===null?null:Math.round(windMs*360)/100,
      gustKmh:gustMs===null?null:Math.round(gustMs*360)/100,
      pressureHpa:presentNumber(item.pressure,800,1150),
      rainMm1h,
      // "rain" missing is UNKNOWN, not 0 mm.
      missingPrecipitationIsZero:false,
    }),
    officialObservation:false,officialAlert:false,radarFrame:false,
    automaticAlertAuthorized:false,attributionRequired:true,
    originalMapPreserved:true,
  });
  return result;
}
/**
 * Both injected services must be server-side shared across all replicas:
 * - cache.get(key), cache.set(key, value, ttlMs)
 * - budget.tryReserve({provider,utcDay,maximum}) returns true ONLY if a
 *   durable atomic counter increment succeeds and stays <= maximum.
 * Without either service the connector fails CLOSED, never calling provider.
 */
export function createRjOpenWeatherOneCall4Connector({
  enabled=false,subscriptionApproved=false,apiKey=null,
  cache=null,budget=null,fetchImpl=globalThis.fetch
}={}){
  const configured=enabled===true&&subscriptionApproved===true&&
    typeof apiKey==='string'&&/^[a-f0-9]{32}$/i.test(apiKey)&&
    cache&&typeof cache.get==='function'&&typeof cache.set==='function'&&
    budget&&typeof budget.tryReserve==='function'&&
    typeof fetchImpl==='function';
  async function getCurrent({target=null,now=Date.now()}={}){
    if(!configured)return missing('CONFIGURATION_OR_SHARED_QUOTA_NOT_APPROVED');
    if(!Number.isSafeInteger(now)||now<0||!verifiedTarget(target))
      return missing('UNVERIFIED_RJ_MUNICIPAL_TARGET');
    const key=`openweather:v4:current:${String(target.ibge)}:${target.latitude.toFixed(4)}:${target.longitude.toFixed(4)}`;
    let cached;
    try{cached=await cache.get(key);}
    catch{return missing('SHARED_CACHE_UNAVAILABLE');}
    if(cached?.status==='AVAILABLE_PROVIDER_CURRENT_ESTIMATE'&&
       cached.ibge===String(target.ibge)&&
       cached.latitude===target.latitude&&cached.longitude===target.longitude&&
       Number.isFinite(Date.parse(cached.retrievedAt))&&
       now-Date.parse(cached.retrievedAt)>=0&&
       now-Date.parse(cached.retrievedAt)<RJ_OPENWEATHER_CACHE_MS)
      return cached;
    const utcDay=new Date(now).toISOString().slice(0,10);
    let reserved=false;
    try{
      reserved=await budget.tryReserve({
        provider:RJ_OPENWEATHER_SOURCE_ID,utcDay,
        maximum:RJ_OPENWEATHER_DAILY_INTERNAL_MAX
      })===true;
    }catch{return missing('ATOMIC_QUOTA_UNAVAILABLE');}
    if(!reserved)return missing('DAILY_PROVIDER_BUDGET_EXHAUSTED');
    const url=new URL('https://api.openweathermap.org/data/4.0/onecall/current');
    url.searchParams.set('lat',String(target.latitude));
    url.searchParams.set('lon',String(target.longitude));
    url.searchParams.set('units','metric');
    url.searchParams.set('lang','pt_br');
    url.searchParams.set('appid',apiKey);
    let response;
    try{
      const payload=await fetchJsonContract(url.toString(),{
        allowedHosts:[RJ_OPENWEATHER_HOST],
        fetchImpl,timeoutMs:5_000,maxBytes:128*1024
      });
      response=normalize(payload,target,now);
    }catch{
      // Never return provider exception, URL, query, credentials or body.
      return missing('OPENWEATHER_PROVIDER_FETCH_FAILED');
    }
    if(response.status!=='AVAILABLE_PROVIDER_CURRENT_ESTIMATE')return response;
    try{await cache.set(key,response,RJ_OPENWEATHER_CACHE_MS);}
    catch{return missing('SHARED_CACHE_WRITE_FAILED');}
    return response;
  }
  return Object.freeze({
    configured:Boolean(configured),getCurrent,
    sourceId:RJ_OPENWEATHER_SOURCE_ID,
    automaticIngestion:false,dailyBudget:RJ_OPENWEATHER_DAILY_INTERNAL_MAX
  });
}
