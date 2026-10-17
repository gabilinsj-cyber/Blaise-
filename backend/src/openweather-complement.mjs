import {fetchJsonContract} from './source-contract.mjs';
export const OPENWEATHER_TASK_ID='openweather-rio-complement';
export const OPENWEATHER_SOURCE_URL='https://openweathermap.org/';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function normalizeOpenWeatherRio(raw,{now=Date.now(),fetchedAt=now}={}) {
 if(!Number.isFinite(now)||!Number.isFinite(fetchedAt)||fetchedAt>now)fail('owm_invalid_clock');
 if(raw?.cod!==200||raw?.sys?.country!=='BR'||raw?.name!=='Rio de Janeiro'
  ||!Number.isFinite(raw?.coord?.lat)||!Number.isFinite(raw?.coord?.lon)
  ||Math.abs(raw.coord.lat+22.9068)>.02||Math.abs(raw.coord.lon+43.1729)>.02)fail('owm_scope_mismatch');
 const stamp=raw.dt*1000;
 if(!Number.isInteger(raw.dt)||!Number.isFinite(stamp)||now-stamp<0||now-stamp>300000)fail('owm_calculation_not_current');
 function n(v,lo,hi,factor=1){if(v==null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)fail('owm_invalid_quantity');return Math.round(v*factor*100)/100;}
 return Object.freeze({sourceId:OPENWEATHER_TASK_ID,sourceUrl:OPENWEATHER_SOURCE_URL,ibge:'3304557',
  scope:'RIO_COORDINATE_COMPLEMENT_NOT_INDEPENDENT_STATION',kind:'BLENDED_CURRENT_WEATHER',
  calculatedAt:new Date(stamp).toISOString(),fetchedAt:new Date(fetchedAt).toISOString(),
  temperatureC:n(raw.main?.temp,-30,60),feelsLikeC:n(raw.main?.feels_like,-50,80),
  humidityPercent:n(raw.main?.humidity,0,100),windKmh:n(raw.wind?.speed,0,111.11,3.6),
  gustKmh:n(raw.wind?.gust,0,138.88,3.6),pressureSeaLevelHpa:n(raw.main?.pressure,850,1100),
  rainRateMmPerHour:n(raw.rain?.['1h'],0,500),rainAccumulationMm:null,
  independentStationProven:false,mayIssueWarning:false});
}
export async function probeOpenWeatherRio({apiKey='',usageApproved=false,fetchImpl=globalThis.fetch,now=Date.now}={}){
 if(!usageApproved)fail('owm_usage_not_approved');if(!/^[a-f0-9]{32}$/i.test(apiKey))fail('owm_key_missing');
 const url=new URL('https://api.openweathermap.org/data/2.5/weather');
 for(const [k,v] of Object.entries({lat:'-22.9068',lon:'-43.1729',units:'metric',appid:apiKey}))url.searchParams.set(k,v);
 const response=await fetchJsonContract(url,{allowedHosts:['api.openweathermap.org'],fetchImpl,timeoutMs:8000,maxBytes:32768});
 return normalizeOpenWeatherRio(response.json??response,{now:now()});
}
export function createOpenWeatherCache({now=Date.now}={}) {
 let snapshot=null,lastError=null;
 return {recordSuccess(value){snapshot=value;lastError=null;},recordFailure(code){lastError=code;},read(){
  const age=now()-Date.parse(snapshot?.calculatedAt),fetchAge=now()-Date.parse(snapshot?.fetchedAt);
  const current=snapshot&&age>=0&&age<=300000&&fetchAge>=0&&fetchAge<=300000&&!lastError;
  return {sourceId:OPENWEATHER_TASK_ID,state:current?'CURRENT':lastError?'UNAVAILABLE':'STALE',
   reason:lastError??'blended_current_product_not_independent_station',fetchedAt:snapshot?.fetchedAt??null,
   observedAt:snapshot?.calculatedAt??null,snapshot:current?snapshot:null};
 }};
}
