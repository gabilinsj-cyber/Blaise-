/**
 * Blaise V6 RJ — Table 1 / Table 2 cascade.
 * Table 1: Alerta Rio (Rio municipality only), regional Civil Defence,
 * then complementary OpenWeatherMap product (independence NOT presumed).
 * If TWO genuinely independent measured readings match, calculate and STOP.
 * Otherwise Table 2: INPE/CPTEC -> INMET -> CEMADEN -> Windy -> NOAA.
 *
 * A forecast may corroborate/provide context to ONE measured reading but
 * CANNOT be numerically averaged with a station observation or certify a
 * warning. A modeled OpenWeatherMap value is not a second measured source.
 * All inputs require upstream-authenticated and licensed source adapters.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

export const RJ_TABLE1_FOUR=Object.freeze([
  'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','OPENWEATHERMAP_API','REDEMET_METAR',
]);
export const RJ_TABLE1_THREE=RJ_TABLE1_FOUR; // compatibility export
export const RJ_TABLE2_FIVE=Object.freeze([
  'INPE_CPTEC_FORECAST','INMET_STATION','CEMADEN_RJ','WINDY_MODELO','NOAA',
]);
export const RJ_TABLE12_CASCADE_VERSION='2026-10-14.v4';
const RJ_CITIES=new Set(RJ_MUNICIPALITIES.map(row=>row.ibge));
const VARIABLES=Object.freeze({
  TEMPERATURA_C:Object.freeze({unit:'°C',min:-30,max:60,threshold:2}),
  UMIDADE_PERCENTUAL:Object.freeze({unit:'%',min:0,max:100,threshold:10}),
  VENTO_KMH:Object.freeze({unit:'km/h',min:0,max:400,threshold:12}),
  RAJADA_KMH:Object.freeze({unit:'km/h',min:0,max:400,threshold:16}),
  CHUVA_MM_1H:Object.freeze({unit:'mm',min:0,max:400,threshold:8,window:60}),
  PRESSAO_HPA:Object.freeze({unit:'hPa',min:850,max:1100,threshold:3}),
});
const SOURCE_ORIGIN=Object.freeze({
  ALERTA_RIO:'ALERTA_RIO',
  DEFESA_CIVIL_RJ_REGIONAL:'DEFESA_CIVIL_RJ_REGIONAL',
  DEFESA_CIVIL:'DEFESA_CIVIL_RJ_REGIONAL',
  OPENWEATHERMAP_API:'OPENWEATHERMAP_API',
  REDEMET_METAR:'REDEMET_METAR',
  INMET_STATION:'INMET_STATION',
  INMET:'INMET_STATION',
  CEMADEN_RJ:'CEMADEN_RJ',
  CEMADEN:'CEMADEN_RJ',
});
const STATIONS=new Set([
  'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION','CEMADEN_RJ','REDEMET_METAR',
]);
const MODELS=new Set(['INPE_CPTEC_FORECAST','WINDY_MODELO','NOAA','OPENWEATHERMAP_API']);
const CEMADEN_VARIABLES=new Set(['CHUVA_MM_1H']);
const valid=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const time=(x)=>typeof x==='string'?Date.parse(x):NaN;
const withinTime=(t,now,maxAgeMs)=>Number.isFinite(t)&&now-t>=0&&now-t<=maxAgeMs;
const approx=(a,b)=>{
  const rad=Math.PI/180,phi=(b.latitude-a.latitude)*rad;
  const lambda=(b.longitude-a.longitude)*rad;
  const h=Math.sin(phi/2)**2+Math.cos(a.latitude*rad)
    *Math.cos(b.latitude*rad)*Math.sin(lambda/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
};
const safe=(state,fields={})=>Object.freeze({
  state,estimatedValue:null,
  weighted:false,
  safeForAutomaticWarning:false,
  mayClaimOfficialMunicipalMeasurement:false,
  selectedSources:Object.freeze([]),
  ...fields,
});
function provenanceValid(row,{sourceId,ibge,variable,spec,now}) {
  return row && typeof row==='object' && !Array.isArray(row)
    && SOURCE_ORIGIN[row.sourceId]===sourceId
    && String(row.ibge)===String(ibge)&&row.variable===variable
    && row.unit===spec.unit&&valid(row.value,spec.min,spec.max)
    &&typeof row.sourceUrl==='string'&&row.sourceUrl.startsWith('https://')
    &&valid(row.latitude,-23.7,-20.4)&&valid(row.longitude,-45.5,-40.4)
    &&row.usagePermissionStatus==='VERIFIED_FOR_APP_DATA_DISPLAY'
    &&(spec.window===undefined||row.measurementWindowMinutes===spec.window)
    &&withinTime(time(row.observedAt),now,300_000);
}
function readingAllowed(row,opts){
  if(!provenanceValid(row,opts))return false;
  if(opts.sourceId==='CEMADEN_RJ'&&!CEMADEN_VARIABLES.has(opts.variable))return false;
  if(opts.sourceId==='REDEMET_METAR' && (String(opts.ibge)!=='3304557'||!['SBGL','SBRJ'].includes(row.stationId)||!['TEMPERATURA_C','VENTO_KMH','RAJADA_KMH'].includes(opts.variable)))return false;
  if(typeof row.stationId!=='string'||row.stationId.length<2)return false;
  if(STATIONS.has(opts.sourceId))
    return row.origin==='OFFICIAL_OBSERVATION';
  // OpenWeatherMap often blends models and observations. It only becomes
  // a genuinely independent raw station when independent provenance is PROVEN.
  return opts.sourceId==='OPENWEATHERMAP_API'
    &&row.origin==='INDEPENDENT_STATION_OBSERVATION'
    &&row.rawStationObservation===true
    &&row.independenceVerified===true
    &&typeof row.underlyingProviderId==='string'
    &&row.underlyingProviderId.length>=3
    &&typeof row.upstreamMeasurementId==='string'
    &&row.upstreamMeasurementId.length>=3;
}
function forecastAllowed(row,{sourceId,ibge,variable,spec,now}){
  return row&&MODELS.has(sourceId)
    &&row.sourceId===sourceId&&row.kind==='MODEL_FORECAST'
    &&String(row.ibge)===String(ibge)&&row.variable===variable
    &&row.unit===spec.unit&&valid(row.value,spec.min,spec.max)
    &&typeof row.sourceUrl==='string'&&row.sourceUrl.startsWith('https://')
    &&row.usagePermissionStatus==='VERIFIED_FOR_APP_DATA_DISPLAY'
    &&typeof row.modelFamilyId==='string'&&row.modelFamilyId.length>=3
    &&typeof row.productId==='string'&&row.productId.length>=3
    &&valid(row.latitude,-23.7,-20.4)&&valid(row.longitude,-45.5,-40.4)
    &&valid(row.gridResolutionKm,0.1,25)
    &&(spec.window===undefined||row.forecastWindowMinutes===spec.window)
    &&withinTime(time(row.issuedAt),now,24*3_600_000)
    &&Number.isFinite(time(row.validAt))
    &&Math.abs(time(row.validAt)-now)<=24*3_600_000
    &&row.weightBasis==='VERIFIED_HISTORICAL_SKILL_FOR_VARIABLE_LOCATION_AND_LEAD'
    &&typeof row.skillEvidenceId==='string'&&row.skillEvidenceId.length>=4;
}
const observedSummary=o=>Object.freeze({
  sourceId:SOURCE_ORIGIN[o.sourceId],stationId:o.stationId,ibge:String(o.ibge),variable:o.variable,
  value:o.value,unit:o.unit,observedAt:o.observedAt,
  sourceUrl:o.sourceUrl,type:'OBSERVED_STATION',
  qualityWeight:o.qualityWeight??null,qualityEvidenceId:o.qualityEvidenceId??null,
});
const modelSummary=m=>Object.freeze({
  sourceId:m.sourceId,productId:m.productId,ibge:String(m.ibge),variable:m.variable,
  value:m.value,unit:m.unit,validAt:m.validAt,
  sourceUrl:m.sourceUrl,type:'MODEL_FORECAST_NOT_A_SENSOR',
});
function independent(a,b){
  const first=a.underlyingProviderId||SOURCE_ORIGIN[a.sourceId];
  const second=b.underlyingProviderId||SOURCE_ORIGIN[b.sourceId];
  return first!==second && (a.upstreamMeasurementId==null
    ||a.upstreamMeasurementId!==b.upstreamMeasurementId);
}
function comparable(a,b,spec){
  return a.unit===b.unit && (spec.window===undefined
    ||a.measurementWindowMinutes===b.measurementWindowMinutes)
    &&Math.abs(time(a.observedAt)-time(b.observedAt))<=300_000
    &&approx(a,b)<=25;
}
function observedPair(pair,spec,{stage,step,consultedSources,allPrimary}){
  const [a,b]=pair;
  const weighted=pair.every(x=>valid(x.qualityWeight,0.01,5)
    &&x.qualityWeightBasis==='VERIFIED_STATION_QC_AND_LOCAL_SKILL'
    &&typeof x.qualityEvidenceId==='string'&&x.qualityEvidenceId.length>=4);
  const estimate=weighted
    ?(a.value*a.qualityWeight+b.value*b.qualityWeight)/(a.qualityWeight+b.qualityWeight)
    :null;
  return safe('TWO_INDEPENDENT_COMPARABLE_OBSERVATIONS',{
    stage,decisionStep:step,estimatedValue:weighted?Math.round(estimate*100)/100:null,
    formula:weighted?'SUM(weight*value)/SUM(weights)':null,
    calculationStatus:weighted?'VERIFIED_WEIGHTED_MEAN':'WEIGHT_EVIDENCE_MISSING_SHOW_READINGS',
    weighted,measurementPair:Object.freeze(pair.map(observedSummary)),
    selectedSources:Object.freeze(pair.map(x=>SOURCE_ORIGIN[x.sourceId])),
    originalPrimaryReadings:Object.freeze(allPrimary.map(observedSummary)),
    consultedSources:Object.freeze([...consultedSources]),
    calculatedNotOfficialMeasurement:true,
  });
}
const bestModelPair=(observed,model,spec,{consultedSources,allPrimary,stage})=>{
  const compare=observed.filter(o=>Math.abs(time(model.validAt)-time(o.observedAt))<=3_600_000
    &&approx(model,o)<=25);
  if(!compare.length)return null;
  const ordered=[...compare].sort((a,b)=>
    Math.abs(a.value-model.value)-Math.abs(b.value-model.value));
  const winner=ordered[0];
  const difference=Math.abs(winner.value-model.value);
  // Only highlight if the product is meaningfully compatible with a station.
  if(difference>spec.threshold)return null;
  if(ordered.length>=2 &&
    Math.abs(ordered[1].value-model.value)-difference<=Math.max(spec.threshold*.25,.05))
    return null;
  return safe('OFFICIAL_OR_VETTED_READING_WITH_MODEL_REFERENCE',{
    stage,decisionStep:'FIRST_COMPATIBLE_DISPUTE_REFERENCE',
    estimatedValue:null,weighted:false,
    selectedSources:Object.freeze([SOURCE_ORIGIN[winner.sourceId],model.sourceId]),
    readingAndForecast:Object.freeze([observedSummary(winner),modelSummary(model)]),
    originalPrimaryReadings:Object.freeze(allPrimary.map(observedSummary)),
    consultedSources:Object.freeze([...consultedSources]),
    explanation:'MODEL_APPROXIMATION_IS_NOT_SECOND_MEASUREMENT_OR_OFFICIAL_CONSENSUS',
  });
};

/** Deterministic pure resolution from source-attributed, already validated batches. */
export function resolveRjTable12FiveSourceDispute({
  ibge,variable,observations=[],forecasts=[],now=Date.now(),observationsOnly=false,
}={}){
  if(!RJ_CITIES.has(String(ibge)))throw new TypeError('rj_table12_municipality_invalid');
  const spec=VARIABLES[variable];
  if(!spec)throw new TypeError('rj_table12_variable_not_numeric_or_not_supported');
  if(!Number.isFinite(now)||!Array.isArray(observations)
    ||!Array.isArray(forecasts)||observations.length>100||forecasts.length>100)
    throw new TypeError('rj_table12_records_invalid');
  const primary=RJ_TABLE1_THREE.filter(id=>id!=='ALERTA_RIO'||String(ibge)==='3304557');
  const checked=[];
  const validated=[];
  const uniqueStation=new Set();
  function gather(id){
    const entries=observations.filter(o=>readingAllowed(o,{
      sourceId:id,ibge,variable,spec,now,
    })).sort((a,b)=>time(b.observedAt)-time(a.observedAt));
    for(const row of entries){
      const key=id+':'+row.stationId;
      if(uniqueStation.has(key))continue;
      uniqueStation.add(key);
      // A specific sensor shown by two publishers is still ONE observation.
      // A Table 2 reference must match AT LEAST ONE of the initial
      // Table 1 observations. Agreement between two comparator providers
      // alone does not resolve the original primary-source discrepancy.
      const hasPrimary = validated.some(old=>primary.includes(SOURCE_ORIGIN[old.sourceId]));
      const primaryCandidates=RJ_TABLE2_FIVE.includes(id) && hasPrimary
        ?validated.filter(old=>primary.includes(SOURCE_ORIGIN[old.sourceId]))
        :validated;
      const candidate=primaryCandidates.filter(old=>independent(old,row)
        &&SOURCE_ORIGIN[old.sourceId]!==SOURCE_ORIGIN[row.sourceId]
        &&comparable(old,row,spec)
        &&Math.abs(old.value-row.value)<=spec.threshold)[0];
      if(candidate)return [candidate,row];
      validated.push(row);
    }
    return null;
  }
  for(const id of primary){
    checked.push(id);
    const pair=gather(id);
    if(pair)return observedPair(pair,spec,{
      stage:'TABLE_1_TWO_OF_THREE_CONVERGED',step:'TWO_TABLE1_READINGS_CONVERGED',
      consultedSources:checked,allPrimary:[...validated,pair[1]],
    });
  }
  const initial=[...validated];
  let firstModelContext=null;
  // Only after no compatible Table 1 pair: consult five suppliers in EXACT
  // order. Never treat a modeled product as a second measured observation.
  for(const id of RJ_TABLE2_FIVE){
    checked.push(id);
    if(STATIONS.has(id)){
      const pair=gather(id);
      if(pair)return observedPair(pair,spec,{
        stage:'TABLE_2_OBSERVED_DISPUTE_RESOLVED',
        step:initial.length?'INDEPENDENT_OBSERVATION_CONFIRMS_ONE_PRIMARY':'TWO_TABLE2_OBSERVATIONS_WITHOUT_PRIMARY',
        consultedSources:checked,allPrimary:initial,
      });
    } else {
      const products=forecasts.filter(f=>forecastAllowed(f,{
        sourceId:id,ibge,variable,spec,now,
      })).sort((a,b)=>time(b.issuedAt)-time(a.issuedAt));
      for(const product of products.slice(0,1)){
        const match=bestModelPair(initial,product,spec,{
          consultedSources:checked,allPrimary:initial,stage:'TABLE_2_MODEL_COMPARISON',
        });
        if(match){
          if(!observationsOnly)return match;
          firstModelContext??=match;
        }
      }
    }
  }
  if(firstModelContext)return firstModelContext;
  return safe('NO_VERIFIABLE_CONVERGENCE',{
    stage:'ALL_ELIGIBLE_SOURCES_EXAMINED',
    originalPrimaryReadings:Object.freeze(initial.map(observedSummary)),
    primaryComplementaryForecasts:Object.freeze(forecasts.filter(f=>
      f.sourceId==='OPENWEATHERMAP_API'&&forecastAllowed(f,{
        sourceId:'OPENWEATHERMAP_API',ibge,variable,spec,now,
      })).map(modelSummary)),
    consultedSources:Object.freeze(checked),
    conclusion:'SHOW_REAL_READINGS_OR_UNAVAILABLE_DO_NOT_INVENT_SECOND_READING',
  });
}

