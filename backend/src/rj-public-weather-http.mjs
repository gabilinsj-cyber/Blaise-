/**
 * Blaise V6 RJ — one public, read-only presentation boundary for the official
 * weather source cascade. Source adapters remain opt-in and licensed.
 *
 * This API does NOT turn an INPE/Windy forecast into a station reading, does
 * NOT synthesize readings for all 92 cities, and NEVER triggers P0 alerts.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

export const RJ_PUBLIC_WEATHER_PATH='/v1/public/rj-weather';
export const RJ_PUBLIC_WEATHER_CONTRACT='BLAISE_RJ_PUBLIC_WEATHER_READOUT_V1';
const RJ_CODES=new Set(RJ_MUNICIPALITIES.map(x=>x.ibge));
const VARIABLES=Object.freeze({
  TEMPERATURA_C:{unit:'°C',min:-30,max:60},
  UMIDADE_PERCENTUAL:{unit:'%',min:0,max:100},
  VENTO_KMH:{unit:'km/h',min:0,max:400},
  RAJADA_KMH:{unit:'km/h',min:0,max:400},
  CHUVA_MM_1H:{unit:'mm',min:0,max:400},
});
const IDS=new Set(['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION',
  'CEMADEN_RJ','INPE_CPTEC_FORECAST','WINDY_MODELO']);
const TYPES=new Set(['OFFICIAL_STATION_OBSERVATION','MODEL_FORECAST_NOT_A_MEASURED_STATION']);
const KINDS=new Set(['TWO_COMPATIBLE_OFFICIAL_SOURCES','ONE_VERIFIED_OFFICIAL_SOURCE',
  'ONE_OFFICIAL_PLUS_FORECAST_CONTEXT','OFFICIAL_DISAGREEMENT_WITH_MODEL_GUIDED_DISPLAY_PRIORITY',
  'OFFICIAL_DISAGREEMENT_WITH_TWO_SOURCE_CONTEXT','OFFICIAL_DISAGREEMENT_DISPLAY_BOTH_READINGS',
  'TWO_COMPATIBLE_FORECAST_SOURCES','ONE_VERIFIED_FORECAST_SOURCE']);
const MAX_BODY=16*1024;
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const at=(date,now,maxAge=7_200_000)=>{
  const stamp=typeof date==='string'?Date.parse(date):NaN;
  return Number.isFinite(stamp)&&now-stamp>=0&&now-stamp<=maxAge?date:null;
};
const bounded=(s,n=96)=>typeof s==='string'&&s.length>0&&s.length<=n?s:null;
const plain=(source,variable,now)=>{
  if(!source||typeof source!=='object'||!IDS.has(source.sourceId))return null;
  const spec=VARIABLES[variable];
  if(!finite(source.value,spec.min,spec.max)||source.unit!==spec.unit)return null;
  const type=source.dataType||source.type;
  if(!TYPES.has(type))return null;
  const time=type==='OFFICIAL_STATION_OBSERVATION'
    ?at(source.observedAt,now):at(source.validAt,now,24*3_600_000);
  if(!time)return null;
  const identity=type==='OFFICIAL_STATION_OBSERVATION'
    ?bounded(source.stationId,70):bounded(source.productId,90);
  if(!identity)return null;
  return Object.freeze({
    sourceId:source.sourceId,type,
    identity,at:time,
    value:source.value,unit:source.unit,
  });
};
function resultRow(plan,variable,now){
  const result=plan?.latestVerifiedResult;
  if(!result||!KINDS.has(result.state)||!VARIABLES[variable])return null;
  const spec=VARIABLES[variable];
  const base={
    variable,unit:spec.unit,
    kind:result.state,
    value:null,
    observedNotMunicipalAverage:true,
    automaticWarningAuthorized:false,
    measurements:Object.freeze([]),
  };
  if(result.state==='TWO_COMPATIBLE_OFFICIAL_SOURCES'){
    if(!finite(result.value,spec.min,spec.max)||
       !Array.isArray(result.selectedSourceIds)||result.selectedSourceIds.length!==2||
       !result.selectedSourceIds.every(id=>IDS.has(id)&&!['INPE_CPTEC_FORECAST','WINDY_MODELO'].includes(id)))
      return null;
    const stamp=at(result.provenance?.observedAt,now);
    if(!stamp)return null;
    return Object.freeze({...base,
      value:result.value,at:stamp,
      sourceIds:Object.freeze(result.selectedSourceIds),
      formula:'WEIGHTED_COMPATIBLE_OFFICIAL_STATIONS_NOT_MUNICIPAL_MEAN',
    });
  }
  if(result.state==='ONE_VERIFIED_OFFICIAL_SOURCE'){
    if(!finite(result.value,spec.min,spec.max)||
       !Array.isArray(result.selectedSourceIds)||result.selectedSourceIds.length!==1)
      return null;
    const id=result.selectedSourceIds[0];
    if(!IDS.has(id)||['INPE_CPTEC_FORECAST','WINDY_MODELO'].includes(id))return null;
    const stamp=at(result.observedAt,now);
    if(!stamp||!bounded(result.selectedStationIds?.[0],70))return null;
    return Object.freeze({...base,value:result.value,at:stamp,
      sourceIds:Object.freeze([id]),
      stationId:result.selectedStationIds[0],
    });
  }
  const two=Array.isArray(result.sourcePairForDisplay)
    ? result.sourcePairForDisplay.map(r=>plain(r,variable,now)).filter(Boolean):[];
  const official=Array.isArray(result.officialReadings)
    ? result.officialReadings.slice(0,3).map(r=>plain({
        ...r,dataType:'OFFICIAL_STATION_OBSERVATION',
      },variable,now)).filter(Boolean):[];
  const model=two.find(x=>x.type==='MODEL_FORECAST_NOT_A_MEASURED_STATION');
  if(two.length===2&&two.some(x=>x.type==='OFFICIAL_STATION_OBSERVATION')&&model){
    return Object.freeze({...base,
      kind:'OFFICIAL_PLUS_MODEL_CONTEXT_NO_WEIGHTED_OBSERVATION',
      measurements:Object.freeze(two),
      alternateOfficialReadings:Object.freeze(official),
      highlightedReadingSourceId:result.consensusConfirmed===false
        ?null:null, // No sensor is certified correct by model proximity.
      sourceIds:Object.freeze(two.map(x=>x.sourceId)),
    });
  }
  if(official.length>=2){
    return Object.freeze({...base,kind:'OFFICIAL_DISAGREEMENT_SHOW_BOTH',
      measurements:Object.freeze(official),
      sourceIds:Object.freeze(official.map(x=>x.sourceId)),
    });
  }
  return null; // Never relabel unproven forecast as an observed reading.
}

export async function buildRjPublicWeatherReadout(executor,{ibge,now=Date.now()}={}){
  if(typeof executor!=='function'||!RJ_CODES.has(String(ibge))||
      !Number.isFinite(now)||now<0)throw TypeError('invalid_rj_public_readout');
  const readings=[];
  for(const variable of Object.keys(VARIABLES)){
    let candidate;
    try {candidate=await executor({ibge:String(ibge),variable,level:1,now});}
    catch {continue;}
    const value=resultRow(candidate,variable,now);
    if(value)readings.push(value);
  }
  return Object.freeze({
    contract:RJ_PUBLIC_WEATHER_CONTRACT,
    generatedAt:new Date(now).toISOString(),
    ibge:String(ibge),
    scope:'EXACT_RJ_MUNICIPALITY_STATION_OR_LABELED_FORECAST',
    unitsVerified:true,
    municipalAveragesInvented:false,
    radarImageryIncluded:false,
    appBillingRequired:false,
    automaticAlerts:false,
    readings:Object.freeze(readings),
  });
}
function write(res,code,value){
  const body=JSON.stringify(value);
  if(Buffer.byteLength(body,'utf8')>MAX_BODY){
    res.statusCode=503;res.end('');return;
  }
  res.statusCode=code;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.end(body);
}

/**
 * One backend request per selected RJ city, instead of five Android calls.
 * In-process cache keeps API load bounded; CDN/rate limiting is required
 * before scaling user traffic. This does not initiate a background worker.
 */
