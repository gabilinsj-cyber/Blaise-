/**
 * Blaise V6 RJ — optional OpenWeather current weather adapter.
 * Server-side ONLY. DO NOT put OPENWEATHER_API_KEY into an APK, BuildConfig,
 * public GitHub file, log, report, exception, URL displayed to end users.
 *
 * A provider aggregate/model cannot act as a second independent
 * official station or P0 alert. "Current" is NOT a 1–7 day forecast.
 * Product availability, quota and license are separately verified.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

const MUNICIPALITIES=new Set(RJ_MUNICIPALITIES.map(x=>String(x.ibge)));
const invalid=(reason)=>Object.freeze({
  status:'UNAVAILABLE',reason,provider:'OPENWEATHER',
  data:null,credentialValueExposed:false,officialAlertAuthorized:false,
});
const finite=(value,min,max)=>
  typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
const field=(o,name,min,max)=>finite(o?.[name],min,max);
const round=(value,digits=2)=>value===null?null:Number(value.toFixed(digits));
export const OPENWEATHER_RJ_CURRENT_ENDPOINT='https://api.openweathermap.org/data/2.5/weather';
export const OPENWEATHER_RJ_SECRET_NAME='OPENWEATHER_API_KEY';
export const OPENWEATHER_RJ_MIN_REFRESH_MS=300_000;
export const OPENWEATHER_RJ_INPUT_ROLE='LICENSED_AGGREGATED_PROVIDER_POINT_NOT_INMET_STATION';

export function normalizeOpenWeatherCurrentRj(raw,{
  ibge,latitude,longitude,now=Date.now(),maxAgeMs=3_600_000,
}={}) {
  if(!MUNICIPALITIES.has(String(ibge))
    ||finite(latitude,-23.6,-20.4)===null
    ||finite(longitude,-45.3,-40.3)===null
    ||!Number.isFinite(now))return invalid('OUTSIDE_RJ_MUNICIPALITY_OR_COORDINATES');
  if(!raw||typeof raw!=='object'||raw.cod!=200 && raw.cod!=='200')
    return invalid('INVALID_PROVIDER_RESPONSE');
  const time=Number(raw.dt)*1000;
  if(!Number.isFinite(time)||now-time<0||now-time>maxAgeMs)
    return invalid('PROVIDER_RESULT_STALE_OR_FUTURE');
  const responseLat=finite(raw.coord?.lat,-23.6,-20.4);
  const responseLon=finite(raw.coord?.lon,-45.3,-40.3);
  if(responseLat===null||responseLon===null
    ||Math.abs(responseLat-latitude)>0.25||Math.abs(responseLon-longitude)>0.25)
    return invalid('PROVIDER_GRIDPOINT_NOT_REQUESTED_LOCALITY');

  // Each field may be absent: never interpret "rain missing" as "zero rain".
  const tempC=field(raw.main,'temp',-40,65);
  const feelsLikeC=field(raw.main,'feels_like',-70,80);
  const humidityPct=field(raw.main,'humidity',0,100);
  const pressureHpa=field(raw.main,'pressure',830,1090);
  const windMs=field(raw.wind,'speed',0,110);
  const gustMs=field(raw.wind,'gust',0,140);
  const directionDeg=field(raw.wind,'deg',0,360);
  const rain1hMm=finite(raw.rain?.['1h'],0,450);
  const weatherCodes=Array.isArray(raw.weather)
    ?raw.weather.map(w=>finite(w?.id,200,804)).filter(x=>x!==null).slice(0,10):[];
  return Object.freeze({
    status:'CURRENT_AGGREGATED_PROVIDER_POINT',
    provider:'OPENWEATHER',
    kind:'THIRD_PARTY_CURRENT_WEATHER_AGGREGATE_NOT_OFFICIAL_STATION',
    ibge:String(ibge), latitude:responseLat,longitude:responseLon,
    observedAt:new Date(time).toISOString(),
    receivedAt:new Date(now).toISOString(),
    forecastHorizon:null,
    values:Object.freeze({
      temperatureC:tempC,feelsLikeC,humidityPercent:humidityPct,
      pressureHpa,windKmh:windMs===null?null:round(windMs*3.6),
      windGustKmh:gustMs===null?null:round(gustMs*3.6),
      windDirectionDegrees:directionDeg,rain1hMm,
      weatherConditionCodes:Object.freeze(weatherCodes),
      hailVerified:null,
      forecastRainProbability:null,
    }),
    sourcePage:'https://openweathermap.org/',
    attributionRequired:'Weather data provided by OpenWeather',
    credentialValueExposed:false,
    officialAlertAuthorized:false,
    sourceIsIndependentOfficialObservation:false,
    note:'Only this point and provider time, not 92 independent observed municipal stations.',
  });
}

export async function fetchOpenWeatherCurrentRj({
  ibge,latitude,longitude,
  apiKey=process.env.OPENWEATHER_API_KEY,
  dataUseApproved=false,
  now=Date.now(),
  fetchImpl=globalThis.fetch,
}={}) {
  if(dataUseApproved!==true)return invalid('SOURCE_PLAN_AND_DATA_USE_NOT_VERIFIED');
  if(typeof apiKey!=='string'||!/^[-_a-zA-Z0-9]{12,128}$/.test(apiKey))
    return invalid('SERVER_SIDE_OPENWEATHER_SECRET_MISSING_OR_INVALID');
  if(typeof fetchImpl!=='function')return invalid('SERVER_FETCH_UNAVAILABLE');
  if(!MUNICIPALITIES.has(String(ibge))
    ||finite(latitude,-23.6,-20.4)===null
    ||finite(longitude,-45.3,-40.3)===null)
    return invalid('OUTSIDE_RJ_MUNICIPALITY_OR_COORDINATES');
  try {
    const url=new URL(OPENWEATHER_RJ_CURRENT_ENDPOINT);
    url.searchParams.set('lat',String(latitude));
    url.searchParams.set('lon',String(longitude));
    url.searchParams.set('units','metric');
    url.searchParams.set('lang','pt_br');
    url.searchParams.set('appid',apiKey);
    const res=await fetchImpl(url.toString(),{
      method:'GET',headers:{Accept:'application/json'},
      redirect:'error',signal:AbortSignal.timeout(9000),
    });
    if(!res ||res.ok!==true)return invalid('PROVIDER_HTTP_ERROR_OR_QUOTA');
    const json=await res.json();
    return normalizeOpenWeatherCurrentRj(json,{ibge,latitude,longitude,now});
  } catch {
    // Never serialize fetch errors: many HTTP clients include ?appid=TOKEN
    // in the message or stack trace.
    return invalid('PROVIDER_REQUEST_FAILED');
  }
}
