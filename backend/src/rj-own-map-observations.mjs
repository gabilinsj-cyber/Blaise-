/**
 * Blaise V6 RJ: user-requested OWN MAP, OWN RENDERING, multiple feeds.
 *
 * This module prepares bounded POINT OBSERVATIONS for Blaise's own geographic
 * renderer; it never fetches radar screenshots or third-party map tiles.
 * Four referenced channels: Alerta Rio, regional Civil Defence, INMET and
 * Windy. The first three are candidate official observation/warning sources
 * when the product and coverage are verified. Windy is an independent MODEL
 * comparison channel, not a public official measurement.
 * CEMADEN, ANA, SGB/SACE, Marinha and NOAA remain separate approved adapters.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

const VALID_RJ = new Set(RJ_MUNICIPALITIES.map(x => x.ibge));
const BASE_CHANNELS = Object.freeze([
  {sourceId:'ALERTA_RIO', type:'OFFICIAL_CANDIDATE', coverage:'RIO_CITY_ONLY'},
  {sourceId:'DEFESA_CIVIL_RJ_REGIONAL', type:'OFFICIAL_CANDIDATE', coverage:'LOCAL_AUTHORITY_ONLY'},
  {sourceId:'INMET_STATION', type:'OFFICIAL_CANDIDATE', coverage:'STATION_ONLY'},
  {sourceId:'WINDY_MODELO', type:'MODEL_COMPARISON', coverage:'FORECAST_MODEL_NOT_OBSERVATION'},
].map(Object.freeze));
export const RJ_OWN_MAP_CHANNELS = BASE_CHANNELS;
export const RJ_OWN_MAP_RENDERER = 'BLAISE_V6_RJ_NATIVE_GEOGRAPHIC_CANVAS';
export const RJ_OWN_MAP_BOUNDARIES = Object.freeze({
  west:-44.889,east:-40.956,south:-23.368,north:-20.763,
});
const MEASURES = Object.freeze({
  TEMPERATURE_C:{min:-30,max:60,unit:'°C'},
  WIND_MS:{min:0,max:100,unit:'m/s'},
  GUST_MS:{min:0,max:125,unit:'m/s'},
  RAIN_MM_1H:{min:0,max:400,unit:'mm/1h'},
  HUMIDITY_PERCENT:{min:0,max:100,unit:'%'},
});
const valid = (n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const reject = reason=>Object.freeze({status:'UNAVAILABLE',reason,points:Object.freeze([]),
  radarFrameAvailable:false,estimatedMunicipalAverage:null,thirdPartyImageCopied:false});

export function prepareOwnMapObservationLayer({observations,now=Date.now(),maxAgeMs=7_200_000}={}) {
  if(!Array.isArray(observations)||observations.length>128
    ||!Number.isFinite(now)||!valid(maxAgeMs,1,7_200_000))return reject('INVALID_INPUT');
  if(observations.length===0)return reject('NO_VALID_RECENT_OFFICIAL_STATION_POINTS');
  const points=[],dedup=new Set();
  for(const row of observations){
    if(!row||typeof row!=='object'||Array.isArray(row))continue;
    if(row.kind!=='OFFICIAL_OBSERVATION')continue;
    if(!BASE_CHANNELS.some(s=>s.sourceId===row.sourceId&&s.type==='OFFICIAL_CANDIDATE'))continue;
    if(row.sourceId==='ALERTA_RIO'&&String(row.ibge)!=='3304557')continue;
    if(!VALID_RJ.has(String(row.ibge)))continue;
    const metric=MEASURES[row.variable];
    if(!metric||!valid(row.value,metric.min,metric.max)||row.unit!==metric.unit)continue;
    if(!valid(row.latitude,RJ_OWN_MAP_BOUNDARIES.south,RJ_OWN_MAP_BOUNDARIES.north)
      ||!valid(row.longitude,RJ_OWN_MAP_BOUNDARIES.west,RJ_OWN_MAP_BOUNDARIES.east))continue;
    if(typeof row.stationId!=='string'||!/^[-_A-Za-z0-9]{2,70}$/.test(row.stationId))continue;
    if(typeof row.sourceUrl!=='string'||!row.sourceUrl.startsWith('https://'))continue;
    if(row.usagePermissionStatus!=='VERIFIED_FOR_APP_DATA_DISPLAY')continue;
    const seen=Date.parse(row.observedAt);
    if(!Number.isFinite(seen)||now-seen<0||now-seen>maxAgeMs)continue;
    const id=`${row.sourceId}:${row.stationId}:${row.variable}:${row.observedAt}`;
    if(dedup.has(id))continue;
    dedup.add(id);
    points.push(Object.freeze({kind:'OBSERVED_STATION_POINT',sourceId:row.sourceId,
      stationId:row.stationId,ibge:String(row.ibge),observedAt:row.observedAt,
      value:row.value,unit:metric.unit,variable:row.variable,sourceUrl:row.sourceUrl,
      latitude:row.latitude,longitude:row.longitude,
      presentation:'BLAISE_OWN_SYMBOL_RENDERER',notMunicipalMean:true}));
  }
  return Object.freeze({
    status:points.length?'AVAILABLE_STATION_POINTS':'UNAVAILABLE',
    reason:points.length?'OBSERVED_POINTS_ONLY_NO_RADAR_OR_SPATIAL_INTERPOLATION':'NO_VALID_RECENT_OFFICIAL_STATION_POINTS',
    renderer:RJ_OWN_MAP_RENDERER,points:Object.freeze(points),
    radarFrameAvailable:false,estimatedMunicipalAverage:null,thirdPartyImageCopied:false,
    automaticWarningAuthorized:false,
  });
}
