/**
 * NOAA STAR/CoastWatch ACSPO GOES-19 L3C SST: strict private marine gate.
 * NOAA-only single-satellite source. It must not be counted twice.
 * A real high-QA NetCDF cell is required; otherwise SST is unavailable. No subscription
 * API, land temperatures, automatic warning or production publication.
 */
import {RJ_SST_OFFSHORE_POINTS} from './rj-osisaf-sst-admin-bridge.mjs';
function allowed(url){
  try{
    const u=new URL(url);
    return u.protocol==='https:'&&u.hostname==='coastwatch.noaa.gov'&&
      u.pathname.startsWith('/data/pub0014/coastwatch/sst/nrt/abi/g19/l3c/')&&
      /-STAR-L3C_GHRSST-.*-ABI_G19-ACSPO_.*\.nc$/.test(u.pathname)&&
      !u.username&&!u.password&&!u.search&&!u.hash;
  }catch{return false;}
}
const fail=reason=>Object.freeze({
  contract:'BLAISE_RJ_NOAA_ACSPO_SST_ADMIN_V1',
  state:'UNAVAILABLE',reason,approvedValues:0,records:Object.freeze([]),
  sourceId:'NOAA_COASTWATCH_SST',kind:'E',
  singleSatelliteSource:true,
  airTemperatureMeasurements:0,municipalityMeasurements:0,
  publishedToSubscribers:false,publishedToAndroid:false
});
export function verifyRjNoaaCoastwatchSst(proof,{
  now=Date.now(),rightsAttributionReviewed=false
}={}){
  if(rightsAttributionReviewed!==true||!Number.isSafeInteger(now)||now<0||
    proof?.contract!=='BLAISE_NOAA_ACSPO_G19_RJ_SST_OFFSHORE_V1'||
    !['FULL','PARTIAL'].includes(proof.status)||
    proof.sourceId!=='NOAA_COASTWATCH_SST'||
    proof.productId!=='GOES19_ABI_ACSPO_L3C'||
    proof.satelliteFamily!=='GOES19_ABI'||
    proof.singleSourceNoDoubleCount!==true||
    proof.kind!=='E'||proof.officialObservation!==false||
    proof.airTemperatureMeasurements!==0||
    proof.publishedToAndroid!==false||proof.publishedToSubscriber!==false||
    proof.automaticCollection!==false||
    proof.qualityThreshold!==5||
    proof.gridType!=='GHRSST_L3C_1D_LATLON'||
    proof.attribution!=='NOAA CoastWatch / NOAA STAR ACSPO'||
    !allowed(proof.sourceUrl)||proof.expectedPoints!==3||
    !Array.isArray(proof.points)||proof.points.length!==3)
    return fail('NOAA_ACSPO_NOT_AUTHORIZED');
  const checked=Date.parse(proof.checkedAt),valid=Date.parse(proof.validAt);
  if(![checked,valid].every(Number.isFinite)||
     valid>checked||checked>now||now-checked>12*60_000||
     checked-valid>12*3600_000)
    return fail('NOAA_ACSPO_STALE');
  const accepted=[];
  for(let i=0;i<RJ_SST_OFFSHORE_POINTS.length;i++){
    const target=RJ_SST_OFFSHORE_POINTS[i],p=proof.points[i];
    if(!p||p.id!==target.id||p.latitude!==target.latitude||
       p.longitude!==target.longitude||
       !Number.isFinite(p.dataLatitude)||!Number.isFinite(p.dataLongitude)||
       Math.abs(p.dataLatitude-target.latitude)>0.075||
       Math.abs(p.dataLongitude-target.longitude)>0.075)
      return fail('NOAA_ACSPO_GRID_CELL_MISMATCH');
    if(p.temperatureC===null){
      if(p.qualityLevel!==null)return fail('NOAA_ACSPO_MISSING_CELL_MISMATCH');
      continue;
    }
    if(typeof p.temperatureC!=='number'||!Number.isFinite(p.temperatureC)||
       p.temperatureC< -3||p.temperatureC>40||p.qualityLevel!==5)
      return fail('NOAA_ACSPO_INVALID_QUALITY_OR_VALUE');
    accepted.push(Object.freeze({
      pointId:p.id,latitude:p.latitude,longitude:p.longitude,
      field:'seaSurfaceTemperatureC',value:p.temperatureC,
      unit:'°C',sourceId:'NOAA_COASTWATCH_SST',
      datasetId:'GOES19_ABI_ACSPO_L3C',category:'E',
      qualityLevel:5,issuedAt:proof.validAt,
      validAt:proof.validAt,checkedAt:proof.checkedAt,
      sourceUrl:proof.sourceUrl,notAtmosphericTemperature:true,
      singleSatelliteSource:true,observedByBuoy:false
    }));
  }
  if(accepted.length!==proof.verifiedPoints||
    (proof.status==='FULL')!==(accepted.length===3))
    return fail('NOAA_ACSPO_COUNT_MISMATCH');
  return Object.freeze({
    ...fail(null),state:accepted.length===3?'FULL':'PARTIAL',
    reason:null,approvedValues:accepted.length,records:Object.freeze(accepted)
  });
}
