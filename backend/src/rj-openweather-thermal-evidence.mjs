/**
 * Read-only, normalized OpenWeather One Call 4.0 current E thermal adapter.
 * Does NOT fetch external services, consume quotas, read keys or write to DB.
 * A separate approved server Agent 13 is responsible for paid gates, atomic
 * 900/day shared budget, 60s cache and its own current-response validation.
 * No physical thermometer claim and no fabricated feels-like formula.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
const codes=new Set(geo.points.map(p=>p.ibge));
const sourceUrl='https://openweathermap.org/api/one-call-4';
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
const validIso=(s,now,maxAgeMs)=>{
  if(typeof s!=='string'||!/^(20\d{2})-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s))return false;
  const t=Date.parse(s);
  return Number.isFinite(t)&&t<=now&&now-t<=maxAgeMs;
};
/**
 * Both booleans must originate in the trusted server, NEVER HTTP/Android input.
 * Reference coordinates are supplied by the verified service registry;
 * these need not coincide with the interior representative DWD grid points.
 */
export function approvedOpenWeatherThermalEvidence(normalized,{
  now=Date.now(),subscriptionApproved=false,serverVerified=false,
  verifiedTarget=null
}={}){
  if(subscriptionApproved!==true||serverVerified!==true||
     !Number.isSafeInteger(now)||now<0||
     normalized?.contract!=='BLAISE_RJ_OPENWEATHER_CURRENT_4_V1'||
     normalized.status!=='AVAILABLE_PROVIDER_CURRENT_ESTIMATE'||
     normalized.sourceId!=='OPENWEATHER_ONECALL4_CURRENT'||
     normalized.type!=='PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT'||
     normalized.officialObservation!==false||normalized.officialAlert!==false||
     normalized.automaticAlertAuthorized!==false||
     normalized.attributionRequired!==true||
     !codes.has(normalized.ibge)||verifiedTarget?.ibge!==normalized.ibge||
     verifiedTarget.municipalityGeoVerifiedByBackend!==true||
     !number(verifiedTarget.latitude,-25,-20)||
     !number(verifiedTarget.longitude,-46,-40)||
     !number(normalized.latitude,-25,-20)||
     !number(normalized.longitude,-46,-40)||
     Math.abs(verifiedTarget.latitude-normalized.latitude)>0.02||
     Math.abs(verifiedTarget.longitude-normalized.longitude)>0.02||
     !validIso(normalized.validAt,now,35*60_000)||
     !validIso(normalized.retrievedAt,now,12*60_000)||
     Date.parse(normalized.validAt)>Date.parse(normalized.retrievedAt))
    return null;
  const temperatureC=number(normalized.values?.temperatureC,-60,65);
  const feelsLikeC=number(normalized.values?.providerFeelsLikeC,-80,80);
  if(temperatureC===null&&feelsLikeC===null)return null;
  const recordBase=Object.freeze({
    ibge:normalized.ibge,sourceId:'OPENWEATHER_ONECALL4_CURRENT',
    category:'E',datasetId:'OPENWEATHER_ONECALL4_CURRENT',
    sourceUrl,validAt:normalized.validAt,checkedAt:normalized.retrievedAt,
    issuedAt:normalized.validAt,
    verifiedByBackend:true,commercialUseAuthorized:true,
    municipalityGeoVerified:true,
    officialObservation:false,officialAlert:false,
  });
  const records=Object.freeze([
    ...(temperatureC===null?[]:[Object.freeze({...recordBase,field:'temperatureC',value:temperatureC})]),
    ...(feelsLikeC===null?[]:[Object.freeze({...recordBase,field:'feelsLikeC',value:feelsLikeC})])
  ]);
  const candidate=Object.freeze({
    ibge:normalized.ibge,sourceId:'OPENWEATHER_ONECALL4_CURRENT',
    nature:'E',values:Object.freeze({temperatureC,feelsLikeC}),
    validAt:normalized.validAt,checkedAt:normalized.retrievedAt,
    sourceUrl,verifiedByBackend:true,municipalityGeoVerified:true,
    licensedForCommercialUse:true,officialObservation:false,officialAlert:false
  });
  return Object.freeze({
    contract:'RJ_OPENWEATHER_APPROVED_THERMAL_EVIDENCE_V1',
    kind:'E',sourceId:'OPENWEATHER_ONECALL4_CURRENT',
    records,candidate,mayPublishToSubscribers:false,automaticCollection:false,
    observedStation:false,sourceAttribution:'OpenWeather',
    includesRawProviderPayload:false
  });
}
