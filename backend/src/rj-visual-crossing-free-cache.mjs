/**
 * Firestore PRIVATE Visual Crossing Free normalized cache.
 *
 * Storage is opt-in server-only and only accepts the already-parsed,
 * provenance-checked output from the one-location Free Timeline API.
 * It never stores an API key, a raw provider JSON, the request URL, a name,
 * a voice recording, user location or subscriber data.
 *
 * Current (E) is not a station reading. Future hourly slots (P) are never
 * converted into observations. Read evaluates time again, even if a Firestore
 * TTL deletion job has not yet removed an old document.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
import {VC_FIELD_SPEC} from './rj-visual-crossing-free-private.mjs';

export const VC_PRIVATE_CACHE_COLLECTION='blaise_rj_visual_crossing_free_private_weather_v1';
export const VC_CACHE_CONTRACT='BLAISE_VC_FREE_PRIVATE_CACHE_V1';
export const VC_CURRENT_MAX_AGE_MS=90*60_000;
export const VC_FORECAST_SNAPSHOT_MAX_AGE_MS=6*60*60_000;
const MAX_FUTURE_MS=48*60*60_000;
const ALL_CITIES=new Set(geo.points.map(x=>String(x.ibge)));
const keys=Object.values(VC_FIELD_SPEC).map(x=>x.field);
const definitions=new Map(Object.values(VC_FIELD_SPEC).map(x=>[x.field,x]));
const empty=(ibge,reason)=>Object.freeze({
  sourceId:'VISUAL_CROSSING_FREE',ibge:String(ibge),
  status:'INDISPONIVEL',reason,kindCurrent:'E',
  kindForecast:'P',validAt:null,checkedAt:null,
  fields:[],forecast:[],publishedToSubscribers:false,
  providerBalanceVerified:false
});
const finiteTime=(iso)=>typeof iso==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(iso)&&Number.isFinite(Date.parse(iso));
const safeValues=(values)=>{
 if(!values||typeof values!=='object'||Array.isArray(values))return null;
 if(Object.keys(values).length!==keys.length||Object.keys(values).some(k=>!definitions.has(k)))return null;
 const out={};
 for(const key of keys){
  const value=values[key],def=definitions.get(key);
  if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<def.min||value>def.max))
   return null;
  out[key]=value;
 }
 return out;
};
export function normalizeVisualCrossingCacheRecord(sample,{
 ibge=sample?.ibge,now=Date.now()
}={}){
 const city=String(ibge);
 if(!Number.isSafeInteger(now)||now<0||!ALL_CITIES.has(city)||
    sample?.status!=='PRIVATE_REAL_SAMPLE_READY'||
    sample.sourceId!=='VISUAL_CROSSING_FREE'||
    sample.ibge!==city||
    sample.queryCostVerified!==true||sample.queryCost!==1||
    sample.category!=='E'||
    sample.privateStagingOnly!==true||
    sample.publishedToSubscribers!==false||
    sample.publishedToAndroid!==false||
    sample.observationsPublished!==false||sample.paidApiUsed!==false||
    sample.officialObservation!==false||sample.officialAlert!==false||
    sample.current?.kind!=='E'||
    sample.current?.measurementStationVerified!==false||
    sample.current?.provenance!=='VISUAL_CROSSING_AGGREGATED_CURRENT_CONDITIONS'||
    !finiteTime(sample.current?.validAt)||
    !finiteTime(sample.checkedAt)||
    Math.abs(Date.parse(sample.checkedAt)-now)>60_000||
    Date.parse(sample.current.validAt)>now+30_000||
    now-Date.parse(sample.current.validAt)>VC_CURRENT_MAX_AGE_MS)
  return null;
 const current=safeValues(sample.current.values);
 if(!current||Object.values(current).every(v=>v===null))return null;
 const forecast=[];
 if(!Array.isArray(sample.forecast)||sample.forecast.length>49)return null;
 let last=now;
 for(const slot of sample.forecast){
  if(slot?.kind!=='P'||!finiteTime(slot.validAt))return null;
  const ms=Date.parse(slot.validAt);
  if(ms<=last||ms>now+MAX_FUTURE_MS)return null;
  const values=safeValues(slot.values);
  if(!values)return null;
  forecast.push({validAt:slot.validAt,kind:'P',values});
  last=ms;
 }
 const checkedAt=new Date(now).toISOString();
 return Object.freeze({
  contract:VC_CACHE_CONTRACT,sourceId:'VISUAL_CROSSING_FREE',
  ibge:city,checkedAt,providerRecordCost:1,
  providerRecordBalanceVerified:false,
  categoryCurrent:'E',categoryForecast:'P',
  current:{validAt:sample.current.validAt,kind:'E',
    measurementStationVerified:false,values:current},
  forecast,attribution:'Weather data by Visual Crossing',
  expiresAt:new Date(now+VC_FORECAST_SNAPSHOT_MAX_AGE_MS).toISOString(),
  publishedToSubscribers:false,clientReleased:false
 });
}
export function evaluateVisualCrossingPrivateCache(record,{
 ibge=record?.ibge,now=Date.now()
}={}){
 const city=String(ibge);
 if(!ALL_CITIES.has(city)||!Number.isSafeInteger(now)||now<0||
    record?.contract!==VC_CACHE_CONTRACT||
    record.sourceId!=='VISUAL_CROSSING_FREE'||record.ibge!==city||
    record.categoryCurrent!=='E'||record.categoryForecast!=='P'||
    record.publishedToSubscribers!==false||record.clientReleased!==false||
    record.providerRecordCost!==1||
    !finiteTime(record.checkedAt)||!finiteTime(record.expiresAt))
  return empty(city,'NO_VERIFIED_PRIVATE_CACHE');
 const checked=Date.parse(record.checkedAt);
 if(checked>now||now-checked>VC_FORECAST_SNAPSHOT_MAX_AGE_MS||
    Date.parse(record.expiresAt)<=now)return empty(city,'CACHE_EXPIRED');
 const base=safeValues(record.current?.values);
 const valid=Date.parse(record.current?.validAt);
 const currentAvailable=record.current?.kind==='E'&&
   record.current?.measurementStationVerified===false&&base&&
   Number.isFinite(valid)&&valid<=now+30_000&&
   now-valid>=0&&now-valid<=VC_CURRENT_MAX_AGE_MS;
 const currentFields=currentAvailable?keys.flatMap(key=>base[key]===null?[]:[
  Object.freeze({field:key,unit:definitions.get(key).unit,value:base[key],kind:'E'})
 ]):[];
 const forecast=[];
 let last=now;
 if(Array.isArray(record.forecast)&&record.forecast.length<=49){
  for(const slot of record.forecast){
   if(slot?.kind!=='P'||!finiteTime(slot.validAt))continue;
   const ms=Date.parse(slot.validAt);
   const safe=safeValues(slot.values);
   if(!safe||ms<=last||ms>now+MAX_FUTURE_MS)continue;
   last=ms;
   forecast.push(Object.freeze({validAt:slot.validAt,kind:'P',
    availableFields:keys.filter(key=>safe[key]!==null).length,
    fields:Object.freeze(keys.flatMap(key=>safe[key]===null?[]:[
     Object.freeze({field:key,unit:definitions.get(key).unit,value:safe[key],kind:'P'})
    ]))}));
  }
 }
 if(currentFields.length===0&&forecast.length===0)
  return empty(city,'NO_FRESH_CURRENT_OR_FORECAST');
 return Object.freeze({
  sourceId:'VISUAL_CROSSING_FREE',ibge:city,kindCurrent:'E',
  kindForecast:'P',status:'PRIVATE_CACHE_VALID',
  checkedAt:record.checkedAt,
  validAt:currentAvailable?record.current.validAt:null,
  fields:Object.freeze(currentFields),
  forecast:Object.freeze(forecast.slice(0,36)),
  attribution:'Weather data by Visual Crossing',
  publishedToSubscribers:false,providerBalanceVerified:false
 });
}
export function createRjVisualCrossingPrivateCache({db,clock=()=>Date.now()}={}){
 if(typeof db?.collection!=='function')throw Error('Firestore required');
 const collection=db.collection(VC_PRIVATE_CACHE_COLLECTION);
 const read=async(ibge)=>{
  const city=String(ibge);
  if(!ALL_CITIES.has(city))return empty(city,'INVALID_MUNICIPALITY');
  const snap=await collection.doc(city).get();
  if(!snap.exists)return empty(city,'NO_VERIFIED_PRIVATE_CACHE');
  return evaluateVisualCrossingPrivateCache(snap.data(),{ibge:city,now:clock()});
 };
 const save=async(sample)=>{
  const record=normalizeVisualCrossingCacheRecord(sample,{now:clock()});
  if(!record)throw Error('unverified_visual_crossing_sample');
  // We never persist raw provider body, full request URI, secrets or identities.
  await collection.doc(record.ibge).set(record);
  return Object.freeze({saved:true,ibge:record.ibge,
   forecastSlots:record.forecast.length,
   currentFields:keys.filter(k=>record.current.values[k]!==null).length,
   expiresAt:record.expiresAt});
 };
 return Object.freeze({read,save,automaticProviderFetch:false,
   clientPublicationEnabled:false});
}
