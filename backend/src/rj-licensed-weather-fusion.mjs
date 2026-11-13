/**
 * Agent 12: licensed station fusion for local RJ estimates (not city/state alerts).
 *
 * No collector runs here. Inputs MUST come from server-verified, authorized
 * licensed collectors and an independently maintained per-product grant registry.
 * A weighted average never changes upstream commercial use restrictions.
 * No network bypass, covert retrieval or source laundering is implemented.
 */
import {validateRjAgentSource} from './blaise-rj-agent-registry.mjs';
import {thermalSensationCelsius} from './rj-scientific-calculator.mjs';

export const RJ_LICENSED_LOCAL_WEATHER_FUSION='RJ_LICENSED_LOCAL_WEATHER_FUSION_V1';
const SOURCE_HOSTS=Object.freeze({
  'alerta-rio':['alertario.rio.rj.gov.br','websempre.rio.rj.gov.br'],
  inmet:['inmet.gov.br','apitempo.inmet.gov.br'],
  'defesa-civil-rj':['defesacivil.rj.gov.br'],
  noaa:['noaa.gov'],
  'inpe-cptec':['inpe.br','cptec.inpe.br'],
  eumetsat:['eumetsat.int'],
  'jaxa-gsmap':['jaxa.jp'],
});
const METRICS=Object.freeze({
  temperature:Object.freeze({code:'TEMPERATURE_C',unit:'°C',range:[-20,55],radiusKm:8}),
  humidity:Object.freeze({code:'HUMIDITY_PERCENT',unit:'%',range:[0,100],radiusKm:8}),
  wind:Object.freeze({code:'WIND_10M_VECTOR_KMH',unit:'km/h',radiusKm:5}),
  rainfall:Object.freeze({code:'RAIN_ACCUMULATION_MM',unit:'mm',range:[0,500],radiusKm:3}),
});
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const invalid=(reason)=>Object.freeze({
  status:'UNAVAILABLE',reason,value:null,sourceCount:0,officialAlert:false
});
const iso=(v)=>new Date(v).toISOString();

