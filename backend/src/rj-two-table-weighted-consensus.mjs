/**
 * Blaise V6 RJ — two-table consultation: Table 1 P1 before Table 2 fallback.
 *
 * Only TWO distinct, comparable records are used in one weighted estimate.
 * One Table-2 observation agreeing with one Table-1 observation is sufficient;
 * the other providers do not have to concur.
 *
 * DIFFERENT DATA PRODUCTS MUST NEVER BE MIXED AS A MEASUREMENT:
 * - Official station + official station => local calculated observation mean.
 * - Independently backtested forecast + forecast => forecast-only estimate.
 * - Official station + INPE/Windy/NOAA model => two labeled values, NO mean.
 * Storm severity, hail occurrence and risk categories cannot be averaged.
 *
 * Caller-supplied adapters here do not prove an online data integration.
 */
import { rjTwoTableRouting } from './rj-phenomenon-source-policy.mjs';
import { weightedOfficialMean } from './rj-scientific-calculator.mjs';
import { weightedComparableForecastMean } from './rj-weather-source-reconciliation.mjs';

export const RJ_TWO_TABLE_VERSION='rj-table1-plus-one-table2-20261012-v1';
const SPECS=Object.freeze({
  TEMPERATURA:Object.freeze({variable:'TEMPERATURA_C',unit:'°C',lo:-30,hi:60,tolerance:2}),
  VENTO:Object.freeze({variable:'VENTO_KMH',unit:'km/h',lo:0,hi:400,tolerance:12}),
  RAJADA:Object.freeze({variable:'RAJADA_KMH',unit:'km/h',lo:0,hi:400,tolerance:16}),
  PRESSAO_ATMOSFERICA:Object.freeze({variable:'PRESSAO_HPA',unit:'hPa',lo:870,hi:1085,tolerance:3}),
  UMIDADE:Object.freeze({variable:'UMIDADE_PERCENTUAL',unit:'%',lo:0,hi:100,tolerance:10}),
  CHUVA_ATUAL:Object.freeze({variable:'TAXA_CHUVA_MM_H',unit:'mm/h',lo:0,hi:400,tolerance:8}),
  CHUVA_ACUMULADA:Object.freeze({variable:'CHUVA_MM_1H',unit:'mm',lo:0,hi:400,tolerance:8}),
});
const NON_MEANABLE=new Set(['SENSACAO_TERMICA','TEMPORAL','GRANIZO']);
const OFFICIAL=new Set(['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION','CEMADEN_RJ']);
const MODEL=new Set(['OPENWEATHERMAP_API','INPE_CPTEC_FORECAST','WINDY_MODELO','NOAA']);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const range=(v,min,max)=>finite(v)&&v>=min&&v<=max;
const kmBetween=(a,b)=>{
  const r=Math.PI/180,dy=(b.latitude-a.latitude)*r,dx=(b.longitude-a.longitude)*r;
  const h=Math.sin(dy/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dx/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
};
const frozenArray=values=>Object.freeze(values.map(x=>Object.freeze({...x})));
const fail=(status,details={})=>Object.freeze({
  status,weightedValue:null,weightedSourceCount:0,
  estimateKind:'NO_CALCULATED_VALUE',
  officialMeasurement:false,automaticAlertAuthorized:false,
  usedSources:Object.freeze([]),...details,
});
const sourceView=row=>Object.freeze({
  sourceId:row.sourceId,
  value:row.value,unit:row.unit,
  type:row.type,
  timestamp:row.type==='OBSERVATION'?row.observedAt:row.validAt,
  referenceId:row.type==='OBSERVATION'?row.stationId:row.productId,
  sourceUrl:row.sourceUrl,
});
function validRow(row,expected,ibge,spec,now) {
  if(!row||typeof row!=='object'||Array.isArray(row)
    ||row.sourceId!==expected||String(row.ibge)!==String(ibge)
    ||row.variable!==spec.variable||row.unit!==spec.unit
    ||!range(row.value,spec.lo,spec.hi)
    ||typeof row.sourceUrl!=='string'||!row.sourceUrl.startsWith('https://')
    ||row.usagePermissionStatus!=='VERIFIED_FOR_APP_DATA_DISPLAY'
    ||!range(row.latitude,-23.7,-20.4)||!range(row.longitude,-45.5,-40.4))
    return false;
  if(spec.variable==='CHUVA_MM_1H'&&row.measurementWindowMinutes!==60)return false;
  if(spec.variable==='TAXA_CHUVA_MM_H'&&row.measurementWindowMinutes!==60)return false;
  if(OFFICIAL.has(expected)) {
    const at=Date.parse(row.observedAt);
    return row.type==='OBSERVATION'&&row.origin==='OFFICIAL_OBSERVATION'
      &&typeof row.stationId==='string'&&row.stationId.length>0
      &&typeof row.originOrganization==='string'&&row.originOrganization.length>0
      &&typeof row.originObservationId==='string'&&row.originObservationId.length>0
      &&row.weightBasis==='DOCUMENTED_STATION_QC'
      &&range(row.weight,0.01,5)
      &&finite(at)&&now-at>=0&&now-at<=7_200_000;
  }
  if(MODEL.has(expected)) {
    const issue=Date.parse(row.issuedAt),valid=Date.parse(row.validAt);
    return row.type==='FORECAST'&&row.kind==='MODEL_FORECAST'
      &&typeof row.modelFamilyId==='string'&&row.modelFamilyId.length>2
      &&typeof row.productId==='string'&&row.productId.length>0
      &&typeof row.modelRunId==='string'&&row.modelRunId.length>0
      &&finite(issue)&&now-issue>=0&&now-issue<=86_400_000
      &&finite(valid)&&Math.abs(valid-now)<=86_400_000
      &&range(row.gridResolutionKm,0.1,25);
  }
  return false;
}
function independent(a,b) {
  if(a.sourceId===b.sourceId)return false;
  if(a.type!==b.type)return false;
  if(a.type==='OBSERVATION')return a.originObservationId!==b.originObservationId
    &&a.originOrganization!==b.originOrganization;
  return a.modelFamilyId!==b.modelFamilyId;
}
function compatible(a,b,spec) {
  if(!independent(a,b)||Math.abs(a.value-b.value)>spec.tolerance
    ||kmBetween(a,b)>25)return false;
  if(a.type==='OBSERVATION')
    return Math.abs(Date.parse(a.observedAt)-Date.parse(b.observedAt))<=900_000;
  return Math.abs(Date.parse(a.validAt)-Date.parse(b.validAt))<=3_600_000;
}
function verifiedForecastSkill(row) {
  return row.weightBasis==='VERIFIED_HISTORICAL_SKILL_FOR_VARIABLE_LOCATION_AND_LEAD'
    &&typeof row.skillEvidenceId==='string'&&row.skillEvidenceId.length>=4
    &&range(row.weight,0.01,1);
}
function weighted(a,b,now,ibge,spec) {
  if(!compatible(a,b,spec))return null;
  if(a.type==='OBSERVATION') {
    const calculation=weightedOfficialMean({
      observations:[a,b],now,maxAgeMs:7_200_000,
      maxSkewMs:900_000,maxSeparationKm:25,
    });
    if(calculation.state!=='CALCULO_EXPERIMENTAL_BLAISE')return null;
    return Object.freeze({
      status:'TWO_COMPATIBLE_OFFICIAL_OBSERVATIONS',
      weightedValue:calculation.value,
      estimateKind:'LOCAL_WEIGHTED_STATION_ESTIMATE_NOT_CITYWIDE_MEASUREMENT',
      formula:'SUM(w_i*x_i)/SUM(w_i)',
      provenance:calculation,
    });
  }
  if(!verifiedForecastSkill(a)||!verifiedForecastSkill(b))return null;
  const mean=weightedComparableForecastMean({
    forecasts:[a,b],ibge,variable:spec.variable,now,
  });
  if(mean.state!=='COMPARABLE_FORECAST_MODELS')return null;
  return Object.freeze({
    status:'TWO_INDEPENDENT_COMPATIBLE_FORECASTS',
    weightedValue:mean.calculatedValue,
    estimateKind:'WEIGHTED_FORECAST_ONLY_NOT_OFFICIAL_OBSERVATION',
    formula:'SUM(w_model_i*forecast_i)/SUM(w_model_i)',
    provenance:mean.calculatedEstimate,
  });
}
function success(c,a,b,extra) {
  return Object.freeze({
    ...c, ...extra,
    weightedSourceCount:2,
    usedSources:Object.freeze([sourceView(a),sourceView(b)]),
    officialMeasurement:false,automaticAlertAuthorized:false,
    mayTriggerAlert:false,
    warningCategoryAveraged:false,
    municipalCoverageImplied:false,
  });
}

/**
 * Run the Table-1 P1 query first, only then consult Table-2 in exact order.
 * The T1 third complement OpenWeatherMap is a model and is not implicitly
 * a third Brazilian warning authority.
 * A single Table-2 corroborator is sufficient — never three-source averaging.
 */
export async function consultRjTwoTableSources({
  ibge,phenomenon,adapters={},now=Date.now(),
}={}) {
  const route=rjTwoTableRouting({ibge,phenomenon});
  if(!finite(now)||!adapters||typeof adapters!=='object'||Array.isArray(adapters))
    throw TypeError('rj_invalid_two_table_adapters_or_clock');
  if(NON_MEANABLE.has(phenomenon)) {
    return fail('NON_NUMERIC_OR_DERIVED_PHENOMENON_NO_WEIGHTED_MEAN',{
      phenomenon,ibge:String(ibge),
      note:'Thermal sensation needs physical derivation; hail and storm warning levels cannot be weighted.',
    });
  }
  const spec=SPECS[phenomenon];
  if(!spec)throw TypeError('rj_phenomenon_not_supported_for_mean');
  const consulted=[],errors=[],t1=[],t2=[];
  async function fetchSource(source,store) {
    if(typeof adapters[source.id]!=='function')return;
    consulted.push(source.id);
    try {
      const batch=await adapters[source.id](Object.freeze({
        sourceId:source.id,ibge:String(ibge),phenomenon,variable:spec.variable,now,
      }));
      const rows=Array.isArray(batch?.observations)&&OFFICIAL.has(source.id)
        ?batch.observations
        :Array.isArray(batch?.forecasts)&&MODEL.has(source.id)?batch.forecasts:[];
      for(const row of rows.slice(0,20)) {
        if(validRow(row,source.id,ibge,spec,now))store.push(Object.freeze({...row}));
      }
    } catch { errors.push(source.id); }
  }
  const context=()=>({
    ibge:String(ibge),phenomenon,unit:spec.unit,
    consultedSources:Object.freeze([...consulted]),
    adapterFailures:Object.freeze([...errors]),
    table1Readings:Object.freeze(t1.map(sourceView)),
    table2Readings:Object.freeze(t2.map(sourceView)),
    liveIntegrationVerified:false,
  });
  // P1 are jointly prioritized. First P1 pair is sufficient when valid.
  for(const source of route.table1) {
    await fetchSource(source,t1);
    if(source.id!=='DEFESA_CIVIL_RJ_REGIONAL')continue;
    const p1=t1.filter(x=>x.type==='OBSERVATION');
    for(let i=0;i<p1.length;i++)for(let j=i+1;j<p1.length;j++) {
      const value=weighted(p1[i],p1[j],now,String(ibge),spec);
      if(value)return success(value,p1[i],p1[j],{
        ...context(),agreementStage:'TABLE_1_JOINT_P1',
      });
    }
  }
  let closestModelContext=null;
  const t1Official=t1.filter(x=>x.type==='OBSERVATION');
  for(const source of route.table2) {
    await fetchSource(source,t2);
    const newRows=t2.filter(x=>x.sourceId===source.id);
    for(const b of newRows)for(const a of t1) {
      const value=weighted(a,b,now,String(ibge),spec);
      if(value) return success(value,a,b,{
        ...context(),agreementStage:'ONE_TABLE_1_PLUS_ONE_TABLE_2',
        table2UsedCount:1,
      });
      // A forecast close to an official observation can guide the display,
      // but cannot be averaged with an observation.
      if(a.type==='OBSERVATION'&&b.type==='FORECAST'
        &&kmBetween(a,b)<=25
        &&Math.abs(Date.parse(a.observedAt)-Date.parse(b.validAt))<=3_600_000
        &&Math.abs(a.value-b.value)<=spec.tolerance
        &&verifiedForecastSkill(b)
        &&!closestModelContext) {
        closestModelContext={observed:a,forecast:b};
      }
    }
  }
  if(closestModelContext) {
    return fail('OFFICIAL_READING_CORROBORATED_BY_MODEL_NO_WEIGHTED_MEASUREMENT',{
      ...context(),
      usedSources:Object.freeze([
        sourceView(closestModelContext.observed),
        sourceView(closestModelContext.forecast),
      ]),
      agreementStage:'ONE_TABLE_1_PLUS_ONE_TABLE_2',
      note:'Forecast-model agreement is complementary evidence, not a second measured value.',
    });
  }
  const all=[...t1Official,...t2.filter(x=>x.type==='OBSERVATION')];
  return fail(all.length?'TWO_COMPATIBLE_SOURCES_NOT_FOUND':'NO_VERIFIED_OBSERVATION_AVAILABLE',{
    ...context(),
    displayedObservations:Object.freeze(all.map(sourceView)),
    note:'The two tables were consulted; never invent agreement or a weighted measurement.',
  });
}
