/**
 * Blaise V6 RJ — real INMET hourly station adapter for the hierarchical
 * meteorological calculator. It uses the official INMET automatic-station
 * JSON catalog and station-specific hourly JSON — NOT simulated data.
 *
 * Important: NO network access by default. The deployer must separately
 * enable this adapter AND confirm the specific product's usage rights.
 * This does not make INPE/CPTEC, Windy or Defesa Civil data available,
 * and must never generate a municipality-wide fictitious measurement.
 */
import { fetchJsonContract } from './source-contract.mjs';
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

export const RJ_INMET_CATALOG_URL = 'https://apitempo.inmet.gov.br/estacoes/T';
export const RJ_INMET_HOST = 'apitempo.inmet.gov.br';
export const RJ_INMET_LIVE_ADAPTER_CONTRACT = 'BLAISE_RJ_INMET_STATION_LIVE_ADAPTER_V1';

const MUNICIPALITIES = new Map(RJ_MUNICIPALITIES.map(x=>[x.ibge,x.name]));
const SPECS = Object.freeze({
  TEMPERATURA_C: Object.freeze({field:'TEM_INS',unit:'°C',min:-30,max:60,factor:1}),
  UMIDADE_PERCENTUAL: Object.freeze({field:'UMD_INS',unit:'%',min:0,max:100,factor:1}),
  VENTO_KMH: Object.freeze({field:'VEN_VEL',unit:'km/h',min:0,max:100,factor:3.6}),
  RAJADA_KMH: Object.freeze({field:'VEN_RAJ',unit:'km/h',min:0,max:111.11,factor:3.6}),
  CHUVA_MM_1H: Object.freeze({field:'CHUVA',unit:'mm',min:0,max:400,factor:1}),
});
const normalize=x=>String(x??'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const finite=(x,lower,upper)=>typeof x==='number'&&Number.isFinite(x)&&x>=lower&&x<=upper;
function number(raw,min,max) {
  if(typeof raw==='number')return finite(raw,min,max)?raw:null;
  if(typeof raw!=='string'||!/^[-+]?\d{1,4}(?:[.,]\d{1,5})?$/.test(raw.trim()))return null;
  const value=Number(raw.replace(',','.'));
  return finite(value,min,max)?value:null;
}
function utcObservation(row) {
  const day=row?.DT_MEDICAO,hour=String(row?.HR_MEDICAO??'').padStart(4,'0');
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)
    ||!/^\d{4}$/.test(hour))return null;
  const h=Number(hour.slice(0,2)),m=Number(hour.slice(2));
  if(h>23||m>59)return null;
  const stamp=`${day}T${hour.slice(0,2)}:${hour.slice(2)}:00.000Z`;
  const t=Date.parse(stamp);
  if(!Number.isFinite(t)||new Date(t).toISOString()!==stamp)return null;
  return stamp;
}
function catalogForMunicipality(raw,ibge) {
  if(!Array.isArray(raw)||raw.length<1||raw.length>2000)return [];
  const name=MUNICIPALITIES.get(String(ibge));
  if(!name)return [];
  const results=[];
  const seen=new Set();
  for(const s of raw) {
    if(!s||typeof s!=='object'||Array.isArray(s))continue;
    if(s.SG_ESTADO!=='RJ'||s.CD_SITUACAO!=='Operante')continue;
    if(normalize(s.DC_NOME)!==normalize(name))continue;
    const code=s.CD_ESTACAO;
    if(typeof code!=='string'||!/^A\d{3}$/.test(code)||seen.has(code))continue;
    const lat=number(s.VL_LATITUDE,-23.7,-20.4);
    const lon=number(s.VL_LONGITUDE,-45.5,-40.4);
    if(lat===null||lon===null)continue;
    seen.add(code);
    results.push(Object.freeze({code,name:s.DC_NOME,latitude:lat,longitude:lon}));
  }
  return results.sort((a,b)=>a.code.localeCompare(b.code)).slice(0,4);
}
function parseStationReadings(raw,station,variable,ibge,now,sourceUrl) {
  if(!Array.isArray(raw)||raw.length<1||raw.length>500)return null;
  const spec=SPECS[variable];
  let best=null;
  for(const row of raw) {
    if(!row||typeof row!=='object'||Array.isArray(row))continue;
    if(row.CD_ESTACAO!=null&&row.CD_ESTACAO!==station.code)continue;
    const stamp=utcObservation(row);
    if(!stamp)continue;
    const t=Date.parse(stamp);
    if(now-t<0||now-t>7_200_000)continue;
    const measured=number(row[spec.field],spec.min,spec.max);
    if(measured===null)continue;
    const value=Math.round(measured*spec.factor*1000)/1000;
    if(!best||t>Date.parse(best.observedAt))best=Object.freeze({
      origin:'OFFICIAL_OBSERVATION',sourceId:'INMET_STATION',
      stationId:station.code,ibge:String(ibge),variable,
      value,unit:spec.unit,weight:1,
      observedAt:stamp,latitude:station.latitude,longitude:station.longitude,
      sourceUrl,measurementWindowMinutes:variable==='CHUVA_MM_1H'?60:undefined,
      stationName:station.name,
      provenance:'INMET_AUTOMATIC_STATION_HOURLY_JSON_NOT_MUNICIPAL_MEAN',
    });
  }
  return best;
}
const unavailable=(status,details=null)=>Object.freeze({
  contract:RJ_INMET_LIVE_ADAPTER_CONTRACT,status,
  observations:Object.freeze([]),forecasts:Object.freeze([]),
  sourceId:'INMET_STATION',details,
  automaticAlertAuthorized:false,
});

