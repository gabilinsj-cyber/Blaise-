/**
 * meteoblue basic-6h -> trusted PRIVATE forecast comparison.
 * Schema fields derived from official /packages/openapi.json, 2026-11-18.
 * Forecast ≠ observation, 6h precipitation ≠ hourly measured rainfall.
 * Official definitions (meteoblue, weather variables):
 * precipitation = total liquid-water-equivalent forecast accumulated during
 * the preceding period; convective_precipitation = convective part accumulated
 * during that same period. They are distinct source keys and MUST NOT be
 * aliased or derived one from the other. Equal numerical series are possible
 * and require scientific review, not automatic corruption/replacement.
 * See https://docs.meteoblue.com/en/meteo/variables/weather-variables
 * No temperature/feels-like override, no gusts, no storm/official alerts.
 */
export const METEOBLUE_BASIC6H_FIELDS=Object.freeze({
  precipitation:Object.freeze({name:'forecastPrecipitationSixHourMm',unit:'mm',min:0,max:500,meaning:'SIX_HOUR_FORECAST_TOTAL'}),
  convective_precipitation:Object.freeze({name:'forecastConvectivePrecipitationSixHourMm',unit:'mm',min:0,max:500,meaning:'SIX_HOUR_FORECAST_COMPONENT'}),
  precipitation_probability:Object.freeze({name:'forecastPrecipitationProbabilitySixHourPct',unit:'%',min:0,max:100,meaning:'SIX_HOUR_FORECAST_PROBABILITY'}),
  windspeed_mean:Object.freeze({name:'forecastWindMeanSixHourKmh',unit:'km/h',min:0,max:400,meaning:'SIX_HOUR_MEAN_NOT_GUST'}),
  windspeed_max:Object.freeze({name:'forecastWindMaxSixHourKmh',unit:'km/h',min:0,max:400,meaning:'SIX_HOUR_MAX_WIND_SPEED_NOT_GUST'}),
  relativehumidity_mean:Object.freeze({name:'forecastHumidityMeanSixHourPct',unit:'%',min:0,max:100,meaning:'SIX_HOUR_MEAN'}),
  sealevelpressure_mean:Object.freeze({name:'forecastSeaLevelPressureMeanSixHourHpa',unit:'hPa',min:800,max:1100,meaning:'SIX_HOUR_MEAN_SEA_LEVEL_PRESSURE'}),
});
const TIME_RE=/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|\+00:00)?$/;
const fail=(r)=>Object.freeze({status:'UNAVAILABLE',reason:r,sourceId:'METEOBLUE_FREE_FORECAST',forecast:null,publishedToAndroid:false});
const normalizeUtc=(s)=>{
  if(typeof s!=='string'||!TIME_RE.test(s))return null;
  const canonical=s.replace(' ','T').replace(/(?:Z|\+00:00)$/,'');
  const suffix=(canonical.length===16?':00':'')+'Z';
  const d=new Date(canonical+suffix);
  if(!Number.isFinite(d.getTime()))return null;
  // Date.parse normalizes invalid dates such as February 30; do not allow them.
  return d.toISOString().slice(0,19)===canonical+((canonical.length===16)?':00':'')
    ?d.toISOString():null;
};
const unitNorm=(x)=>typeof x==='string'?x.trim().toLowerCase():null;
// Some meteoblue responses use m/s (including ms-1); the Blaise UI uses km/h.
// Normalize only documented/recognized units, never guess from magnitudes.
const windFactor=(given)=>{
 const u=unitNorm(given);
 if(['km/h','kmh'].includes(u))return 1;
 if(['m/s','ms-1','m s-1'].includes(u))return 3.6;
 return null;
};
const matchesUnit=(given,want)=>{
 if(given===undefined||given===null)return false;
 const normalized=unitNorm(given);
 return want==='mm'?normalized==='mm':
   want==='km/h'?windFactor(normalized)!==null:
   want==='hPa'?['hpa','mbar'].includes(normalized):
   want==='%'?['%','percent'].includes(normalized):false;
};
/** Validate units if supplier provides them. Absent unit metadata never earns
 * full scientific homologation; defaults are documented but not asserted here. */
