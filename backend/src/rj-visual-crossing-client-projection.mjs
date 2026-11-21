/**
 * Strict, source-attributed paid-client projection from an already evaluated
 * private Firestore cache. No provider calls, subscriptions, tokens or secrets.
 * A product-level release gate is checked by the authenticated HTTP handler.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
const CITIES=new Set(geo.points.map(x=>String(x.ibge)));
const v=(items,id)=>items.find(x=>x.field===id)?.value??null;
const num=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max?x:null;
const time=x=>typeof x==='string'?Date.parse(x):NaN;
export const VC_PAID_DISPLAY_ATTRIBUTION='Weather data by Visual Crossing';
export const VC_PAID_DISPLAY_CONTRACT='RJ_VISUAL_CROSSING_BOUNDED_CITY_E_P_V1';
export function projectVisualCrossingForPaidDashboard(
 cache,{ibge,now=Date.now()}={}
){
 const code=String(ibge);
 if(!CITIES.has(code)||!Number.isSafeInteger(now)||now<0||
    cache?.status!=='PRIVATE_CACHE_VALID'||
    cache.sourceId!=='VISUAL_CROSSING_FREE'||cache.ibge!==code||
    cache.kindCurrent!=='E'||cache.kindForecast!=='P'||
    cache.publishedToSubscribers!==false||
    cache.providerBalanceVerified!==false||
    cache.attribution!==VC_PAID_DISPLAY_ATTRIBUTION||
    !Array.isArray(cache.fields)||cache.fields.length>10||
    !Array.isArray(cache.forecast)||cache.forecast.length>36||
    !Number.isFinite(time(cache.checkedAt))||
    time(cache.checkedAt)>now||now-time(cache.checkedAt)>6*60*60_000)
  return null;
 const currentTime=time(cache.validAt);
 const currentAllowed=Number.isFinite(currentTime)&&
   currentTime<=now&&now-currentTime<=30*60_000&&
   now-time(cache.checkedAt)<=30*60_000;
 const fields=currentAllowed?cache.fields:[];
 if(!fields.every(x=>x.kind==='E'&&typeof x.field==='string'&&
    typeof x.value==='number'&&Number.isFinite(x.value)))
  return null;
 const ids=fields.map(f=>f.field);
 if(new Set(ids).size!==ids.length)return null;
 const rules={
  temperatureC:['°C',-40,60],feelsLikeC:['°C',-60,70],
  relativeHumidityPct:['%',0,100],dewPointC:['°C',-60,60],
  windSpeedKmh:['km/h',0,350],windGustKmh:['km/h',0,450],
  precipitationMm:['mm',0,500],precipitationProbabilityPct:['%',0,100],
  pressureHpa:['hPa',800,1100],severeRiskIndex:['index 0-100',0,100]
 };
 if(fields.some(x=>{
  const rule=rules[x.field];
  return !rule||x.unit!==rule[0]||x.value<rule[1]||x.value>rule[2];
 }))return null;
 const current={
  temperatureC:num(v(fields,'temperatureC'),-40,60),
  feelsLikeC:num(v(fields,'feelsLikeC'),-60,70),
  humidityPct:num(v(fields,'relativeHumidityPct'),0,100),
  dewPointC:num(v(fields,'dewPointC'),-60,60),
  windKmh:num(v(fields,'windSpeedKmh'),0,350),
  gustKmh:num(v(fields,'windGustKmh'),0,450),
  precipitationMm:num(v(fields,'precipitationMm'),0,500),
  precipitationProbabilityPct:num(v(fields,'precipitationProbabilityPct'),0,100),
  pressureHpa:num(v(fields,'pressureHpa'),800,1100),
  severeRiskIndex:num(v(fields,'severeRiskIndex'),0,100)
 };
 // Do not attach a physical-station label or official severe-weather alert.
 const next=cache.forecast.find(slot=>{
  const t=time(slot.validAt);
  return slot.kind==='P'&&Number.isFinite(t)&&t>now&&
    t-now<=60*60_000&&Array.isArray(slot.fields);
 });
 const nextPrecip=next?num(v(next.fields,'precipitationMm'),0,500):null;
 const nextProb=next?num(v(next.fields,'precipitationProbabilityPct'),0,100):null;
 const nextWind=next?num(v(next.fields,'windGustKmh'),0,450):null;
 const forecastNext=next&&(nextPrecip!==null||nextProb!==null||nextWind!==null)
   ?{validAt:next.validAt,kind:'P',
     precipitationMm:nextPrecip,precipitationProbabilityPct:nextProb,
     windGustKmh:nextWind}:null;
 if(Object.values(current).every(x=>x===null)&&!forecastNext)return null;
 return Object.freeze({
  contract:VC_PAID_DISPLAY_CONTRACT,
  ibge:code,sourceId:'VISUAL_CROSSING_FREE',sourceLabel:'Visual Crossing',
  attribution:VC_PAID_DISPLAY_ATTRIBUTION,
  currentKind:'E_AGGREGATED_NOT_STATION',
  forecastKind:'P_MODEL_NOT_OBSERVATION',
  currentValidAt:currentAllowed?cache.validAt:null,
  checkedAt:cache.checkedAt,officialAlert:false,
  dataNotForSafetyCriticalDecisions:true,
  current,forecastNext
 });
}
