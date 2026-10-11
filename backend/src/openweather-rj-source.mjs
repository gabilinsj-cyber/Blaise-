/**
 * Blaise V6 RJ — OpenWeather current conditions adapter (optional).
 *
 * Security:
 * - NEVER embed API keys or the account password in this file, the Android
 *   APK, query logs, build output, or client-facing errors.
 * - The API key is supplied only to the backend from a secret environment
 *   variable, after key rotation and reviewed product license/attribution.
 * - Disabled by default. No network call or billing is triggered at import.
 * - Returned records are THIRD-PARTY ESTIMATES, never independent official
 *   station observations or alert confirmations.
 *
 * Endpoint: https://api.openweathermap.org/data/2.5/weather
 * Official docs: https://openweathermap.org/current
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

export const OPENWEATHER_RJ_SOURCE_ID = 'OPENWEATHER_ESTIMATE';
export const OPENWEATHER_RJ_SOURCE_URL = 'https://openweathermap.org/api';
const RJ_IBGE = new Set(RJ_MUNICIPALITIES.map(city=>String(city.ibge)));
const MIN_CACHE_MS=600_000;
const MAX_CACHE_MS=1_800_000;
const MAX_CACHE_ITEMS=100;
const MAPPINGS=Object.freeze({
  TEMPERATURA_C:{unit:'°C',minimum:-40,maximum:70,extract:p=>p.main?.temp},
  SENSACAO_TERMICA_C:{unit:'°C',minimum:-60,maximum:85,extract:p=>p.main?.feels_like},
  UMIDADE_PERCENTUAL:{unit:'%',minimum:0,maximum:100,extract:p=>p.main?.humidity},
  VENTO_KMH:{unit:'km/h',minimum:0,maximum:400,extract:p=>p.wind?.speed*3.6},
  RAJADA_KMH:{unit:'km/h',minimum:0,maximum:400,extract:p=>p.wind?.gust===undefined?null:p.wind.gust*3.6},
  CHUVA_MM_1H:{unit:'mm',minimum:0,maximum:400,extract:p=>p.rain?.['1h']??null},
});
const finite = x => typeof x==='number' && Number.isFinite(x);
const range = (x,min,max) => finite(x)&&x>=min&&x<=max;
function distanceKm(a,b) {
  const r=Math.PI/180,dp=(a.latitude-b.latitude)*r,dq=(a.longitude-b.longitude)*r;
  const x=Math.sin(dp/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dq/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.max(0,x))));
}
const empty = (reason) => Object.freeze({
  observations:Object.freeze([]),
  forecasts:Object.freeze([]),
  status:reason,
  officialAlertAvailable:false,
  officialStationObservation:false,
});

/**
 * Pure parser: the 2.5 Current Weather response is compiled from multiple
 * provider data families. Its "current" weather number is not guaranteed to
 * be an independent INMET/Defesa Civil/Alerta Rio station measurement.
 */
export function normalizeOpenWeatherRjCurrent({
  payload, ibge, variable, latitude, longitude, now=Date.now(),
  termsApproved=false,
}={}) {
  if(!termsApproved)return empty('OPENWEATHER_TERMS_APPROVAL_REQUIRED');
  if(!RJ_IBGE.has(String(ibge)))return empty('OPENWEATHER_INVALID_RJ_MUNICIPALITY');
  const spec=MAPPINGS[variable];
  if(!spec)return empty('OPENWEATHER_UNSUPPORTED_VARIABLE');
  if(!range(latitude,-23.7,-20.4)||!range(longitude,-45.5,-40.4))
    return empty('OPENWEATHER_INVALID_RJ_COORDINATES');
  const measuredAt=Number(payload?.dt)*1000;
  const location={latitude:payload?.coord?.lat,longitude:payload?.coord?.lon};
  if(!finite(now)||!finite(measuredAt)||now-measuredAt<0||now-measuredAt>7_200_000)
    return empty('OPENWEATHER_OLD_OR_FUTURE_REPORT');
  if(!range(location.latitude,-23.7,-20.4)||!range(location.longitude,-45.5,-40.4)
    ||distanceKm(location,{latitude,longitude})>25)
    return empty('OPENWEATHER_REPORTED_POSITION_NOT_MATCHED');
  if(![200,'200'].includes(payload?.cod))return empty('OPENWEATHER_PROVIDER_NOT_OK');
  const value=spec.extract(payload);
  if(!range(value,spec.minimum,spec.maximum))
    return empty('OPENWEATHER_NO_VALID_REPORTED_VALUE');
  const instant=new Date(measuredAt).toISOString();
  const one=Object.freeze({
    sourceId:OPENWEATHER_RJ_SOURCE_ID,
    kind:'THIRD_PARTY_CURRENT_ESTIMATE',
    estimateKind:'AGGREGATED_CURRENT_PROVIDER_DATA',
    origin:'THIRD_PARTY_AGGREGATE_NOT_OFFICIAL_OBSERVATION',
    productId:'OPENWEATHER_CURRENT_2_5',
    modelRunId:'OPENWEATHER_CURRENT_'+Math.trunc(measuredAt/1000),
    sourceUrl:OPENWEATHER_RJ_SOURCE_URL,
    usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
    officialObservation:false,
    automaticallyConfirmAlert:false,
    ibge:String(ibge),variable,unit:spec.unit,
    value,latitude:location.latitude,longitude:location.longitude,
    issuedAt:instant,validAt:instant,
    forecastWindowMinutes:variable==='CHUVA_MM_1H'?60:null,
    weightBasis:'NOT_BACKTESTED_FOR_INDEPENDENT_STATION_TIE_BREAK',
    attribution:'Weather data provided by OpenWeather',
  });
  return Object.freeze({
    observations:Object.freeze([]),
    forecasts:Object.freeze([one]),
    status:'THIRD_PARTY_CURRENT_ESTIMATE_READY_NOT_OFFICIAL_MEASUREMENT',
    officialAlertAvailable:false,officialStationObservation:false,
  });
}