export function createRjInmetLiveAdapters({
  enabled=false,usageApproved=false,fetchImpl=globalThis.fetch,
  clock=()=>Date.now(),catalogTtlMs=3_600_000,stationTtlMs=60_000,
}={}) {
  if(typeof enabled!=='boolean'||typeof usageApproved!=='boolean'
    ||typeof fetchImpl!=='function'||typeof clock!=='function'
    ||!Number.isInteger(catalogTtlMs)||catalogTtlMs<60_000||catalogTtlMs>86_400_000
    ||!Number.isInteger(stationTtlMs)||stationTtlMs<30_000||stationTtlMs>300_000)
    throw TypeError('rj_inmet_invalid_adapter_configuration');
  let catalog=null, catalogAt=-Infinity;
  const stationCache=new Map();
  async function getCatalog(now) {
    if(catalog && now-catalogAt>=0&&now-catalogAt<=catalogTtlMs)return catalog;
    const candidate=await fetchJsonContract(RJ_INMET_CATALOG_URL,{
      allowedHosts:[RJ_INMET_HOST],fetchImpl,timeoutMs:7000,maxBytes:2*1024*1024,
    });
    // Do not retain structurally invalid catalogs even if downstream finds
    // no station. A partial catalog risks false "not covered" conclusions.
    if(!Array.isArray(candidate)||candidate.length<1||candidate.length>2000)
      throw TypeError('rj_inmet_catalog_invalid');
    catalog=candidate;catalogAt=now;
    return catalog;
  }
  async function getHourly(station,now) {
    const utc=new Date(now).toISOString().slice(0,10);
    const start=new Date(now-86_400_000).toISOString().slice(0,10);
    const url=`https://${RJ_INMET_HOST}/estacao/${start}/${utc}/${station.code}`;
    const key=`${station.code}:${start}:${utc}`;
    const entry=stationCache.get(key);
    if(entry&&now-entry.at>=0&&now-entry.at<=stationTtlMs)
      return Object.freeze({url,data:entry.data});
    const data=await fetchJsonContract(url,{
      allowedHosts:[RJ_INMET_HOST],fetchImpl,timeoutMs:7000,maxBytes:1024*1024,
    });
    if(!Array.isArray(data)||data.length<1||data.length>500)
      throw TypeError('rj_inmet_hourly_invalid');
    stationCache.set(key,{at:now,data});
    if(stationCache.size>12)stationCache.delete(stationCache.keys().next().value);
    return Object.freeze({url,data});
  }
  const INMET_STATION=async ({ibge,variable,now=clock()}={})=>{
    if(!enabled||!usageApproved)return unavailable(
      !enabled?'INMET_NETWORK_DISABLED':'INMET_PRODUCT_USAGE_APPROVAL_REQUIRED');
    const city=String(ibge);
    if(!MUNICIPALITIES.has(city)||!Object.hasOwn(SPECS,variable)
      ||!Number.isFinite(now)||now<0)return unavailable('INVALID_RJ_SCOPE_OR_VARIABLE');
    try {
      const stations=catalogForMunicipality(await getCatalog(now),city);
      if(!stations.length)return unavailable('NO_EXACT_MUNICIPAL_INMET_STATION');
      for(const station of stations) {
        const {url,data}=await getHourly(station,now);
        const observation=parseStationReadings(data,station,variable,city,now,url);
        if(observation)return Object.freeze({
          contract:RJ_INMET_LIVE_ADAPTER_CONTRACT,
          status:'VALIDATED_RECENT_OFFICIAL_STATION_READING',
          sourceId:'INMET_STATION',observations:Object.freeze([observation]),
          forecasts:Object.freeze([]),automaticAlertAuthorized:false,
        });
      }
      return unavailable('NO_RECENT_VALID_MEASUREMENT');
    }catch(e) {
      // No exception details or HTTP response bodies are returned to callers.
      return unavailable('INMET_FETCH_OR_PRODUCT_VALIDATION_FAILED');
    }
  };
  return Object.freeze({INMET_STATION});
}
