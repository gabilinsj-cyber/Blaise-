/**
 * NOAA GFS 2m air-temperature P forecast for all 92 RJ IBGE polygons.
 * One bounded official NOMADS GRIB2 subset per model cycle (not 92 HTTP calls).
 * Read-only staging: no scheduler, secrets, customer endpoint or publication.
 */
import points from './rj-ibge-92-points.json' with {type:'json'};
import {
  boundedGrib,readGribTemperature,gfsRecentCandidates,rjGfsPoint,
  validateNoaaGfsPoint
} from './noaa-gfs-atmos-collector.mjs';

const targetCodes=Object.freeze(points.points.map(p=>p.ibge));
if(targetCodes.length!==92||new Set(targetCodes).size!==92)
  throw Error('RJ_GFS_GEOMETRY_INVENTORY_INVALID');
const unavailable=(reason,now)=>Object.freeze({
  contract:'RJ_NOAA_GFS_ATMOS_92_STAGING_V1',
  state:'UNAVAILABLE',reason,
  checkedAt:new Date(now).toISOString(),
  municipalityCount:92,verifiedMunicipalities:0,
  missingMunicipalities:92,records:Object.freeze([]),
  sourceId:'NOAA_GFS',kind:'P',modelNotStation:true,
  automaticCollection:false,publishedToAndroid:false,
  productionChanged:false,officialObservation:false
});
export function rjNoaaModelMunicipalityCodes(){
  return targetCodes;
}
/**
 * Runs only when explicitly called. An invalid nearest cell stays null, not 0.
 * No field is called current sensor temperature.
 */
export async function probeNoaaGfsRj92({
  now=Date.now(),fetchImpl=globalThis.fetch,
  download=boundedGrib,decode=readGribTemperature
}={}){
  if(!Number.isSafeInteger(now)||now<0)return unavailable('INVALID_CLOCK',Date.now());
  let lastFailure='NO_VALID_FORECAST_GRID';
  for(const cycle of gfsRecentCandidates(now)){
    let bytes;
    try{bytes=await download(cycle.url,fetchImpl);}
    catch(error){lastFailure=String(error?.message||'GRID_UNAVAILABLE').slice(0,120);continue;}
    if(!Buffer.isBuffer(bytes))return unavailable('INVALID_GRID_BUFFER',now);
    const results=new Array(92);
    let cursor=0;
    const workers=Array.from({length:4},async()=>{
      while(cursor<targetCodes.length){
        const index=cursor++;
        const point=rjGfsPoint(targetCodes[index]);
        if(!point){results[index]=null;continue;}
        try{
          const decoded=await decode(bytes,point);
          const row=validateNoaaGfsPoint(decoded,{point,
            issued:cycle.issued,forecastHour:cycle.forecastHour,
            now,sourceUrl:cycle.url});
          results[index]=row.status==='REAL_MODEL_POINT_VALIDATED'
            ?Object.freeze({ibge:point.ibge,latitude:point.lat,longitude:point.lon,
              temperatureC:row.temperatureC,unit:'°C',
              kind:'P',datasetId:row.datasetId}):null;
        }catch{results[index]=null;}
      }
    });
    await Promise.all(workers);
    const verified=results.filter(Boolean);
    if(verified.length===0){lastFailure='ALL_NEAREST_GRID_VALUES_UNVERIFIED';continue;}
    return Object.freeze({
      contract:'RJ_NOAA_GFS_ATMOS_92_STAGING_V1',
      state:verified.length===92?'FULL':'PARTIAL',
      checkedAt:new Date(now).toISOString(),
      issuedAt:new Date(cycle.issued).toISOString(),
      validAt:new Date(cycle.issued+cycle.forecastHour*3_600_000).toISOString(),
      sourceUrl:cycle.url,sourceId:'NOAA_GFS',datasetId:'GFS_0P25_TMP_2M',
      kind:'P',modelNotStation:true,gridResolutionDegrees:0.25,
      municipalityCount:92,verifiedMunicipalities:verified.length,
      missingMunicipalities:92-verified.length,
      records:Object.freeze(verified),
      automaticCollection:false,publishedToAndroid:false,
      productionChanged:false,officialObservation:false,
    });
  }
  return unavailable(lastFailure,now);
}
