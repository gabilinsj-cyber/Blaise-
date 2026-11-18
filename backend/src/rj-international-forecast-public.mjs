/**
 * Minimal customer-visible forecast projection.
 * Accepts ONLY a normalized, validated MET Norway model result obtained by
 * the server from its shared cache. Never substitutes forecasts for stations,
 * introduces unofficial warnings, or treats ECMWF via MET as independent.
 */
import ibgePoints from './rj-ibge-92-points.json' with { type: 'json' };
const allowedCities=new Set(ibgePoints.points.map(p=>p.ibge));
const source='MET_NORWAY_LOCATIONFORECAST_2';
const weatherOrigin='ECMWF_IFS';
const uvOrigin='COPERNICUS_CAMS_UV_VIA_MET_NO';
const bounded=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi?v:null;
const timestamp=(v)=>typeof v==='string'?Date.parse(v):NaN;
export const RJ_FORECAST_PUBLIC_STATUS='MODEL_FORECAST_NOT_LOCAL_MEASUREMENT';
export function projectRjInternationalForecast(forecast,{now=Date.now()}={}){
  if(!Number.isSafeInteger(now)||now<0||!forecast||
     forecast.status!=='FORECAST_AVAILABLE'||forecast.source!==source||
     forecast.originWeather!==weatherOrigin||forecast.originUv!==uvOrigin||
     !allowedCities.has(forecast.ibge)||forecast.nature!=='PREVISAO_DE_MODELO_NAO_OBSERVACAO'||
     forecast.officialObservation!==false||forecast.officialAlert!==false||
     forecast.automaticAlertsAuthorized!==false||forecast.uvIsMeasured!==false||
     forecast.uvIsActualCloudAdjusted!==false||
     forecast.independentFromEcmwfDirect!==false||
     forecast.sourceUrl!=='https://api.met.no/weatherapi/locationforecast/2.0/complete'||
     forecast.license!=='CC BY 4.0')return null;
  const valid=timestamp(forecast.validAt),issued=timestamp(forecast.issuedAt),checked=timestamp(forecast.checkedAt);
  if(![valid,issued,checked].every(Number.isFinite)||
     valid>now||now-valid>90*60_000||issued>now||now-issued>12*60*60_000||
     checked>now||now-checked>120_000)return null;
  const v=forecast.values||{},h=forecast.hourly||{};
  const out=Object.freeze({
    ibge:forecast.ibge,sourceId:source,modelOrigin:weatherOrigin,
    uvOrigin,kind:RJ_FORECAST_PUBLIC_STATUS,
    issuedAt:forecast.issuedAt,validAt:forecast.validAt,checkedAt:forecast.checkedAt,
    // ECMWF via MET Norway is no longer approved for thermal display.
    temperatureC:null,
    feelsLikeC:null,
    humidityPct:bounded(v.humidityPct,0,100),
    pressureHpa:bounded(v.pressureHpa,800,1150),
    dewPointC:bounded(v.dewPointC,-90,65),
    cloudPct:bounded(v.cloudPct,0,100),
    windKmh:bounded(v.windKmh,0,400),
    gustKmh:bounded(v.gustKmh,0,550),
    uvClearSkyIndex:forecast.uvIsClearSky===true?bounded(v.uvClearSkyIndex,0,25):null,
    precipitationNextHourMm:bounded(h.precipitationNextHourMm,0,500),
    precipitationProbabilityNextHourPct:bounded(h.precipitationProbabilityNextHourPct,0,100),
    credit:'MET Norway / ECMWF IFS (UV céu limpo: CAMS via MET Norway)',
    sourceUrl:forecast.sourceUrl,
    license:'CC BY 4.0'
  });
  if([out.temperatureC,out.feelsLikeC,out.humidityPct,out.pressureHpa,
      out.dewPointC,out.cloudPct,out.windKmh,out.gustKmh,out.uvClearSkyIndex,
      out.precipitationNextHourMm,out.precipitationProbabilityNextHourPct].every(v=>v===null))return null;
  return out;
}
