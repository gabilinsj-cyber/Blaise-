/**
 * Blaise V6 RJ - Agent 13 freshness supervisor.
 *
 * At most one analysis of already-ingested, authenticated source snapshots per
 * minute. This module NEVER calls a weather provider, reads a key, reserves
 * credits, starts a timer, stores a record or publishes to customers.
 * A future shared scheduled worker can invoke auditMinute once per minute,
 * guarded by a distributed lease. Do NOT run one timer per Cloud Run instance.
 *
 * "checked at 12:15" MUST NOT be displayed as "measured at 12:15".
 * Temperature and sky observations have separate source/provenance timestamps.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';
import {reviewAgent13ConflictWithInmet} from './rj-agent13-inmet-private-tiebreak.mjs';

export const AGENT13_MINUTE_AUDIT_MS = 60_000;
export const AGENT13_CONTRACT = 'BLAISE_RJ_AGENT13_FRESHNESS_AUDIT_V1';
export const AGENT13_SELECTED_CITY_TARGET_MINUTES = 35;
export const AGENT13_OWM_GLOBAL_DAILY_CALLS = 1;
export const AGENT13_PUBLICATION_ENABLED = false;
const knownCities = new Set(RJ_MUNICIPALITIES.map(x => String(x.ibge)));
if (knownCities.size !== 92) throw Error('RJ_92_NOT_VERIFIED');
const freeze = v => Object.freeze(v);
const SOURCE = freeze({
  HG_BRASIL_WEATHER_PRO:freeze({maxAgeMinutes:60,allowed:freeze(['temperatureC','skyCondition','humidityPct']),nature:'E'}),
  OPENWEATHER_ONECALL4_CURRENT:freeze({maxAgeMinutes:35,allowed:freeze(['temperatureC','feelsLikeC']),nature:'E'}),
  VISUAL_CROSSING_FREE:freeze({maxAgeMinutes:30,allowed:freeze(['temperatureC','feelsLikeC','skyCondition']),nature:'E'}),
  WEATHERAPI_FREE:freeze({maxAgeMinutes:35,allowed:freeze(['temperatureC','feelsLikeC','skyCondition']),nature:'E'}),
  DWD_ICON_GLOBAL:freeze({maxAgeMinutes:60,allowed:freeze(['forecastTemperatureC']),nature:'P'}),
});
export const AGENT13_REGISTERED_SOURCE_RULES = SOURCE;
const SKY = new Set(['SOL','PARCIALMENTE_NUBLADO','NUBLADO','CHUVA','TEMPESTADE']);
const comparable=(field,value)=>{
 if(field==='skyCondition')return typeof value==='string'&&SKY.has(value);
 const ranges={
  temperatureC:[-60,65],feelsLikeC:[-80,80],
  forecastTemperatureC:[-60,65],humidityPct:[0,100]
 };
 const bounds=ranges[field];
 return bounds && typeof value==='number' && Number.isFinite(value) &&
   value>=bounds[0]&&value<=bounds[1];
};
const iso=(str)=>{
 if(typeof str!=='string'||!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(str))return NaN;
 const ms=Date.parse(str);
 return Number.isFinite(ms)&&new Date(ms).toISOString()===str?ms:NaN;
};
const rejection=(reason,ibge=null,field=null)=>freeze({reason,ibge,field});
const sourceAllowed=(id,enabledSources)=>{
 const x=enabledSources?.[id];
 // License/plan/provenance gate; this auditor cannot grant a contract.
 return x?.licensed===true&&x?.collectingAuthorized===true&&
   x?.clientReleaseAuthorized===true&&x?.serverVerified===true;
};
function validateRow(row,now,enabledSources){
 if(!row||typeof row!=='object'||Array.isArray(row))
   return rejection('INVALID_SOURCE_RECORD');
 const id=row.sourceId,field=row.field,city=String(row.ibge??'');
 const policy=SOURCE[id];
 if(row.regionId!=null &&
    (typeof row.regionId!=='string' || !/^[A-Za-z0-9_-]{1,50}$/.test(row.regionId) ||
      row.localRegionGeometryVerified!==true))
   return rejection('LOCAL_REGION_MAPPING_NOT_VERIFIED',city,field);
 if(!knownCities.has(city))return rejection('UNKNOWN_RJ_CITY',city,field);
 if(!policy||!policy.allowed.includes(field)||row.nature!==policy.nature)
   return rejection('SOURCE_FIELD_OR_NATURE_NOT_APPROVED',city,field);
 if(!sourceAllowed(id,enabledSources))
   return rejection('SOURCE_LICENSE_COLLECTION_OR_RELEASE_NOT_APPROVED',city,field);
 if(row.verifiedByBackend!==true||row.municipalityMappingVerified!==true||
   row.originalProviderTimestampVerified!==true||
   row.qualityPass!==true||row.wasIngestedFromAuthorizedCollector!==true)
   return rejection('PROVENANCE_OR_QA_NOT_VERIFIED',city,field);
 if(!comparable(field,row.value))
   return rejection('OUT_OF_RANGE_OR_UNSUPPORTED_SKY',city,field);
 const measured=iso(row.measuredAt),ingested=iso(row.ingestedAt);
 const published=row.providerPublishedAt==null?null:iso(row.providerPublishedAt);
 if(!Number.isFinite(measured)||!Number.isFinite(ingested)||
   (published!==null&&!Number.isFinite(published))||
   measured>ingested||ingested>now||
   (published!==null&&(published<measured||published>ingested)))
   return rejection('INVALID_OR_STALE_TIMESTAMPS',city,field);
 const age=now-measured;
 if(age<0||age>policy.maxAgeMinutes*60_000)
   return rejection('SOURCE_MEASUREMENT_TOO_OLD',city,field);
 // Weather risk classification is descriptive only; no government levels.
 return freeze({
  ibge:city,regionId:row.regionId??null,field,sourceId:id,value:row.value,
  nature:policy.nature,measuredAt:row.measuredAt,
  providerPublishedAt:row.providerPublishedAt??null,
  ingestedAt:row.ingestedAt,
  ageMinutes:Math.round(age/60_000*10)/10,
  ageClass:age<=35*60_000?'PREFERRED_35_MINUTES':'ACCEPTABLE_UP_TO_PROVIDER_LIMIT',
  alertLevel:null,officialAlert:false,
 });
}
const SOURCE_ORDER=freeze([
 'HG_BRASIL_WEATHER_PRO','WEATHERAPI_FREE',
 'VISUAL_CROSSING_FREE','OPENWEATHER_ONECALL4_CURRENT','DWD_ICON_GLOBAL'
]);
/**
 * rows: server-side normalized records, NOT subscriber supplied.
 * existing: last displayed metadata from an authenticated persistent store.
 * This produces proposals ONLY. No real release is performed by this module.
 */
