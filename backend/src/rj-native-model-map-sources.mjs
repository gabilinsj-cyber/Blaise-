/**
 * Blaise V6 RJ: numeric model input for the EXISTING native map.
 * NOAA/GFS and DWD/ICON use direct, authorized source products. Nullschool is
 * a useful external viewer, NOT a third numerical feed or a second GFS model.
 * No request, polling, map tile copying, or GRIB2 decoding starts on import.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

export const RJ_MAP_MODEL_FEED_CONTRACT='BLAISE_RJ_NATIVE_MAP_MODEL_FORECAST_V1';
export const RJ_NULLSCHOOL_VISUAL_REFERENCE=Object.freeze({
  id:'EARTH_NULLSCHOOL',
  name:'Earth Nullschool — visualização externa',
  url:'https://earth.nullschool.net/',
  aboutUrl:'https://earth.nullschool.net/about',
  codeUrl:'https://github.com/cambecc/earth',
  codeLicense:'MIT (published source code; not a blanket data licence)',
  role:'ADMIN_EXTERNAL_VISUAL_COMPARISON_ONLY',
  numericalSource:false,
  independentFromNoaaGfs:false,
  commercialDataReuseVerified:false,
  tilesOrImageCopyPermitted:false,
  extraSourceNote:'Some Nullschool ocean layers use non-NOAA providers; inspect each product independently.'
});
export const RJ_NATIVE_MODEL_SOURCES=Object.freeze({
  NOAA_GFS:Object.freeze({
    id:'NOAA_GFS',model:'GFS',kind:'NUMERIC_MODEL_FORECAST',
    allowedHost:'nomads.ncep.noaa.gov',
    dataIndex:'https://www.nco.ncep.noaa.gov/pmb/products/gfs/nomads/',
    maxLeadHours:384,credit:'NOAA / NCEP — GFS via NOMADS'
  }),
  DWD_ICON_GLOBAL:Object.freeze({
    id:'DWD_ICON_GLOBAL',model:'ICON_GLOBAL',kind:'NUMERIC_MODEL_FORECAST',
    allowedHost:'opendata.dwd.de',
    dataIndex:'https://opendata.dwd.de/weather/nwp/icon/grib/',
    maxLeadHours:180,credit:'Deutscher Wetterdienst (DWD) — ICON Global, CC BY 4.0'
  })
});
const RJ_CODES=new Set(RJ_MUNICIPALITIES.map(x=>String(x.ibge)));
const METRICS=Object.freeze({
  TEMPERATURE_2M_C:Object.freeze({unit:'°C',minimum:-50,maximum:65}),
  WIND_SPEED_10M_KMH:Object.freeze({unit:'km/h',minimum:0,maximum:350}),
  RELATIVE_HUMIDITY_2M:Object.freeze({unit:'%',minimum:0,maximum:100}),
  PRESSURE_MSL_HPA:Object.freeze({unit:'hPa',minimum:850,maximum:1100}),
  RAIN_ACCUMULATION_MM:Object.freeze({unit:'mm',minimum:0,maximum:1500})
});
const valid=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const fail=(reason)=>Object.freeze({
  status:'UNAVAILABLE',reason,points:Object.freeze([]),isObservation:false,
  radarAvailable:false,officialAlert:false,automaticIngestion:false
});
function isTrustedSourceUrl(url,host){
  try {
    const u=new URL(url);
    return u.protocol==='https:'&&u.hostname===host&&!u.username&&!u.password&&
      !u.port&&!u.hash;
  }catch{return false;}
}
/**
 * SERVER-ONLY: the grant must originate from an operator-verified rights
 * registry; untrusted user-provided grants never confer actual permission.
 * Decoder must independently validate product field, units and grid location.
 */
