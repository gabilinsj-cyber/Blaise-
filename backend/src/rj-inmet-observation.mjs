/**
 * Blaise V6 RJ — real INMET automatic station observations.
 * Only actual operating stations explicitly named after an RJ municipality
 * are eligible. No interpolation, invented stations or cross-state fallback.
 *
 * Network is DISABLED until the operator explicitly approves this product's
 * use, access policy and data publication. No secret credentials are logged.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

export const RJ_INMET_STATION_CATALOG_URL = 'https://apitempo.inmet.gov.br/estacoes/T';
export const RJ_INMET_STATION_SOURCE = 'INMET_STATION';
const CATALOG_REFRESH_MS = 60*60_000;
const STATION_REFRESH_MS = 5*60_000;
const MAX_BYTES = 2*1024*1024;
const RJ = new Map(RJ_MUNICIPALITIES.map(c => [c.ibge,c.name]));
const METRICS = Object.freeze({
  TEMPERATURA_C:['TEM_INS','°C',-30,60,1],
  UMIDADE_PERCENTUAL:['UMD_INS','%',0,100,1],
  VENTO_KMH:['VEN_VEL','km/h',0,100,3.6],
  RAJADA_KMH:['VEN_RAJ','km/h',0,125,3.6],
  CHUVA_MM_1H:['CHUVA','mm',0,400,1],
});
const numeric = (v,low,high) => typeof v==='number' && Number.isFinite(v) && v>=low && v<=high;
function fold(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ').trim().toLocaleLowerCase('pt-BR');
}
function finiteMeasure(v,min,max) {
  if(typeof v==='number' && Number.isFinite(v))return v>=min&&v<=max?v:null;
  if(typeof v!=='string'||!/^[-+]?\d{1,5}(?:[.,]\d{1,5})?$/.test(v.trim()))return null;
  const value=Number(v.replace(',','.'));
  return numeric(value,min,max)?value:null;
}
function hourInstant(item) {
  if(!item || typeof item!=='object')return null;
  const day=item.DT_MEDICAO;
  const hour=String(item.HR_MEDICAO??'').padStart(4,'0');
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day.slice(0,10))
      || !/^([01]\d|2[0-3])[0-5]\d$/.test(hour))return null;
  const timestamp=`${day.slice(0,10)}T${hour.slice(0,2)}:${hour.slice(2)}:00.000Z`;
  const stamp=Date.parse(timestamp);
  return Number.isFinite(stamp)&&new Date(stamp).toISOString()===timestamp?stamp:null;
}
function stationFromCatalog(item) {
  if(!item||item.SG_ESTADO!=='RJ'||item.CD_SITUACAO!=='Operante')return null;
  const code=item.CD_ESTACAO;
  const name=String(item.DC_NOME||'').trim();
  if(typeof code!=='string'||!/^[A-Z][0-9]{3}$/.test(code)||name.length<3||name.length>100)return null;
  const latitude=finiteMeasure(item.VL_LATITUDE,-23.7,-20.4);
  const longitude=finiteMeasure(item.VL_LONGITUDE,-45.5,-40.4);
  if(latitude===null||longitude===null)return null;
  const city=RJ_MUNICIPALITIES.find(c=>fold(c.name)===fold(name));
  if(!city)return null;
  return Object.freeze({ibge:city.ibge,stationId:code,stationName:name,latitude,longitude});
}
export function validateRjInmetStationCatalog(payload) {
  if(!Array.isArray(payload)||payload.length>10000)throw TypeError('inmet_invalid_station_catalog');
  const grouped=new Map();
  for(const row of payload) {
    const station=stationFromCatalog(row);
    if(!station)continue;
    if(!grouped.has(station.ibge))grouped.set(station.ibge,[]);
    const existing=grouped.get(station.ibge);
    if(existing.some(x=>x.stationId===station.stationId))continue;
    existing.push(station);
  }
  return grouped;
}

export function projectRjInmetStationRows(rows,station,{ibge,variable,now}) {
  if(!Array.isArray(rows)||rows.length>500||!RJ.has(String(ibge))
      ||station?.ibge!==String(ibge)||!Object.hasOwn(METRICS,variable)
      ||!Number.isFinite(now))throw TypeError('inmet_invalid_projection_request');
  const [field,unit,low,high,factor]=METRICS[variable];
  const best=rows.map(row=>({row,at:hourInstant(row)}))
    .filter(x=>x.at!==null&&now-x.at>=0&&now-x.at<=2*60*60_000)
    .sort((a,b)=>b.at-a.at)
    .find(({row})=>finiteMeasure(row?.[field],low,high)!==null);
  if(!best)return Object.freeze([]);
  const value=finiteMeasure(best.row[field],low,high)*factor;
  const day=new Date(now).toISOString().slice(0,10);
  const yesterday=new Date(now-24*60*60_000).toISOString().slice(0,10);
  const sourceUrl=`https://apitempo.inmet.gov.br/estacao/${yesterday}/${day}/${station.stationId}`;
  const result={
    origin:'OFFICIAL_OBSERVATION',
    sourceId:RJ_INMET_STATION_SOURCE,stationId:station.stationId,
    stationName:station.stationName,ibge:station.ibge,variable,unit,value,
    observedAt:new Date(best.at).toISOString(),sourceUrl,
    latitude:station.latitude,longitude:station.longitude,
    weight:1,notMunicipalAverage:true,
    ...(variable==='CHUVA_MM_1H'?{measurementWindowMinutes:60}:{}),
  };
  return Object.freeze([Object.freeze(result)]);
}

async function fetchOfficialJson(fetchImpl,url) {
  // Only INMET's exact HTTPS host can be accessed.
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.hostname!=='apitempo.inmet.gov.br'
    ||parsed.username||parsed.password||parsed.port||parsed.hash)
    throw TypeError('inmet_unapproved_host');
  const response=await fetchImpl(url,{
    headers:{Accept:'application/json'},redirect:'manual',
    signal:AbortSignal.timeout(7_000),
  });
  if(response?.status!==200)throw Error('inmet_http_not_available');
  const body=await response.text();
  if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>MAX_BYTES)
    throw TypeError('inmet_response_too_large');
  return JSON.parse(body);
}

/**
 * Factory carries a TTL cache plus in-flight deduplication. A failed refresh
 * does not reuse expired data or trigger source polling from the Android app.
 */
