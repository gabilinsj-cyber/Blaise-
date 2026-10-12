/**
 * Blaise V6 RJ — real OpenWeatherMap Current Weather API adapter.
 *
 * Source: https://openweathermap.org/api/current
 * Weather values are OWM's own multi-source current-weather product, NOT
 * official INMET/Alerta Rio station readings or an official severe warning.
 * Never forward the secret key, raw upstream URL, or weather body to a client.
 * This module can perform live HTTPS calls, but only if explicitly configured.
 * Other ten Table-1 products (hail/severe storm) are not invented from weather
 * icon codes. Marine products use separate product-specific adapters.
 */
import {fetchJsonContract} from './source-contract.mjs';
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

export const RJ_OWM_CONTRACT='BLAISE_RJ_OWM_CURRENT_WEATHER_V1';
export const RJ_OWM_HOST='api.openweathermap.org';
export const RJ_OWM_SUPPORTED=Object.freeze([
  'TEMPERATURA','SENSACAO_TERMICA','CHUVA_ATUAL','CHUVA_ACUMULADA',
  'VENTO','RAJADA','PRESSAO_ATMOSFERICA','UMIDADE',
]);
export const RJ_OWM_UNSUPPORTED_CURRENT=Object.freeze(['TEMPORAL','GRANIZO']);
const CITIES=new Map(RJ_MUNICIPALITIES.map(x=>[String(x.ibge),x.name]));
const LIMITS=Object.freeze({south:-23.7,north:-20.4,west:-45.5,east:-40.4});
const specs=Object.freeze({
  TEMPERATURA:['main.temp','°C',-30,60],
  SENSACAO_TERMICA:['main.feels_like','°C',-40,80],
  CHUVA_ATUAL:['rain.1h','mm/1h',0,400],
  CHUVA_ACUMULADA:['rain.1h','mm/1h',0,400],
  VENTO:['wind.speed','km/h',0,400],
  RAJADA:['wind.gust','km/h',0,400],
  PRESSAO_ATMOSFERICA:['main.pressure','hPa',850,1100],
  UMIDADE:['main.humidity','%',0,100],
});
const numeric=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const canonical=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-zA-Z0-9 ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const unavailable=(reason,ibge,phenomenon)=>Object.freeze({
  contract:RJ_OWM_CONTRACT,sourceId:'OPENWEATHERMAP_API',
  status:'UNAVAILABLE',reason,ibge:String(ibge??''),phenomenon,
  products:Object.freeze([]),automaticAlertAuthorized:false,
  officialObservation:false,weatherMapImageIncluded:false,
});
const projectValue=(obj,path)=>path.split('.').reduce((o,k)=>o?.[k],obj);

