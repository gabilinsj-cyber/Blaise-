/**
 * Approved RJ thermal field gate — no HTTP, no scheduling, no publication.
 * 18/11/2026 operator policy: HG current E (once contracted), OpenWeather
 * current E (quota/contract), DWD ICON Global forecast P (Germany).
 * NOAA, ECMWF/MET Norway and Climatempo are prohibited for these fields.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';
const CODES=new Set(RJ_MUNICIPALITIES.map(x=>x.ibge));
export const RJ_THERMAL_POLICY_V2='RJ_THERMAL_HG_OWM_DWD_ONLY_V2';
export const RJ_THERMAL_PRIORITY=Object.freeze([
  'HG_BRASIL_WEATHER_PRO','OPENWEATHER_ONECALL4_CURRENT','DWD_ICON_GLOBAL'
]);
export const RJ_THERMAL_BLOCKED=Object.freeze([
  'NOAA_GFS','ECMWF_IFS','MET_NORWAY_LOCATIONFORECAST_2','CLIMATEMPO'
]);
const RULES=Object.freeze({
  HG_BRASIL_WEATHER_PRO:Object.freeze({nature:'E',maxAgeMs:60*60_000}),
  OPENWEATHER_ONECALL4_CURRENT:Object.freeze({nature:'E',maxAgeMs:35*60_000}),
  DWD_ICON_GLOBAL:Object.freeze({nature:'P',maxAgeMs:90*60_000}),
});
const value=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi?x:null;
const verified=(r,ibge,now)=>{
  const rule=RULES[r?.sourceId];
  if(!rule||r.ibge!==ibge||r.nature!==rule.nature||
    r.verifiedByBackend!==true||r.municipalityGeoVerified!==true||
    r.licensedForCommercialUse!==true||r.officialObservation!==false||
    r.officialAlert!==false||
    typeof r.sourceUrl!=='string'||!r.sourceUrl.startsWith('https://')||
    !Number.isSafeInteger(now))return false;
  const valid=Date.parse(r.validAt),checked=Date.parse(r.checkedAt);
  if(!Number.isFinite(valid)||!Number.isFinite(checked)||
    checked>now||now-checked>12*60_000||valid>now||now-valid>rule.maxAgeMs)return false;
  if(rule.nature==='P'){
    const issued=Date.parse(r.issuedAt);
    if(!Number.isFinite(issued)||issued>valid||now-issued>12*60*60_000||
      r.datasetId!=='ICON_GLOBAL_2M')return false;
  }
  return true;
};
export function selectRjApprovedThermal({
  municipalityIbge,candidates=[],now=Date.now(),
  hgSubscriptionActive=false
}={}){
  const ibge=String(municipalityIbge??'');
  const missing=Object.freeze({
    contract:RJ_THERMAL_POLICY_V2,ibge,
    temperatureC:null,temperatureSource:null,temperatureNature:null,
    feelsLikeC:null,feelsLikeSource:null,feelsLikeNature:null,
    status:'UNAVAILABLE',officialObservation:false,officialAlert:false,
    automaticAlertsAuthorized:false,publishedToSubscriber:false,
  });
  if(!CODES.has(ibge)||!Number.isSafeInteger(now)||now<0||!Array.isArray(candidates))
    return missing;
  const selected=new Map();
  for(const r of candidates){
    // A written commercial license alone does NOT activate the paid plan.
    if(r?.sourceId==='HG_BRASIL_WEATHER_PRO'&&hgSubscriptionActive!==true)continue;
    if(!verified(r,ibge,now))continue;
    const prev=selected.get(r.sourceId);
    if(!prev||Date.parse(r.validAt)>Date.parse(prev.validAt))selected.set(r.sourceId,r);
  }
  let temperature=null,feelsLike=null;
  for(const id of RJ_THERMAL_PRIORITY){
    const r=selected.get(id);if(!r)continue;
    // DWD ICON Global 2m gives model temperature; it does NOT claim a direct
    // observed feels-like sensor reading. Other temperature formulas need
    // separate audited physical inputs, so no guessed thermal field here.
    if(!temperature){
      const v=value(r.values?.temperatureC,-60,65);
      if(v!==null)temperature={value:v,source:id,nature:r.nature,validAt:r.validAt};
    }
    if(!feelsLike&&id==='OPENWEATHER_ONECALL4_CURRENT'){
      const v=value(r.values?.feelsLikeC,-80,80);
      if(v!==null)feelsLike={value:v,source:id,nature:'E',validAt:r.validAt};
    }
  }
  return Object.freeze({
    ...missing,status:temperature||feelsLike?'PARTIAL_OR_AVAILABLE':'UNAVAILABLE',
    temperatureC:temperature?.value??null,temperatureSource:temperature?.source??null,
    temperatureNature:temperature?.nature??null,
    feelsLikeC:feelsLike?.value??null,feelsLikeSource:feelsLike?.source??null,
    feelsLikeNature:feelsLike?.nature??null,
    sourceValidAt:Object.freeze({temperature:temperature?.validAt??null,
      feelsLike:feelsLike?.validAt??null}),
  });
}
/**
 * Pure admin visual cross-check: official reference is manually entered
 * from INMET/Defesa Civil RJ site, NEVER fetched or copied to customer data.
 * Defesa Civil may have a warning only; with no thermometer reading return
 * NO_COMPARABLE_OFFICIAL_TEMPERATURE (never infer temperature from a warning).
 */
