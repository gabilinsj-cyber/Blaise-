import { fetchJsonContract } from './source-contract.mjs';

export const PNBOIA_HOST='api-boias.remobs.com.br';
export const PNBOIA_CATALOG_URL=`https://${PNBOIA_HOST}/public/moored/stations`;
export const PNBOIA_DATA_PATH='/v1/public/rj/buoys';
export const PNBOIA_CONTRACT='RJ_PNBOIA_OBSERVATIONS_V1';
const SPECS=Object.freeze({
  sig_wave_height:{unit:'m',min:0,max:30,label:'Altura significativa das ondas'},
  wind_speed:{unit:'m/s',min:0,max:100,label:'Velocidade do vento'},
});
const unavailable=state=>({contract:PNBOIA_CONTRACT,state,stations:[],observations:[],automaticAlertAuthorized:false});
export function eligibleRjBuoy(s){
  return Number.isInteger(s?.id)&&s.id>0&&s.id<=100&&s.mode==='FUNDEADA'
    &&['PNBOIA','REMOBS'].includes(s.project)&&typeof s.local==='string'
    &&/(^|[,\s])RJ($|[,\s])/i.test(s.local)
    &&typeof s.name==='string'&&s.name.length>0&&s.name.length<=160
    &&Number.isFinite(s.latitude)&&s.latitude>=-26&&s.latitude<=-20
    &&Number.isFinite(s.longitude)&&s.longitude>=-45.5&&s.longitude<=-38;
}
function observationTime(value){
  if(typeof value!=='string')return NaN;
  // The provider documents date_time as UTC. Never use the host's local zone.
  const utc=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value)?value:
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(value)?value+'Z':null;
  if(!utc)return NaN;
  const ms=Date.parse(utc);
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,19)===utc.slice(0,19)?ms:NaN;
}
export function normalizePnboiaRows(rows,{station,now}={}){
  if(!eligibleRjBuoy(station)||!Number.isFinite(now)||!Array.isArray(rows)||rows.length>200)return [];
  const latest=new Map();
  for(const row of rows){
    const spec=Object.hasOwn(SPECS,row?.variable_short_name)?SPECS[row.variable_short_name]:null;
    const at=observationTime(row?.date_time);
    if(!spec||row.aggregate_flag!==1||row.variable_units!==spec.unit
      ||!Number.isFinite(at)||now-at<0||now-at>300_000
      ||typeof row.value!=='number'||!Number.isFinite(row.value)||row.value<spec.min||row.value>spec.max
      ||row.depth!=null&&row.depth!==0||!Number.isInteger(row.sensor_installation_id)||row.sensor_installation_id<=0)continue;
    const old=latest.get(row.variable_short_name);
    // Do not choose arbitrarily between simultaneous conflicting sensors.
    if(old&&Date.parse(old.observedAt)===at){
      if(old.value!==row.value||old.sensorInstallationId!==row.sensor_installation_id)latest.set(row.variable_short_name,{...old,conflict:true});
      continue;
    }
    if(!old||at>Date.parse(old.observedAt))latest.set(row.variable_short_name,{
      stationId:station.id,stationName:station.name,latitude:station.latitude,longitude:station.longitude,
      variable:row.variable_short_name,label:spec.label,value:row.value,unit:spec.unit,
      observedAt:new Date(at).toISOString(),qualityFlag:1,sensorInstallationId:row.sensor_installation_id,
      source:'Marinha / PNBOIA / REMObs',sourceUrl:`https://${PNBOIA_HOST}/v2/moored/observations`,
      scope:'BUOY_POINT_NOT_BEACH_OR_MUNICIPALITY',automaticAlertAuthorized:false,
    });
  }
  return [...latest.values()].filter(x=>!x.conflict);
}