export function auditAgent13Minute({
 nowMs,rows=[],existing=[],enabledSources={},selectedMunicipalityIbges=[],
 privateInmetReviews={}
}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<0||!Array.isArray(rows)||
    !Array.isArray(existing)||rows.length>2000||existing.length>2000||
    !privateInmetReviews||typeof privateInmetReviews!=='object'||
    Array.isArray(privateInmetReviews)||
    !Array.isArray(selectedMunicipalityIbges)||
    selectedMunicipalityIbges.length>2||
    selectedMunicipalityIbges.some(x=>!knownCities.has(String(x)))||
    new Set(selectedMunicipalityIbges.map(String)).size!==selectedMunicipalityIbges.length)
  throw Error('INVALID_FRESHNESS_AUDIT_INPUT');
 const verified=[],rejected=[];
 for(const item of rows){
  const result=validateRow(item,nowMs,enabledSources);
  if('reason'in result)rejected.push(result);else verified.push(result);
 }
 const group=new Map();
 for(const item of verified){
  const key=item.ibge+':'+(item.regionId??'ALL')+':'+item.field;
  const curr=group.get(key);
  if(!curr||
    iso(item.measuredAt)>iso(curr.measuredAt)||
    (item.measuredAt===curr.measuredAt &&
      SOURCE_ORDER.indexOf(item.sourceId)<SOURCE_ORDER.indexOf(curr.sourceId)))
    group.set(key,item);
 }
 // When independent current estimates contradict significantly near the
 // same time, HOLD for scientific review; newer fetch alone is not enough.
 const conflicts=new Set();
 const byPlaceField=new Map();
 for(const item of verified){
  const key=item.ibge+':'+(item.regionId??'ALL')+':'+item.field;
  const values=byPlaceField.get(key)??[];
  values.push(item);
  byPlaceField.set(key,values);
 }
 const thresholds=freeze({temperatureC:4,feelsLikeC:6,humidityPct:25,forecastTemperatureC:6});
 for(const [key,values] of byPlaceField){
  for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){
   const a=values[i],b=values[j];
   if(a.sourceId===b.sourceId||a.nature!==b.nature||
      Math.abs(iso(a.measuredAt)-iso(b.measuredAt))>15*60_000)continue;
   const mismatch=a.field==='skyCondition'
     ?(a.value!==b.value&&(a.value==='TEMPESTADE'||b.value==='TEMPESTADE'))
     :Math.abs(a.value-b.value)>(thresholds[a.field]??Infinity);
   if(mismatch)conflicts.add(key);
  }
 }
 // Only conflicts eligible under the original 15-minute comparable-source
 // check can trigger an INMET review, and only from an already-authenticated,
 // human-reviewed PRIVATE snapshot. Never fetch or expose INMET in Android.
 let privateInmetReviewAttempts=0;
 const resolvedPrivately=[];
 for(const key of [...conflicts]){
  if(!Object.hasOwn(privateInmetReviews,key))continue;
  const values=byPlaceField.get(key)??[];
  if(values.length<2)continue;
  privateInmetReviewAttempts++;
  const first=values[0];
  const tie=reviewAgent13ConflictWithInmet({
   ibge:first.ibge,regionId:first.regionId,field:first.field,
   candidates:values,review:privateInmetReviews[key],nowMs
  });
  if(tie.status==='PRIVATE_DISPUTE_RESOLVED'){
   // The only displayed candidate is still a Blaise-licensed provider.
   // Its ORIGINAL measurement time and source identity are preserved.
   group.set(key,tie.selectedBlaiseReading);
   conflicts.delete(key);
   resolvedPrivately.push(Object.freeze({key,winnerSourceId:tie.selectedBlaiseReading.sourceId}));
  }
 }
 const previous=new Map();
 for(const item of existing){
  if(!knownCities.has(String(item?.ibge))||
     !Object.values(SOURCE).some(r=>r.allowed.includes(item?.field)))
    continue;
  const ts=iso(item.measuredAt);
  if(!Number.isFinite(ts)||ts>nowMs)continue;
  const key=String(item.ibge)+':'+(item.regionId??'ALL')+':'+item.field;
  if(!previous.has(key)||iso(previous.get(key).measuredAt)<ts)
    previous.set(key,item);
 }
 const fresh=[...group.values()].sort((a,b)=>{
  const aSelected=selectedMunicipalityIbges.map(String).includes(a.ibge)?0:1;
  const bSelected=selectedMunicipalityIbges.map(String).includes(b.ibge)?0:1;
  return aSelected-bSelected||a.ibge.localeCompare(b.ibge)||
    a.field.localeCompare(b.field);
 });
 const updates=fresh.filter(item=>{
  if(conflicts.has(item.ibge+':'+(item.regionId??'ALL')+':'+item.field))return false;
  const prev=previous.get(item.ibge+':'+(item.regionId??'ALL')+':'+item.field);
  // Never republish an older observation or rebrand an unchanged one.
  return !prev||iso(item.measuredAt)>iso(prev.measuredAt);
 });
 return freeze({
  contract:AGENT13_CONTRACT,
  auditAt:new Date(nowMs).toISOString(),
  checkIntervalSeconds:60,
  monitoredRjMunicipalities:92,
  selectedCityTargetMinutes:AGENT13_SELECTED_CITY_TARGET_MINUTES,
  inspectedRows:rows.length,
  eligibleRows:verified.length,
  rejectedCount:rejected.length,
  heldForConflictCount:conflicts.size,
  privateInmetReviewAttemptedCount:privateInmetReviewAttempts,
  resolvedByPrivateInmetCount:resolvedPrivately.length,
  privatelyResolvedBlaiseSources:freeze(resolvedPrivately),
  inmetMeasurementsInClientData:false,
  heldFields:freeze([...conflicts].sort()),
  rejectionCounts:freeze(Object.fromEntries(
    [...new Set(rejected.map(x=>x.reason))].map(reason=>[
      reason,rejected.filter(x=>x.reason===reason).length
    ])
  )),
  alreadyStoredReadings:existing.length,
  proposedUpdates:freeze(updates),
  // The selected most up-to-date data are NOT automatically published:
  // a different authorized release gate must commit them atomically.
  previewLatest:freeze(fresh),
  providerNetworkCalls:0,
  creditsReserved:0,
  fetchedNewData:false,
  automaticProviderCollection:false,
  automaticClientPublication:false,
  escalatedSafetyAlert:false,
 });
}
