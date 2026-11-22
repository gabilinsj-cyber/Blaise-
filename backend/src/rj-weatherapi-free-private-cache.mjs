/**
 * Private Firestore cache for WeatherAPI.com Free current conditions.
 *
 * Constructor does not connect, read secrets, schedule, consume provider
 * quotas or publish to Android. Runtime injection and client release gates
 * remain separate and OFF. Do not expose raw Firestore docs to subscriber APIs.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
import {projectWeatherApiFreeCurrentForPaidDashboard}
 from './rj-weatherapi-free-client-projection.mjs';
export const RJ_WA_PRIVATE_CACHE_COLLECTION='blaise_rj_weatherapi_free_private_current_v1';
export const RJ_WA_PRIVATE_CACHE_CONTRACT='RJ_WEATHERAPI_FREE_PRIVATE_CURRENT_CACHE_V1';
export const RJ_WA_CACHE_AUTO_FETCH=false;
const known=new Set(geo.points.map(p=>String(p.ibge)));
const fields=['last_updated_epoch','temp_c','feelslike_c','humidity','wind_kph',
 'gust_kph','precip_mm','cloud','pressure_mb','uv'];
const iso=n=>new Date(n).toISOString();
const stamp=s=>typeof s==='string'?Date.parse(s):NaN;
const invalid=(ibge,reason)=>Object.freeze({
 ibge:String(ibge),status:'UNAVAILABLE',reason,sourceId:'WEATHERAPI_FREE',
 publicReleaseEnabled:false,providerDataVerified:false
});
export function normalizeWeatherApiFreePrivateCache(source,{now=Date.now()}={}){
 if(!Number.isSafeInteger(now)||now<0||!known.has(String(source?.ibge))||
    source?.sourceId!=='WEATHERAPI_FREE'||
    source?.status!=='PRIVATE_CACHE_VALID'||
    source?.nature!=='E'||
    source?.providerDataVerified!==true||
    source?.municipalityGeographyVerified!==true||
    source?.publicReleaseEnabled!==false||
    !Number.isFinite(stamp(source.checkedAt))||
    Math.abs(now-stamp(source.checkedAt))>60_000||
    !source.location||typeof source.location!=='object'||
    !source.data||typeof source.data!=='object')return null;
 const data=Object.fromEntries(fields.map(key=>[key,source.data[key]??null]));
 data.condition={code:source.data.condition?.code??null};
 const normalized={
  status:'PRIVATE_CACHE_VALID',sourceId:'WEATHERAPI_FREE',
  ibge:String(source.ibge),nature:'E',providerDataVerified:true,
  municipalityGeographyVerified:true,publicReleaseEnabled:false,
  checkedAt:iso(now),
  location:{lat:source.location.lat,lon:source.location.lon},
  data
 };
 if(!projectWeatherApiFreeCurrentForPaidDashboard(normalized,{ibge:normalized.ibge,now}))
  return null;
 return Object.freeze({
  contract:RJ_WA_PRIVATE_CACHE_CONTRACT,
  ...normalized,expiresAt:iso(now+35*60_000),
  privateOnly:true,clientReleased:false
 });
}
export function evaluateWeatherApiFreePrivateCache(row,{
 ibge,now=Date.now()
}={}){
 const city=String(ibge);
 if(!known.has(city)||!Number.isSafeInteger(now)||now<0||
    row?.contract!==RJ_WA_PRIVATE_CACHE_CONTRACT||
    row?.ibge!==city||row?.sourceId!=='WEATHERAPI_FREE'||
    row.privateOnly!==true||row.clientReleased!==false||
    row.publicReleaseEnabled!==false||
    !Number.isFinite(stamp(row.expiresAt))||
    stamp(row.expiresAt)<=now||
    !projectWeatherApiFreeCurrentForPaidDashboard(row,{ibge:city,now}))
  return invalid(city,'UNVERIFIED_OR_EXPIRED_PRIVATE_CACHE');
 return Object.freeze({
  status:'PRIVATE_CACHE_VALID',sourceId:'WEATHERAPI_FREE',
  ibge:city,nature:'E',providerDataVerified:true,
  municipalityGeographyVerified:true,publicReleaseEnabled:false,
  checkedAt:row.checkedAt,location:row.location,data:row.data
 });
}
export function createRjWeatherApiFreePrivateCache({db,clock=()=>Date.now()}={}){
 if(typeof db?.collection!=='function'||typeof clock!=='function')
  throw Error('weatherapi_private_firestore_required');
 const collection=db.collection(RJ_WA_PRIVATE_CACHE_COLLECTION);
 if(typeof collection?.doc!=='function')throw Error('weatherapi_private_firestore_invalid');
 async function save(source){
  const normalized=normalizeWeatherApiFreePrivateCache(source,{now:clock()});
  if(!normalized)throw Error('weatherapi_invalid_private_source');
  await collection.doc(normalized.ibge).set(normalized);
  return Object.freeze({saved:true,ibge:normalized.ibge,
   checkedAt:normalized.checkedAt,privateOnly:true,
   customerReleased:false});
 }
 async function read(ibge){
  const city=String(ibge);
  if(!known.has(city))return invalid(city,'UNKNOWN_IBGE');
  const snap=await collection.doc(city).get();
  if(!snap.exists)return invalid(city,'NO_PRIVATE_CACHE');
  return evaluateWeatherApiFreePrivateCache(snap.data(),{ibge:city,now:clock()});
 }
 return Object.freeze({save,read,automaticProviderFetch:false,
  clientPublicationEnabled:false,canReadRawSecret:false});
}