export function createRjPublicWeatherHandler(delegate,{
  executor,enabled=false,licensingApproved=false,clock=()=>Date.now(),
  cacheTtlMs=60_000,
}={}){
  if(typeof delegate!=='function'||typeof executor!=='function'||
     typeof clock!=='function'||typeof enabled!=='boolean'||
     typeof licensingApproved!=='boolean'||
     !Number.isInteger(cacheTtlMs)||cacheTtlMs<30_000||cacheTtlMs>300_000)
    throw TypeError('invalid_rj_public_weather_handler');
  const cache=new Map(),pending=new Map();
  return async(req,res)=>{
    const path=String(req.url??'').split('?',1)[0];
    if(path!==RJ_PUBLIC_WEATHER_PATH||!enabled||!licensingApproved)
      return delegate(req,res);
    if(req.method!=='GET'){write(res,405,{error:'method_not_allowed'});return;}
    let code;
    try {
      const url=new URL(req.url,'http://localhost');
      if([...url.searchParams.keys()].length!==1||
          url.searchParams.getAll('ibge').length!==1)throw TypeError('invalid_query');
      code=url.searchParams.get('ibge');
      if(!/^[0-9]{7}$/.test(code)||!RJ_CODES.has(code))throw TypeError('invalid_municipality');
    }catch {write(res,400,{error:'invalid_rj_municipality'});return;}
    const now=clock();
    if(!Number.isFinite(now)||now<0){write(res,503,{error:'clock_unavailable'});return;}
    const hit=cache.get(code);
    if(hit&&now-hit.cachedAt>=0&&now-hit.cachedAt<cacheTtlMs){
      write(res,hit.payload.readings.length?200:503,
        hit.payload.readings.length?hit.payload:{error:'no_verified_current_rj_weather'});
      return;
    }
    try {
      if(!pending.has(code)){
        if(pending.size>=8){write(res,503,{error:'busy'});return;}
        const task=buildRjPublicWeatherReadout(executor,{ibge:code,now})
          .finally(()=>pending.delete(code));
        pending.set(code,task);
      }
      const payload=await pending.get(code);
      if(payload.readings.length===0){
        cache.set(code,{cachedAt:now,payload});
        write(res,503,{error:'no_verified_current_rj_weather'});return;
      }
      cache.set(code,{cachedAt:now,payload});
      if(cache.size>92)cache.delete(cache.keys().next().value);
      write(res,200,payload);
    }catch{
      write(res,503,{error:'public_rj_weather_unavailable'});
    }
  };
}
