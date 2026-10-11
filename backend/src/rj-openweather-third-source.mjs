/**
 * Blaise V6 RJ — OpenWeatherMap optional THIRD source, not an official station.
 *
 * Only an authorized server-side adapter may call Current Weather API; never
 * bundle credentials in the Android app, repository, analytics or error logs.
 * Provider data may aggregate stations/models/satellites. It must NOT be
 * counted as independent official measurement or an authoritative warning.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';
export const OPENWEATHER_SOURCE_ID='OPENWEATHER_CURRENT';
export const OPENWEATHER_API_URL='https://api.openweathermap.org/data/2.5/weather';
const RJ_IBGE=new Set(RJ_MUNICIPALITIES.map(x=>x.ibge));
const METRIC_FIELD=Object.freeze({
  TEMPERATURA_C:{path:['main','temp'],unit:'°C',min:-30,max:60,multiplier:1},
  SENSACAO_TERMICA_C:{path:['main','feels_like'],unit:'°C',min:-45,max:80,multiplier:1},
  UMIDADE_PERCENTUAL:{path:['main','humidity'],unit:'%',min:0,max:100,multiplier:1},
  VENTO_KMH:{path:['wind','speed'],unit:'km/h',min:0,max:400,multiplier:3.6},
  RAJADA_KMH:{path:['wind','gust'],unit:'km/h',min:0,max:400,multiplier:3.6},
  CHUVA_MM_1H:{path:['rain','1h'],unit:'mm',min:0,max:400,multiplier:1},
});
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const distance=(a,b)=>{
  const d=Math.PI/180,lat=(b.latitude-a.latitude)*d,lon=(b.longitude-a.longitude)*d;
  const h=Math.sin(lat/2)**2+
    Math.cos(a.latitude*d)*Math.cos(b.latitude*d)*Math.sin(lon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
};

/**
 * Convert a validated OpenWeather JSON result into ONE third-party processed
 * condition. If a parameter was omitted, do NOT interpret it as zero.
 * Do not claim coverage of 92 independent monitoring stations.
 */
export function normalizeOpenWeatherCurrent({
  response,ibge,variable,now=Date.now(),
  requestedCoordinates,usagePermissionStatus='NOT_VERIFIED',
}={}) {
  const field=METRIC_FIELD[variable];
  if(!field||!RJ_IBGE.has(String(ibge))||!Number.isFinite(now)
    ||usagePermissionStatus!=='VERIFIED_FOR_APP_DATA_DISPLAY')return null;
  if(!response || typeof response!=='object'||Array.isArray(response))return null;
  const point={latitude:response.coord?.lat,longitude:response.coord?.lon};
  if(!finite(point.latitude,-23.7,-20.4)||!finite(point.longitude,-45.5,-40.4)
    ||!requestedCoordinates
    ||!finite(requestedCoordinates.latitude,-23.7,-20.4)
    ||!finite(requestedCoordinates.longitude,-45.5,-40.4)
    ||distance(point,requestedCoordinates)>25)return null;
  const timestamp=Number(response.dt)*1000;
  if(!Number.isFinite(timestamp)||now-timestamp<0||now-timestamp>3_600_000)return null;
  const raw=field.path.reduce((obj,key)=>obj?.[key],response);
  if(typeof raw!=='number'||!Number.isFinite(raw))return null;
  const value=Number((raw*field.multiplier).toFixed(2));
  if(!finite(value,field.min,field.max))return null;
  return Object.freeze({
    kind:'THIRD_PARTY_PROCESSED_CURRENT',
    sourceId:OPENWEATHER_SOURCE_ID,
    ibge:String(ibge),variable,value,unit:field.unit,
    dataType:'PROCESSED_WEATHER_CONDITIONS_NOT_AUTHORITATIVE_STATION',
    observedAt:new Date(timestamp).toISOString(),
    latitude:point.latitude,longitude:point.longitude,
    sourceUrl:'https://openweathermap.org/',
    productId:'CURRENT_WEATHER_API_2_5',
    possibleUnderlyingSources:'STATIONS_MODELS_SATELLITES_RADAR_NOT_VERIFIED_INDEPENDENT',
    usagePermissionStatus,
    attributableToIndependentOfficialStation:false,
    officialAlertAuthority:false,
    locationType:'REQUESTED_COORDINATES_NOT_MUNICIPAL_AVERAGE',
    ...(variable==='CHUVA_MM_1H'?{measurementWindowMinutes:60}:{}),
  });
}
/** Server-only adapter. Does not run until a verified key and license are supplied. */
export function createOpenWeatherCurrentAdapter({
  getApiKey=()=>process.env.OPENWEATHER_API_KEY,
  coordinatesByIbge,
  usagePermissionStatus='NOT_VERIFIED',
  fetchImpl=globalThis.fetch,
}={}) {
  if(typeof getApiKey!=='function'||typeof coordinatesByIbge!=='function'
    ||typeof fetchImpl!=='function')throw TypeError('rj_openweather_config_required');
  return async ({ibge,variable,now=Date.now()}={})=>{
    if(usagePermissionStatus!=='VERIFIED_FOR_APP_DATA_DISPLAY')return {thirdPartyConditions:[]};
    const apiKey=getApiKey();
    if(typeof apiKey!=='string'||apiKey.length<16)return {thirdPartyConditions:[]};
    const coords=coordinatesByIbge(String(ibge));
    if(!coords||!finite(coords.latitude,-23.7,-20.4)
      ||!finite(coords.longitude,-45.5,-40.4))return {thirdPartyConditions:[]};
    const field=METRIC_FIELD[variable];
    if(!field)return {thirdPartyConditions:[]};
    const url=new URL(OPENWEATHER_API_URL);
    url.searchParams.set('lat',String(coords.latitude));
    url.searchParams.set('lon',String(coords.longitude));
    url.searchParams.set('units','metric');
    url.searchParams.set('lang','pt_br');
    url.searchParams.set('appid',apiKey);
    try {
      const res=await fetchImpl(url.toString(),{
        method:'GET',redirect:'error',cache:'no-store',
        signal:AbortSignal.timeout(7000),
      });
      if(!res.ok)return {thirdPartyConditions:[]};
      const raw=await res.text();
      if(raw.length>20000)return {thirdPartyConditions:[]};
      const parsed=JSON.parse(raw);
      const snapshot=normalizeOpenWeatherCurrent({
        response:parsed,ibge,variable,now,
        requestedCoordinates:coords,usagePermissionStatus,
      });
      return {thirdPartyConditions:snapshot?[snapshot]:[]};
    } catch {
      // Never print the request URL (it embeds a secret appid), raw response
      // or provider error object. The server handles rate limiting/backoff.
      return {thirdPartyConditions:[]};
    }
  };
}
