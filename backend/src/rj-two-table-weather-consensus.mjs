/**
 * Blaise V6 RJ — two-table meteorological reconciliation.
 *
 * Table 1: Alerta Rio, regional Civil Defence, OpenWeatherMap as the previously
 * approved third complementary product. OpenWeatherMap MUST NOT be
 * automatically counted as an independent official sensor.
 *
 * Table 2: five hierarchically consulted candidates. Four are explicitly
 * confirmed by the owner's latest instruction: INPE, INMET, Windy, NOAA.
 * The remaining fourth slot is CEMADEN, drawn from the previously approved
 * RJ hydro source inventory, PROVISIONAL pending the owner's confirmation.
 *
 * This file performs deterministic validation/selection of GIVEN observations;
 * it has no network access, no source credentials and NO alert-publishing code.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

const RJ_CODES=new Set(RJ_MUNICIPALITIES.map(x=>String(x.ibge)));
export const RJ_TABLE1_SOURCES=Object.freeze([
  'ALERTA_RIO',
  'DEFESA_CIVIL_RJ_REGIONAL',
  'OPENWEATHERMAP_API',
]);
export const RJ_TABLE2_SOURCES=Object.freeze([
  'INPE_CPTEC_FORECAST',
  'INMET_STATION',
  'WINDY_MODELO',
  'CEMADEN_RJ', // Provisional remaining slot; validate with project owner.
  'NOAA',       // Always last in this table.
]);
export const RJ_TABLE2_FOURTH_SOURCE_STATUS='CEMADEN_PROVISIONAL_AWAITING_OWNER_CONFIRMATION';
export const RJ_TWO_TABLES_POLICY_VERSION='RJ_TWO_TABLES_20261012_1';

const VARIABLES=Object.freeze({
  TEMPERATURA_C:Object.freeze({unit:'°C',min:-35,max:60,tolerance:2}),
  SENSACAO_TERMICA_C:Object.freeze({unit:'°C',min:-45,max:75,tolerance:3}),
  VENTO_KMH:Object.freeze({unit:'km/h',min:0,max:400,tolerance:12}),
  RAJADA_KMH:Object.freeze({unit:'km/h',min:0,max:400,tolerance:16}),
  CHUVA_MM_1H:Object.freeze({unit:'mm',min:0,max:400,tolerance:8}),
  UMIDADE_PERCENTUAL:Object.freeze({unit:'%',min:0,max:100,tolerance:10}),
});
const MODEL_SOURCES=new Set(['INPE_CPTEC_FORECAST','WINDY_MODELO','NOAA']);
const OBS_SOURCE=new Set(['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION','CEMADEN_RJ']);
const MAX_OBSERVATION_AGE_MS=2*3600*1000;
const MAX_FORECAST_ISSUE_AGE_MS=24*3600*1000;

function within(n,min,max){return typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;}
function distanceKm(a,b){
  const rad=Math.PI/180;
  const dLat=(b.latitude-a.latitude)*rad,dLon=(b.longitude-a.longitude)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function timestamp(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v))return NaN;return Date.parse(v);}
function sourceAllowedForMunicipality(sourceId,ibge){
  return sourceId!=='ALERTA_RIO'||ibge==='3304557';
}
function valid(row,sourceId,ibge,variable,spec,now){
  if(!row||typeof row!=='object'||Array.isArray(row)||row.sourceId!==sourceId
    ||String(row.ibge)!==ibge||row.variable!==variable||row.unit!==spec.unit
    ||!within(row.value,spec.min,spec.max)
    ||!within(row.latitude,-23.7,-20.4)
    ||!within(row.longitude,-45.5,-40.4)
    ||!sourceAllowedForMunicipality(sourceId,ibge)
    ||typeof row.sourceUrl!=='string'||!row.sourceUrl.startsWith('https://')
    ||row.usagePermissionStatus!=='VERIFIED_FOR_APP_DATA_DISPLAY')return false;
  if(OBS_SOURCE.has(sourceId)){
    const time=timestamp(row.observedAt);
    return row.kind==='OFFICIAL_OBSERVATION'
      &&typeof row.stationId==='string'&&row.stationId.length>=2
      &&Number.isFinite(time)&&now>=time&&now-time<=MAX_OBSERVATION_AGE_MS
      &&(variable!=='CHUVA_MM_1H'||row.measurementWindowMinutes===60);
  }
  if(sourceId==='OPENWEATHERMAP_API'){
    // OWM can relay previously published station data. Unless explicitly
    // traced to an independent ORIGINAL instrument, treat it as a modeled
    // product, not as the second independent measurement.
    if(row.kind==='OFFICIAL_OBSERVATION'){
      const time=timestamp(row.observedAt);
      return row.productKind==='INDEPENDENT_OBSERVATION'
        &&row.originalProviderVerified===true
        &&typeof row.originalProviderId==='string'&&row.originalProviderId.length>=3
        &&typeof row.stationId==='string'&&row.stationId.length>=2
        &&Number.isFinite(time)&&now>=time&&now-time<=MAX_OBSERVATION_AGE_MS
        &&(variable!=='CHUVA_MM_1H'||row.measurementWindowMinutes===60);
    }
  }
  const issued=timestamp(row.issuedAt),time=timestamp(row.validAt);
  return row.kind==='MODEL_FORECAST'
    &&typeof row.modelFamilyId==='string'&&row.modelFamilyId.length>=3
    &&typeof row.productId==='string'&&row.productId.length>=3
    &&Number.isFinite(issued)&&now>=issued&&now-issued<=MAX_FORECAST_ISSUE_AGE_MS
    &&Number.isFinite(time)&&Math.abs(now-time)<=24*3600*1000
    &&within(row.gridResolutionKm,0.1,25)
    &&(variable!=='CHUVA_MM_1H'||row.forecastWindowMinutes===60);
}
function nature(row){return row.kind==='OFFICIAL_OBSERVATION'?'OBSERVATION':'FORECAST';}
function isIndependent(a,b){
  if(a.sourceId===b.sourceId)return false;
  if(nature(a)==='OBSERVATION'&&nature(b)==='OBSERVATION'){
    const originalId=x=>x.originalProviderId??x.sourceId;
    // A republished observation from OWM is not independent.
    return originalId(a)!==originalId(b)
      &&!(a.stationId===b.stationId&&distanceKm(a,b)<0.2);
  }
  if(nature(a)==='FORECAST'&&nature(b)==='FORECAST')
    return a.modelFamilyId!==b.modelFamilyId;
  // One observation + one forecast may be independently presented as
  // comparison, but NEVER used in a weighted measured mean.
  return true;
}
function comparable(a,b,variable,spec,now){
  if(!isIndependent(a,b))return false;
  if(Math.abs(a.value-b.value)>spec.tolerance)return false;
  if(distanceKm(a,b)>25)return false;
  const ta=timestamp(nature(a)==='OBSERVATION'?a.observedAt:a.validAt);
  const tb=timestamp(nature(b)==='OBSERVATION'?b.observedAt:b.validAt);
  const maxSkew=nature(a)==='OBSERVATION'&&nature(b)==='OBSERVATION'
    ?15*60*1000:60*60*1000;
  if(Math.abs(ta-tb)>maxSkew)return false;
  if(variable==='CHUVA_MM_1H'){
    if(nature(a)==='OBSERVATION'&&a.measurementWindowMinutes!==60)return false;
    if(nature(b)==='OBSERVATION'&&b.measurementWindowMinutes!==60)return false;
    if(nature(a)==='FORECAST'&&a.forecastWindowMinutes!==60)return false;
    if(nature(b)==='FORECAST'&&b.forecastWindowMinutes!==60)return false;
  }
  return true;
}
function snapshot(r){return Object.freeze({
  sourceId:r.sourceId,kind:r.kind,variable:r.variable,value:r.value,
  unit:r.unit,observedAt:r.observedAt??null,validAt:r.validAt??null,
  stationId:r.stationId??null,modelFamilyId:r.modelFamilyId??null,
  sourceUrl:r.sourceUrl,ibge:String(r.ibge),
});}
function result(state,{ibge,variable,checked,table1,table2,matched=[],estimate=null,
  estimateKind=null,disagreement=false,reason=null}){
  return Object.freeze({
    state,ibge,variable,policyVersion:RJ_TWO_TABLES_POLICY_VERSION,
    table1Sources:RJ_TABLE1_SOURCES,
    table2Sources:RJ_TABLE2_SOURCES,
    fourthTieBreakSourceStatus:RJ_TABLE2_FOURTH_SOURCE_STATUS,
    checkedSourceIds:Object.freeze([...checked]),
    table1Readings:Object.freeze(table1.map(snapshot)),
    table2Readings:Object.freeze(table2.map(snapshot)),
    matchedSources:Object.freeze(matched.map(snapshot)),
    estimate,estimateKind,
    disagreement,reason,
    autoAlert:false,officialAlertDecision:null,
    noInventedObservation:true,productionLiveConnectionsVerified:false,
  });
}
function weight(row){
  // No calibrated weight => simple mean. We never take model skill as an
  // observation weight. Both rows must explicitly carry positive validated
  // weights to use a weighted observational mean.
  return typeof row.qualityWeight==='number'&&within(row.qualityWeight,0.01,10)
    &&row.qualityWeightBasis==='VERIFIED_STATION_QC'
    ?row.qualityWeight:null;
}

/**
 * A numeric verdict is possible only for *compatible observations* from
 * two independent original instruments. Any model comparison returns the
 * two individually-labeled figures, never a fabricated measured mean.
 */
