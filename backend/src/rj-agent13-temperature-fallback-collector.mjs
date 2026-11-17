/**
 * Optional server-only Agent 13 temperature/feels-like contingency collector.
 * No HTTP route, timer, background poll, or production activation.
 *
 * Priority sources must be independently verified by the backend: client
 * claims cannot satisfy the three-source audit. Only two city reference
 * locations have been calibrated so far; never derive GPS from an IBGE code.
 */
import {
  decideRjAgent13TemperatureFallback,
  RJ_AGENT13_TEMPERATURE_FALLBACK_INTERVAL_MS
} from './rj-agent13-temperature-fallback-policy.mjs';
import {
  RJ_OPENWEATHER_SOURCE_ID,
  RJ_OPENWEATHER_DAILY_INTERNAL_MAX,
  RJ_OPENWEATHER_HOST
} from './rj-openweather-onecall4.mjs';
import {fetchJsonContract} from './source-contract.mjs';

const GEO=new Map([
  ['3304557',Object.freeze({lat:-22.9068,lon:-43.1729})],
  ['3303302',Object.freeze({lat:-22.8833,lon:-43.1036})]
]);
const maxAge=RJ_AGENT13_TEMPERATURE_FALLBACK_INTERVAL_MS;
const invalid=reason=>Object.freeze({
  status:'BLOCKED',reason,fields:Object.freeze({temperatureC:null,feelsLikeC:null}),
  officialObservation:false,officialAlert:false
});
const bounded=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi?v:null;
const timestampValid=(t,now)=>Number.isSafeInteger(t)&&t>=0&&
  t<=now&&now-t<=maxAge;

function temperatureOnly(payload,ibge,point,at){
  if(!payload||typeof payload!=='object'||
     !Number.isFinite(payload.lat)||!Number.isFinite(payload.lon)||
     Math.abs(payload.lat-point.lat)>.1||
     Math.abs(payload.lon-point.lon)>.1||
     !Array.isArray(payload.data)||payload.data.length!==1)
    return null;
  const item=payload.data[0];
  const dt=item?.dt;
  if(!Number.isSafeInteger(dt)||dt<0||
     !timestampValid(dt*1000,at))return null;
  const temp=bounded(item?.temp,-60,65);
  const feels=bounded(item?.feels_like,-80,80);
  if(temp===null&&feels===null)return null;
  return Object.freeze({
    status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
    sourceId:RJ_OPENWEATHER_SOURCE_ID,ibge,
    type:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT',
    officialObservation:false,officialAlert:false,
    validAt:new Date(dt*1000).toISOString(),
    retrievedAt:new Date(at).toISOString(),
    values:Object.freeze({temperatureC:temp,providerFeelsLikeC:feels})
  });
}