export function createRjInmetStationAdapter({
  enabled=false,termsApproved=false,fetchImpl=globalThis.fetch,
  now=()=>Date.now(),stationRefreshMs=STATION_REFRESH_MS,
  catalogRefreshMs=CATALOG_REFRESH_MS,
}={}) {
  if(typeof enabled!=='boolean'||typeof termsApproved!=='boolean'
    ||typeof fetchImpl!=='function'||typeof now!=='function'
    ||!numeric(stationRefreshMs,60_000,86_400_000)
    ||!numeric(catalogRefreshMs,300_000,86_400_000))
    throw TypeError('inmet_invalid_adapter_config');
  let catalog=null,catalogFetchedAt=-Infinity,catalogPending=null;
  const entries=new Map();
  const stationRowsCache=new Map();
  async function rowsForStation(station) {
    const time=now();
    const prior=stationRowsCache.get(station.stationId);
    if(prior && time-prior.fetchedAt<=stationRefreshMs)return prior.rows;
    if(prior?.pending)return prior.pending;
    const task=(async()=>{
      const day=new Date(time).toISOString().slice(0,10);
      const yesterday=new Date(time-24*60*60_000).toISOString().slice(0,10);
      const url=`https://apitempo.inmet.gov.br/estacao/${yesterday}/${day}/${station.stationId}`;
      const rows=await fetchOfficialJson(fetchImpl,url);
      if(!Array.isArray(rows)||rows.length>500)
        throw TypeError('inmet_invalid_station_rows');
      stationRowsCache.set(station.stationId,{rows,fetchedAt:now()});
      return rows;
    })();
    stationRowsCache.set(station.stationId,{pending:task});
    try{return await task}
    finally{
      if(stationRowsCache.get(station.stationId)?.pending===task)
        stationRowsCache.delete(station.stationId);
    }
  }
  async function stations() {
    const time=now();
    if(catalog && time-catalogFetchedAt<=catalogRefreshMs)return catalog;
    if(!catalogPending)catalogPending=(async()=>{
      const payload=await fetchOfficialJson(fetchImpl,RJ_INMET_STATION_CATALOG_URL);
      const checked=validateRjInmetStationCatalog(payload);
      catalog=checked;catalogFetchedAt=now();
      return checked;
    })().finally(()=>{catalogPending=null});
    return catalogPending;
  }
  async function read({ibge,variable}) {
    if(!RJ.has(String(ibge)))throw TypeError('inmet_invalid_rj_city');
    if(!Object.hasOwn(METRICS,variable))throw TypeError('inmet_invalid_metric');
    if(!enabled||!termsApproved)return Object.freeze({observations:[],forecasts:[],
      state:'DISABLED_AWAITING_ACCESS_AND_TERMS'});
    const eligible=(await stations()).get(String(ibge))||[];
    if(!eligible.length)return Object.freeze({observations:[],forecasts:[],
      state:'NO_OPERATING_STATION_NAMED_FOR_CITY'});
    const station=eligible[0];
    const time=now();
    const cacheKey=`${station.stationId}:${variable}`;
    const prior=entries.get(cacheKey);
    if(prior && time-prior.refreshedAt<=stationRefreshMs)
      return Object.freeze({observations:prior.observations,forecasts:[],
        state:prior.observations.length?'CURRENT_STATION_OBSERVATION':'NO_RECENT_READING'});
    if(prior?.pending)return prior.pending;
    const pending=(async()=>{
      const rows=await rowsForStation(station);
      const observations=projectRjInmetStationRows(rows,station,{ibge,variable,now:now()});
      entries.set(cacheKey,{refreshedAt:now(),observations});
      return Object.freeze({observations,forecasts:[],state:observations.length?
        'CURRENT_STATION_OBSERVATION':'NO_RECENT_READING'});
    })();
    entries.set(cacheKey,{...prior,pending});
    try{return await pending}
    finally{const present=entries.get(cacheKey);if(present?.pending===pending)entries.delete(cacheKey)}
  }
  return Object.freeze({read,enabled:enabled&&termsApproved});
}