function httpsHostMatches(raw,sourceId){
  const hosts=SOURCE_HOSTS[sourceId];
  if(!hosts||typeof raw!=='string')return false;
  try {
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.hostname.endsWith('.'))return false;
    return hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));
  }catch{return false;}
}
function haversineKm(a,b){
  const rad=Math.PI/180,deltaLat=(b.latitude-a.latitude)*rad,
    deltaLon=(b.longitude-a.longitude)*rad;
  const x=Math.sin(deltaLat/2)**2+Math.cos(a.latitude*rad)*
    Math.cos(b.latitude*rad)*Math.sin(deltaLon/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(x)));
}
function rightFor(sample,grants,now){
  // These objects must be supplied by a separately authenticated licensing registry.
  const grant=grants.find(g=>g?.sourceId===sample.sourceId&&
    g.productId===sample.productId&&g.status==='VERIFIED'&&
    g.permission==='COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION');
  if(!grant||typeof grant.evidenceId!=='string'||grant.evidenceId.length<8||
    typeof grant.attribution!=='string'||grant.attribution.length<10||
    !httpsHostMatches(grant.licenseUrl,sample.sourceId))return null;
  const expiry=Date.parse(grant.validUntil);
  if(!Number.isFinite(expiry)||expiry<=now)return null;
  return grant;
}
function validateWind(value){
  return value&&typeof value==='object'&&
    number(value.speedKmh,0,200)&&number(value.directionFromDeg,0,360);
}
function normalizeMetric(samples,metric,target,grants,now){
  const spec=METRICS[metric];
  if(!spec)return invalid('UNKNOWN_METRIC');
  if(!Array.isArray(samples)||samples.length<2||samples.length>6)
    return invalid('TWO_INDEPENDENT_SOURCES_REQUIRED');
  const ids=new Set(),stationKeys=new Set(),records=[];
  for(const s of samples){
    if(!s||s.kind!=='STATION_OBSERVATION'||s.metric!==spec.code||s.unit!==spec.unit||
      !validateRjAgentSource(s.sourceId)||s.sourceId==='cor-rio'||
      !SOURCE_HOSTS[s.sourceId]||
      typeof s.originalSourceId!=='string'||s.originalSourceId!==s.sourceId||
      !httpsHostMatches(s.sourceUrl,s.sourceId)||
      typeof s.productId!=='string'||s.productId.length<3||
      typeof s.stationId!=='string'||s.stationId.length<2||
      s.ibge!==target.ibge||
      !number(s.latitude,-23.37,-20.75)||!number(s.longitude,-44.9,-40.9)||
      !number(s.quality,0.7,1)||ids.has(s.originalSourceId)||
      stationKeys.has(s.sourceId+':'+s.stationId))
      return invalid('INCOMPATIBLE_OR_REPUBLISHED_OBSERVATIONS');
    if(metric==='wind'){
      if(!validateWind(s.value)||s.heightM!==10||
        !number(s.averagingMinutes,1,15))return invalid('WIND_REFERENCE_NOT_COMPARABLE');
    }else if(!number(s.value,...spec.range))return invalid('INVALID_METRIC_VALUE');
    if(metric==='temperature'&&
      (!number(s.elevationM,0,2200)||Math.abs(s.elevationM-target.elevationM)>100))
      return invalid('STATION_ELEVATION_MISMATCH');
    if(metric==='wind'&&(!['URBAN','COASTAL','OPEN'].includes(s.exposureClass)))
      return invalid('WIND_EXPOSURE_NOT_COMPARABLE');
    const observedAt=Date.parse(s.observedAt);
    if(!Number.isFinite(observedAt)||observedAt>now||now-observedAt>15*60_000)
      return invalid('STALE_OR_FUTURE_READING');
    if(metric==='rainfall'){
      const start=Date.parse(s.accumulationStart),end=Date.parse(s.accumulationEnd);
      if(!Number.isFinite(start)||!Number.isFinite(end)||end!==observedAt||
        ![5,10,15,30,60].includes((end-start)/60000))
        return invalid('INVALID_RAIN_GAUGE_ACCUMULATION_WINDOW');
    }
    const distance=haversineKm(target,s);
    if(distance>spec.radiusKm)return invalid('STATIONS_NOT_LOCALLY_COMPARABLE');
    const grant=rightFor(s,grants,now);
    if(!grant)return invalid('COMMERCIAL_DERIVATION_LICENSE_NOT_VERIFIED');
    ids.add(s.originalSourceId);
    stationKeys.add(s.sourceId+':'+s.stationId);
    records.push({s,observedAt,distance,grant});
  }
  if(ids.size<2)return invalid('TWO_INDEPENDENT_SOURCES_REQUIRED');
  const stamps=records.map(r=>r.observedAt);
  if(Math.max(...stamps)-Math.min(...stamps)>5*60_000)
    return invalid('OBSERVATION_TIMES_NOT_COMPARABLE');
  if(metric==='wind'){
    const exposure=records[0].s.exposureClass;
    if(records.some(r=>r.s.exposureClass!==exposure||
      r.s.averagingMinutes!==records[0].s.averagingMinutes))
      return invalid('WIND_AVERAGING_OR_EXPOSURE_MISMATCH');
    for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
      const a=records[i].s.value,b=records[j].s.value;
      const diff=Math.abs(a.directionFromDeg-b.directionFromDeg)%360;
      if(Math.min(diff,360-diff)>45||Math.abs(a.speedKmh-b.speedKmh)>15)
        return invalid('WIND_STATIONS_DISAGREE_REVIEW_REQUIRED');
    }
  }
  if(metric==='rainfall'){
    const {accumulationStart,accumulationEnd}=records[0].s;
    if(records.some(r=>r.s.accumulationStart!==accumulationStart||
      r.s.accumulationEnd!==accumulationEnd))
      return invalid('RAIN_ACCUMULATION_WINDOWS_NOT_EQUAL');
    const values=records.map(r=>r.s.value);
    const max=Math.max(...values),min=Math.min(...values);
    if(max-min>Math.max(2,max*0.25))
      return invalid('LOCAL_RAINFALL_DISAGREEMENT_REVIEW_REQUIRED');
  }
  if(metric==='temperature'&&
    Math.max(...records.map(r=>r.s.value))-Math.min(...records.map(r=>r.s.value))>3)
    return invalid('TEMPERATURE_STATIONS_DISAGREE_REVIEW_REQUIRED');
  if(metric==='humidity'&&
    Math.max(...records.map(r=>r.s.value))-Math.min(...records.map(r=>r.s.value))>15)
    return invalid('HUMIDITY_STATIONS_DISAGREE_REVIEW_REQUIRED');
  const weights=records.map(r=>r.s.quality/Math.max(.5,r.distance)**2);
  const weightTotal=weights.reduce((a,b)=>a+b,0);
  if(!Number.isFinite(weightTotal)||weightTotal<=0)return invalid('INVALID_FUSION_WEIGHT');
  const ratios=weights.map(w=>w/weightTotal);
  let value,extra={};
  if(metric==='wind'){
    const u=records.reduce((acc,r,i)=>acc-r.s.value.speedKmh*
      Math.sin(r.s.value.directionFromDeg*Math.PI/180)*ratios[i],0);
    const v=records.reduce((acc,r,i)=>acc-r.s.value.speedKmh*
      Math.cos(r.s.value.directionFromDeg*Math.PI/180)*ratios[i],0);
    const speed=Math.hypot(u,v);
    value=Number(speed.toFixed(2));
    extra={directionFromDeg: speed>=0.2?
      Number(((Math.atan2(-u,-v)*180/Math.PI)+360)%360).toFixed(1):null,
      quantity:'VECTOR_MEAN_10M_NOT_GUSTS'};
  }else value=Number(records.reduce((acc,r,i)=>acc+r.s.value*ratios[i],0).toFixed(2));
  const sources=records.map(({s,grant,observedAt,distance},i)=>Object.freeze({
    sourceId:s.sourceId,productId:s.productId,stationId:s.stationId,
    observedAt:iso(observedAt),sourceUrl:s.sourceUrl,
    licenseUrl:grant.licenseUrl,licenseEvidenceId:grant.evidenceId,
    attribution:grant.attribution,weight:Number(ratios[i].toFixed(6)),
    distanceKm:Number(distance.toFixed(2)),
  }));
  return Object.freeze({
    status:'AUTHORIZED_LOCAL_WEIGHTED_ESTIMATE',
    contract:RJ_LICENSED_LOCAL_WEATHER_FUSION,
    metric:spec.code,unit:spec.unit,value,...extra,
    estimateScope:'LOCAL_POINT_ONLY_NOT_WHOLE_CITY_OR_STATE',
    dataType:'DERIVED_ESTIMATE_NOT_DIRECT_MEASUREMENT',
    method:metric==='wind'?'QUALITY_INVERSE_DISTANCE_VECTOR_AVERAGE':'QUALITY_INVERSE_DISTANCE_SQUARED',
    observedAt:iso(Math.min(...stamps)),calculatedAt:iso(now),
    sources:Object.freeze(sources),sourceCount:sources.length,
    provenanceMustBeDisplayed:true,officialAlert:false,
    mayTriggerAlert:false,
    note:metric==='rainfall'
      ?'Não representa chuva acumulada em toda a cidade ou no estado. Preservar extremos por estação no monitoramento de risco.'
      :'Estimativa local condicionada à comparabilidade das estações.',
    ...(metric==='rainfall'?{
      accumulationStart:records[0].s.accumulationStart,
      accumulationEnd:records[0].s.accumulationEnd,
      maximumGaugeMm:Math.max(...records.map(r=>r.s.value))
    }:{})
  });
}
/**
 * No arbitrary international fallback: each model is a distinct product,
 * with a specific license, valid run, grid, uncertainty and forecast lead.
 */
