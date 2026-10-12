import {USGS_RJ_TASK_ID,USGS_RJ_SOURCE_ID,USGS_RJ_FEED_URL} from './usgs-rj-earthquakes.mjs';

export const RJ_EARTHQUAKES_PUBLIC_PATH='/v1/public/rj-earthquakes';
export const RJ_EARTHQUAKES_PUBLIC_CONTRACT='BLAISE_RJ_GLOBAL_USGS_RECENT_V1';
const MAX_BYTES=12*1024;

/** Globally observed quakes only; not evidence of earthquake impact in Rio. */
export function buildRjEarthquakesPublicSnapshot(worker,{nowMs=Date.now()}={}) {
  if(!worker||typeof worker.status!=='function'||typeof worker.readSource!=='function'
    ||!Number.isFinite(nowMs))throw TypeError('rj_usgs_worker_invalid');
  const status=worker.status();
  if(status.enabled!==true||status.started!==true||status.usgsEarthquakesConfigured!==true)return null;
  const data=worker.readSource(USGS_RJ_TASK_ID);
  const snapshot=data?.snapshot;
  if(data?.state!=='CURRENT'||snapshot?.sourceId!==USGS_RJ_SOURCE_ID
    || snapshot.sourceUrl!==USGS_RJ_FEED_URL
    ||!Number.isFinite(Date.parse(snapshot.generatedAt))
    ||nowMs-Date.parse(snapshot.generatedAt)<0
    ||nowMs-Date.parse(snapshot.generatedAt)>75*60_000
    ||!Array.isArray(snapshot.events)||snapshot.events.length>2)return null;
  return Object.freeze({
    contract:RJ_EARTHQUAKES_PUBLIC_CONTRACT,
    generatedAt:new Date(nowMs).toISOString(),
    observedFeedGeneratedAt:snapshot.generatedAt,
    source:'USGS',sourceUrl:USGS_RJ_FEED_URL,
    scope:'WORLDWIDE_PAST_DAY_MAGNITUDE_2_5_PLUS',
    events:Object.freeze(snapshot.events.map(e=>Object.freeze({...e}))),
    impactOnRioConfirmed:false,
    tsunamiWarningConfirmed:false,
    informationalOnly:true,
    thirdPartyImagesIncluded:false,
    subscriberDataIncluded:false,
  });
}
function send(res,code,body){
  const value=JSON.stringify(body);
  if(Buffer.byteLength(value,'utf8')>MAX_BYTES)throw TypeError('rj_usgs_public_payload_too_large');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.statusCode=code;res.end(value);
}
export function createRjEarthquakesPublicHandler(delegate,{
  sourceWorker,enabled=false,clock=()=>Date.now(),
}={}){
  if(typeof delegate!=='function'||!sourceWorker
    ||typeof sourceWorker.readSource!=='function'||typeof clock!=='function')
    throw TypeError('rj_usgs_public_handler_configuration_invalid');
  return async(req,res)=>{
    if(req.url?.split('?',1)[0]!==RJ_EARTHQUAKES_PUBLIC_PATH||enabled!==true)
      return delegate(req,res);
    if(req.method!=='GET'){send(res,405,{error:'method_not_allowed'});return;}
    try{
      const snapshot=buildRjEarthquakesPublicSnapshot(sourceWorker,{nowMs:clock()});
      if(!snapshot){send(res,503,{error:'usgs_current_data_not_available'});return;}
      send(res,200,snapshot);
    }catch{
      send(res,503,{error:'usgs_current_data_unavailable'});
    }
  };
}