/** Secret remains server-side; no network unless access AND display terms are configured. */
export function createPnboiaObservationProvider({token='',usageApproved=false,fetchImpl=globalThis.fetch,clock=()=>Date.now()}={}){
  let cached=null,pending=null,lastAttempt=-Infinity;
  const configured=typeof token==='string'&&token.length>0&&token.length<=8192&&!/[\s\r\n]/.test(token);
  async function acquire(){
    const now=clock();
    if(!configured)return unavailable('ACCESS_NOT_CONFIGURED');
    if(usageApproved!==true)return unavailable('DISPLAY_TERMS_NOT_CONFIRMED');
    try{
      const catalog=await fetchJsonContract(PNBOIA_CATALOG_URL,{allowedHosts:[PNBOIA_HOST],fetchImpl,timeoutMs:3000,maxBytes:512*1024});
      if(!Array.isArray(catalog)||catalog.length<1||catalog.length>500)return unavailable('INVALID_CATALOG');
      const stations=catalog.filter(eligibleRjBuoy).sort((a,b)=>a.id-b.id);
      if(stations.length>12)return unavailable('STATION_LIMIT_EXCEEDED');
      const observations=[];
      let authorizationFailed=false;
      // Strict cap on parallel public requests; result contains no provider response body.
      const results=await Promise.all(stations.map(async station=>{
        const url=new URL(`https://${PNBOIA_HOST}/v2/moored/observations`);
        url.search=new URLSearchParams({buoy_id:String(station.id),variable:Object.keys(SPECS).join(','),
          start_date:new Date(now-300_000).toISOString().slice(0,19),end_date:new Date(now).toISOString().slice(0,19),limit:'200',order:'desc'}).toString();
        try{
          let resolution=null;
          const rows=await fetchJsonContract(url,{
            allowedHosts:[PNBOIA_HOST],timeoutMs:4000,maxBytes:256*1024,
            fetchImpl:async(u,options)=>{
              if(new URL(u).origin!==`https://${PNBOIA_HOST}`)throw Error('untrusted_origin');
              const response=await fetchImpl(u,{...options,headers:{...options.headers,Authorization:`Bearer ${token}`}});
              if([401,403].includes(response.status))authorizationFailed=true;
              resolution=response.headers.get('x-data-resolution');
              return response;
            },
          });
          // Synoptic timestamps may be nominal, not actual observation times.
          if(resolution!=='integral')return [];
          return normalizePnboiaRows(rows,{station,now:clock()});
        }catch{return []}
      }));
      observations.push(...results.flat());
      return {contract:PNBOIA_CONTRACT,state:observations.length?'CURRENT_POINT_OBSERVATIONS':authorizationFailed?'ACCESS_DENIED':'NO_VALID_CURRENT_OBSERVATIONS',
        checkedAt:new Date(clock()).toISOString(),stations:stations.map(s=>({id:s.id,name:s.name})),observations,automaticAlertAuthorized:false};
    }catch{return unavailable('SOURCE_UNAVAILABLE')}
  }
  return async()=>{
    const now=clock();
    if(!Number.isFinite(now))return unavailable('INVALID_CLOCK');
    if(pending)return pending;
    if(cached&&now-lastAttempt>=0&&now-lastAttempt<30_000){
      const observations=cached.observations.filter(x=>now-Date.parse(x.observedAt)>=0&&now-Date.parse(x.observedAt)<=300_000);
      return {...cached,observations,state:cached.state==='CURRENT_POINT_OBSERVATIONS'&&!observations.length?'NO_VALID_CURRENT_OBSERVATIONS':cached.state};
    }
    lastAttempt=now;
    pending=acquire().then(result=>(cached=result)).finally(()=>{pending=null});
    return pending;
  };
}
export function createPnboiaHttpHandler(next,{provider}={}){
  return async(req,res)=>{
    if(req.url?.split('?')[0]!==PNBOIA_DATA_PATH)return next(req,res);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if(req.method!=='GET'){res.writeHead(405,{'Allow':'GET'});res.end('{}');return}
    const result=await provider();
    res.writeHead(200);res.end(JSON.stringify(result));
  };
}