export function prepareRjNativeModelForecastPoint({
  sample=null,rights=[],now=Date.now()
}={}){
  if(!sample||!Array.isArray(rights)||!Number.isSafeInteger(now)||now<0)
    return fail('INVALID_MODEL_INPUT');
  const src=RJ_NATIVE_MODEL_SOURCES[sample.sourceId];
  if(!src)return fail('EXTERNAL_VIEWER_NOT_NUMERICAL_SOURCE');
  const field=METRICS[sample.metric];
  if(!field||sample.kind!=='DECODED_GRIB2_MODEL_GRID_POINT'||
    sample.dataType!=='MODEL_FORECAST'||sample.unit!==field.unit||
    !valid(sample.value,field.minimum,field.maximum)||
    !RJ_CODES.has(String(sample.ibge))||
    !valid(sample.latitude,-23.37,-20.75)||
    !valid(sample.longitude,-44.9,-40.9)||
    typeof sample.productId!=='string'||sample.productId.length<3||
    typeof sample.modelRunId!=='string'||sample.modelRunId.length<6||
    !isTrustedSourceUrl(sample.sourceUrl,src.allowedHost))
    return fail('INCOMPATIBLE_OR_UNVERIFIED_MODEL_PRODUCT');
  const grant=rights.find(g=>g?.sourceId===sample.sourceId&&
    g.productId===sample.productId&&g.status==='VERIFIED'&&
    g.permission==='COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION'&&
    typeof g.evidenceId==='string'&&g.evidenceId.length>=8&&
    typeof g.attribution==='string'&&g.attribution.length>=8&&
    Number.isFinite(Date.parse(g.validUntil))&&Date.parse(g.validUntil)>now);
  if(!grant)return fail('COMMERCIAL_PRODUCT_RIGHTS_NOT_VERIFIED');
  const run=Date.parse(sample.cycleAt),validAt=Date.parse(sample.validAt);
  if(!Number.isFinite(run)||!Number.isFinite(validAt)||run>now||
    now-run>18*60*60*1000||validAt<run||validAt<now-6*60*60*1000||
    validAt-run>src.maxLeadHours*60*60*1000)
    return fail('MODEL_CYCLE_OR_VALIDITY_OUTSIDE_WINDOW');
  const leadHours=(validAt-run)/3600000;
  if(!Number.isInteger(leadHours))
    return fail('MODEL_FORECAST_LEAD_NOT_HOURLY');
  if(sample.metric==='RAIN_ACCUMULATION_MM'){
    const start=Date.parse(sample.accumulationStart),end=Date.parse(sample.accumulationEnd);
    if(!Number.isFinite(start)||!Number.isFinite(end)||
      end!==validAt||start<run||start>=end||end-start>6*3600000)
      return fail('RAIN_ACCUMULATION_WINDOW_MISSING');
  }
  const point=Object.freeze({
    type:'MODEL_FORECAST_GRID_POINT',sourceId:src.id,model:src.model,
    productId:sample.productId,modelRunId:sample.modelRunId,
    ibge:String(sample.ibge),latitude:sample.latitude,longitude:sample.longitude,
    variable:sample.metric,value:sample.value,unit:field.unit,
    cycleAt:new Date(run).toISOString(),validAt:new Date(validAt).toISOString(),
    forecastLeadHours:leadHours,sourceUrl:sample.sourceUrl,
    sourceCredit:grant.attribution,licenseEvidenceId:grant.evidenceId,
    nativeRenderer:'BLAISE_V6_RJ_NATIVE_GEOGRAPHIC_CANVAS',
    kind:'FORECAST_NOT_STATION_OBSERVATION',
    ...(sample.metric==='RAIN_ACCUMULATION_MM'?{
      accumulationStart:sample.accumulationStart,accumulationEnd:sample.accumulationEnd
    }:{})
  });
  return Object.freeze({
    contract:RJ_MAP_MODEL_FEED_CONTRACT,status:'AVAILABLE_MODEL_FORECAST',
    points:Object.freeze([point]),isObservation:false,
    radarAvailable:false,officialAlert:false,automaticIngestion:false,
    attributionRequired:true,nullschoolIsIndependentSource:false,
    noCopernicusProductRequired:true,
    dataBasis:'DIRECT_NOAA_GFS_OR_DWD_ICON_LICENSED_NUMERIC_PRODUCT',
    originalMapPreserved:true
  });
}
