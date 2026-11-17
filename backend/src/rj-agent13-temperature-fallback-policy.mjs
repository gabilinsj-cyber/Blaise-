/**
 * Blaise V6 RJ — Agent 13 temperature-only contingency policy.
 *
 * This pure decision layer does NOT fetch, schedule, merge into a dashboard,
 * or enable the optional provider. The three priority source records MUST be
 * constructed server-side from authenticated/verified source inventories;
 * they must never be accepted directly from an Android request.
 *
 * Source freshness remains <=12 min. The 35-minute exception is ONLY for
 * display of OpenWeather temperature / feels-like model estimates when all
 * three priority readings lack a usable value for that specific field.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

export const RJ_AGENT13_TEMPERATURE_FALLBACK_POLICY='RJ_AGENT13_TEMP_FEELSLIKE_FALLBACK_V1';
export const RJ_AGENT13_TEMPERATURE_FALLBACK_INTERVAL_MS=35*60_000;
export const RJ_AGENT13_TEMPERATURE_FALLBACK_MAX_AGE_MS=35*60_000;
export const RJ_AGENT13_PRIORITY_SOURCE_MAX_AGE_MS=12*60_000;
export const RJ_AGENT13_FALLBACK_FIELDS=Object.freeze(['temperatureC','feelsLikeC']);
const RJ_IBGE=new Set(RJ_MUNICIPALITIES.map(m=>m.ibge));
const SOURCE_STATES=new Set(['CURRENT','UNAVAILABLE','STALE','INVALID']);
// Excluded municipal bodies only provide alert links; excluded international
// sources cannot be silently reintroduced as temperature instruments.
const EXCLUDED_TEMPERATURE_SOURCE_IDS=new Set([
  'ALERTA_RIO','DEFESA_CIVIL_RJ','INEA','MARINHA_DO_BRASIL',
  'WINDY','COPERNICUS'
]);
const validTime=(time,now,ageLimit)=>{
  const ms=Date.parse(time);
  return Number.isFinite(ms)&&ms<=now&&now-ms<=ageLimit;
};
const bounded=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi?v:null;
const unavailable=(reason)=>Object.freeze({
  contract:RJ_AGENT13_TEMPERATURE_FALLBACK_POLICY,
  status:'BLOCKED',reason,
  fields:Object.freeze({temperatureC:null,feelsLikeC:null}),
  source:null,validAt:null,checkedAt:null,
  officialObservation:false,officialAlert:false
});

function checkedPriority(readings,now){
  if(!Array.isArray(readings)||readings.length!==3)return false;
  const ids=new Set();
  for(let rank=1;rank<=3;rank++){
    const r=readings[rank-1];
    if(r?.rank!==rank||typeof r.sourceId!=='string'||
       !/^[A-Z][A-Z0-9_-]{1,63}$/.test(r.sourceId)||ids.has(r.sourceId)||
       EXCLUDED_TEMPERATURE_SOURCE_IDS.has(r.sourceId)||
       r.verifiedByBackend!==true||!SOURCE_STATES.has(r.status)||
       !validTime(r.checkedAt,now,RJ_AGENT13_PRIORITY_SOURCE_MAX_AGE_MS))
      return false;
    ids.add(r.sourceId);
    if(r.status==='CURRENT'&&!validTime(r.validAt,now,RJ_AGENT13_PRIORITY_SOURCE_MAX_AGE_MS))
      return false;
  }
  return true;
}
function hasValidPrimary(readings,field){
  const bounds=field==='temperatureC'?[-60,65]:[-80,80];
  return readings.some(r=>r.status==='CURRENT'&&
    bounded(r.values?.[field],...bounds)!==null);
}

/** Only internally audited priority statuses can authorize a contingency. */
export function decideRjAgent13TemperatureFallback({
  municipalityIbge,prioritySources,providerEstimate=null,now=Date.now()
}={}){
  const ibge=String(municipalityIbge??'');
  if(!RJ_IBGE.has(ibge))return unavailable('UNKNOWN_RJ_MUNICIPALITY');
  if(!Number.isSafeInteger(now)||now<0||!checkedPriority(prioritySources,now))
    return unavailable('PRIMARY_SOURCE_AUDIT_INCOMPLETE');

  const needsTemperature=!hasValidPrimary(prioritySources,'temperatureC');
  const needsFeelsLike=!hasValidPrimary(prioritySources,'feelsLikeC');
  if(!needsTemperature&&!needsFeelsLike)
    return unavailable('PRIORITY_VALUES_PRESENT');

  const eligible=Object.freeze({
    temperatureC:needsTemperature,feelsLikeC:needsFeelsLike
  });
  if(!providerEstimate)return Object.freeze({
    contract:RJ_AGENT13_TEMPERATURE_FALLBACK_POLICY,
    status:'FALLBACK_ELIGIBLE',ibge,eligible,
    minimumCallIntervalSeconds:RJ_AGENT13_TEMPERATURE_FALLBACK_INTERVAL_MS/1000,
    officialObservation:false,officialAlert:false
  });

  const candidate=providerEstimate;
  if(candidate.status!=='AVAILABLE_PROVIDER_CURRENT_ESTIMATE'||
     candidate.sourceId!=='OPENWEATHER_ONECALL4_CURRENT'||
     candidate.ibge!==ibge||
     candidate.type!=='PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT'||
     candidate.officialObservation!==false||candidate.officialAlert!==false||
     !validTime(candidate.validAt,now,RJ_AGENT13_TEMPERATURE_FALLBACK_MAX_AGE_MS)||
     !validTime(candidate.retrievedAt,now,RJ_AGENT13_TEMPERATURE_FALLBACK_MAX_AGE_MS))
    return unavailable('PROVIDER_TEMPERATURE_ESTIMATE_INVALID_OR_EXPIRED');

  const temp=needsTemperature?bounded(candidate.values?.temperatureC,-60,65):null;
  const feels=needsFeelsLike?bounded(candidate.values?.providerFeelsLikeC,-80,80):null;
  if(temp===null&&feels===null)
    return unavailable('PROVIDER_TEMPERATURE_FIELDS_MISSING');

  return Object.freeze({
    contract:RJ_AGENT13_TEMPERATURE_FALLBACK_POLICY,
    status:'FALLBACK_ESTIMATE',ibge,
    nature:'ESTIMATIVA_OPENWEATHER_CONTINGENCIA_NAO_OBSERVACAO',
    source:'OpenWeather One Call 4.0',
    sourceUrl:'https://openweathermap.org/api/one-call-4',
    validAt:candidate.validAt,checkedAt:new Date(now).toISOString(),
    ageSeconds:Math.floor((now-Date.parse(candidate.validAt))/1000),
    maximumAgeSeconds:RJ_AGENT13_TEMPERATURE_FALLBACK_MAX_AGE_MS/1000,
    minimumCallIntervalSeconds:RJ_AGENT13_TEMPERATURE_FALLBACK_INTERVAL_MS/1000,
    fields:Object.freeze({temperatureC:temp,feelsLikeC:feels}),
    officialObservation:false,officialAlert:false,
    otherWeatherFieldsUsed:false,automaticAlertsAuthorized:false
  });
}
