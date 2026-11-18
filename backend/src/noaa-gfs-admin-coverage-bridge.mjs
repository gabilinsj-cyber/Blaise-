/**
 * Trusted ADMIN-only bridge from a verified NOAA GFS statewide model proof
 * to Blaise's existing O/E/P completeness audit. This does not create a
 * subscriber route, fetch external data, or authorize production publication.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
const geoById=new Map(geo.points.map(x=>[x.ibge,x]));
const valid=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const time=(v)=>typeof v==='string'?Date.parse(v):NaN;
const sourceUrlValid=(url)=>{
  try{
    const p=new URL(url);
    return p.protocol==='https:'&&p.hostname==='nomads.ncep.noaa.gov'&&
      p.pathname==='/cgi-bin/filter_gfs_0p25.pl'&&
      p.searchParams.get('var_TMP')==='on'&&
      p.searchParams.get('lev_2_m_above_ground')==='on'&&
      p.searchParams.get('subregion')===''&&
      !p.username&&!p.password;
  }catch{return false;}
};
export function modelGridToAdminTemperatureRecords(batch,{
  now=Date.now(),modelRightsReviewed=false
}={}){
  if(modelRightsReviewed!==true||!Number.isSafeInteger(now)||now<0||
     batch?.contract!=='RJ_NOAA_GFS_ATMOS_92_STAGING_V1'||
     !['FULL','PARTIAL'].includes(batch?.state)||
     batch?.kind!=='P'||batch?.sourceId!=='NOAA_GFS'||
     batch?.datasetId!=='GFS_0P25_TMP_2M'||
     batch?.modelNotStation!==true||batch?.officialObservation!==false||
     batch?.publishedToAndroid!==false||batch?.productionChanged!==false||
     !sourceUrlValid(batch?.sourceUrl)||batch?.municipalityCount!==92||
     !Array.isArray(batch?.records)||batch.records.length>92||
     batch?.verifiedMunicipalities!==batch.records.length||
     batch?.missingMunicipalities!==92-batch.records.length)
     return Object.freeze([]);
  const issued=time(batch.issuedAt),validAt=time(batch.validAt),checked=time(batch.checkedAt);
  if(![issued,validAt,checked].every(Number.isFinite)||issued>validAt||
     validAt>checked||checked>now||now-checked>12*60_000||
     checked-validAt>=3*60*60_000||checked-issued>12*60*60_000)
     return Object.freeze([]);
  const used=new Set(),trusted=[];
  for(const row of batch.records){
    const p=geoById.get(row?.ibge);
    if(!p||used.has(row.ibge)||p.verifiedByBackend!==true||
       row.kind!=='P'||row.datasetId!=='GFS_0P25_TMP_2M'||
       row.unit!=='°C'||!valid(row.temperatureC,-60,65)||
       !valid(row.latitude,-25,-20)||!valid(row.longitude,-46,-40)||
       Math.abs(row.latitude-p.lat)>1e-6||Math.abs(row.longitude-p.lon)>1e-6)
      return Object.freeze([]); // untrusted or duplicated bundle: reject all
    used.add(row.ibge);
    trusted.push(Object.freeze({
      field:'temperatureC',ibge:row.ibge,
      sourceId:'NOAA_GFS',category:'P',
      datasetId:'GFS_0P25_TMP_2M',value:row.temperatureC,
      validAt:batch.validAt,issuedAt:batch.issuedAt,
      checkedAt:batch.checkedAt,sourceUrl:batch.sourceUrl,
      verifiedByBackend:true,commercialUseAuthorized:true,
      municipalityGeoVerified:true,
    }));
  }
  return Object.freeze(trusted);
}
