/**
 * Blaise V6 RJ — internal, fail-closed O/E/P weather parameter audit.
 *
 * This is NOT a data collector or a subscriber endpoint. Only trusted backend
 * adapters may create records. No provider name alone implies data availability.
 * Missing fields remain null; model forecasts are never station observations.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

const sources = Object.freeze({
  // INMET and CEMADEN deliberately absent: internal Brazilian comparison
  // inputs are not eligible as data suppliers to Blaise V6 RJ.
  DWD_ICON_GLOBAL: 'P', NOAA_GFS: 'P', ECMWF_IFS: 'P', INPE_CPTEC: 'P',
  NOAA_GFS_WAVE: 'P', ECMWF_WAVE: 'P', NOAA_RTOFS: 'P', NOAA_UVI: 'P',
  NOAA_GLM: 'O', JAXA_GSMAP: 'E', NASA_GPM_IMERG: 'E',
  EUMETSAT_SAT: 'O', EUMETSAT_OSI_SAF_SST: 'E',
  NOAA_COASTWATCH_SST: 'E', NASA_MUR_SST: 'E',
  // User-authorized 17/11/2026: Copernicus CAMS strictly via MET Norway/Yr
  // for the clear-sky UV product; not a direct Copernicus collector.
  COPERNICUS_CAMS_UV_VIA_MET_NO: 'P',
  NASA_SAT: 'O', ANA_RIVER: 'O', SGB_SACE: 'O',
});
export const RJ_METEOROLOGY_SOURCE_CATEGORIES = sources;

// Field-to-product compatibility is a candidate catalogue, not a connection.
// Each entry is [source ID, O/E/P]. Some derived/model-assisted quantities
// legitimately use E rather than the model's usual forecast category P.
const definitions = [
  ['temperatureC','°C',-60,65,[['DWD_ICON_GLOBAL','P'],['NOAA_GFS','P'],['ECMWF_IFS','P'],['INPE_CPTEC','P']]],
  ['feelsLikeC','°C',-80,80,[['DWD_ICON_GLOBAL','E'],['NOAA_GFS','E'],['ECMWF_IFS','E']]],
  ['humidityPct','%',0,100,[['DWD_ICON_GLOBAL','P'],['NOAA_GFS','P'],['ECMWF_IFS','P']]],
  ['uvIndex','index',0,25,[['NOAA_UVI','P']]],
  ['uvClearSkyIndex','index',0,25,[['COPERNICUS_CAMS_UV_VIA_MET_NO','P']]],
  // MET Norway uses ECMWF forecast: same ECMWF model, not extra independent input.
  ['rainNextHourForecastMm','mm',0,500,[['ECMWF_IFS','P'],['NOAA_GFS','P'],['DWD_ICON_GLOBAL','P']]],
  ['rainNextHourProbabilityPct','%',0,100,[['ECMWF_IFS','P']]],
  ['dewPointC','°C',-90,65,[['DWD_ICON_GLOBAL','E'],['NOAA_GFS','E'],['ECMWF_IFS','E']]],
  ['pressureHpa','hPa',800,1100,[['DWD_ICON_GLOBAL','P'],['NOAA_GFS','P'],['ECMWF_IFS','P']]],
  ['windKmh','km/h',0,400,[['DWD_ICON_GLOBAL','P'],['NOAA_GFS','P'],['ECMWF_IFS','P']]],
  ['gustKmh','km/h',0,504,[['DWD_ICON_GLOBAL','P'],['NOAA_GFS','P'],['ECMWF_IFS','P']]],
  ['rainNowMm','mm',0,500,[]],
  ['rainAccumulatedMm','mm',0,2500,[['JAXA_GSMAP','E'],['NASA_GPM_IMERG','E']]],
  ['oceanRainMm','mm',0,2500,[['JAXA_GSMAP','E'],['NASA_GPM_IMERG','E']]],
  ['cloudPct','%',0,100,[['EUMETSAT_SAT','O'],['NASA_SAT','O'],['DWD_ICON_GLOBAL','P'],['NOAA_GFS','P']]],
  ['visibilityKm','km',0,250,[['DWD_ICON_GLOBAL','P'],['NOAA_GFS','P']]],
  ['solarRadiationWm2','W/m²',0,1800,[['DWD_ICON_GLOBAL','P'],['NOAA_GFS','P']]],
  ['lightningCount','count',0,1000000,[['NOAA_GLM','O']]],
  ['hailProbabilityPct','%',0,100,[['ECMWF_IFS','P'],['DWD_ICON_GLOBAL','P'],['NOAA_GFS','P']]],
  ['cycloneLandRiskPct','%',0,100,[['ECMWF_IFS','E'],['NOAA_GFS','E']]],
  ['cycloneSeaRiskPct','%',0,100,[['ECMWF_IFS','E'],['NOAA_GFS','E']]],
  ['waveHeightM','m',0,35,[['NOAA_GFS_WAVE','P'],['ECMWF_WAVE','P']]],
  ['swellPeriodS','s',0,40,[['NOAA_GFS_WAVE','P'],['ECMWF_WAVE','P']]],
  ['seaCurrentMs','m/s',0,10,[['NOAA_RTOFS','P']]],
  // Every sea-surface temperature here is a satellite retrieval or L4 estimate.
  // Two GOES-East/ABI processors are not independent sensors.
  ['seaSurfaceTemperatureC','°C',-5,45,[['EUMETSAT_OSI_SAF_SST','E'],
    ['NOAA_COASTWATCH_SST','E'],['NASA_MUR_SST','E']]],
  ['riverLevelM','m',-50,200,[['ANA_RIVER','O'],['SGB_SACE','O']]],
  ['hydrologicalRiskLevel','level',1,5,[]],
];
export const RJ_METEOROLOGICAL_FIELDS = Object.freeze(definitions.map(
  ([id,unit,min,max,candidates])=>Object.freeze({
    id,unit,min,max,candidates:Object.freeze(candidates.map(
      ([sourceId,category])=>Object.freeze({sourceId,category})
    )),
  })
));
const byField=new Map(RJ_METEOROLOGICAL_FIELDS.map(field=>[field.id,field]));
const ibges=new Set(RJ_MUNICIPALITIES.map(m=>m.ibge));
const isoTime=(str,now,maxAge)=> {
  if(typeof str!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(str))return false;
  const t=Date.parse(str);
  return Number.isFinite(t)&&t<=now&&now-t<=maxAge;
};
const hasFreshValue=(record,now)=>{
  if(!record||typeof record!=='object')return false;
  const field=byField.get(record.field);
  if(!field||!ibges.has(String(record.ibge)))return false;
  if(!field.candidates.some(c=>c.sourceId===record.sourceId&&c.category===record.category))return false;
  if(record.verifiedByBackend!==true||record.commercialUseAuthorized!==true||
     record.municipalityGeoVerified!==true)return false;
  if(typeof record.sourceUrl!=='string'||!/^https:\/\/[^\s]+$/.test(record.sourceUrl))return false;
  if(!isoTime(record.checkedAt,now,12*60_000))return false;
  const maxAge=record.category==='O'?12*60_000:12*60*60_000;
  if(!isoTime(record.validAt,now,maxAge))return false;
  if(record.category!=='O'&&!isoTime(record.issuedAt,now,12*60*60_000))return false;
  if(typeof record.value!=='number'||!Number.isFinite(record.value)||record.value<field.min||record.value>field.max)return false;
  if(['count','level'].includes(field.unit)&&!Number.isInteger(record.value))return false;
  // Explicit model run/underlying dataset must be known, even if a web viewer
  // repackages the same model. The viewer itself cannot enter this allowlist.
  if(record.category!=='O'&&
     (typeof record.datasetId!=='string'||record.datasetId.trim().length<3))return false;
  return true;
};

/**
 * For trusted ADMIN-side analysis ONLY; never send audit/records to subscriber.
 * Entries for unconnected products remain UNAVAILABLE and value null.
 */