/** Authorized adapter contract. Does not connect external services itself. */
export async function consultRjTable12FiveSourceDispute({
  ibge,variable,adapters={},now=Date.now(),adapterTimeoutMs=8000,
  elapsedClock=()=>performance.now(),observationsOnly=false,
}={}){
  if(!adapters||typeof adapters!=='object'||Array.isArray(adapters)
    ||!Number.isInteger(adapterTimeoutMs)||adapterTimeoutMs<10||adapterTimeoutMs>8000
    ||typeof elapsedClock!=='function')
    throw new TypeError('rj_table12_invalid_adapters');
  // Input check before any connector is called.
  resolveRjTable12FiveSourceDispute({ibge,variable,now,observationsOnly});
  const started=elapsedClock();
  if(!Number.isFinite(started))throw new TypeError('rj_table12_invalid_clock');
  const decisionNow=()=>{
    const elapsed=elapsedClock()-started;
    if(!Number.isFinite(elapsed)||elapsed<0)throw new TypeError('rj_table12_invalid_clock');
    return now+elapsed;
  };
  const consulted=[],observations=[],forecasts=[],connectorFailures=[];
  const order=[...RJ_TABLE1_THREE.filter(x=>x!=='ALERTA_RIO'||String(ibge)==='3304557'),
    ...RJ_TABLE2_FIVE];
  for(const id of order){
    const adapter=adapters[id];
    if(typeof adapter!=='function')continue;
    consulted.push(id);
    const controller=new AbortController();
    let timer;
    try{
      const result=await Promise.race([
        Promise.resolve().then(()=>adapter(Object.freeze({ibge:String(ibge),variable,now:decisionNow(),sourceId:id,signal:controller.signal}))),
        new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('source_timeout'));},adapterTimeoutMs);}),
      ]);
      if(result&&typeof result==='object'&&!Array.isArray(result)){
        if(Array.isArray(result.observations))
          observations.push(...result.observations.slice(0,8).filter(x=>
            SOURCE_ORIGIN[x?.sourceId]===id));
        if(Array.isArray(result.forecasts))
          forecasts.push(...result.forecasts.slice(0,8).filter(x=>x?.sourceId===id));
      }
    }catch(_){connectorFailures.push(id);}
    finally{clearTimeout(timer);}
    const decision=resolveRjTable12FiveSourceDispute({
      ibge,variable,observations,forecasts,now:decisionNow(),observationsOnly,
    });
    if(decision.state==='TWO_INDEPENDENT_COMPARABLE_OBSERVATIONS'
      ||(!observationsOnly&&decision.state==='OFFICIAL_OR_VETTED_READING_WITH_MODEL_REFERENCE'))
      return Object.freeze({...decision,
        actuallyContactedSources:Object.freeze([...consulted]),
        connectorFailures:Object.freeze([...connectorFailures]),
      });
  }
  const final=resolveRjTable12FiveSourceDispute({
    ibge,variable,observations,forecasts,now:decisionNow(),observationsOnly,
  });
  return Object.freeze({...final,
    actuallyContactedSources:Object.freeze(consulted),
    connectorFailures:Object.freeze(connectorFailures),
    allIntegrationsConnected:false,
  });
}
