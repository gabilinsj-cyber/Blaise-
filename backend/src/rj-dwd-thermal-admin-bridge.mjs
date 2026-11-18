/**
 * Admin-only DWD ICON 2m forecast adapter for the existing RJ O/E/P audit.
 * Accepts exclusively the real, numeric, geo-verified DWD CDO staging proof.
 * No network, scheduler, secret, database, customer endpoint or publication.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
import {DWD_ICON_OFFICIAL_WEIGHTS_URL,DWD_WEIGHTS_LEGACY_CUTOFF_UTC} from './rj-dwd-icon-regrid.mjs';
const byCode=new Map(geo.points.map(p=>[p.ibge,p]));
const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
const validTime=(x)=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const allowedUrl=(x)=>{
 try{
   const u=new URL(x);
   return u.protocol==='https:'&&u.hostname==='opendata.dwd.de'&&
     (/(?:^\/weather\/nwp\/v1\/m\/icon\/p\/T_2M\/r\/20\d{2}-\d\d-\d\dT(?:00|06|12|18)%3A00\/s\/PT\d{3}H00M\.grib2$)/i.test(u.pathname)||
      /^\/weather\/nwp\/icon\/grib\/(00|06|12|18)\/t_2m\/icon_global_icosahedral_single-level_20\d{8}_\d{3}_T_2M\.grib2\.bz2$/.test(u.pathname))&&
     !u.username&&!u.password&&!u.search&&!u.hash;
 }catch{return false;}
};
export function auditedDwdThermalRecord(proof,{
  now=Date.now(),dwdRightsReviewed=false
}={}){
  if(dwdRightsReviewed!==true||!Number.isSafeInteger(now)||now<0||
     proof?.contract!=='BLAISE_DWD_ICON_GLOBAL_RJ_NUMERIC_STAGING_V1'||
     proof.status!=='DWD_MODEL_POINT_VALIDATED'||
     proof.sourceId!=='DWD_ICON_GLOBAL'||proof.kind!=='P'||
     proof.unit!=='°C'||proof.officialObservation!==false||
     proof.officialAlert!==false||proof.productionChanged!==false||
     proof.publishedToAndroid!==false||proof.gridResolutionDegrees!==0.25||
     proof.gridInterpolation!=='DWD_OFFICIAL_CDO_PRECOMPUTED_WEIGHTS'||
     proof.gridWeightsUrl!==DWD_ICON_OFFICIAL_WEIGHTS_URL||
     !allowedUrl(proof.sourceUrl)||
     (now>=DWD_WEIGHTS_LEGACY_CUTOFF_UTC&&(
       proof.distribution!=='DWD_V1_NATIVE_GRIB2'||
       proof.postSunsetReady!==true||
       proof.weightsMode!=='PINNED_OFFICIAL_ARCHIVE'))||
     !finite(proof.valueC,-60,65)||
     !validTime(proof.validAt)||!validTime(proof.issuedAt)||
     !validTime(proof.checkedAt))return null;
  const place=byCode.get(String(proof.ibge));
  if(!place||!place.verifiedByBackend||
     !finite(proof.latitude,-25,-20)||!finite(proof.longitude,-46,-40)||
     Math.abs(proof.latitude-place.lat)>0.00001||
     Math.abs(proof.longitude-place.lon)>0.00001)return null;
  const issued=Date.parse(proof.issuedAt),valid=Date.parse(proof.validAt),
    checked=Date.parse(proof.checkedAt);
  if(issued>valid||valid>checked||checked>now||
     now-checked>12*60_000||now-valid>90*60_000||
     checked-issued>12*60*60_000)return null;
  return Object.freeze({
    ibge:place.ibge,field:'temperatureC',value:proof.valueC,
    sourceId:'DWD_ICON_GLOBAL',category:'P',
    datasetId:'ICON_GLOBAL_2M',
    sourceUrl:proof.sourceUrl,
    issuedAt:proof.issuedAt,validAt:proof.validAt,checkedAt:proof.checkedAt,
    verifiedByBackend:true,commercialUseAuthorized:true,
    municipalityGeoVerified:true,
  });
}