export function reconcileRjTwoTables({ibge,variable,records=[],now=Date.now()}={}){
  const code=String(ibge),spec=VARIABLES[variable];
  if(!RJ_CODES.has(code))throw new TypeError('rj_unknown_municipality');
  if(!spec)throw new TypeError('rj_unsupported_variable');
  if(!Array.isArray(records)||records.length>200||!Number.isFinite(now))
    throw new TypeError('rj_invalid_sources_or_clock');
  const checked=[],primary=[],tie=[];
  for(const id of RJ_TABLE1_SOURCES){
    if(!sourceAllowedForMunicipality(id,code))continue;
    checked.push(id);
    const candidates=records.filter(r=>valid(r,id,code,variable,spec,now))
      .sort((a,b)=>timestamp(b.observedAt??b.issuedAt)-timestamp(a.observedAt??a.issuedAt));
    if(candidates.length)primary.push(candidates[0]);
  }
  for(let i=0;i<primary.length;i++)for(let j=i+1;j<primary.length;j++){
    const a=primary[i],b=primary[j];
    if(!comparable(a,b,variable,spec,now)||nature(a)!=='OBSERVATION'||nature(b)!=='OBSERVATION')continue;
    const wa=weight(a),wb=weight(b);
    const usedWeighted=wa!==null&&wb!==null;
    const estimate=usedWeighted?(a.value*wa+b.value*wb)/(wa+wb):(a.value+b.value)/2;
    return result('TABLE1_TWO_COMPATIBLE_SOURCES',{
      ibge:code,variable,checked,table1:primary,table2:tie,
      matched:[a,b],estimate:Math.round(estimate*100)/100,
      estimateKind:usedWeighted?'QUALITY_WEIGHTED_OBSERVATION_MEAN':'SIMPLE_OBSERVATION_MEAN',
      reason:'NO_TIEBREAK_REQUIRED',
    });
  }
  // Table 2 is queried only if two independent observed readings in Table 1
  // could not confirm one another. Priority is explicit. Only the FIRST
  // compatible Table 2 candidate is selected; never cross-average a forecast
  // and a measurement. If INMET exists in a different table in a future
  // policy revision, its provider identity must not be double counted.
  if(primary.length){
    for(const id of RJ_TABLE2_SOURCES){
      checked.push(id);
      const options=records.filter(r=>valid(r,id,code,variable,spec,now));
      const candidate=options[0];
      if(!candidate)continue;
      tie.push(candidate);
      for(const p of primary){
        if(!comparable(p,candidate,variable,spec,now))continue;
        const bothObserved=nature(p)==='OBSERVATION'&&nature(candidate)==='OBSERVATION';
        const wa=weight(p),wb=weight(candidate);
        const weighted=bothObserved&&wa!==null&&wb!==null;
        const avg=bothObserved
          ?(weighted?(p.value*wa+candidate.value*wb)/(wa+wb):(p.value+candidate.value)/2)
          :null;
        return result('TABLE2_FIRST_COMPATIBLE_PAIR',{
          ibge:code,variable,checked,table1:primary,table2:tie,
          matched:[p,candidate],
          estimate:avg===null?null:Math.round(avg*100)/100,
          estimateKind:avg===null?'OFFICIAL_OR_COMPLEMENTARY_READING_PLUS_FORECAST_CONTEXT':
            weighted?'QUALITY_WEIGHTED_OBSERVATION_MEAN':'SIMPLE_OBSERVATION_MEAN',
          disagreement:true,
          reason:'MATCHED_ONE_TABLE1_SOURCE_WITH_FIRST_ELIGIBLE_TABLE2_SOURCE',
        });
      }
    }
  }
  return result(primary.length?'TABLE1_DIVERGENCE_NO_VALID_TABLE2_PAIR':'NO_VALID_CURRENT_TABLE1_READING',{
    ibge:code,variable,checked,table1:primary,table2:tie,
    disagreement:primary.length>1,
    reason:'NO_COMPATIBLE_INDEPENDENT_PAIR_FOUND_NO_MEASUREMENT_INVENTED',
  });
}

