/**
 * Canonical internal O/E/P evidence from MET Norway global forecasts.
 * Only a backend result obtained after MET Norway TOS acceptance is eligible.
 * ECMWF via MET is the SAME underlying model as direct ECMWF, not a 4th
 * independent thermometer. CAMS is only clear-sky UV, never actual UV index.
 */
import {
  MET_NORWAY_LOCATIONFORECAST_URL,
  MET_NORWAY_WEATHER_ORIGIN,MET_NORWAY_UV_ORIGIN
} from './rj-met-norway-locationforecast.mjs';

const supported=Object.freeze([
  // Temperature and sensation excluded by 18/11/2026 operator policy.
  ['humidityPct','humidityPct','P'],
  ['pressureHpa','pressureHpa','P'],
  ['dewPointC','dewPointC','E'],
  ['cloudPct','cloudPct','P'],
  ['windKmh','windKmh','P'],
  ['gustKmh','gustKmh','P']
]);
const hourly=Object.freeze([
  ['rainNextHourForecastMm','precipitationNextHourMm'],
  ['rainNextHourProbabilityPct','precipitationProbabilityNextHourPct']
]);
export function projectMetNorwayAdminCoverageEvidence(forecast,{
  termsAcceptedByHuman=false,backendVerified=false
}={}){
  if(termsAcceptedByHuman!==true||backendVerified!==true||
     forecast?.status!=='FORECAST_AVAILABLE'||
     forecast?.source!=='MET_NORWAY_LOCATIONFORECAST_2'||
     forecast?.originWeather!==MET_NORWAY_WEATHER_ORIGIN||
     forecast?.originUv!==MET_NORWAY_UV_ORIGIN||
     forecast?.officialObservation!==false||
     forecast?.uvIsActualCloudAdjusted!==false||
     typeof forecast.ibge!=='string')return Object.freeze([]);
  const common={
    ibge:forecast.ibge,sourceUrl:MET_NORWAY_LOCATIONFORECAST_URL,
    issuedAt:forecast.issuedAt,validAt:forecast.validAt,
    checkedAt:forecast.checkedAt,
    verifiedByBackend:true,commercialUseAuthorized:true,
    municipalityGeoVerified:true
  };
  const records=[];
  function add(field,value,category,origin,datasetId){
    if(typeof value!=='number'||!Number.isFinite(value))return;
    records.push(Object.freeze({
      ...common,field,value,category,sourceId:origin,datasetId,
      modelTransport:'MET_NORWAY_LOCATIONFORECAST_2',
      independentFromDirectEcmwf:origin!==MET_NORWAY_WEATHER_ORIGIN,
      forecastNotStationMeasurement:true
    }));
  }
  for(const [field,key,kind] of supported)
    add(field,forecast.values?.[key],kind,MET_NORWAY_WEATHER_ORIGIN,
      'ECMWF_IFS_GLOBAL_VIA_MET_NO');
  for(const [field,key] of hourly)
    add(field,forecast.hourly?.[key],'P',MET_NORWAY_WEATHER_ORIGIN,
      'ECMWF_IFS_GLOBAL_VIA_MET_NO');
  // Distinct from actual UV: must never fill "uvIndex" with clear-sky value.
  if(forecast.uvIsClearSky===true)
    add('uvClearSkyIndex',forecast.values?.uvClearSkyIndex,'P',
      MET_NORWAY_UV_ORIGIN,'COPERNICUS_CAMS_CLEAR_SKY_VIA_MET_NO');
  return Object.freeze(records);
}
