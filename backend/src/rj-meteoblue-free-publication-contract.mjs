/**
 * Seven-field scientific readout + *deny-by-design* client publication contract.
 * PR #173: private meteoblue Free trial, one audited Rio point, no subscriber
 * license or scientific approval established. No HTTP, Firestore, credentials,
 * credits, subscriber route, alerting or model data are emitted by this module.
 *
 * Important: quality diagnostics can never grant publication by themselves.
 */
import {METEOBLUE_BASIC6H_FIELDS}
 from './rj-meteoblue-basic6h-parse.mjs';

const specs=Object.entries(METEOBLUE_BASIC6H_FIELDS);
const sixHoursMs=6*60*60_000;
const ttlMs=sixHoursMs;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const canonical=t=>typeof t==='string'&&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t)&&
 Number.isFinite(Date.parse(t))&&
 new Date(Date.parse(t)).toISOString()===t;
const sortedUnique=arr=>Object.freeze([...new Set(arr)].sort());

export const METEOBLUE_FREE_PUBLICATION_CONTRACT=Object.freeze({
 source:'METEOBLUE_FREE_FORECAST',
 scope:'PRIVATE_STAGING_RIO_ONLY',category:'P',intervalHours:6,
 fieldCount:7,publicReleaseApproved:false,subscriberApiEnabled:false,
 androidPublicationEnabled:false,alertInputEnabled:false,
 scientificHomologationGranted:false,commercialRightsVerified:false,
 modelIndependentOfExistingNwp:false,
 observationalData:false,officialAlert:false,
 allowedProbeCities:Object.freeze(['3304557']),
 // This never becomes true from a runtime environment flag or cache timestamp.
 requiresSeparateScientificCommercialAndReleaseAuthorization:true
});

/**
 * Returns only field identifiers, counts and validation reasons; NEVER values.
 * Old cached forecasts may lack sourceField (now persisted by the new parser):
 * this is correctly flagged as missing source-key provenance, not fabricated.
 */
