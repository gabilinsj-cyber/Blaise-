/**
 * Agent 12 scientific fusion contract: NEVER launder restricted measurements.
 * Requires independent, fresh and commercially authorized station observations.
 * This is an ESTIMATE for informational display, not a measurement or an alert.
 * Provenance remains visible to operators and attributable to customers.
 */
import {validateRjAgentSource} from './blaise-rj-agent-registry.mjs';

export const RJ_LICENSED_FUSION_VERSION='rj-licensed-independent-temperature-fusion-v1';
const HOSTS=Object.freeze({
  'alerta-rio':['alertario.rio.rj.gov.br','websempre.rio.rj.gov.br'],
  'inmet':['inmet.gov.br','apitempo.inmet.gov.br'],
  'defesa-civil-rj':['defesacivil.rj.gov.br'],
  'noaa':['noaa.gov'],
  'inpe-cptec':['inpe.br','cptec.inpe.br'],
  'eumetsat':['eumetsat.int'],
  'jaxa-gsmap':['jaxa.jp']
});
const valid=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const unavailable=reason=>Object.freeze({
  status:'UNAVAILABLE',reason,value:null,officialAlert:false,
  warningPublisherAuthorized:false,automaticSourceCollection:false
});
function trustedSourceUrl(sourceId,raw) {
  const allow=HOSTS[sourceId];
  if(!allow||typeof raw!=='string')return false;
  let url;
  try{url=new URL(raw);}catch{return false;}
  if(url.protocol!=='https:'||url.username||url.password||url.port||
     url.hash||url.hostname.endsWith('.'))return false;
  return allow.some(host=>url.hostname===host||url.hostname.endsWith('.'+host));
}
function km(a,b) {
  const rad=Math.PI/180;
  const a1=a.latitude*rad,b1=b.latitude*rad,dl=(b.longitude-a.longitude)*rad;
  const h=Math.sin((b1-a1)/2)**2+Math.cos(a1)*Math.cos(b1)*Math.sin(dl/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
}
/** Approved grants must be issued by the server's separate license registry. */
function grantAllowed(sample,grants,now) {
  const grant=grants.find(x=>x?.sourceId===sample.sourceId&&
    x.productId===sample.productId);
  if(!grant||grant.status!=='VERIFIED'||
    grant.permission!=='COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION'||
    typeof grant.evidenceId!=='string'||grant.evidenceId.length<8||
    typeof grant.attribution!=='string'||grant.attribution.length<10||
    !trustedSourceUrl(sample.sourceId,grant.licenseUrl)||
    !Number.isFinite(Date.parse(grant.validUntil))||
    Date.parse(grant.validUntil)<=now)return null;
  return grant;
}

export function prepareRjLicensedTemperatureFusion({
  samples=[],grants=[],target=null,now=Date.now()
}={}) {
  if(!Number.isSafeInteger(now)||now<0||
    !Array.isArray(samples)||samples.length<2||samples.length>6||
    !Array.isArray(grants)||grants.length>25||
    !target||!valid(target.latitude,-23.37,-20.75)||
    !valid(target.longitude,-44.9,-40.9)||
    !valid(target.elevationM,0,2000))
    return unavailable('INVALID_FUSION_INPUT');
  const accepted=[],sourceIds=new Set();
  for(const s of samples) {
    if(!s||s.kind!=='OBSERVED_STATION_TEMPERATURE'||
      s.metric!=='TEMPERATURE_C'||s.unit!=='°C'||
      !validateRjAgentSource(s.sourceId)||!HOSTS[s.sourceId]||
      typeof s.productId!=='string'||s.productId.length<3||
      !trustedSourceUrl(s.sourceId,s.sourceUrl)||
      !valid(s.value,-20,55)||
      !valid(s.latitude,-23.37,-20.75)||!valid(s.longitude,-44.9,-40.9)||
      !valid(s.elevationM,0,2000)||
      Math.abs(s.elevationM-target.elevationM)>100||
      !valid(s.quality,0.7,1.0)||
      typeof s.stationId!=='string'||s.stationId.length<2||
      sourceIds.has(s.sourceId))
      return unavailable('INCOMPATIBLE_OR_DUPLICATED_OFFICIAL_MEASUREMENTS');
    const stamp=Date.parse(s.observedAt);
    if(!Number.isFinite(stamp)||stamp>now||now-stamp>15*60_000)
      return unavailable('STALE_MEASUREMENTS');
    const distance=km(target,s);
    if(distance>8)return unavailable('STATION_OUTSIDE_COMPARABLE_LOCAL_AREA');
    const grant=grantAllowed(s,grants,now);
    if(!grant)return unavailable('COMMERCIAL_RIGHTS_NOT_VERIFIED_FOR_EACH_PRODUCT');
    accepted.push({s,stamp,distance,grant});
    sourceIds.add(s.sourceId);
  }
  if(sourceIds.size<2)return unavailable('TWO_INDEPENDENT_AUTHORIZED_SOURCES_REQUIRED');
  if(Math.max(...accepted.map(x=>x.stamp))-Math.min(...accepted.map(x=>x.stamp))>10*60_000)
    return unavailable('OBSERVATION_TIMES_NOT_COMPARABLE');
  if(Math.max(...samples.map(s=>s.value))-Math.min(...samples.map(s=>s.value))>3)
    return unavailable('MEASUREMENTS_DISAGREE_REVIEW_REQUIRED');
  const weights=accepted.map(x=>x.s.quality/Math.max(0.5,x.distance)**2);
  const total=weights.reduce((a,b)=>a+b,0);
  if(!Number.isFinite(total)||total<=0)return unavailable('FUSION_WEIGHT_INVALID');
  const value=accepted.reduce((sum,x,i)=>sum+x.s.value*weights[i]/total,0);
  const sources=accepted.map(({s,stamp,distance,grant},i)=>Object.freeze({
    sourceId:s.sourceId,productId:s.productId,stationId:s.stationId,
    observedAt:new Date(stamp).toISOString(),sourceUrl:s.sourceUrl,
    grantedUseEvidenceId:grant.evidenceId,
    attribution:grant.attribution,licenseUrl:grant.licenseUrl,
    distanceKm:Number(distance.toFixed(2)),weight:Number((weights[i]/total).toFixed(6))
  }));
  return Object.freeze({
    status:'AUTHORIZED_WEIGHTED_ESTIMATE',
    label:'Estimativa Blaise — média ponderada de observações autorizadas',
    method:'QUALITY_WEIGHTED_INVERSE_DISTANCE_SQUARED',
    value:Number(value.toFixed(2)),unit:'°C',metric:'TEMPERATURE_C',
    calculatedAt:new Date(now).toISOString(),
    dataAsOf:new Date(Math.min(...accepted.map(x=>x.stamp))).toISOString(),
    validUntil:new Date(Math.min(...accepted.map(x=>x.stamp))+15*60_000).toISOString(),
    dataType:'ESTIMATE_NOT_OFFICIAL_MEASUREMENT',sources:Object.freeze(sources),
    sourceCount:sources.length,provenanceMustBeDisplayed:true,
    officialAlert:false,warningPublisherAuthorized:false,
    automaticSourceCollection:false,notRainfallInterpolation:true,
    internationalFallback:'REQUIRES_SEPARATE_VALIDATED_LICENSED_MODEL_PRODUCT'
  });
}
