/**
 * Strict, private DWD ICON Global 92-municipality forecast bridge.
 * One official 0.25-degree remapped grid, 92 interior IBGE points.
 * Outputs ONLY audited P records; never station observations, current weather,
 * subscriber payloads or scheduled collection.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
import {auditedDwdThermalRecord} from './rj-dwd-thermal-admin-bridge.mjs';
const officialCodes=new Set(geo.points.map(p=>p.ibge));
const validSource=sourceUrl=>{
  try{
    const u=new URL(sourceUrl);
    return u.protocol==='https:'&&u.hostname==='opendata.dwd.de'&&
      /^\/weather\/nwp\/icon\/grib\/(00|06|12|18)\/t_2m\/icon_global_icosahedral_single-level_20\d{8}_\d{3}_T_2M\.grib2\.bz2$/.test(u.pathname)&&
      !u.search&&!u.hash&&!u.username&&!u.password;
  }catch{return false;}
};
export function approvedDwdIcon92AdminRecords(batch,{
  now=Date.now(),dwdRightsReviewed=false
}={}){
  if(dwdRightsReviewed!==true||!Number.isSafeInteger(now)||now<0||
     batch?.contract!=='BLAISE_DWD_ICON_GLOBAL_RJ_92_STAGING_V1'||
     !['FULL','PARTIAL'].includes(batch.status)||
     batch.municipalityCount!==92||batch.sourceId!=='DWD_ICON_GLOBAL'||
     batch.datasetId!=='ICON_GLOBAL_2M'||batch.kind!=='P'||
     batch.officialObservation!==false||batch.officialAlert!==false||
     batch.municipalityPointsNotPhysicalStations!==true||
     batch.automaticCollection!==false||batch.productionChanged!==false||
     batch.publishedToAndroid!==false||
     batch.networkDownloadsPerForecastGrid!==1||
     !validSource(batch.sourceUrl)||!Array.isArray(batch.records)||
     !Array.isArray(batch.missingMunicipalityCodes)||
     batch.verifiedMunicipalities!==batch.records.length||
     batch.missingMunicipalities!==batch.missingMunicipalityCodes.length||
     batch.verifiedMunicipalities+batch.missingMunicipalities!==92||
     (batch.status==='FULL')!==(batch.verifiedMunicipalities===92))
    return Object.freeze([]);
  const codes=new Set(),records=[];
  for(const entry of batch.records){
    if(!officialCodes.has(entry?.ibge)||codes.has(entry.ibge)||
       entry.sourceId!=='DWD_ICON_GLOBAL'||entry.kind!=='P'||entry.unit!=='°C')
      return Object.freeze([]);
    codes.add(entry.ibge);
    // The one-city bridge verifies geometry, CDO weights, model timestamp,
    // product URL and value independently for every city.
    const record=auditedDwdThermalRecord({
      ...batch,...entry,
      contract:'BLAISE_DWD_ICON_GLOBAL_RJ_NUMERIC_STAGING_V1',
      status:'DWD_MODEL_POINT_VALIDATED'
    },{now,dwdRightsReviewed:true});
    if(!record)return Object.freeze([]);
    records.push(record);
  }
  for(const code of batch.missingMunicipalityCodes){
    if(!officialCodes.has(code)||codes.has(code))return Object.freeze([]);
    codes.add(code);
  }
  if(codes.size!==92)return Object.freeze([]);
  return Object.freeze(records);
}