/**
 * Factory for a backend-only adapter. Callers must supply an IBGE-based,
 * verified coordinate resolver. The real API key must be managed by Secret
 * Manager and injected via OPENWEATHER_API_KEY; the credential posted in chat
 * should be rotated before any integration.
 */
export function createOpenWeatherRjAdapter({
  enabled=false,
  termsApproved=false,
  apiKeyProvider=()=>process.env.OPENWEATHER_API_KEY,
  coordinatesForIbge=()=>null,
  fetchImpl=globalThis.fetch,
  cacheTtlMs=900_000,
}={}) {
  if(!range(cacheTtlMs,MIN_CACHE_MS,MAX_CACHE_MS))
    throw new RangeError('openweather_cache_ttl_out_of_bounds');
  if(typeof fetchImpl!=='function'||typeof coordinatesForIbge!=='function'
     ||typeof apiKeyProvider!=='function')
    throw new TypeError('openweather_backend_configuration_invalid');
  const cache=new Map();
  return async ({ibge,variable,now=Date.now()}={})=>{
    if(!enabled)return empty('OPENWEATHER_DISABLED_BY_DEFAULT');
    if(!termsApproved)return empty('OPENWEATHER_TERMS_APPROVAL_REQUIRED');
    if(!RJ_IBGE.has(String(ibge))||!MAPPINGS[variable]||!finite(now))
      return empty('OPENWEATHER_QUERY_NOT_ELIGIBLE');
    const point=coordinatesForIbge(String(ibge));
    if(!point||!range(point.latitude,-23.7,-20.4)
      ||!range(point.longitude,-45.5,-40.4))
      return empty('OPENWEATHER_MUNICIPAL_COORDINATES_NOT_VERIFIED');
    const cacheKey=`${ibge}:${variable}:${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}`;
    const hit=cache.get(cacheKey);
    if(hit&&now-hit.checkedAt<cacheTtlMs)
      return hit.result;
    const key=apiKeyProvider();
    if(typeof key!=='string'||key.length<15)
      return empty('OPENWEATHER_BACKEND_SECRET_NOT_CONFIGURED');
    // Fixed trusted host, with no user-supplied URL and no redirect.
    const url=new URL('https://api.openweathermap.org/data/2.5/weather');
    url.searchParams.set('lat',point.latitude.toFixed(5));
    url.searchParams.set('lon',point.longitude.toFixed(5));
    url.searchParams.set('units','metric');
    url.searchParams.set('appid',key);
    let result;
    try {
      const response=await fetchImpl(url.toString(),{
        method:'GET',redirect:'error',
        signal:AbortSignal.timeout(8000),
        headers:{Accept:'application/json'},
      });
      if(!response?.ok) return empty('OPENWEATHER_HTTP_FAILURE');
      const payload=await response.json();
      result=normalizeOpenWeatherRjCurrent({
        payload,ibge,variable,latitude:point.latitude,longitude:point.longitude,
        now,termsApproved:true,
      });
    } catch {
      // Never include exception, full URL, query string, token or response.
      return empty('OPENWEATHER_NETWORK_OR_RESPONSE_FAILURE');
    }
    if(result.forecasts.length>0){
      if(cache.size>=MAX_CACHE_ITEMS)cache.delete(cache.keys().next().value);
      cache.set(cacheKey,{checkedAt:now,result});
    }
    return result;
  };
}