export function assessMeteoblueFreePublication(forecast,{nowMs=Date.now(),storedAtMs=null}={}){
 const errors=[];
 const warnings=[];
 const details=[];
 const validNow=Number.isSafeInteger(nowMs)&&nowMs>=0;
 if(!validNow)errors.push('INVALID_REVIEW_CLOCK');
 const f=forecast&&typeof forecast==='object'&&!Array.isArray(forecast)
   ?forecast:null;
 if(!f){
  errors.push('NO_PRIVATE_FORECAST');
 }else{
  if(f.status!=='FORECAST_PARSED_PRIVATE_STAGING'||
     f.sourceId!=='METEOBLUE_FREE_FORECAST'||
     f.packageName!=='basic-6h'||f.intervalHours!==6||
     f.ibge!=='3304557'||f.category!=='P'||f.forecastOnly!==true||
     f.observational!==false||f.stationMeasurement!==false||
     f.officialAlert!==false)
    errors.push('PRIVATE_FORECAST_PROVENANCE_INVALID');
  if(f.publishedToAndroid!==false||f.publishedToSubscribers!==false||
     f.scientificallyHomologated!==false)
    errors.push('PRIVATE_PUBLICATION_FLAGS_INVALID');
  if(f.metadataRunVerified!==true||f.unitMetadataVerified!==true||
     f.sourceCoordinatesVerified!==true||
     f.completeFieldCoverage!==true||
     f.auditReadyForPrivateReview!==true)
    errors.push('MODEL_UNITS_LOCATION_OR_COVERAGE_NOT_VERIFIED');
  if(f.modelRunIndependentOfNwpSources!==false)
    warnings.push('MODEL_INDEPENDENCE_NOT_ESTABLISHED');
  const ts=f.validTimes;
  if(!Array.isArray(ts)||ts.length<1||ts.length>80||
     ts.some((t,i)=>!canonical(t)||
       (i>0&&Date.parse(t)-Date.parse(ts[i-1])!==sixHoursMs))){
    errors.push('INVALID_SIX_HOUR_TIMELINE');
  }
  const issueAt=f.issuedAt;
  if(!canonical(issueAt)||(validNow&&
      (Date.parse(issueAt)>nowMs||nowMs-Date.parse(issueAt)>36*60*60_000)))
    warnings.push('MODEL_RUN_NOT_CURRENT_FOR_CLIENT');
  if(storedAtMs!==null&&
     (!Number.isSafeInteger(storedAtMs)||storedAtMs<0||
      (validNow&&(storedAtMs>nowMs||nowMs-storedAtMs>ttlMs))))
    warnings.push('PRIVATE_CACHE_EXPIRED_OR_CLOCK_INVALID');

  const series=f.values;
  if(!Array.isArray(series)||series.length!==specs.length){
    errors.push('NOT_EXACTLY_SEVEN_FIELDS');
  }else{
    const seen=new Set();
    const paired=new Map();
    for(const [sourceKey,definition] of specs){
      const matching=series.filter(x=>x?.field===definition.name);
      if(matching.length!==1){
        errors.push('FIELD_MISSING_OR_DUPLICATE_'+sourceKey.toUpperCase());
        continue;
      }
      const item=matching[0];
      if(seen.has(item.field))errors.push('DUPLICATE_FIELD');
      seen.add(item.field);
      if(item.sourceField!==sourceKey)
       warnings.push('SOURCE_KEY_PROVENANCE_NOT_PERSISTED_OR_MISMATCH_'+sourceKey.toUpperCase());
      if(item.unit!==definition.unit||item.semantics!==definition.meaning)
       errors.push('FIELD_UNIT_OR_SEMANTICS_INVALID_'+sourceKey.toUpperCase());
      const data=item.values;
      if(!Array.isArray(data)||!Array.isArray(ts)||data.length!==ts.length){
       errors.push('FIELD_LENGTH_INVALID_'+sourceKey.toUpperCase());continue;
      }
      if(data.some(v=>v!==null&&(!finite(v)||v<definition.min||v>definition.max))){
       errors.push('FIELD_RANGE_INVALID_'+sourceKey.toUpperCase());continue;
      }
      const numericCount=data.filter(finite).length;
      details.push(Object.freeze({
       field:definition.name,unit:definition.unit,sourceKey,
       numericCount,missingCount:data.length-numericCount,
       valueRangePass:true,forecastCategory:'P'
      }));
      if(numericCount!==data.length)
       warnings.push('INCOMPLETE_PERIOD_VALUES_'+sourceKey.toUpperCase());
      paired.set(sourceKey,data);
    }
    if(seen.size!==series.length)errors.push('UNEXPECTED_OR_REPEATED_FIELD');
    const total=paired.get('precipitation');
    const convective=paired.get('convective_precipitation');
    if(total&&convective){
      let wet=0,equalWet=0,exceeds=0;
      for(let i=0;i<total.length;i++){
       const a=total[i],b=convective[i];
       if(!finite(a)||!finite(b))continue;
       const wetSlot=a>0.001||b>0.001;
       if(wetSlot){wet++;if(Math.abs(a-b)<=0.001)equalWet++;}
       if(b>a+0.001)exceeds++;
      }
      if(exceeds>0)warnings.push('CONVECTIVE_COMPONENT_EXCEEDS_TOTAL_REVIEW');
      if(wet>0&&equalWet===wet)
       warnings.push('CONVECTIVE_COMPONENT_MATCHES_TOTAL_IN_ALL_WET_PERIODS_REVIEW');
    }
    const windMean=paired.get('windspeed_mean');
    const windMax=paired.get('windspeed_max');
    if(windMean&&windMax&&windMean.some((v,i)=>finite(v)&&
      finite(windMax[i])&&v>windMax[i]+0.001))
      warnings.push('SIX_HOUR_WIND_MAX_BELOW_MEAN_REVIEW');
    // No cross-field hard rule between precipitation probability and amount:
    // meteoblue documents that ensemble probability and deterministic
    // precipitation can disagree without making either forecast invalid.
  }
 }
 const reasons=sortedUnique([
  ...errors,...warnings,
  'SCIENTIFIC_AND_COMMERCIAL_APPROVAL_NOT_GRANTED',
  'NO_SUBSCRIBER_PUBLICATION_CONTRACT',
  'NO_CLIENT_OR_ALERT_ENDPOINT'
 ]);
 return Object.freeze({
  status:'BLOCKED_PRIVATE_STAGING_ONLY',
  source:'METEOBLUE_FREE_FORECAST',category:'P',
  structuralChecksPassed:errors.length===0,
  additionalScientificReviewRequired:errors.length>0||warnings.length>0,
  errors:sortedUnique(errors),warnings:sortedUnique(warnings),
  reasons,fields:Object.freeze(details),
  clientPublicationAllowed:false,androidPublicationAllowed:false,
  canGenerateOfficialAlerts:false,canPopulateRiskCalculator:false,
  commercialUseAuthorized:false,scientificallyHomologated:false,
  clientPayload:null,alertPayload:null,mapLayerPayload:null,
  providerContacted:false,creditsReserved:0,
  noNewCollectionRequired:true
 });
}

/** Hard-deny every future subscriber adapter, regardless of caller flags. */
export function buildMeteoblueFreeClientPayload(forecast,options={}){
 const report=assessMeteoblueFreePublication(forecast,options);
 return Object.freeze({
  status:'BLOCKED_PRIVATE_STAGING_ONLY',
  reasons:report.reasons,
  forecast:null,weather:null,alerts:null,clientPayload:null,
  publishedToSubscribers:false,publishedToAndroid:false,
  providerContacted:false,creditsReserved:0
 });
}