export function createRjOpenWeatherLiveAdapter({
  enabled=false,licensedForApp=false,apiKey='',
  fetchImpl=globalThis.fetch,clock=()=>Date.now(),
  weatherTtlMs=300_000,geocodeTtlMs=86_400_000,
}={}) {
  if(typeof enabled!=='boolean'||typeof licensedForApp!=='boolean'
    ||typeof apiKey!=='string'||typeof fetchImpl!=='function'
    ||typeof clock!=='function'
    ||!Number.isInteger(weatherTtlMs)||weatherTtlMs<60_000||weatherTtlMs>900_000
    ||!Number.isInteger(geocodeTtlMs)||geocodeTtlMs<3_600_000
    ||geocodeTtlMs>7*86_400_000)throw TypeError('rj_owm_invalid_adapter_config');
  const weatherCache=new Map(),geocodeCache=new Map();
  let lastSuccessAt=null,lastSourceTime=null,lastStatus='NOT_QUERIED';
  const safeFetch=url=>fetchJsonContract(url,{
    allowedHosts:[RJ_OWM_HOST],fetchImpl,timeoutMs:7000,maxBytes:256*1024,
  });

  async function coords(ibge,now) {
    const cached=geocodeCache.get(ibge);
    if(cached&&now-cached.at>=0&&now-cached.at<geocodeTtlMs)return cached.coords;
    const name=CITIES.get(ibge);
    // OWM's direct geocoder has international duplicate-name possibilities.
    // The state MUST match RJ; absence of precise match fails closed.
    const query=new URLSearchParams({q:`${name},Rio de Janeiro,BR`,limit:'5',appid:apiKey});
    const raw=await safeFetch(`https://${RJ_OWM_HOST}/geo/1.0/direct?${query}`);
    if(!Array.isArray(raw)||raw.length>5)throw Error('owm_invalid_geocode_response');
    const item=raw.find(x=>x?.country==='BR'
      &&canonical(x.state)==='rio de janeiro'
      &&canonical(x.name)===canonical(name)
      &&numeric(x.lat,LIMITS.south,LIMITS.north)
      &&numeric(x.lon,LIMITS.west,LIMITS.east));
    if(!item)throw Error('owm_no_verified_rj_municipality_geocode');
    const result=Object.freeze({latitude:item.lat,longitude:item.lon});
    geocodeCache.set(ibge,{at:now,coords:result});
    if(geocodeCache.size>92)geocodeCache.delete(geocodeCache.keys().next().value);
    return result;
  }
  async function fetchCurrent(ibge,now) {
    const cached=weatherCache.get(ibge);
    if(cached&&now-cached.at>=0&&now-cached.at<weatherTtlMs)return cached.payload;
    const loc=await coords(ibge,now);
    const query=new URLSearchParams({
      lat:String(loc.latitude),lon:String(loc.longitude),
      units:'metric',appid:apiKey,
    });
    const raw=await safeFetch(`https://${RJ_OWM_HOST}/data/2.5/weather?${query}`);
    if(!raw||typeof raw!=='object'||Array.isArray(raw)
      ||raw.cod!=null&&Number(raw.cod)!==200
      ||raw.sys?.country!=='BR'
      ||!numeric(raw.coord?.lat,LIMITS.south,LIMITS.north)
      ||!numeric(raw.coord?.lon,LIMITS.west,LIMITS.east)
      ||Math.abs(raw.coord.lat-loc.latitude)>0.2
      ||Math.abs(raw.coord.lon-loc.longitude)>0.2
      ||!Number.isSafeInteger(raw.dt)
      ||now-raw.dt*1000<0||now-raw.dt*1000>7_200_000) {
      throw Error('owm_invalid_or_stale_product');
    }
    // Do not cache original upstream body, which may include unneeded fields.
    const payload=Object.freeze({
      observedAt:new Date(raw.dt*1000).toISOString(),coordinates:loc,
      temperatureC:raw.main?.temp,feelsLikeC:raw.main?.feels_like,
      humidityPercent:raw.main?.humidity,pressureHpa:raw.main?.pressure,
      windKmh:typeof raw.wind?.speed==='number'?raw.wind.speed*3.6:null,
      gustKmh:typeof raw.wind?.gust==='number'?raw.wind.gust*3.6:null,
      hourlyRainMm:raw.rain?.['1h'] ?? null,
    });
    weatherCache.set(ibge,{at:now,payload});
    if(weatherCache.size>92)weatherCache.delete(weatherCache.keys().next().value);
    lastSuccessAt=new Date(now).toISOString();
    lastSourceTime=payload.observedAt;
    return payload;
  }
  async function query({ibge,phenomenon,now=clock()}={}) {
    const city=String(ibge??'');
    if(!enabled)return unavailable('CONNECTOR_DISABLED',city,phenomenon);
    if(!licensedForApp)return unavailable('COMMERCIAL_PRODUCT_PERMISSION_NOT_VERIFIED',city,phenomenon);
    if(!apiKey||apiKey.length<8)return unavailable('SECRET_NOT_CONFIGURED',city,phenomenon);
    if(!CITIES.has(city)||!Number.isFinite(now)||now<0)
      return unavailable('INVALID_RJ_MUNICIPALITY_OR_CLOCK',city,phenomenon);
    if(!Object.hasOwn(specs,phenomenon))
      return unavailable('NO_SUPPORTED_CURRENT_WEATHER_PRODUCT_FOR_PHENOMENON',city,phenomenon);
    try {
      const payload=await fetchCurrent(city,now);
      const [field,unit,min,max]=specs[phenomenon];
      const value=projectValue(payload,({
        'main.temp':'temperatureC','main.feels_like':'feelsLikeC',
        'rain.1h':'hourlyRainMm','wind.speed':'windKmh',
        'wind.gust':'gustKmh','main.pressure':'pressureHpa',
        'main.humidity':'humidityPercent',
      })[field]);
      if(!numeric(value,min,max))return unavailable('VALUE_NOT_PRESENT_OR_INVALID',city,phenomenon);
      const number=Math.round(value*100)/100;
      lastStatus='FRESH_VALIDATED_COMPLEMENTARY_PRODUCT';
      return Object.freeze({
        contract:RJ_OWM_CONTRACT,status:'FRESH_COMPLEMENTARY_PRODUCT',
        sourceId:'OPENWEATHERMAP_API',ibge:city,phenomenon,
        result:Object.freeze({
          value:number,unit,observedAt:payload.observedAt,
          coordinates:payload.coordinates,
          product:'OPENWEATHER_CURRENT_WEATHER_MULTISOURCE',
          sourceUrl:'https://openweathermap.org/api/current',
          classification:'THIRD_PARTY_MULTISOURCE_PRODUCT_NOT_INMET_OR_ALERTRIO_STATION',
          forecastOrObservation:'OWM_CURRENT_WEATHER_ASSIMILATED_PRODUCT',
          periodMinutes:['CHUVA_ATUAL','CHUVA_ACUMULADA'].includes(phenomenon)?60:null,
          notMunicipalMean:true,mayTriggerAlert:false,
        }),
        automaticAlertAuthorized:false,
        officialObservation:false,
        weatherMapImageIncluded:false,
      });
    } catch {
      lastStatus='SOURCE_RESPONSE_NOT_VERIFIED';
      return unavailable('OWM_HTTPS_OR_PRODUCT_VALIDATION_FAILED',city,phenomenon);
    }
  }
  function status() {
    return Object.freeze({
      contract:RJ_OWM_CONTRACT,sourceId:'OPENWEATHERMAP_API',
      configured:enabled&&licensedForApp&&apiKey.length>=8,
      licensedForApp,enabled,lastSuccessAt,lastSourceTime,lastStatus,
      freshProductFetchedAt:lastSuccessAt,
      apiKeyIncluded:false,automaticAlertAuthorized:false,
    });
  }
  return Object.freeze({query,status});
}
