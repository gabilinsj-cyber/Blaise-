/**
 * WeatherAPI.com FREE, read-only projection from a private, authorized cache.
 * No provider calls, key, timer, Firestore writes, or direct Android network.
 * "current" is aggregated E, NOT a physical RJ station or emergency alert.
 */
import points from './rj-ibge-92-points.json' with {type:'json'};
const CITIES=new Map(points.points.map(p=>[String(p.ibge),p]));
export const RJ_WEATHERAPI_FREE_CLIENT_CONTRACT='RJ_WEATHERAPI_FREE_CURRENT_E_V1';
export const RJ_WEATHERAPI_FREE_ATTRIBUTION='Dados meteorológicos: WeatherAPI.com';
export const RJ_WEATHERAPI_CLIENT_RELEASE_ENABLED_BY_DEFAULT=false;
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi?n:null;
const stamp=s=>typeof s==='string'?Date.parse(s):NaN;
const approxKm=(a,b,c,d)=>111*Math.sqrt((a-c)**2+(Math.cos(a*Math.PI/180)*(b-d))**2);
function sky(code){
 if(code===1000)return 'SOL';
 if(code===1003)return 'PARCIALMENTE_NUBLADO';
 if(code===1006||code===1009||code===1030)return 'NUBLADO';
 if([1087,1273,1276,1279,1282].includes(code))return 'TEMPESTADE';
 if([1063,1066,1069,1072,1150,1153,1168,1171,1180,1183,1186,
  1189,1192,1195,1198,1201,1204,1207,1240,1243,1246,1249,1252,
  1255,1258,1261,1264].includes(code))return 'CHUVA';
 return null;
}
export function projectWeatherApiFreeCurrentForPaidDashboard(cache,{
 ibge,now=Date.now()
}={}){
 const code=String(ibge);
 const p=CITIES.get(code);
 if(!p||!Number.isSafeInteger(now)||now<0||
    cache?.status!=='PRIVATE_CACHE_VALID'||
    cache?.sourceId!=='WEATHERAPI_FREE'||
    cache?.ibge!==code||
    cache?.nature!=='E'||
    cache?.providerDataVerified!==true||
    cache?.municipalityGeographyVerified!==true||
    cache?.publicReleaseEnabled!==false||
    cache?.data?.last_updated_epoch===undefined)return null;
 const got=stamp(cache.checkedAt);
 const currentMs=cache.data.last_updated_epoch*1000;
 if(!Number.isFinite(got)||got>now||now-got>12*60_000||
    !Number.isSafeInteger(cache.data.last_updated_epoch)||
    currentMs>got||currentMs>now||now-currentMs>35*60_000)
  return null;
 const latitude=finite(cache.location?.lat,-34,-20);
 const longitude=finite(cache.location?.lon,-46,-38);
 if(latitude===null||longitude===null||
    approxKm(p.lat,p.lon,latitude,longitude)>40)return null;
 const temp=finite(cache.data.temp_c,-60,65);
 const feels=finite(cache.data.feelslike_c,-80,80);
 const humidity=finite(cache.data.humidity,0,100);
 const wind=finite(cache.data.wind_kph,0,350);
 const gust=finite(cache.data.gust_kph,0,450);
 const precip=finite(cache.data.precip_mm,0,500);
 const cloud=finite(cache.data.cloud,0,100);
 const pressure=finite(cache.data.pressure_mb,800,1100);
 const uv=finite(cache.data.uv,0,25);
 const skyCondition=sky(cache.data.condition?.code);
 if([temp,feels,humidity,wind,gust,precip,cloud,pressure,uv].every(x=>x===null)&&
    skyCondition===null)return null;
 // Only a small, source-labeled subscriber DTO. Raw records, provider
 // location detail, key, account, alerts and INMET review never escape.
 return Object.freeze({
  contract:RJ_WEATHERAPI_FREE_CLIENT_CONTRACT,
  ibge:code,sourceId:'WEATHERAPI_FREE',
  sourceLabel:'WeatherAPI.com',
  attribution:RJ_WEATHERAPI_FREE_ATTRIBUTION,
  nature:'E_AGGREGATED_NOT_STATION',
  validAt:new Date(currentMs).toISOString(),
  checkedAt:cache.checkedAt,
  temperatureC:temp,feelsLikeC:feels,
  humidityPct:humidity,windKmh:wind,gustKmh:gust,
  precipitationMm:precip,cloudPct:cloud,
  pressureHpa:pressure,uvIndex:uv,
  skyCondition,officialAlert:false,
  actualStormConfirmed:false,
  criticalAlertEscalationAuthorized:false
 });
}
