/**
 * Blaise V6 RJ — PRIVATE, read-only meteorological source memory.
 *
 * Reads already cached supplier data and the local ledger ONLY. Does not
 * contact any weather API, start polling, recharge credits or serve users.
 * "Live" describes evaluation of cache freshness at request time, not
 * a continuous observation stream or one-minute model update.
 */
import {METEOBLUE_BASIC6H_FIELDS} from './rj-meteoblue-basic6h-parse.mjs';

const MB='METEOBLUE_FREE_FORECAST';
const source=(id,label,kind,role,state,details={})=>Object.freeze({
 id,label,kind,role,state,clientPublished:false,...details
});
const FIELDS=Object.freeze(Object.entries(METEOBLUE_BASIC6H_FIELDS).map(([key,val])=>
 Object.freeze({jsonKey:key,field:val.name,unit:val.unit,meaning:val.meaning})
));
const registered=Object.freeze([
 source('DWD_ICON_GLOBAL','DWD ICON Global','P','Temperatura prevista a 2 m e comparação meteorológica','UNVERIFIED_CURRENT_CACHE'),
 source('ECMWF_IFS','ECMWF/IFS via fonte licenciada','P','Previsão internacional; não é observação local','UNVERIFIED_CURRENT_CACHE'),
 source('NOAA_GFS','NOAA GFS','P','Atmosfera, vento, chuva prevista e sistemas','UNVERIFIED_CURRENT_CACHE'),
 source('NOAA_GFS_WAVE','NOAA GFS-Wave','P','Ondas e swell previstos','UNVERIFIED_CURRENT_CACHE'),
 source('NOAA_COASTWATCH_SST','NOAA CoastWatch','E','SST estimada por satélite com QA','UNVERIFIED_CURRENT_CACHE'),
 source('NOAA_GLM','NOAA GOES-19 GLM','O','Detecção satelital de raios, com validade','UNVERIFIED_CURRENT_CACHE'),
 source('OPENWEATHER_AGENT13','OpenWeather/Agente 13','E','Contingência térmica condicionada por quota','UNVERIFIED_CURRENT_CACHE'),
 source('HG_BRASIL_WEATHER_PRO','HG Brasil Pro','E','Condições agregadas; plano ainda não contratado','NOT_CONTRACTED'),
 source('ANA_RIVER','ANA/Hidroweb','O','Nível de rios por estação auditada','UNVERIFIED_CURRENT_CACHE'),
 source('SGB_SACE','SGB/SACE','O','Rios e cheias por estação auditada','UNVERIFIED_CURRENT_CACHE')
]);
const noData=reason=>Object.freeze({
 sourceId:MB,kind:'P',status:'INDISPONIVEL',reason,
 privateOnly:true,fields:[],
 forecastValidAt:null,modelRun:null
});
export function evaluatePrivateMeteoblueCache(forecast,{now=Date.now()}={}){
 if(!Number.isSafeInteger(now)||now<0||
   !forecast||forecast.status!=='FORECAST_PARSED_PRIVATE_STAGING'||
   forecast.sourceId!==MB||forecast.ibge!=='3304557'||
   forecast.category!=='P'||forecast.forecastOnly!==true||
   forecast.observational!==false||forecast.publishedToSubscribers!==false||
   forecast.scientificallyHomologated!==false||
   forecast.auditReadyForPrivateReview!==true||
   forecast.metadataRunVerified!==true||
   forecast.unitMetadataVerified!==true||
   forecast.sourceCoordinatesVerified!==true||
   forecast.completeFieldCoverage!==true)
  return noData('UNVERIFIED_OR_UNAVAILABLE');
 const times=forecast.validTimes;
 if(!Array.isArray(times)||times.length<1||times.length>80||
    !times.every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))
  return noData('INVALID_SIX_HOUR_TIMELINE');
 const index=times.findIndex(t=>Date.parse(t)>=now);
 if(index<0||Date.parse(times[index])-now>6*60*60_000)
  return noData('NO_NEAR_TERM_FORECAST_SLOT');
 const values=forecast.values;
 if(!Array.isArray(values)||values.length!==FIELDS.length)
  return noData('SEVEN_FIELDS_INCOMPLETE');
 const matched=new Map(values.map(f=>[f?.field,f]));
 if(matched.size!==FIELDS.length)return noData('DUPLICATE_OR_MISSING_FIELD');
 const records=[];
 for(const def of FIELDS){
  const record=matched.get(def.field);
  const n=record?.values?.[index];
  const standard=METEOBLUE_BASIC6H_FIELDS[def.jsonKey];
  if(record?.unit!==def.unit||record?.semantics!==def.meaning||
     !Array.isArray(record.values)||record.values.length!==times.length||
     typeof n!=='number'||!Number.isFinite(n)||
     n<standard.min||n>standard.max)
    return noData('FIELD_VALUE_NOT_VERIFIED');
  records.push(Object.freeze({field:def.field,unit:def.unit,
    value:n,meaning:def.meaning,kind:'P'}));
 }
 return Object.freeze({
  sourceId:MB,kind:'P',status:'PRIVATE_CACHE_VALID',
  reason:'ONE_REAL_RESPONSE_READY_FOR_PRIVATE_SCIENTIFIC_REVIEW',
  privateOnly:true,ibge:'3304557',intervalHours:6,
  modelRun:forecast.issuedAt??null,
  forecastValidAt:times[index],fields:Object.freeze(records),
  subscriberPublished:false,providerBalanceVerified:false
 });
}

export function createRjMeteorologicalMemoryReader({
 getCached=null,readLocalBudgetStatus=null,clock=()=>Date.now()
}={}){
 return async()=>{
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0)throw Error('invalid_clock');
  let mb=noData('NO_FRESH_PRIVATE_CACHE');
  if(typeof getCached==='function'){
   try{mb=evaluatePrivateMeteoblueCache(await getCached('3304557'),{now});}
   catch{mb=noData('CACHE_READ_UNAVAILABLE');}
  }
  let ledger=null;
  if(typeof readLocalBudgetStatus==='function'){
   try{
    const r=await readLocalBudgetStatus();
    if(r?.sourceOfCounts==='LOCAL_FIRESTORE_RESERVATIONS_ONLY' &&
       Number.isSafeInteger(r.localSpentCredits)&&r.localSpentCredits>=0 &&
       Number.isSafeInteger(r.callsReservedToday)&&r.callsReservedToday>=0)
     ledger=Object.freeze({localSpentCredits:r.localSpentCredits,
       callsReservedToday:r.callsReservedToday,
       maxCallsPerUtcDay:r.maxCallsPerUtcDay,
       providerCreditBalance:'UNVERIFIED_IN_PROVIDER_DASHBOARD'});
   }catch{}
  }
  return Object.freeze({
   contract:'RJ_ADMIN_METEOROLOGICAL_MEMORY_V1',
   scope:'ADMIN_ONLY',
   evaluatedAt:new Date(now).toISOString(),
   pollingWeatherProviders:false,
   clientPublishingEnabled:false,
   currentObservationsClaimed:false,
   privateMeteoblue:mb,
   quotaLedger:ledger,
   sources:Object.freeze([
    source(MB,'meteoblue Free • mLM basic-6h','P',
      'Sete campos de previsão sem medições atuais/rajadas/temperatura',
      mb.status, {validAt:mb.forecastValidAt??null}),
    ...registered
   ])
  });
 };
}
