/**
 * Blaise V6 RJ — INMET is PRIVATE dispute adjudication only.
 *
 * Do not fetch INMET, scrape its public panels, set timers, disclose its
 * measurements to subscribers or treat INMET as a Blaise display source.
 * Server-side review evidence must come from an authorized human checking
 * an official public panel (or a separately approved read-only source).
 *
 * INMET automated stations generally issue hourly observations, not minute
 * thermometers. Geography, altitude, variable, time and units must match.
 * This module never treats a station as a measurement in every RJ locality.
 */
import {createHash} from 'node:crypto';

export const RJ_INMET_TIEBREAK_CONTRACT='RJ_AGENT13_PRIVATE_INMET_DISPUTE_V1';
export const RJ_INMET_PANEL_URL='https://mapas.inmet.gov.br/';
export const RJ_INMET_TIEBREAK_AUTO_FETCH=false;
export const RJ_INMET_TIEBREAK_CLIENT_PUBLICATION=false;
const ACCEPT=Object.freeze({
 temperatureC:Object.freeze({min:-60,max:65,maxDifference:5,minWinningMargin:0.25,maxAgeMs:90*60_000}),
 humidityPct:Object.freeze({min:0,max:100,maxDifference:20,minWinningMargin:2,maxAgeMs:90*60_000}),
});
/** Fingerprint binds a private human check to this exact Blaise conflict.
 * No INMET observation enters the fingerprint or any public DTO.
 */
export function fingerprintRjInmetDispute(candidates){
 if(!Array.isArray(candidates)||candidates.length<2||candidates.length>5)
  throw Error('invalid_inmet_dispute_candidates');
 const items=candidates.map(x=>{
  if(typeof x?.ibge!=='string'||typeof x?.sourceId!=='string'||
    typeof x?.field!=='string'||typeof x?.measuredAt!=='string'||
    typeof x?.value!=='number'||!Number.isFinite(x.value)||
    (x.regionId!=null&&typeof x.regionId!=='string'))
   throw Error('invalid_inmet_dispute_candidate');
  return [x.ibge,x.regionId??null,x.field,x.nature,x.sourceId,x.value,x.measuredAt];
 }).sort((a,b)=>String(a[4]).localeCompare(String(b[4])));
 if(new Set(items.map(x=>x[4])).size!==items.length)
  throw Error('duplicate_inmet_dispute_source');
 return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}
const fail=reason=>Object.freeze({status:'REVIEW_REQUIRED',reason,
  selectedBlaiseReading:null,inmetValueExposed:false,providerCalls:0,
  officialObservationPublished:false,customerPublicationAuthorized:false});
function time(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))return NaN;
 const ms=Date.parse(value);
 return Number.isFinite(ms)&&new Date(ms).toISOString()===value?ms:NaN;
}
/**
 * This is an INTERNAL-only decision. The reference argument is never returned
 * or logged; callers must pass trusted backend review data, never Android input.
 * The result can only enter private staging, NEVER a public release endpoint.
 */
export function reviewAgent13ConflictWithInmet({
 ibge,regionId=null,field,candidates=[],review=null,nowMs
}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<0||!ACCEPT[field]||
    typeof ibge!=='string'||!/^33\d{5}$/.test(ibge)||
    !Array.isArray(candidates)||candidates.length<2||candidates.length>5)
  return fail('INVALID_OR_UNSUPPORTED_CONFLICT');
 const spec=ACCEPT[field];
 if(new Set(candidates.map(x=>x?.sourceId)).size!==candidates.length||
    candidates.some(x=>x?.ibge!==ibge||x?.regionId!==regionId||
      x?.field!==field||x?.nature!=='E'||x?.sourceId==='INMET'||
      typeof x?.sourceId!=='string'||typeof x.value!=='number'||
      !Number.isFinite(x.value)||x.value<spec.min||x.value>spec.max||
      !Number.isFinite(time(x.measuredAt))||
      time(x.measuredAt)>nowMs||nowMs-time(x.measuredAt)>60*60_000))
  return fail('CANDIDATE_PROVENANCE_NOT_COMPARABLE');
 // It is the user's conflict criterion; no routine INMET access.
 const spread=Math.max(...candidates.map(x=>x.value))-
              Math.min(...candidates.map(x=>x.value));
 const conflictMinimum=field==='temperatureC'?4:25;
 if(spread<=conflictMinimum)return fail('NO_CONFIRMED_CONFLICT');
 if(!review||typeof review!=='object'||Array.isArray(review)||
    review.accessMode!=='HUMAN_VERIFIED_PUBLIC_INMET_PANEL'||
    review.publicPanelUrl!==RJ_INMET_PANEL_URL||
    review.inspectedByAuthorizedReviewer!==true||
    review.officialInmetStationVerified!==true||
    review.stationRepresentativeForTargetArea===false||
    review.stationRepresentativeForTargetArea!==true||
    review.geographyAndAltitudeVerified!==true||
    review.sameMeteorologicalVariableAndUnitsVerified!==true||
    review.originalObservationTimeVerified!==true||
    review.referenceQualityApproved!==true||
    review.targetIbge!==ibge||review.targetRegionId!==regionId||
    review.parameter!==field||
    review.conflictFingerprint!==fingerprintRjInmetDispute(candidates)||
    typeof review.stationCode!=='string'||
    !/^A\d{3,4}$/.test(review.stationCode)||
    typeof review.stationDistanceKm!=='number'||
    !Number.isFinite(review.stationDistanceKm)||
    review.stationDistanceKm<0||review.stationDistanceKm>30||
    typeof review.observedValue!=='number'||
    !Number.isFinite(review.observedValue)||
    review.observedValue<spec.min||review.observedValue>spec.max)
  return fail('INMET_PUBLIC_PANEL_EVIDENCE_INSUFFICIENT');
 const observed=time(review.observedAt),checked=time(review.reviewedAt);
 if(!Number.isFinite(observed)||!Number.isFinite(checked)||
    observed>checked||checked>nowMs||nowMs-checked>15*60_000||
    nowMs-observed>spec.maxAgeMs||
    candidates.some(x=>Math.abs(time(x.measuredAt)-observed)>45*60_000))
  return fail('INMET_TIMESTAMP_OR_STATION_NOT_COMPARABLE');
 const ordered=candidates.map(c=>({candidate:c,delta:Math.abs(c.value-review.observedValue)}))
   .sort((a,b)=>a.delta-b.delta);
 const best=ordered[0],second=ordered[1];
 if(best.delta>spec.maxDifference)
  return fail('ALL_BLAISE_SOURCES_FAR_FROM_REFERENCE');
 if(second.delta-best.delta<spec.minWinningMargin)
  return fail('REFERENCE_TOO_CLOSE_TO_DISAMBIGUATE');
 // Return a BLAISE provider's original reading with original timestamp,
 // without any INMET station code/time/value or other private review content.
 return Object.freeze({
  contract:RJ_INMET_TIEBREAK_CONTRACT,
  status:'PRIVATE_DISPUTE_RESOLVED',
  reason:null,selectedBlaiseReading:best.candidate,
  inmetValueExposed:false,providerCalls:0,
  officialObservationPublished:false,customerPublicationAuthorized:false,
  reviewScope:'PRIVATE_COMPARISON_ONLY'
 });
}