export function reviewThermalAgainstOfficial({
  blaise,reference,now=Date.now(),toleranceC=3,maxDistanceKm=30
}={}){
  const base=Object.freeze({
    contract:'RJ_MANUAL_OFFICIAL_THERMAL_REVIEW_V1',
    scope:'ADMIN_ONLY',source:reference?.sourceId??null,
    result:'NOT_COMPARABLE',differenceC:null,
    overrideTemperature:false,overrideFeelsLike:false,
    automaticOfficialFetch:false,officialDataStored:false,
    clientDataPublished:false,mayTriggerAlerts:false,
  });
  if(!['INMET','DEFESA_CIVIL_RJ'].includes(reference?.sourceId)||
    reference?.manualReviewConfirmed!==true||
    typeof reference.referenceUrl!=='string'||!reference.referenceUrl.startsWith('https://')||
    !Number.isSafeInteger(now)||now<0||!Number.isFinite(maxDistanceKm)||
    maxDistanceKm<=0||maxDistanceKm>100||
    !Number.isFinite(toleranceC)||toleranceC<1||toleranceC>8)
    return base;
  if(!blaise||!CODES.has(String(blaise.ibge))||
    !RJ_THERMAL_PRIORITY.includes(blaise.sourceId)||
    value(blaise.temperatureC,-60,65)===null||blaise.verifiedByBackend!==true)
    return base;
  const ref=value(reference.temperatureC,-60,65);
  if(ref===null)return Object.freeze({...base,result:'NO_COMPARABLE_OFFICIAL_TEMPERATURE'});
  const bt=Date.parse(blaise.validAt),rt=Date.parse(reference.validAt);
  if(!Number.isFinite(bt)||!Number.isFinite(rt)||bt>now||rt>now||
    now-bt>90*60_000||now-rt>90*60_000||
    Math.abs(bt-rt)>60*60_000||
    value(reference.distanceKm,0,100)===null||
    reference.distanceKm>maxDistanceKm)
    return Object.freeze({...base,result:'REFERENCE_TIME_OR_DISTANCE_MISMATCH'});
  const diff=Math.round(Math.abs(blaise.temperatureC-ref)*10)/10;
  return Object.freeze({...base,result:diff<=toleranceC?
    'CLOSE_TO_OFFICIAL_REFERENCE':'ADMIN_REVIEW_NEEDED',differenceC:diff});
}