function unitsVerified(units){
 if(!units||typeof units!=='object')return false;
 const groups=[
  [['precipitation'],'mm'],
  [['windspeed','wind_speed'],'km/h'],
  [['relativehumidity'],'%'],
  [['sealevelpressure','pressure'],'hPa']
 ];
 const base=groups.every(([names,expected])=>{
  const name=names.find(n=>Object.hasOwn(units,n));
  return name&&matchesUnit(units[name],expected);
 });
 // Optional individual-unit metadata must never contradict shared units.
 const individual={
  precipitation:'mm',convective_precipitation:'mm',
  precipitation_probability:'%',windspeed_mean:'km/h',
  windspeed_max:'km/h',relativehumidity_mean:'%',
  sealevelpressure_mean:'hPa'
 };
 return base&&Object.entries(individual).every(([name,expected])=>
   !Object.hasOwn(units,name)||matchesUnit(units[name],expected));
}
export function parseMeteoblueBasic6h({payload,ibge,latitude,longitude,nowMs=Date.now()}={}){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    !Number.isSafeInteger(nowMs)||nowMs<0||
    typeof ibge!=='string'||!/^33\d{5}$/.test(ibge))
  return fail('INVALID_CONTRACT');
 const b=payload.data_6h,metadata=payload.metadata;
 if(!b||typeof b!=='object'||!metadata||typeof metadata!=='object'||
    payload.error||payload.error_message||
    !Array.isArray(b.time)||b.time.length<1||b.time.length>80)
  return fail('MISSING_FORECAST_SCHEMA');
 const times=b.time.map(normalizeUtc);
 if(times.some(x=>x===null))return fail('INVALID_TIMESTAMPS');
 const stamps=times.map(x=>Date.parse(x));
 if(stamps.some((x,i)=>x<nowMs-24*60*60_000||
    x>nowMs+15*24*60*60_000||
    (i>0&&x<=stamps[i-1])||
    (i>0&&(x-stamps[i-1])!==6*60*60_000)))
  return fail('NON_COMPARABLE_SIX_HOUR_TIMELINE');
 if(typeof metadata.latitude==='number'&&
   Math.abs(metadata.latitude-latitude)>0.15)return fail('WRONG_LATITUDE');
 if(typeof metadata.longitude==='number'&&
   Math.abs(metadata.longitude-longitude)>0.15)return fail('WRONG_LONGITUDE');
 const observations=[];
 const stats={};
 let windUnitConversionApplied=false;
 for(const [sourceField,field] of Object.entries(METEOBLUE_BASIC6H_FIELDS)){
  const values=b[sourceField];
  if(values===undefined){stats[field.name]='UNAVAILABLE_NOT_IN_RESPONSE';continue;}
  if(!Array.isArray(values)||values.length!==times.length)
    return fail('INVALID_LENGTH_'+sourceField.toUpperCase());
  // Refuse numeric strings and non-finite provider values BEFORE conversion.
  if(values.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v))))
    return fail('NON_NUMERIC_'+sourceField.toUpperCase());
  const isWind=sourceField==='windspeed_mean'||sourceField==='windspeed_max';
  const unitForWind=isWind?(payload.units?.[sourceField]??
    payload.units?.windspeed??payload.units?.wind_speed):null;
  const factor=isWind?windFactor(unitForWind):1;
  // Never call raw m/s a km/h reading; missing/unknown units are unavailable.
  if(isWind&&factor===null){
   stats[field.name]='UNAVAILABLE_WIND_UNIT_NOT_VERIFIED';
   continue;
  }
  const normalized=values.map(v=>v===null?null:(isWind?Math.round(v*factor*1000)/1000:v));
  if(normalized.some(v=>v!==null&&
    (typeof v!=='number'||!Number.isFinite(v)||v<field.min||v>field.max)))
    return fail('OUT_OF_RANGE_'+sourceField.toUpperCase());
  if(isWind&&factor!==1)windUnitConversionApplied=true;
  stats[field.name]=normalized.some(v=>v!==null)?'FORECAST_VALUES_PRESENT':'UNAVAILABLE_NULL_VALUES';
  observations.push(Object.freeze({
    // Preserve exact provider source key for future private provenance audits.
    sourceField,field:field.name,unit:field.unit,semantics:field.meaning,
    values:Object.freeze(normalized)
  }));
 }
 const modelRun=normalizeUtc(metadata.modelrun_utc);
 const updated=normalizeUtc(metadata.modelrun_updatetime_utc);
 const runValid=modelRun!==null&&Date.parse(modelRun)<=nowMs&&
   nowMs-Date.parse(modelRun)<=36*60*60_000;
 const unitEvidence=unitsVerified(payload.units);
 const hasContent=observations.some(o=>o.values.some(v=>v!==null));
 if(!hasContent)return fail('NO_VALID_NUMERIC_FIELDS');
 const sourceCoordinatesVerified=
   Number.isFinite(latitude)&&Number.isFinite(longitude)&&
   Number.isFinite(metadata.latitude)&&Number.isFinite(metadata.longitude)&&
   Math.abs(metadata.latitude-latitude)<=0.15&&
   Math.abs(metadata.longitude-longitude)<=0.15;
 const completeFieldCoverage=Object.values(stats).every(x=>x==='FORECAST_VALUES_PRESENT');
 const auditBlockers=[];
 if(!runValid)auditBlockers.push('MODEL_RUN_NOT_VERIFIED');
 if(!unitEvidence)auditBlockers.push('FIELD_UNITS_NOT_VERIFIED');
 if(!sourceCoordinatesVerified)auditBlockers.push('SOURCE_COORDINATES_NOT_VERIFIED');
 if(!completeFieldCoverage)auditBlockers.push('SEVEN_FIELD_COVERAGE_INCOMPLETE');
 // Even valid provider forecasts may share underlying ECMWF/DWD/NOAA models.
 return Object.freeze({
  status:'FORECAST_PARSED_PRIVATE_STAGING',
  sourceId:'METEOBLUE_FREE_FORECAST',
  category:'P',modelNature:'METEOBLUE_LEARNING_MULTIMODEL_NOT_INDEPENDENT',
  ibge,packageName:'basic-6h',intervalHours:6,
  validTimes:Object.freeze(times),
  issuedAt:runValid?modelRun:null,
  processedAt:updated,metadataRunVerified:runValid,
  unitMetadataVerified:unitEvidence,
  windUnitConversionApplied,
  sourceCoordinatesVerified,
  completeFieldCoverage,
  // Private audit completeness is NOT production/scientific homologation.
  // This flag must be true before the collector declares its staging audit ready.
  auditReadyForPrivateReview:auditBlockers.length===0,
  auditBlockers:Object.freeze(auditBlockers),
  values:Object.freeze(observations),
  coverage:Object.freeze(stats),
  observational:false,officialAlert:false,
  stationMeasurement:false,forecastOnly:true,
  scientificallyHomologated:false,
  publishedToAndroid:false,publishedToSubscribers:false,
  modelRunIndependentOfNwpSources:false
 });
}
