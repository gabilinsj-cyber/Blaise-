/**
 * Agent 12 — temperature and thermal sensation for the EXISTING Blaise RJ map.
 *
 * A local Defesa Civil RJ station observation and a licensed DWD/ICON or
 * NOAA/GFS model point have different epistemic status. Their weighted
 * combination is an ESTIMATE only when a separately documented calibration
 * approves the weights. No measurement or official alert is synthesized.
 *
 * If the local reading is unusable, preserve the international model as
 * model-only forecast, not as real-time observed temperature.
 *
 * No network calls, background workers, source laundering or license bypass.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';
import {prepareRjNativeModelForecastPoint} from './rj-native-model-map-sources.mjs';
import {thermalSensationCelsius} from './rj-scientific-calculator.mjs';

export const RJ_TEMP_THERMAL_BLEND_CONTRACT='BLAISE_RJ_AUTHORIZED_OBSERVATION_MODEL_TEMPERATURE_V1';
const RJ_CODES=new Set(RJ_MUNICIPALITIES.map(x=>String(x.ibge)));
const REAL_SOURCE='defesa-civil-rj';
const DOMAINS=['defesacivil.rj.gov.br'];
const finite=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const iso=ms=>new Date(ms).toISOString();
const unavailable=(reason)=>Object.freeze({status:'UNAVAILABLE',reason,value:null,
  officialMeasurement:false,officialAlert:false,mayTriggerAlert:false});
function sourceHostValid(raw){
  if(typeof raw!=='string')return false;
  try {
    const u=new URL(raw);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&
      DOMAINS.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));
  }catch{return false;}
}
function distanceKm(a,b){
  const r=Math.PI/180,dLat=(b.latitude-a.latitude)*r,
    dLon=(b.longitude-a.longitude)*r;
  const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*
    Math.sin(dLon/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
}
function validatedLocalTemperature(observation,grant,target,now){
  const s=observation,g=grant;
  if(!s||s.kind!=='STATION_OBSERVATION'||s.sourceId!==REAL_SOURCE||
    s.originalProducerId!==REAL_SOURCE||s.metric!=='TEMPERATURE_C'||
    s.unit!=='°C'||s.ibge!==target.ibge||
    !finite(s.value,-20,55)||!finite(s.quality,0.7,1)||
    !finite(s.latitude,-23.37,-20.75)||!finite(s.longitude,-44.9,-40.9)||
    !finite(s.elevationM,0,2200)||Math.abs(s.elevationM-target.elevationM)>100||
    distanceKm(s,target)>8||!sourceHostValid(s.sourceUrl)||
    typeof s.stationId!=='string'||s.stationId.length<2||
    typeof s.productId!=='string'||s.productId.length<3)
    return unavailable('DEFESA_CIVIL_REAL_STATION_INPUT_NOT_VERIFIED');
  const ms=Date.parse(s.observedAt);
  if(!Number.isFinite(ms)||ms>now||now-ms>5*60_000)
    return unavailable('DEFESA_CIVIL_READING_EXPIRED');
  if(!g||g.sourceId!==s.sourceId||g.productId!==s.productId||
    g.status!=='VERIFIED'||g.permission!=='COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION'||
    !sourceHostValid(g.licenseUrl)||typeof g.evidenceId!=='string'||
    g.evidenceId.length<8||typeof g.attribution!=='string'||
    g.attribution.length<10||!(Date.parse(g.validUntil)>now))
    return unavailable('DEFESA_CIVIL_PRODUCT_COMMERCIAL_RIGHTS_UNVERIFIED');
  return Object.freeze({status:'VERIFIED_REAL_STATION_TEMPERATURE',value:s.value,
    time:ms,sourceId:s.sourceId,productId:s.productId,
    stationId:s.stationId,sourceUrl:s.sourceUrl,
    licenseEvidenceId:g.evidenceId,attribution:g.attribution,
    quality:s.quality});
}
function verifiedModel(sample,rights,now,metric){
  if(!sample)return unavailable('INTERNATIONAL_MODEL_FIELD_MISSING');
  const p=prepareRjNativeModelForecastPoint({sample,rights,now});
  if(p.status!=='AVAILABLE_MODEL_FORECAST')
    return unavailable('INTERNATIONAL_MODEL_PRODUCT_UNVERIFIED');
  const point=p.points[0];
  if(point.variable!==metric)return unavailable('WRONG_MODEL_VARIABLE');
  return Object.freeze({status:'VERIFIED_MODEL_FORECAST_POINT',point});
}
function accompanyingPoint(base,sample,rights,target,now,metric){
  const candidate=verifiedModel(sample,rights,now,metric);
  if(candidate.status!=='VERIFIED_MODEL_FORECAST_POINT')return null;
  const p=candidate.point;
  if(p.sourceId!==base.sourceId||p.modelRunId!==base.modelRunId||
    p.validAt!==base.validAt||p.ibge!==base.ibge||
    distanceKm(p,target)>20)return null;
  return p;
}
function computedSensation(temperature,humidity,wind,ibge,referenceMs,now,mode,sources){
  const hot=temperature>=27&&finite(humidity,40,100);
  const cold=temperature<=10&&finite(wind,4.8,250);
  if(!hot&&!cold)return unavailable('SENSATION_REQUIRES_VALID_HUMIDITY_OR_WIND_IN_APPLICABLE_RANGE');
  // Calculated from forecast values at their VALID TIME. This does NOT
  // convert a forecast into a measured observation.
  const calc=thermalSensationCelsius({
    temperatureC:temperature,humidityPercent:hot?humidity:null,
    windKmh:cold?wind:null,ibge,observedAt:iso(referenceMs),
    now: mode==='MODEL_FORECAST_ONLY'?referenceMs:now
  });
  if(calc.state!=='CALCULO_EXPERIMENTAL_BLAISE')
    return unavailable('THERMAL_FORMULA_OUTSIDE_VALID_DOMAIN');
  return Object.freeze({
    status:mode==='MODEL_FORECAST_ONLY'?'DERIVED_FORECAST_SENSATION':'DERIVED_LOCAL_ESTIMATE_SENSATION',
    value:calc.value,unit:'°C',formula:calc.formula,
    basis:mode,validAt:iso(referenceMs),sources:Object.freeze(sources),
    officialMeasurement:false,officialAlert:false,mayTriggerAlert:false
  });
}
/**
 * Expected input schema:
 * - target: {ibge,latitude,longitude,elevationM}
 * - observation: *direct* Defesa Civil station result (not rebranded INMET/
 *   Alerta Rio), with per-product commercial rights in observationGrant
 * - models.temperature: decoded and authorized NOAA GFS/DWD ICON forecast
 * - models.humidity/wind: same cycle, grid point and validity as temperature
 * - calibration: verified local hindcast report with a non-arbitrary weight
 *
 * Never trusts a naked "VERIFIED" tag from the mobile client. These objects
 * must come from trusted server-side license/calibration registries.
 */
