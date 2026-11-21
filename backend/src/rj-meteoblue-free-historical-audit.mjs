/**
 * Historical forensic inspection of one PRIVATE cached meteoblue forecast.
 * Never returns a current-weather reading, scientific homologation or alerts.
 * Pure function: no network, secrets, database writes, or credit operations.
 */
import {METEOBLUE_BASIC6H_FIELDS} from './rj-meteoblue-basic6h-parse.mjs';

const sixHours=6*60*60_000;
const fieldDefinitions=Object.values(METEOBLUE_BASIC6H_FIELDS);
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
const round3=(n)=>Math.round(n*1000)/1000;
const impossible=(reason)=>Object.freeze({
 status:'HISTORICAL_RECORD_INVALID',reason,readOnly:true,
 providerContacted:false,creditsReserved:0,publishedToSubscribers:false
});

export function inspectHistoricalMeteoblueCacheRecord(record,{nowMs=Date.now()}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<0)return impossible('INVALID_AUDIT_CLOCK');
 if(!record)return Object.freeze({
   status:'NO_HISTORICAL_CACHE_DOCUMENT',readOnly:true,
   providerContacted:false,creditsReserved:0,
   publishedToSubscribers:false,shouldRetryProvider:false
 });
 const f=record.forecast,storedAt=record.storedAtMs;
 if(record.sourceId!=='METEOBLUE_FREE_FORECAST'||
    record.ibge!=='3304557'||!Number.isSafeInteger(storedAt)||
    storedAt>nowMs||storedAt<Date.parse('2026-11-18T00:00:00Z')||
    f?.ibge!=='3304557'||f?.sourceId!=='METEOBLUE_FREE_FORECAST'||
    f?.status!=='FORECAST_PARSED_PRIVATE_STAGING'||f?.category!=='P'||
    f?.publishedToAndroid!==false||f?.publishedToSubscribers!==false||
    f?.observational!==false||f?.scientificallyHomologated!==false||
    f?.forecastOnly!==true)
   return impossible('PROVENANCE_OR_PUBLICATION_FLAGS_INVALID');

 const times=f.validTimes,values=f.values;
 if(!Array.isArray(times)||times.length<1||times.length>80||
    !Array.isArray(values)||values.length!==fieldDefinitions.length)
   return impossible('SEVEN_FIELD_TIMELINE_MISSING');
 const ms=times.map(t=>typeof t==='string'&&
   /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t)
     ?Date.parse(t):NaN);
 if(ms.some((v,i)=>!Number.isFinite(v)||
   new Date(v).toISOString()!==times[i]||
   (i>0&&v-ms[i-1]!==sixHours)))
   return impossible('HISTORICAL_TIMELINE_INVALID');

 const map=new Map();
 for(const x of values){
   if(!x||typeof x.field!=='string'||map.has(x.field)||
      !Array.isArray(x.values)||x.values.length!==times.length)
     return impossible('FIELD_DUPLICATE_OR_LENGTH_INVALID');
   map.set(x.field,x);
 }
 const fields=[];
 for(const field of fieldDefinitions){
   const x=map.get(field.name);
   if(!x||x.unit!==field.unit||x.semantics!==field.meaning)
     return impossible('FIELD_IDENTITY_OR_UNIT_INVALID');
   if(x.values.some(v=>v!==null&&
      (!finite(v)||v<field.min||v>field.max)))
     return impossible('FORECAST_NUMERIC_RANGE_INVALID');
   const nums=x.values.filter(finite).sort((a,b)=>a-b);
   const n=nums.length;
   const middle=Math.floor(n/2);
   fields.push(Object.freeze({
     field:field.name,unit:field.unit,category:'P',
     count:n,missingCount:x.values.length-n,
     min:n?nums[0]:null,max:n?nums[n-1]:null,
     mean:n?round3(nums.reduce((sum,v)=>sum+v,0)/n):null,
     median:n?round3(n%2?nums[middle]:(nums[middle-1]+nums[middle])/2):null,
     rangeValidated:true
   }));
 }
 const out={
   status:'HISTORICAL_FORECAST_AUDITED_NOT_CURRENT',
   source:'METEOBLUE_FREE_FORECAST',
   historicalOnly:true,neverUseAsCurrent:true,
   readOnly:true,providerContacted:false,creditsReserved:0,
   publishedToSubscribers:false,scientificallyHomologated:false,
   storedAtUtc:new Date(storedAt).toISOString(),
   cacheExpired:nowMs-storedAt>6*60*60_000,
   firstForecastUtc:times[0],
   lastForecastUtc:times[times.length-1],
   sixHourForecastSlots:times.length,
   previouslyValidatedProvenance:{
     modelRun:f.metadataRunVerified===true,
     units:f.unitMetadataVerified===true,
     coordinates:f.sourceCoordinatesVerified===true,
     sevenFields:f.completeFieldCoverage===true,
     privateAuditReady:f.auditReadyForPrivateReview===true
   },
   fields:Object.freeze(fields),
 };
 return Object.freeze(out);
}
