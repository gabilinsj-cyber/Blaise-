/**
 * Optional MET Norway / Yr Locationforecast 2.0 transport for RJ.
 *
 * For Brazil, global forecast fields originate from ECMWF/IFS and the
 * clear-sky UV field originates from Copernicus CAMS. These are not two
 * independent thermometers and never station observations or official alerts.
 *
 * Fail closed: operator must personally read/accept the 2026-11-05 TOS,
 * identify the app with a real contact in User-Agent, and inject an atomic
 * shared 3-hour per-location reservation plus shared response cache.
 * No production wiring, background job, public route, client API or GPS.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

export const MET_NORWAY_LOCATIONFORECAST_URL='https://api.met.no/weatherapi/locationforecast/2.0/complete';
export const MET_NORWAY_MIN_CACHE_MS=3*60*60_000;
export const MET_NORWAY_API_SOURCE='MET_NORWAY_LOCATIONFORECAST_2';
export const MET_NORWAY_WEATHER_ORIGIN='ECMWF_IFS';
export const MET_NORWAY_UV_ORIGIN='COPERNICUS_CAMS_UV_VIA_MET_NO';
const IBGES=new Set(RJ_MUNICIPALITIES.map(x=>x.ibge));
const maxBytes=512*1024;
const fail=(reason)=>Object.freeze({
  status:'UNAVAILABLE',reason,forecast:null,automaticAlertsAuthorized:false
});
const between=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
const milliseconds=(time)=>typeof time==='string'?Date.parse(time):NaN;
const urlFor=(point)=>{
  const url=new URL(MET_NORWAY_LOCATIONFORECAST_URL);
  url.searchParams.set('lat',point.lat.toFixed(4));
  url.searchParams.set('lon',point.lon.toFixed(4));
  if(Number.isInteger(point.altitudeM))url.searchParams.set('altitude',String(point.altitudeM));
  return url.toString();
};
function verifiedPoint(ibge,point){
  return IBGES.has(String(ibge))&&point?.verifiedByBackend===true&&
    between(point.lat,-23.5,-20.7)!==null&&between(point.lon,-45,-40.6)!==null&&
    (point.altitudeM===undefined||Number.isInteger(point.altitudeM)&&
      point.altitudeM>=-20&&point.altitudeM<=2500);
}
const convert=(v)=>v===null?null:Math.round(v*360)/100;
const number=(record,key,min,max)=>between(record?.[key],min,max);
const fromDetails=(details)=>{
  const values={
    temperatureC:number(details,'air_temperature',-60,65),
    feelsLikeC:number(details,'apparent_air_temperature',-80,80),
    humidityPct:number(details,'relative_humidity',0,100),
    pressureHpa:number(details,'air_pressure_at_sea_level',800,1150),
    dewPointC:number(details,'dew_point_temperature',-90,65),
    cloudPct:number(details,'cloud_area_fraction',0,100),
    windKmh:convert(number(details,'wind_speed',0,110)),
    gustKmh:convert(number(details,'wind_speed_of_gust',0,140)),
    windDirectionDeg:number(details,'wind_from_direction',0,360),
    uvClearSkyIndex:number(details,'ultraviolet_index_clear_sky',0,25)
  };
  return Object.freeze(values);
};

/** Select a timestamped forecast slot, never recast it as a measured value. */
export function normalizeMetNorwayRjForecast(payload,{municipalityIbge,point,checkedAtMs}={}){
  if(!verifiedPoint(municipalityIbge,point)||!Number.isSafeInteger(checkedAtMs)||checkedAtMs<0)
    return fail('UNVERIFIED_MUNICIPALITY_OR_CLOCK');
  const coords=payload?.geometry?.coordinates;
  if(payload?.type!=='Feature'||!Array.isArray(coords)||coords.length<2||
     between(coords[0],-180,180)===null||between(coords[1],-90,90)===null||
     Math.abs(coords[0]-point.lon)>0.02||Math.abs(coords[1]-point.lat)>0.02)
    return fail('MODEL_COORDINATES_UNVERIFIED');
  const updated=milliseconds(payload?.properties?.meta?.updated_at);
  if(!Number.isFinite(updated)||updated>checkedAtMs||
     checkedAtMs-updated>12*60*60_000)return fail('MODEL_ISSUE_STALE_OR_INVALID');
  const series=payload?.properties?.timeseries;
  if(!Array.isArray(series)||series.length===0||series.length>512)
    return fail('MODEL_TIMESERIES_INVALID');
  // Use a past/at-now model forecast slot within the recent hour; at times
  // the next slot may be slightly in the future, which is never labelled now.
  const chosen=series.map(row=>({row,valid:milliseconds(row?.time)}))
    .filter(x=>Number.isFinite(x.valid)&&x.valid<=checkedAtMs&&
      checkedAtMs-x.valid<=90*60_000)
    .sort((a,b)=>b.valid-a.valid)[0];
  if(!chosen)return fail('MODEL_NO_NEAR_CURRENT_FORECAST_SLOT');
  const details=chosen.row?.data?.instant?.details;
  if(!details||typeof details!=='object'||Array.isArray(details))
    return fail('MODEL_INSTANT_DETAILS_MISSING');
  const values=fromDetails(details);
  const nextHour=chosen.row?.data?.next_1_hours?.details;
  const hourly=Object.freeze({
    precipitationNextHourMm:number(nextHour,'precipitation_amount',0,500),
    precipitationProbabilityNextHourPct:number(nextHour,'probability_of_precipitation',0,100)
  });
  if(Object.values(values).every(v=>v===null)&&
     Object.values(hourly).every(v=>v===null))
    return fail('MODEL_FIELDS_UNAVAILABLE');
  const updatedAt=new Date(updated).toISOString();
  return Object.freeze({
    status:'FORECAST_AVAILABLE',ibge:String(municipalityIbge),
    source:MET_NORWAY_API_SOURCE,transport:'MET Norway/Yr Locationforecast 2.0',
    originWeather:MET_NORWAY_WEATHER_ORIGIN,
    originUv:MET_NORWAY_UV_ORIGIN,
    uvIsClearSky:true,uvIsMeasured:false,
    uvIsActualCloudAdjusted:false,
    independentFromEcmwfDirect:false,
    nature:'PREVISAO_DE_MODELO_NAO_OBSERVACAO',
    issuedAt:updatedAt,validAt:new Date(chosen.valid).toISOString(),
    checkedAt:new Date(checkedAtMs).toISOString(),
    values,hourly,
    credit:'Dados: MET Norway / ECMWF; UV de céu limpo: Copernicus CAMS via MET Norway',
    license:'CC BY 4.0',
    licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl:MET_NORWAY_LOCATIONFORECAST_URL,
    modifiedForBlaise:true,
    officialObservation:false,officialAlert:false,
    automaticAlertsAuthorized:false,
    notRealTimeObservation:true
  });
}
function slimPayload(body,nowMs){
  const series=body?.properties?.timeseries;
  if(!Array.isArray(series))return null;
  return {
    type:body.type,geometry:{coordinates:body.geometry?.coordinates},
    properties:{
      meta:{updated_at:body.properties?.meta?.updated_at},
      // Keep forecast slots covering 3h cache plus a bounded look-ahead.
      timeseries:series.filter(row=>{
        const stamp=milliseconds(row?.time);
        return Number.isFinite(stamp)&&stamp>=nowMs-2*60*60_000&&
          stamp<=nowMs+10*60*60_000;
      }).slice(0,48)
    }
  };
}
function validUa(value){
  return typeof value==='string'&&value.length>=25&&value.length<=240&&
    /^BlaiseV6RJ\/[0-9]+(?:\.[0-9]+){1,2} /.test(value)&&
    /(https:\/\/[A-Za-z0-9./_-]+|[^\s@]+@[^\s@]+\.[^\s@]+)/.test(value)&&
    !/[\r\n]/.test(value);
}
async function boundedJson(response){
  const sizeHeader=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(sizeHeader)&&sizeHeader>maxBytes)throw Error('too_large');
  const chunks=[];let n=0;
  if(!response.body)throw Error('empty');
  for await(const chunk of response.body){
    const part=Buffer.from(chunk);
    n+=part.length;
    if(n>maxBytes)throw Error('too_large');
    chunks.push(part);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/**
 * No implicit network calls. Shared store contract:
 * store.get(ibge) -> {payload,lastModified,nextAllowedAtMs}|null
 * store.reserve(ibge,nowMs,minIntervalMs) -> atomic boolean
 * store.set(ibge,record) -> promise; reject on persistence failure.
 */
export function createRjMetNorwayLocationforecastCollector({
  enabled=false,termsAcceptedByHuman=false,userAgent='',
  store=null,fetchImpl=globalThis.fetch,clock=()=>Date.now()
}={}){
  const configured=enabled===true&&termsAcceptedByHuman===true&&
    validUa(userAgent)&&typeof store?.get==='function'&&
    typeof store?.reserve==='function'&&typeof store?.set==='function'&&
    typeof fetchImpl==='function'&&typeof clock==='function';
  async function collect({municipalityIbge,point}={}){
    if(!configured)return fail('HUMAN_TOS_APPROVAL_OR_SHARED_BACKEND_NOT_READY');
    if(!verifiedPoint(municipalityIbge,point))return fail('CITY_COORDINATES_NOT_VERIFIED');
    const ibge=String(municipalityIbge);
    const now=clock();
    if(!Number.isSafeInteger(now)||now<0)return fail('INVALID_CLOCK');
    let existing;
    try{existing=await store.get(ibge);}catch{return fail('SHARED_CACHE_UNAVAILABLE');}
    if(existing&&Number.isSafeInteger(existing.nextAllowedAtMs)&&
      now<existing.nextAllowedAtMs){
      // Cached body is model forecast and can be reprojected for current time.
      const cached=normalizeMetNorwayRjForecast(existing.payload,{
        municipalityIbge:ibge,point,checkedAtMs:now
      });
      return cached.status==='FORECAST_AVAILABLE'
        ?Object.freeze({...cached,cacheHit:true,providerRequestMade:false})
        :cached;
    }
    let reserved;
    try{reserved=await store.reserve(ibge,now,MET_NORWAY_MIN_CACHE_MS);}
    catch{return fail('ATOMIC_THREE_HOUR_COOLDOWN_UNAVAILABLE');}
    if(reserved!==true)return fail('THREE_HOUR_COOLDOWN_ACTIVE');
    const headers={
      'User-Agent':userAgent,'Accept':'application/json',
      'Accept-Encoding':'gzip, deflate'
    };
    // Do not permit conditional GET until the complete minimum interval elapsed.
    if(typeof existing?.lastModified==='string'&&
       Number.isFinite(milliseconds(existing.lastModified)))
      headers['If-Modified-Since']=existing.lastModified;
    let response,receivedAt=now,payload,lastModified=existing?.lastModified??null;
    try{
      response=await fetchImpl(urlFor(point),{
        method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(10_000)
      });
      receivedAt=clock();
      if(!Number.isSafeInteger(receivedAt)||receivedAt<now)
        return fail('NON_MONOTONIC_CLOCK');
      if(response.status!==200&&response.status!==304)
        return fail('MET_NORWAY_UNAVAILABLE_OR_RATE_LIMITED');
      if(response.status===304){
        if(!existing?.payload)return fail('NOT_MODIFIED_WITHOUT_CACHE');
        payload=existing.payload;
      }else{
        payload=slimPayload(await boundedJson(response),receivedAt);
      }
      const m=response.headers?.get?.('last-modified');
      if(m&&Number.isFinite(milliseconds(m)))lastModified=m;
    }catch{return fail('MET_NORWAY_FETCH_OR_PARSE_FAILED');}
    const forecast=normalizeMetNorwayRjForecast(payload,{
      municipalityIbge:ibge,point,checkedAtMs:receivedAt
    });
    if(forecast.status!=='FORECAST_AVAILABLE')return forecast;
    // Respect BOTH 3h minimum and Expires response header (if later).
    const expires=milliseconds(response.headers?.get?.('expires'));
    const nextAllowedAtMs=Math.max(receivedAt+MET_NORWAY_MIN_CACHE_MS,
      Number.isFinite(expires)?expires:0);
    try{
      await store.set(ibge,{payload,lastModified,nextAllowedAtMs});
    }catch{return fail('SHARED_CACHE_WRITE_FAILED');}
    return Object.freeze({...forecast,cacheHit:false,providerRequestMade:true,
      nextAllowedAt:new Date(nextAllowedAtMs).toISOString()});
  }
  return Object.freeze({
    configured:Boolean(configured),collect,automaticPolling:false,
    publishedToAndroid:false,productionEnabled:false,
    minimumCacheMs:MET_NORWAY_MIN_CACHE_MS,
    weatherSource:MET_NORWAY_WEATHER_ORIGIN,uvSource:MET_NORWAY_UV_ORIGIN
  });
}