/**
 * Source adapters are caller-owned and must return records for their own
 * source ID only. This is a sequential scheduler, not a deployed connector.
 */
export async function consultRjTwoTables({
  ibge,variable,adapters={},now=Date.now(),
}={}){
  if(!adapters||typeof adapters!=='object'||Array.isArray(adapters))
    throw new TypeError('rj_invalid_adapters');
  const records=[],contacted=[],failed=[];
  const code=String(ibge);
  const spec=VARIABLES[variable];
  if(!RJ_CODES.has(code)||!spec)throw new TypeError('rj_invalid_municipality_or_variable');
  const consult=async(id)=>{
    const get=adapters[id];
    if(typeof get!=='function')return;
    contacted.push(id);
    try{
      const payload=await get(Object.freeze({ibge:code,variable,sourceId:id,now}));
      if(Array.isArray(payload?.records))
        records.push(...payload.records.slice(0,30).filter(x=>x?.sourceId===id));
    }catch{failed.push(id);}
  };
  for(const id of RJ_TABLE1_SOURCES){
    if(!sourceAllowedForMunicipality(id,code))continue;
    await consult(id);
    const state=reconcileRjTwoTables({ibge:code,variable,records,now});
    if(state.state==='TABLE1_TWO_COMPATIBLE_SOURCES')
      return Object.freeze({...state,contactedSourceIds:Object.freeze(contacted),failedSourceIds:Object.freeze(failed)});
  }
  for(const id of RJ_TABLE2_SOURCES){
    await consult(id);
    const state=reconcileRjTwoTables({ibge:code,variable,records,now});
    if(state.state==='TABLE2_FIRST_COMPATIBLE_PAIR')
      return Object.freeze({...state,contactedSourceIds:Object.freeze(contacted),failedSourceIds:Object.freeze(failed)});
  }
  return Object.freeze({...reconcileRjTwoTables({ibge:code,variable,records,now}),
    contactedSourceIds:Object.freeze(contacted),failedSourceIds:Object.freeze(failed)});
}