export function createRjAgent13TemperatureContingencyCollector({
  enabled=false,subscriptionApproved=false,readSecret=null,
  store=null,fetchImpl=globalThis.fetch,clock=()=>Date.now()
}={}){
  const configured=enabled===true&&subscriptionApproved===true&&
    typeof readSecret==='function'&&
    store?.temperatureCache&&
    typeof store.temperatureCache.get==='function'&&
    typeof store.temperatureCache.set==='function'&&
    typeof store.budget?.tryReserveMunicipalFallback==='function'&&
    typeof fetchImpl==='function'&&typeof clock==='function';

  async function collect({municipalityIbge,prioritySources}={}){
    if(!configured)return invalid('CONTINGENCY_NOT_ENABLED');
    const started=clock();
    if(!Number.isSafeInteger(started)||started<0)
      return invalid('INVALID_CLOCK');
    const first=decideRjAgent13TemperatureFallback({
      municipalityIbge,prioritySources,now:started
    });
    if(first.status!=='FALLBACK_ELIGIBLE')return first;
    const ibge=first.ibge;
    const point=GEO.get(ibge);
    if(!point)return invalid('MUNICIPAL_COORDINATES_NOT_VERIFIED');

    let cached=null;
    try{cached=await store.temperatureCache.get(ibge);}
    catch{return invalid('SHARED_TEMPERATURE_CACHE_UNAVAILABLE');}
    if(cached){
      const hit=decideRjAgent13TemperatureFallback({
        municipalityIbge:ibge,prioritySources,providerEstimate:cached,now:clock()
      });
      if(hit.status==='FALLBACK_ESTIMATE')
        return Object.freeze({...hit,cacheHit:true,providerRequestMade:false});
    }

    // A single shared quota+municipal cooldown transaction is mandatory;
    // this is not a retry loop and never falls back to process-local quota.
    const beforeReserve=clock();
    const again=decideRjAgent13TemperatureFallback({
      municipalityIbge:ibge,prioritySources,now:beforeReserve
    });
    if(again.status!=='FALLBACK_ELIGIBLE')return invalid('PRIMARY_AUDIT_NO_LONGER_CURRENT');
    let apiKey;
    try{apiKey=await readSecret('BLAISE_OPENWEATHER_API_KEY');}
    catch{return invalid('SECRET_MANAGER_UNAVAILABLE');}
    if(typeof apiKey!=='string'||!/^[a-f0-9]{32}$/i.test(apiKey))
      return invalid('API_KEY_NOT_CONFIGURED');
    const reserveAt=clock();
    const finalAudit=decideRjAgent13TemperatureFallback({
      municipalityIbge:ibge,prioritySources,now:reserveAt
    });
    if(finalAudit.status!=='FALLBACK_ELIGIBLE')
      return invalid('PRIMARY_AUDIT_NO_LONGER_CURRENT');
    let reserved=false;
    try{
      reserved=await store.budget.tryReserveMunicipalFallback({
        provider:RJ_OPENWEATHER_SOURCE_ID,
        utcDay:new Date(reserveAt).toISOString().slice(0,10),
        maximum:RJ_OPENWEATHER_DAILY_INTERNAL_MAX,
        ibge,nowMs:reserveAt
      })===true;
    }catch{return invalid('ATOMIC_MUNICIPAL_QUOTA_UNAVAILABLE');}
    if(!reserved){
      // A competing replica may just have fetched the same city.
      // One cache read is allowed, never another billable fetch.
      try{
        const latest=await store.temperatureCache.get(ibge);
        if(latest){
          const hit=decideRjAgent13TemperatureFallback({
            municipalityIbge:ibge,prioritySources,providerEstimate:latest,now:clock()
          });
          if(hit.status==='FALLBACK_ESTIMATE')
            return Object.freeze({...hit,cacheHit:true,providerRequestMade:false});
        }
      }catch{return invalid('SHARED_TEMPERATURE_CACHE_UNAVAILABLE');}
      return invalid('MUNICIPAL_COOLDOWN_OR_DAILY_QUOTA');
    }
    // A reservation is counted even when the network fails; it is intentionally
    // NOT refunded, so an interrupted request cannot cause a billing loop.
    const url=new URL('https://api.openweathermap.org/data/4.0/onecall/current');
    url.searchParams.set('lat',String(point.lat));
    url.searchParams.set('lon',String(point.lon));
    url.searchParams.set('units','metric');
    url.searchParams.set('lang','pt_br');
    url.searchParams.set('appid',apiKey);
    let candidate;
    try{
      const payload=await fetchJsonContract(url.toString(),{
        allowedHosts:[RJ_OPENWEATHER_HOST],
        fetchImpl,timeoutMs:5_000,maxBytes:128*1024
      });
      let receivedAt=clock();
      if(!Number.isSafeInteger(receivedAt)||receivedAt<reserveAt)
        return invalid('CLOCK_NOT_MONOTONIC');
      const providerMs=Number.isSafeInteger(payload?.data?.[0]?.dt)
        ?payload.data[0].dt*1000:NaN;
      const slightlyFuture=providerMs-receivedAt;
      if(slightlyFuture>0&&slightlyFuture<=3_000){
        await new Promise(resolve=>setTimeout(resolve,slightlyFuture+25));
        receivedAt=clock();
      }
      candidate=temperatureOnly(payload,ibge,point,receivedAt);
    }catch{
      return invalid('OPENWEATHER_FETCH_FAILED');
    }
    if(!candidate)return invalid('PROVIDER_TEMPERATURE_STALE_INVALID_OR_FUTURE');
    try{await store.temperatureCache.set(ibge,candidate);}
    catch{return invalid('SHARED_TEMPERATURE_CACHE_WRITE_FAILED');}
    const result=decideRjAgent13TemperatureFallback({
      municipalityIbge:ibge,prioritySources,
      providerEstimate:candidate,now:clock()
    });
    if(result.status!=='FALLBACK_ESTIMATE')return result;
    return Object.freeze({...result,cacheHit:false,providerRequestMade:true});
  }
  return Object.freeze({
    configured:Boolean(configured),collect,
    supportedMunicipalities:Object.freeze([...GEO.keys()]),
    automaticSchedulingEnabled:false,
    productionEnabled:false
  });
}
