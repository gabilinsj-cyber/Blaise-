/**
 * Blaise V6 RJ: user-approved radar source exclusions.
 *
 * RainViewer is NOT an operational feed, commercial fallback, tile provider,
 * image supplier or radar pixel source for the native Blaise map.
 * SOS Chuva was separately excluded. Reject disguised/mirrored upstreams.
 * This policy does not block NOAA, DWD, MET Norway or appropriately licensed
 * independent physical radar grids.
 */
import {isExcludedSosChuvaProduct} from './rj-sos-chuva-exclusion.mjs';

export const RJ_RAINVIEWER_POLICY=Object.freeze({
  sourceId:'RAINVIEWER',
  state:'EXCLUDED_FROM_BLAISE_RJ',
  automaticDataCollection:false,
  radarFrames:false,
  mapTiles:false,
  fallback:false,
  externalReference:false,
  freeApiLicensedForBlaiseCommercialUse:false,
  docsUrl:'https://www.rainviewer.com/api.html'
});

const SOURCE_FIELDS=Object.freeze([
  'sourceId','originalSourceId','originalProducerId','provider','productId',
  'upstreamProductId','radarId','licenseProvider'
]);
const URL_FIELDS=Object.freeze([
  'sourceUrl','originalSourceUrl','upstreamUrl','productUrl',
  'radarUrl','mapTileUrl','imageUrl'
]);
const normalId=s=>typeof s==='string'?
  s.trim().toUpperCase().replace(/[\s-]+/g,'_'):null;
function rainViewerId(value){
  const valueId=normalId(value);
  return valueId==='RAINVIEWER'||valueId==='RAIN_VIEWER'||
    valueId?.startsWith('RAINVIEWER_')||valueId?.startsWith('RAIN_VIEWER_');
}
function rainViewerUrl(value){
  if(typeof value!=='string')return false;
  try{
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    return host==='rainviewer.com'||host.endsWith('.rainviewer.com')||
      host==='rainviewer.net'||host.endsWith('.rainviewer.net');
  }catch{return false;}
}
/** Bounded upstream provenance traversal; no arbitrary or network-based discovery. */
export function isExcludedRjRadarProduct(record){
  if(!record||typeof record!=='object'||Array.isArray(record))return false;
  const queue=[record],visited=new Set();
  while(queue.length&&visited.size<16){
    const item=queue.shift();
    if(!item||typeof item!=='object'||Array.isArray(item)||visited.has(item))continue;
    visited.add(item);
    if(isExcludedSosChuvaProduct(item)||
      SOURCE_FIELDS.some(key=>rainViewerId(item[key]))||
      URL_FIELDS.some(key=>rainViewerUrl(item[key])))
      return true;
    for(const key of ['provenance','upstream','originalProduct']){
      if(item[key]&&typeof item[key]==='object')queue.push(item[key]);
    }
  }
  // Fail closed for provenance too deep to validate safely.
  return queue.length>0;
}
