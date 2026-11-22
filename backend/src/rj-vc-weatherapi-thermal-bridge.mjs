/**
 * Two-source bridge to the existing Android approvedThermal field.
 * Consumes ONLY already verified and commercially released cached snapshots.
 * Conflict fails closed; INMET comparison remains PRIVATE and outside this
 * public response. No requests, secrets, timers, station claims or alerts.
 */
const finite=n=>typeof n==='number'&&Number.isFinite(n)?n:null;
const time=s=>typeof s==='string'?Date.parse(s):NaN;
const base=(ibge,id,validAt,checkedAt)=>({
 ibge,sourceId:id,nature:'E',validAt,checkedAt,
 temperatureC:null,feelsLikeC:null,skyCondition:null,
 backendVerified:true,commercialLicenseVerified:true,
 municipalityGeoVerified:true,contingencyAuthorized:false,
 hgSubscriptionActive:false
});
export const RJ_VC_WEATHERAPI_THERMAL_BRIDGE='RJ_THERMAL_TWO_FREE_SOURCES_V1';
export const RJ_FREE_THERMAL_AUTO_RELEASE=false;
export function projectRjTwoFreeThermalSources({
 visualCrossing=null,weatherApi=null,
 visualCrossingThermalLicenseVerified=false,
 weatherApiThermalLicenseVerified=false,
 now=Date.now()
}={}){
 if(!Number.isSafeInteger(now)||now<0)return Object.freeze({
  approvedThermal:Object.freeze([]),conflictFieldsHeld:Object.freeze([])
 });
 const rows=[];
 if(visualCrossingThermalLicenseVerified===true&&
    visualCrossing?.sourceId==='VISUAL_CROSSING_FREE'&&
    visualCrossing.currentValidAt&&
    now-time(visualCrossing.currentValidAt)>=0&&
    now-time(visualCrossing.currentValidAt)<=30*60_000&&
    now-time(visualCrossing.checkedAt)>=0&&
    now-time(visualCrossing.checkedAt)<=12*60_000){
  const row=base(visualCrossing.ibge,'VISUAL_CROSSING_FREE',
    visualCrossing.currentValidAt,visualCrossing.checkedAt);
  row.temperatureC=finite(visualCrossing.current?.temperatureC);
  row.feelsLikeC=finite(visualCrossing.current?.feelsLikeC);
  if(row.temperatureC!==null||row.feelsLikeC!==null)rows.push(row);
 }
 if(weatherApiThermalLicenseVerified===true&&
    weatherApi?.sourceId==='WEATHERAPI_FREE'&&
    now-time(weatherApi.validAt)>=0&&
    now-time(weatherApi.validAt)<=35*60_000&&
    now-time(weatherApi.checkedAt)>=0&&
    now-time(weatherApi.checkedAt)<=35*60_000){
  const row=base(weatherApi.ibge,'WEATHERAPI_FREE',
   weatherApi.validAt,weatherApi.checkedAt);
  row.temperatureC=finite(weatherApi.temperatureC);
  row.feelsLikeC=finite(weatherApi.feelsLikeC);
  row.skyCondition=weatherApi.skyCondition??null;
  if(row.temperatureC!==null||row.feelsLikeC!==null||
     row.skyCondition!==null)rows.push(row);
 }
 // Hold differing temperatures and feels-like independently. Do not use
 // unverified INMET observations, choose newest request or average values.
 const held=[];
 if(rows.length===2&&rows[0].ibge===rows[1].ibge&&
    Math.abs(time(rows[0].validAt)-time(rows[1].validAt))<=15*60_000){
  for(const [field,threshold] of [['temperatureC',4],['feelsLikeC',6]]){
   if(rows.every(x=>x[field]!==null)&&
      Math.abs(rows[0][field]-rows[1][field])>threshold){
    held.push(field);
    for(const row of rows)row[field]=null;
   }
  }
 }
 return Object.freeze({
  contract:RJ_VC_WEATHERAPI_THERMAL_BRIDGE,
  approvedThermal:Object.freeze(rows
   .filter(x=>x.temperatureC!==null||x.feelsLikeC!==null||x.skyCondition!==null)
   .map(row=>Object.freeze({...row}))),
  conflictFieldsHeld:Object.freeze(held),
  autoPublishEnabled:false,
  inmetDataIncluded:false
 });
}
