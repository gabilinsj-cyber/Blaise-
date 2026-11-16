/**
 * A 92-municipality public-presentation projection of independently acquired
 * and authorized international weather. This module NEVER fetches an API and
 * cannot turn a prediction into a station observation. It is intended for the
 * paid entitlement-protected /v1/data/international-weather endpoint.
 *
 * Missing values are explicit nulls. Neither official Brazilian readings nor
 * the OpenWeather API key, raw provider body, user GPS or purchase token may
 * leave this projection. Map markers are only made from verified provider
 * coordinates, never invented/reprojected/interpolated radar.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';
import { RJ_92_REPRESENTATIVE_BY_IBGE } from './rj-municipal-representative-points.mjs';

export const RJ_INTERNATIONAL_92_CONTRACT='BLAISE_RJ_INTERNATIONAL_92_V1';
export const RJ_INTERNATIONAL_92_PATH='/v1/data/international-weather';
const IBGE=new Set(RJ_MUNICIPALITIES.map(row=>row.ibge));
const within=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const finiteOrNull=(n,min,max)=>within(n,min,max)?n:null;
const time=(v)=>typeof v==='string' ? Date.parse(v) : NaN;
const validSource=Object.freeze({
  OPENWEATHER_ONECALL4_CURRENT: Object.freeze({
    type:'MODELED_CURRENT_ESTIMATE', status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
    title:'OpenWeather One Call 4.0',documentation:'https://openweathermap.org/api/one-call-4',
    maxAgeMs:30*60_000,
  }),
});

function normalize(row, nowMs) {
  if(!row||!IBGE.has(String(row.ibge)))return null;
  const source=validSource[row.sourceId];
  if(!source||row.status!==source.status||row.type!=='PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT'||
     row.officialObservation!==false||row.officialAlert!==false||row.radarFrame!==false||
     row.attributionRequired!==true||row.originalMapPreserved!==true)return null;
  const target=RJ_92_REPRESENTATIVE_BY_IBGE.get(String(row.ibge));
  if(!target || Math.abs(row.latitude-target.latitude)>0.005 ||
     Math.abs(row.longitude-target.longitude)>0.005) return null;
  const timestamp=time(row.validAt),receivedAt=time(row.retrievedAt);
  if(!Number.isFinite(timestamp)||!Number.isFinite(receivedAt)||
     timestamp>nowMs+60_000||receivedAt>nowMs+60_000||
     nowMs-timestamp>source.maxAgeMs || nowMs-receivedAt>source.maxAgeMs||
     !within(row.latitude,-23.37,-20.75)||!within(row.longitude,-44.9,-40.9))return null;
  const v=row.values;
  if(!v||!within(v.temperatureC,-60,65))return null;
  const properties=Object.freeze({
    temperatureC:v.temperatureC,
    feelsLikeC:finiteOrNull(v.providerFeelsLikeC,-80,80),
    humidityPct:finiteOrNull(v.relativeHumidityPct,0,100),
    windKmh:finiteOrNull(v.windKmh,0,400),
    gustKmh:finiteOrNull(v.gustKmh,0,500),
    pressureHpa:finiteOrNull(v.pressureHpa,800,1150),
    rainMm1h:finiteOrNull(v.rainMm1h,0,500),
  });
  return Object.freeze({
    type:source.type,sourceId:row.sourceId,sourceName:source.title,
    sourceUrl:source.documentation,validAt:new Date(timestamp).toISOString(),
    latitude:row.latitude,longitude:row.longitude,values:properties,
  });
}

/** Pure projection. Does not create any measurement or request provider usage.
 * All 92 rows exist, but only verified inputs carry current data.
 */
export function buildRjInternational92Snapshot({
  providerRows=[], nowMs=Date.now(), licenseUseConfirmed=false,
}={}) {
  if(!Number.isSafeInteger(nowMs)||nowMs<0||
     !Array.isArray(providerRows)||providerRows.length>92||
     licenseUseConfirmed!==true)return null;
  const byIbge=new Map();
  for(const row of providerRows){
    const normalized=normalize(row,nowMs);
    if(!normalized)continue;
    const key=String(row.ibge);
    const existing=byIbge.get(key);
    if(!existing||time(normalized.validAt)>time(existing.validAt))
      byIbge.set(key,normalized);
  }
  const municipalities=RJ_MUNICIPALITIES.map(city=>Object.freeze({
    ibge:city.ibge,name:city.name,
    status:byIbge.has(city.ibge)?'CURRENT_MODELED_ESTIMATE':'NO_CURRENT_INTERNATIONAL_DATA',
    weather:byIbge.get(city.ibge)||null,
  }));
  return Object.freeze({
    contract:RJ_INTERNATIONAL_92_CONTRACT,
    generatedAt:new Date(nowMs).toISOString(),
    scope:'RJ_92_MUNICIPALITIES',
    totalMunicipalities:92,
    currentMunicipalities:byIbge.size,
    sourceNature:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_OBSERVATION',
    attribution:'Weather data: OpenWeather One Call 4.0, where explicitly shown',
    radarAvailable:false,
    warningsIssuedByThisFeed:false,
    municipalities:Object.freeze(municipalities),
  });
}
