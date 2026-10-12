import { fetchJsonContract } from './source-contract.mjs';

export const USGS_RJ_TASK_ID='usgs-global-earthquakes';
export const USGS_RJ_SOURCE_ID='usgs-earthquakes-geojson';
export const USGS_RJ_FEED_URL='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
export const USGS_RJ_MAX_AGE_MS=75*60_000;
const MIN_QUAKE_MAG=2.5;
const MAX_FEATURES=2500;

export class UsgsRjError extends Error {
  constructor(code) {super(code);this.name='UsgsRjError';this.code=code;}
}
function reasonable(n,min,max){return typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;}
function quake(record,nowMs) {
  if(!record||record.type!=='Feature'||typeof record.id!=='string'
     || !/^[a-z0-9_-]{3,64}$/i.test(record.id))return null;
  const props=record.properties,geom=record.geometry,coords=geom?.coordinates;
  if(!props||geom?.type!=='Point'||!Array.isArray(coords)
     ||coords.length<3)return null;
  if(!reasonable(props.mag,MIN_QUAKE_MAG,10)||!reasonable(props.time,0,nowMs+60_000)
     ||nowMs-props.time>26*3_600_000
     ||!reasonable(coords[0],-180,180)||!reasonable(coords[1],-90,90)
     ||!reasonable(coords[2],-20,750))return null;
  if(typeof props.place!=='string'||props.place.length>180
    || !props.place.trim() || typeof props.url!=='string')return null;
  let link;
  try{link=new URL(props.url);}catch{return null;}
  if(link.protocol!=='https:'||link.hostname!=='earthquake.usgs.gov'||link.username||link.password)return null;
  return Object.freeze({
    id:record.id, magnitude:props.mag, place:props.place.trim(),
    occurredAt:new Date(props.time).toISOString(),depthKm:coords[2],
    latitude:coords[1],longitude:coords[0],sourceUrl:link.toString(),
    reviewStatus:props.status==='reviewed'?'REVIEWED':'NOT_CONFIRMED_REVIEWED',
    tsunamiFlag:props.tsunami===1?'USGS_EVENT_FLAG_NOT_A_TSUNAMI_WARNING':'NO_USGS_TSUNAMI_FLAG',
    source:'USGS',eventType:'EARTHQUAKE',
    officialTsunamiWarning:false,mayTriggerRjAlert:false,
  });
}
/**
 * Validated USGS data only, never treat USGS tsunami=1 as a tsunami warning.
 * The two biggest events from the past day are global informational cards,
 * not an inference of effects on the RJ coast.
 */
export function parseUsgsRjFeed(payload,{nowMs=Date.now()}={}) {
  if(!reasonable(nowMs,0,Number.MAX_SAFE_INTEGER))throw new UsgsRjError('usgs_invalid_clock');
  if(payload?.type!=='FeatureCollection'||!Array.isArray(payload.features)
    ||payload.features.length>MAX_FEATURES
    ||!reasonable(payload?.metadata?.generated,0,nowMs+60_000)
    ||nowMs-payload.metadata.generated>USGS_RJ_MAX_AGE_MS)
    throw new UsgsRjError('usgs_invalid_or_stale_feed');
  const observed=new Set();
  const earthquakes=payload.features.map(item=>quake(item,nowMs)).filter(Boolean)
    .filter(item=>{if(observed.has(item.id))return false;observed.add(item.id);return true;})
    .sort((a,b)=>b.magnitude-a.magnitude||Date.parse(b.occurredAt)-Date.parse(a.occurredAt))
    .slice(0,2);
  return Object.freeze({
    sourceId:USGS_RJ_SOURCE_ID,sourceUrl:USGS_RJ_FEED_URL,
    generatedAt:new Date(payload.metadata.generated).toISOString(),
    earthquakeCount:earthquakes.length,events:Object.freeze(earthquakes),
    scope:'WORLDWIDE_PAST_DAY_MAGNITUDE_2_5_PLUS',
    alertStatus:'NO_AUTOMATIC_LOCAL_RJ_SEISMIC_OR_TSUNAMI_ALERT',
    thirdPartyImagery:false,
  });
}
export async function probeUsgsRjEarthquakes({fetchImpl=globalThis.fetch,nowMs=Date.now()}={}) {
  const data=await fetchJsonContract(USGS_RJ_FEED_URL,{
    allowedHosts:['earthquake.usgs.gov'],fetchImpl,timeoutMs:7_000,
    maxBytes:4*1024*1024,
  });
  return parseUsgsRjFeed(data,{nowMs});
}

/** In-process source cache. No persistent state, no false 'LIVE' status after expiry. */
export function createUsgsRjCache({now=()=>Date.now()}={}) {
  let last=null,lastAttemptAt=null,lastErrorCode=null;
  return Object.freeze({
    recordSuccess(snapshot,{fetchedAt=now()}={}) {
      if(!snapshot||snapshot.sourceId!==USGS_RJ_SOURCE_ID
         || !Number.isFinite(Date.parse(snapshot.generatedAt)))
         throw new UsgsRjError('usgs_invalid_cache_snapshot');
      last={snapshot,fetchedAt:Date.parse(fetchedAt)};
      lastAttemptAt=new Date(fetchedAt).toISOString();lastErrorCode=null;
    },
    recordFailure(code,{attemptedAt=now()}={}) {
      lastAttemptAt=new Date(attemptedAt).toISOString();
      lastErrorCode=/^[a-z0-9_.:-]{1,80}$/i.test(code)?code:'source_refresh_failed';
    },
    read() {
      const current=now();
      const age=last?current-last.fetchedAt:null;
      const observationAge=last?current-Date.parse(last.snapshot.generatedAt):null;
      const fresh=Boolean(last && age>=0&&age<=USGS_RJ_MAX_AGE_MS
        &&observationAge>=0&&observationAge<=USGS_RJ_MAX_AGE_MS);
      return Object.freeze({
        sourceId:USGS_RJ_TASK_ID,state:fresh?'CURRENT':'UNAVAILABLE',
        reason:fresh?'VALIDATED_OFFICIAL_GEOJSON':'AWAITING_VALIDATED_LIVE_FEED',
        mode:'normal',refreshIntervalMs:60_000,
        refreshDue:!fresh,nextRefreshDueAt:null,lastAttemptAt,lastErrorCode,
        fetchedAt:last?new Date(last.fetchedAt).toISOString():null,
        observedAt:last?.snapshot.generatedAt??null,
        dataAgeMs:observationAge,cacheAgeMs:age,
        snapshot:fresh?last.snapshot:null,
      });
    },
  });
}
