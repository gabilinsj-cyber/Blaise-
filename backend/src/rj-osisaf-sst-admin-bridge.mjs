/**
 * Blaise V6 RJ private OSI SAF SST evidence gate.
 * Consumes a previously obtained GOES-19 OSI-207-c NetCDF quality-checked
 * scientific probe. SST (E) is NOT land temperature, sensor buoy O, or a
 * municipality measurement. No network, scheduler, secrets or public route.
 */
export const RJ_SST_OFFSHORE_POINTS=Object.freeze([
  Object.freeze({id:'ILHA_GRANDE_OFFSHORE',latitude:-23.4,longitude:-44.5}),
  Object.freeze({id:'RIO_OFFSHORE',latitude:-23.5,longitude:-43.25}),
  Object.freeze({id:'CABO_FRIO_OFFSHORE',latitude:-23.25,longitude:-42.0})
]);
const nearest=(a,b)=>typeof a==='number'&&Number.isFinite(a)&&
  typeof b==='number'&&Number.isFinite(b)&&Math.abs(a-b)<=0.075;
const validSource=url=>{
  try{
    const u=new URL(url);
    return u.protocol==='https:'&&u.hostname==='osi-saf.ifremer.fr'&&
      u.pathname.startsWith('/sst/l3c/west_atlantic_east_pacific/')&&
      /\.nc4?$/i.test(u.pathname)&&!u.username&&!u.password&&
      !u.search&&!u.hash;
  }catch{return false;}
};
const unavailable=(reason)=>Object.freeze({
  contract:'BLAISE_RJ_SST_OFFSHORE_ADMIN_AUDIT_V1',
  state:'UNAVAILABLE',reason,
  sourceId:'EUMETSAT_OSI_SAF_SST',productId:'OSI-207-c',kind:'E',
  acceptedPointCount:0,records:Object.freeze([]),
  sensorType:'SATELLITE_GHRSST_SUBSKIN_DERIVED',
  airTemperatureMeasurements:0,municipalityObservations:0,
  publishedToAndroid:false,publishedToSubscribers:false,
  automaticCollection:false
});
export function verifyRjOsiSafSstAdmin(snapshot,{
  now=Date.now(),commercialUseAttributionReviewed=false
}={}){
  if(commercialUseAttributionReviewed!==true||
    !Number.isSafeInteger(now)||now<0||
    snapshot?.contract!=='BLAISE_OSI_SAF_207C_RJ_SST_OFFSHORE_V1'||
    !['FULL','PARTIAL'].includes(snapshot.status)||
    snapshot.sourceId!=='EUMETSAT_OSI_SAF_SST'||
    snapshot.productId!=='OSI-207-c'||snapshot.kind!=='E'||
    snapshot.measuredAsAirTemperature!==false||
    snapshot.publishedToAndroid!==false||snapshot.publishedToSubscriber!==false||
    snapshot.automaticCollection!==false||
    snapshot.oceanPoints!==3||!Array.isArray(snapshot.points)||
    snapshot.points.length!==3||
    snapshot.qualityThreshold!==4||
    snapshot.gridType!=='GHRSST_L3C_1D_LATLON'||
    snapshot.requiredAttribution!=='EUMETSAT OSI SAF, OSI-207-c, CC BY 4.0'||
    !validSource(snapshot.sourceUrl))
    return unavailable('SOURCE_ID_LICENSE_OR_FORMAT_NOT_APPROVED');
  const checked=Date.parse(snapshot.checkedAt),valid=Date.parse(snapshot.validAt);
  if(!Number.isFinite(checked)||!Number.isFinite(valid)||
     valid>checked||checked>now||now-checked>12*60_000||
     checked-valid>12*3600_000)
    return unavailable('SST_TIME_STALE');
  const result=[];
  for(let i=0;i<RJ_SST_OFFSHORE_POINTS.length;i++){
    const expected=RJ_SST_OFFSHORE_POINTS[i],p=snapshot.points[i];
    if(p?.id!==expected.id||p.latitude!==expected.latitude||
       p.longitude!==expected.longitude||
       !nearest(p.dataLatitude,expected.latitude)||
       !nearest(p.dataLongitude,expected.longitude))
      return unavailable('SST_COORDINATES_NOT_APPROVED');
    if(p.temperatureC===null){
      if(p.qualityLevel!==null)return unavailable('SST_MISSING_QA_INCONSISTENT');
      continue;
    }
    if(typeof p.temperatureC!=='number'||!Number.isFinite(p.temperatureC)||
       p.temperatureC< -3||p.temperatureC>40||
       !Number.isInteger(p.qualityLevel)||p.qualityLevel<4||
       p.qualityLevel>5)
      return unavailable('SST_INVALID_TEMPERATURE_OR_QA');
    result.push(Object.freeze({
      pointId:p.id,latitude:p.latitude,longitude:p.longitude,
      actualDataLatitude:p.dataLatitude,actualDataLongitude:p.dataLongitude,
      field:'seaSurfaceTemperatureC',value:p.temperatureC,unit:'°C',
      sourceId:'EUMETSAT_OSI_SAF_SST',productId:'OSI-207-c',
      category:'E',qualityLevel:p.qualityLevel,
      datasetId:'GOES19_ABI_GHRSST_L3C_0P05',
      validAt:snapshot.validAt,checkedAt:snapshot.checkedAt,
      sourceUrl:snapshot.sourceUrl,physicalStationObservation:false
    }));
  }
  if(snapshot.verifiedPoints!==result.length||
     (snapshot.status==='FULL')!==(result.length===3))
    return unavailable('SST_VERIFIED_COUNT_MISMATCH');
  return Object.freeze({
    ...unavailable('NONE'),
    state:result.length===3?'FULL':'PARTIAL',
    reason:null,acceptedPointCount:result.length,
    records:Object.freeze(result)
  });
}