export function prepareRjLicensedLocalWeatherFusion({
  observations={},grants=[],target=null,now=Date.now()
}={}){
  if(!target||typeof target.ibge!=='string'||!/^\d{7}$/.test(target.ibge)||
    !number(target.latitude,-23.37,-20.75)||
    !number(target.longitude,-44.9,-40.9)||
    !number(target.elevationM,0,2200)||
    !Number.isSafeInteger(now)||now<0||!Array.isArray(grants)||grants.length>80)
    return Object.freeze({status:'UNAVAILABLE',reason:'INVALID_TARGET_OR_RIGHTS_REGISTRY',
      officialAlert:false});
  const metrics={};
  for(const metric of Object.keys(METRICS)){
    metrics[metric]=normalizeMetric(observations[metric]??[],metric,target,grants,now);
  }
  const t=metrics.temperature,h=metrics.humidity,w=metrics.wind;
  let thermal=invalid('COMPARABLE_LICENSED_INPUTS_REQUIRED');
  if(t.status==='AUTHORIZED_LOCAL_WEIGHTED_ESTIMATE'){
    const tstamp=Date.parse(t.observedAt);
    const availableRH=h.status==='AUTHORIZED_LOCAL_WEIGHTED_ESTIMATE'&&
      Math.abs(Date.parse(h.observedAt)-tstamp)<=5*60_000;
    const availableWind=w.status==='AUTHORIZED_LOCAL_WEIGHTED_ESTIMATE'&&
      Math.abs(Date.parse(w.observedAt)-tstamp)<=5*60_000;
    if((t.value>=27&&availableRH)||(t.value<=10&&availableWind)){
      const calc=thermalSensationCelsius({
        temperatureC:t.value,
        humidityPercent:availableRH?h.value:null,
        windKmh:availableWind?w.value:null,
        ibge:target.ibge,observedAt:t.observedAt,now
      });
      if(calc.state==='CALCULO_EXPERIMENTAL_BLAISE'){
        const sources=[...t.sources,...(t.value>=27?h.sources:w.sources)];
        thermal=Object.freeze({
          status:'AUTHORIZED_LOCAL_DERIVED_SENSATION',value:calc.value,unit:'°C',
          metric:'SENSACAO_TERMICA',formula:calc.formula,
          observedAt:t.observedAt,calculatedAt:iso(now),
          estimateScope:'LOCAL_POINT_ONLY_NOT_WHOLE_CITY_OR_STATE',
          dataType:'DERIVED_ESTIMATE_NOT_DIRECT_MEASUREMENT',
          sources:Object.freeze(sources),provenanceMustBeDisplayed:true,
          officialAlert:false,mayTriggerAlert:false
        });
      }
    }else thermal=invalid('HEAT_INDEX_REQUIRES_VALID_RH_OR_WIND_CHILL_REQUIRES_VALID_WIND');
  }
  const authorized=Object.values(metrics).filter(x=>x.status==='AUTHORIZED_LOCAL_WEIGHTED_ESTIMATE').length;
  return Object.freeze({
    status:authorized?'PARTIAL_OR_FULL_AUTHORIZED_ESTIMATES':'UNAVAILABLE',
    label:'Estimativas Blaise — médias ponderadas de fontes autorizadas',
    metrics:Object.freeze(metrics),thermal,
    publisherMayClaimOfficialMeasurement:false,
    sourceAttributionMustRemainVisible:true,
    licensedInternationalModelFallback:'SEPARATE_PRODUCT_NOT_STATION_MEAN',
    automaticCollection:false,encryptedTransportRequired:true,
    audit: 'MINIMAL_SOURCE_PRODUCT_TIME_LICENSE_EVIDENCE_NO_USER_VOICE_HISTORY',
    officialAlert:false
  });
}
