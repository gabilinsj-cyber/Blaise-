/**
 * Original Blaise RJ radar visualization DATA contract.
 * Only real, georeferenced, licensed radar rate measurements are accepted.
 * This never downloads or copies third-party radar maps/images, and never
 * invents a continuous rainfall field from sparse ground stations.
 *
 * Conversion from an authorized provider's physical binary/grid product is
 * intentionally separate, source-specific and not implemented here.
 */
export const RJ_RADAR_SPATIAL_LAYER_CONTRACT='BLAISE_NATIVE_RJ_RADAR_SPATIAL_FRAMES_V1';
const BOUNDS=Object.freeze({west:-45.2,east:-40.4,south:-24.3,north:-20.4});
const id=/^[A-Za-z0-9][A-Za-z0-9._-]{1,83}$/;
const number=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const invalid=(why)=>Object.freeze({status:'UNAVAILABLE',reason:why,frames:Object.freeze([]),
  provenanceVerified:false,sourceImageCopied:false,syntheticPixelsGenerated:false});

function normalizedFrame(frame,now,maxAgeMs){
  if(!frame||typeof frame!=='object')return null;
  if(frame.dataType!=='GEOREFERENCED_MEASURED_RADAR_RAIN_RATE')return null;
  if(frame.usagePermissionStatus!=='VERIFIED_FOR_BLAISE_RJ_COMMERCIAL_DISPLAY')return null;
  if(typeof frame.provider!=='string'||!id.test(frame.provider))return null;
  if(typeof frame.radarId!=='string'||!id.test(frame.radarId))return null;
  if(typeof frame.calibrationId!=='string'||!id.test(frame.calibrationId))return null;
  if(typeof frame.sourceUrl!=='string'||!/^https:\/\/[^\s]+$/.test(frame.sourceUrl))return null;
  const time=Date.parse(frame.observedAt);
  if(!Number.isFinite(time)||time>now||now-time>maxAgeMs)return null;
  if(!Array.isArray(frame.cells)||frame.cells.length<1||frame.cells.length>4096)return null;
  const cells=[],keys=new Set();
  for(const cell of frame.cells) {
    if(!cell||!number(cell.latitude,BOUNDS.south,BOUNDS.north)
      ||!number(cell.longitude,BOUNDS.west,BOUNDS.east)
      ||!number(cell.rainRateMmH,0,500)
      ||!number(cell.footprintKm,0.1,10))return null;
    const key=`${cell.latitude.toFixed(5)}:${cell.longitude.toFixed(5)}`;
    if(keys.has(key))return null;
    keys.add(key);
    cells.push(Object.freeze({
      latitude:cell.latitude,longitude:cell.longitude,
      rainRateMmH:cell.rainRateMmH,footprintKm:cell.footprintKm,
      kind:'MEASURED_CALIBRATED_RADAR_CELL',
    }));
  }
  return Object.freeze({
    provider:frame.provider,radarId:frame.radarId,
    calibrationId:frame.calibrationId,observedAt:new Date(time).toISOString(),
    sourceUrl:frame.sourceUrl,method:'ORIGINAL_BLAISE_GEOGRAPHIC_RENDER',
    dataType:'MEASURED_CALIBRATED_RADAR_CELLS',isForecast:false,
    calibrationSource:frame.calibrationSource||null,
    cells:Object.freeze(cells),
  });
}

/** Keep only a bounded 30-minute replay window with measurements <=5 min old
 * for the currently displayed frame. Historic frames may be up to 30min old
 * only when a newest frame within 5min is also present. */
export function prepareRjRadarTimeline({
  frames=[],now=Date.now(),displayLastMinutes=30,
}={}) {
  if(!Array.isArray(frames)||frames.length>12||!Number.isFinite(now)
    ||!Number.isInteger(displayLastMinutes)||displayLastMinutes!==30)
    return invalid('INVALID_FRAME_ENVELOPE');
  const accepted=[];
  for(const item of frames) {
    const normalized=normalizedFrame(item,now,displayLastMinutes*60_000);
    if(!normalized)return invalid('UNVERIFIED_OR_INVALID_REAL_RADAR_GRID');
    accepted.push(normalized);
  }
  if(!accepted.length)return invalid('NO_AUTHORIZED_RADAR_GRID_INPUT');
  accepted.sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
  if(new Set(accepted.map(x=>x.observedAt)).size!==accepted.length)
    return invalid('DUPLICATE_RADAR_FRAME_TIME');
  if(new Set(accepted.map(x=>`${x.provider}:${x.radarId}:${x.calibrationId}`)).size!==1)
    return invalid('INCOMPATIBLE_RADAR_OR_CALIBRATION');
  if(now-Date.parse(accepted.at(-1).observedAt)>5*60_000)
    return invalid('CURRENT_RADAR_FRAME_NOT_FRESH');
  return Object.freeze({
    status:'AVAILABLE_VERIFIED_RADAR_GRID_FRAMES',
    contract:RJ_RADAR_SPATIAL_LAYER_CONTRACT,
    newestFrameAt:accepted.at(-1).observedAt,
    frames:Object.freeze(accepted),
    sourceImageCopied:false,syntheticPixelsGenerated:false,
    provenanceVerified:true,
    warningsAuthorized:false,
    stationAverageUsedAsRadar:false,
  });
}
