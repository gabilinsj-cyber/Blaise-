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
 source('VISUAL_CROSSING_FREE','Visual Crossing Free','E','Consulta REAL privada em 19/11/2026: 7/10 campos E e 36 horários P, custo declarado 1 registro; prova pontual sem cache atual, sem estação homologada nem publicação','PRIVATE_ONE_SHOT_AUDITED_NO_CURRENT_CACHE'),
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


const unavailableNoaaWave=Object.freeze({
 sourceId:'NOAA_GFS_WAVE',kind:'P',status:'INDISPONIVEL',
 waveHeightM:null,issuedAt:null,validAt:null,checkedAt:null,
 physicalObservation:false,publishedToSubscriber:false
});
export function evaluatePrivateNoaaWaveReading(reading,{now=Date.now()}={}){
 const x=reading?.snapshot;
 const issued=Date.parse(x?.issuedAt),valid=Date.parse(x?.validAt),
   checked=Date.parse(x?.checkedAt),expires=Date.parse(x?.expiresAt);
 const url=typeof x?.sourceUrl==='string'?x.sourceUrl:'';
 if(!Number.isSafeInteger(now)||reading?.state!=='CURRENT'||!x||
   x.nature!=='MODELO'||x.units!=='m'||
   !url.startsWith('https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl?')||
   typeof x.waveHeightM!=='number'||!Number.isFinite(x.waveHeightM)||
   x.waveHeightM<0||x.waveHeightM>35||
   ![issued,valid,checked,expires].every(Number.isFinite)||
   issued>valid||valid>checked||checked>now||valid>now||
   now-valid>=60*60_000||now-checked>12*60_000||expires<=now||
   typeof x.latitude!=='number'||typeof x.longitude!=='number'||
   x.latitude < -25||x.latitude > -21||x.longitude < -45||x.longitude > -40)
  return unavailableNoaaWave;
 return Object.freeze({
  sourceId:'NOAA_GFS_WAVE',kind:'P',status:'PRIVATE_CACHE_VALID',
  waveHeightM:x.waveHeightM,unit:'m',issuedAt:x.issuedAt,validAt:x.validAt,
  checkedAt:x.checkedAt,physicalObservation:false,
  publishedToSubscriber:false
 });
}
export function evaluatePrivateMetNorwayReading(forecast,{now=Date.now()}={}){
 const invalid=Object.freeze({sourceId:'ECMWF_IFS',kind:'P',
   status:'INDISPONIVEL',issuedAt:null,validAt:null,
   officialObservation:false,publishedToSubscriber:false});
 const issued=Date.parse(forecast?.issuedAt),valid=Date.parse(forecast?.validAt),
   checked=Date.parse(forecast?.checkedAt);
 if(forecast?.status!=='FORECAST_AVAILABLE'||
    forecast.ibge!=='3304557'||forecast.source!=='MET_NORWAY_LOCATIONFORECAST_2'||
    forecast.originWeather!=='ECMWF_IFS'||forecast.license!=='CC BY 4.0'||
    forecast.officialObservation!==false||forecast.officialAlert!==false||
    ![issued,valid,checked].every(Number.isFinite)||issued>valid||
    valid>now||now-valid>90*60_000||
    checked>now||now-checked>120_000||
    issued>now||now-issued>12*60*60_000)
  return invalid;
 return Object.freeze({sourceId:'ECMWF_IFS',kind:'P',
   status:'PRIVATE_CACHE_VALID',issuedAt:forecast.issuedAt,
   validAt:forecast.validAt,officialObservation:false,
   publishedToSubscriber:false});
}
export function createRjMeteorologicalMemoryReader({
 getCached=null,readLocalBudgetStatus=null,readNoaaWave=null,
 readMetNorway=null,readVisualCrossing=null,clock=()=>Date.now()
}={}){
 return async({ibge='3304557'}={})=>{
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
  let noaaWave=unavailableNoaaWave;
  if(typeof readNoaaWave==='function'){
   try{noaaWave=evaluatePrivateNoaaWaveReading(await readNoaaWave(),{now});}
   catch{noaaWave=unavailableNoaaWave;}
  }
  let met=Object.freeze({sourceId:'ECMWF_IFS',kind:'P',status:'INDISPONIVEL',
   issuedAt:null,validAt:null,officialObservation:false,publishedToSubscriber:false});
  if(typeof readMetNorway==='function'){
   try{met=evaluatePrivateMetNorwayReading(await readMetNorway('3304557'),{now});}
   catch{}
  }
  let visualCrossing=Object.freeze({
    sourceId:'VISUAL_CROSSING_FREE',ibge:String(ibge),
    status:'INDISPONIVEL',reason:'PRIVATE_CACHE_NOT_PRESENT',
    kindCurrent:'E',kindForecast:'P',fields:[],forecast:[],
    publishedToSubscribers:false,providerBalanceVerified:false
  });
  if(typeof readVisualCrossing==='function'){
   try{
    const result=await readVisualCrossing(String(ibge));
    if(result?.sourceId==='VISUAL_CROSSING_FREE' &&
       result.ibge===String(ibge) &&
       result.publishedToSubscribers===false &&
       ['INDISPONIVEL','PRIVATE_CACHE_VALID'].includes(result.status))
     visualCrossing=result;
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
   privateNoaaWave:noaaWave,
   privateMetNorway:met,
   privateVisualCrossing:visualCrossing,
   selectedIbge:String(ibge),
   quotaLedger:ledger,
   sources:Object.freeze([
    source(MB,'meteoblue Free • mLM basic-6h','P',
      'Sete campos de previsão sem medições atuais/rajadas/temperatura',
      mb.status, {validAt:mb.forecastValidAt??null}),
    ...registered.map(item=>item.id==='VISUAL_CROSSING_FREE'
      ?source(item.id,item.label,item.kind,item.role,
        visualCrossing.status==='PRIVATE_CACHE_VALID'?'PRIVATE_CACHE_VALID':
          'PRIVATE_ONE_SHOT_AUDITED_NO_CURRENT_CACHE',
        {validAt:visualCrossing.validAt??null,
         selectedMunicipality:String(ibge)})
      :item.id==='NOAA_GFS_WAVE'
      ?source(item.id,item.label,item.kind,item.role,noaaWave.status,
       {validAt:noaaWave.validAt})
      :item.id==='ECMWF_IFS'
      ?source(item.id,item.label,item.kind,item.role,met.status,
       {validAt:met.validAt})
      :item)
   ])
  });
 };
}