export function prepareRjTempAndThermalCorrection({
  target=null,observation=null,observationGrant=null,
  models={},modelRights=[],calibration=null,now=Date.now()
}={}){
  if(!Number.isSafeInteger(now)||now<0||
    !target||!RJ_CODES.has(String(target.ibge))||
    !finite(target.latitude,-23.37,-20.75)||
    !finite(target.longitude,-44.9,-40.9)||
    !finite(target.elevationM,0,2200)||
    !Array.isArray(modelRights))
    return Object.freeze({contract:RJ_TEMP_THERMAL_BLEND_CONTRACT,
      temperature:unavailable('INVALID_TARGET_OR_RIGHTS_REGISTRY'),
      sensation:unavailable('INVALID_TARGET_OR_RIGHTS_REGISTRY'),
      officialAlert:false});
  const basis=verifiedModel(models?.temperature,modelRights,now,'TEMPERATURE_2M_C');
  const local=validatedLocalTemperature(observation,observationGrant,target,now);
  const model=basis.status==='VERIFIED_MODEL_FORECAST_POINT'?basis.point:null;
  const modelValidAt=model?Date.parse(model.validAt):NaN;
  const modelLocal=model&&distanceKm(model,target)<=20&&model.ibge===target.ibge;
  // Forecast-only is a legitimate fallback, but not a current observation.
  const modelUsable=modelLocal&&modelValidAt>=now-30*60_000;
  const humidity=modelUsable?accompanyingPoint(model,models?.humidity,modelRights,target,now,
    'RELATIVE_HUMIDITY_2M'):null;
  const wind=modelUsable?accompanyingPoint(model,models?.wind,modelRights,target,now,
    'WIND_SPEED_10M_KMH'):null;
  const modelRefs=modelUsable?[model,...[humidity,wind].filter(Boolean)].map(p=>({
    sourceId:p.sourceId,productId:p.productId,modelRunId:p.modelRunId,
    cycleAt:p.cycleAt,validAt:p.validAt,sourceUrl:p.sourceUrl,
    attribution:p.sourceCredit,licenseEvidenceId:p.licenseEvidenceId,
    dataType:'MODEL_FORECAST'
  })):[];
  let temperature=unavailable('NO_VALID_LICENSED_TEMPERATURE_SOURCE');
  let sensation=unavailable('NO_VALID_TEMPERATURE_FOR_SENSATION');
  if(modelUsable){
    // Base case: authorized international model, absolutely no Brazilian source
    // required. Temperature display must say "forecast", not "observed now".
    temperature=Object.freeze({
      status:'MODEL_FORECAST_ONLY',value:model.value,unit:'°C',
      validAt:model.validAt,cycleAt:model.cycleAt,method:'MODEL_GRID_ONLY',
      displayLabel:'Previsão de temperatura — modelo internacional',
      sources:Object.freeze(modelRefs.slice(0,1)),
      officialMeasurement:false,officialAlert:false,mayTriggerAlert:false
    });
    sensation=computedSensation(model.value,humidity?.value,wind?.value,
      target.ibge,modelValidAt,now,'MODEL_FORECAST_ONLY',modelRefs);
  }
  // No blending if local observation is missing, expired, unlicensed, and/or
  // the forecast is too far away in space or time.
  const coherent=local.status==='VERIFIED_REAL_STATION_TEMPERATURE'&&
    modelUsable&&Math.abs(modelValidAt-local.time)<=30*60_000&&
    Math.abs(local.value-model.value)<=5;
  const ready=coherent&&calibration&&calibration.status==='VERIFIED'&&
    calibration.method==='LOCAL_BACKTESTED_OBSERVATION_MODEL_WEIGHT'&&
    calibration.ibge===target.ibge&&
    calibration.modelSourceId===model.sourceId&&
    finite(calibration.observationWeight,0.5,0.95)&&
    typeof calibration.evidenceId==='string'&&calibration.evidenceId.length>=8&&
    Number.isFinite(Date.parse(calibration.validUntil))&&
    Date.parse(calibration.validUntil)>now;
  if(ready){
    const w=calibration.observationWeight;
    const value=Number((w*local.value+(1-w)*model.value).toFixed(2));
    const refs=[{
      sourceId:local.sourceId,productId:local.productId,stationId:local.stationId,
      observedAt:iso(local.time),sourceUrl:local.sourceUrl,
      licenseEvidenceId:local.licenseEvidenceId,attribution:local.attribution,
      dataType:'LOCAL_STATION_OBSERVATION',weight:w
    },{...modelRefs[0],weight:1-w}];
    temperature=Object.freeze({
      status:'AUTHORIZED_OBSERVATION_MODEL_ESTIMATE',value,unit:'°C',
      method:'BACKTEST_CALIBRATED_OBSERVATION_MODEL_WEIGHT',
      displayLabel:'Estimativa Blaise — temperatura ajustada com observação e modelo',
      observedAt:iso(local.time),validAt:model.validAt,
      calibrationEvidenceId:calibration.evidenceId,
      sources:Object.freeze(refs),officialMeasurement:false,
      officialAlert:false,mayTriggerAlert:false,
      caution:'NOT_DIRECT_MEASUREMENT_OR_OFFICIAL_WARNING'
    });
    // Model RH/wind are explicitly derived model fields. They cannot be
    // marketed as Defesa Civil station RH/wind.
    sensation=computedSensation(value,humidity?.value,wind?.value,
      target.ibge,local.time,now,'AUTHORIZED_OBSERVATION_MODEL_ESTIMATE',
      [...refs,...modelRefs.slice(1)]);
  }else if(!modelUsable&&local.status==='VERIFIED_REAL_STATION_TEMPERATURE'){
    // Preserve a genuine local observation, but never invent sensation.
    temperature=Object.freeze({
      status:'LOCAL_STATION_OBSERVATION_ONLY',value:local.value,unit:'°C',
      observedAt:iso(local.time),displayLabel:'Temperatura observada na estação',
      sources:Object.freeze([{
        sourceId:local.sourceId,productId:local.productId,stationId:local.stationId,
        observedAt:iso(local.time),sourceUrl:local.sourceUrl,
        attribution:local.attribution,licenseEvidenceId:local.licenseEvidenceId
      }]),officialMeasurement:true,officialAlert:false,mayTriggerAlert:false
    });
  }
  return Object.freeze({
    contract:RJ_TEMP_THERMAL_BLEND_CONTRACT,temperature,sensation,
    mapRenderer:'BLAISE_V6_RJ_NATIVE_GEOGRAPHIC_CANVAS',
    geographicScope:'LOCAL_POINT_NOT_ALL_RJ',
    modelAndObservationNotDoubleCounted:true,
    fieldSourcesMustBeDisplayed:true,
    noUnlicensedCollection:true,officialAlert:false
  });
}