export function buildInternalRjMeteorologyCoverage(records=[],{now=Date.now()}={}){
  if(!Array.isArray(records)||!Number.isSafeInteger(now)||now<0)
    throw new TypeError('invalid_rj_meteorology_coverage_input');
  const selected=new Map();
  const rejected=[];
  for(const record of records){
    if(!hasFreshValue(record,now)){
      rejected.push({ibge:typeof record?.ibge==='string'?record.ibge:null,field:typeof record?.field==='string'?record.field:null});
      continue;
    }
    const key=record.ibge+'|'+record.field;
    const current=selected.get(key);
    // Prefer O over modelled E/P, then newer validAt. Do not average or invent.
    if(!current||((current.category!=='O'&&record.category==='O')||
      (record.category===current.category&&Date.parse(record.validAt)>Date.parse(current.validAt)))){
      selected.set(key,record);
    }
  }
  const fields=RJ_METEOROLOGICAL_FIELDS.map(field=>{
    let covered=0;
    for(const city of RJ_MUNICIPALITIES){
      if(selected.has(city.ibge+'|'+field.id))covered++;
    }
    return Object.freeze({
      field:field.id,unit:field.unit,coveredMunicipalities:covered,
      unavailableMunicipalities:RJ_MUNICIPALITIES.length-covered,
      state:covered===92?'FULL':covered===0?'UNAVAILABLE':'PARTIAL',
    });
  });
  return Object.freeze({
    contract:'RJ_METEOROLOGY_ADMIN_COVERAGE_V1',scope:'ADMIN_ONLY',
    municipalityCount:RJ_MUNICIPALITIES.length,fieldCount:fields.length,
    evaluatedAt:new Date(now).toISOString(),
    verifiedValueCount:selected.size,rejectedRecordCount:rejected.length,
    fields:Object.freeze(fields),
    // No user location, client IDs, raw station payload or paid-provider key.
    clientLocationStored:false,
    publishedToSubscriber:false,automaticProviderCalls:false,
  });
}
