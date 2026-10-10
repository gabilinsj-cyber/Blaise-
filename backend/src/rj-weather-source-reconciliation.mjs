/**
 * Independent source reconciliation for Blaise V6 RJ.
 *
 * Keep observations and forecast models in SEPARATE groups.
 * INPE/CPTEC is an official forecast and satellite product provider, distinct
 * from INMET (observed stations). A third source can clarify disagreement, but
 * cannot by itself manufacture an observed temperature, rainfall or warning.
 *
 * All products below are in-memory, pre-validated PROVENANCE RECORDS. This
 * module does not access networks, scrape sites, grant data licenses or emit
 * automatic alerts.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';
import { weightedOfficialMean } from './rj-scientific-calculator.mjs';

const CODES = new Set(RJ_MUNICIPALITIES.map(c => c.ibge));
const OFFICIAL_OBSERVERS = new Set([
  'INMET','INMET_STATION','ALERTA_RIO','CEMADEN','CEMADEN_RJ',
  'DEFESA_CIVIL','DEFESA_CIVIL_RJ_REGIONAL','MARINHA_CHM',
]);
const FORECAST_PROVIDERS = new Set(['INPE_CPTEC_FORECAST','NOAA','WINDY_MODELO']);
const THRESHOLDS = Object.freeze({
  TEMPERATURA_C: {unit:'°C',maxDifference:2.0,minimum:-30,maximum:60},
  VENTO_KMH: {unit:'km/h',maxDifference:12,minimum:0,maximum:400},
  RAJADA_KMH: {unit:'km/h',maxDifference:16,minimum:0,maximum:400},
  CHUVA_MM_1H: {unit:'mm',maxDifference:8,minimum:0,maximum:400},
  UMIDADE_PERCENTUAL: {unit:'%',maxDifference:10,minimum:0,maximum:100},
});
const result = (state, fields={}) => Object.freeze({
  state,
  calculatedValue:null,
  officialMeasurement:false,
  automaticAlertAuthorized:false,
  action:'DO_NOT_ISSUE_AUTOMATIC_WARNING',
  ...fields,
});
const numeric = (v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const fresh = (iso,now,maxAgeMs)=>{
  const ms=Date.parse(iso);
  return Number.isFinite(ms)&&now-ms>=0&&now-ms<=maxAgeMs;
};

function validatedObserved(observations,{ibge,variable,now}) {
  const threshold=THRESHOLDS[variable];
  return observations.filter(o=>o&&o.origin==='OFFICIAL_OBSERVATION'
    &&OFFICIAL_OBSERVERS.has(o.sourceId)
    &&String(o.ibge)===String(ibge)&&o.variable===variable&&o.unit===threshold.unit
    &&numeric(o.value,threshold.minimum,threshold.maximum)
    &&fresh(o.observedAt,now,7_200_000)
    &&typeof o.stationId==='string'&&o.stationId.length>0
    &&typeof o.sourceUrl==='string'&&o.sourceUrl.startsWith('https://')
    &&numeric(o.latitude,-23.7,-20.4)&&numeric(o.longitude,-45.5,-40.4)
  );
}
function validatedForecast(forecasts,{ibge,variable,now}) {
  const spec=THRESHOLDS[variable];
  return forecasts.filter(f=>f&&FORECAST_PROVIDERS.has(f.sourceId)
    &&f.kind==='MODEL_FORECAST'&&String(f.ibge)===String(ibge)
    &&f.variable===variable&&f.unit===spec.unit
    &&numeric(f.value,spec.minimum,spec.maximum)
    &&fresh(f.issuedAt,now,24*3_600_000)
    &&typeof f.productId==='string'&&f.productId.length>0
    &&typeof f.modelRunId==='string'&&f.modelRunId.length>0
    &&typeof f.sourceUrl==='string'&&f.sourceUrl.startsWith('https://')
    &&numeric(Date.parse(f.validAt),0,Number.MAX_SAFE_INTEGER)
    &&Math.abs(Date.parse(f.validAt)-now)<=24*3_600_000
    &&f.usagePermissionStatus==='VERIFIED_FOR_APP_DATA_DISPLAY'
  );
}

/**
 * Windy is a forecast/model viewer, not a station. A model at the same
 * locality and valid time may be compared against conflicting observations
 * to PRIORITIZE MANUAL REVIEW, never to certify which reading is true.
 */
function modelDisagreementContext(model, observed, variable) {
  if (!model || !observed.length) return null;
  const modelAt=Date.parse(model.validAt);
  const comparable=observed.filter(o => Math.abs(modelAt-Date.parse(o.observedAt)) <= 3_600_000);
  if (!comparable.length) return null;
  return Object.freeze({
    status:'MODEL_COMPARISON_ONLY_NOT_AUTHORITATIVE_TIE_BREAK',
    sourceId:model.sourceId,
    productId:model.productId,
    modelRunId:model.modelRunId,
    validAt:model.validAt,
    forecastValue:model.value,
    comparedReadings:Object.freeze(comparable.map(o => Object.freeze({
      stationId:o.stationId,sourceId:o.sourceId,
      measuredValue:o.value,absoluteDifference:Math.round(Math.abs(o.value-model.value)*100)/100,
    }))),
    preferredOfficialMeasurement:null,
    permissibleAsOfficialObservation:false,
    automaticallyIssueAlert:false,
    note:'Difference against a forecast does not establish which station is correct.',
  });
}

/**
 * An explicit policy threshold detects disagreements; it is a screening
 * threshold, NOT the physical uncertainty of a particular sensor or model.
 * When a significant conflict exists, do NOT average away the uncertainty.
 * INPE/CPTEC can be consulted as independent forecast CONTEXT only.
 */
export function assessRjMeteorologicalDisagreement({
  observations=[],forecasts=[],ibge,variable,now=Date.now(),
}={}) {
  if(!CODES.has(String(ibge))) throw new TypeError('rj_invalid_municipality');
  if(!Object.hasOwn(THRESHOLDS,variable)) throw new TypeError('rj_unsupported_weather_variable');
  if(!Array.isArray(observations)||observations.length>20||!Array.isArray(forecasts)||forecasts.length>20
    ||!Number.isFinite(now))throw TypeError('invalid_sources_or_clock');
  const obs=validatedObserved(observations,{ibge,variable,now});
  const fc=validatedForecast(forecasts,{ibge,variable,now});
  const inpe=fc.filter(f=>f.sourceId==='INPE_CPTEC_FORECAST');
  const windy=fc.filter(f=>f.sourceId==='WINDY_MODELO');
  const threshold=THRESHOLDS[variable];
  const forecastAdvice=Object.freeze({
    inpeAvailable:inpe.length>0,
    inpeConsultation:'INDEPENDENT_FORECAST_CONTEXT_NOT_AN_OBSERVATION',
    windyAvailable:windy.length>0,
    windyConsultation:'SUPPLEMENTARY_MODEL_DISPUTE_REVIEW_NOT_AN_OFFICIAL_TIE_BREAK',
    availableForecastSourceIds:Object.freeze([...new Set(fc.map(f=>f.sourceId))]),
  });
  const common={variable,ibge:String(ibge),unit:threshold.unit,
    officialObservationCount:obs.length, ...forecastAdvice,
    thresholdsAreScreeningValuesNotSensorAccuracy:true};
  if(obs.length<2) return result('INSUFFICIENT_OFFICIAL_OBSERVATIONS',{
    ...common, action:inpe.length?'REVIEW_OFFICIAL_DATA_AND_INPE_FORECAST_CONTEXT':'CONSULT_INPE_CPTEC_IF_APPROVED_AND_AVAILABLE',
  });
  const distinct=new Set(obs.map(o=>`${o.sourceId}:${o.stationId}`));
  if(distinct.size!==obs.length) return result('NONINDEPENDENT_OR_DUPLICATE_OBSERVATIONS',{
    ...common,action:'REVIEW_STATION_IDENTITY',
  });
  const spread=Math.max(...obs.map(o=>o.value))-Math.min(...obs.map(o=>o.value));
  if(spread>threshold.maxDifference) {
    const windyEvidence=modelDisagreementContext(windy[0],obs,variable);
    const inpeEvidence=modelDisagreementContext(inpe[0],obs,variable);
    return result('SIGNIFICANT_OFFICIAL_DATA_DISAGREEMENT',{
      ...common,spread,screeningThreshold:threshold.maxDifference,
      observedRange:Object.freeze({
        minimum:Math.min(...obs.map(o=>o.value)),
        maximum:Math.max(...obs.map(o=>o.value)),
        unit:threshold.unit,
        label:'INCONSISTENT_STATION_READINGS_NOT_A_SINGLE_MUNICIPAL_VALUE',
      }),
      windyComparison:windyEvidence,
      inpeComparison:inpeEvidence,
      action:windyEvidence?'REVIEW_OFFICIAL_DIVERGENCE_WITH_WINDY_AS_NONAUTHORITATIVE_COMPARISON':
        inpeEvidence?'REVIEW_DIVERGENCE_WITH_INPE_AS_FORECAST_CONTEXT':
        'CONSULT_INPE_CPTEC_AND_WINDY_IF_AUTHORIZED_AND_AVAILABLE',
    });
  }
  // Validate station separation, time matching, weights etc. in the existing
  // provenanced calculator; no model forecast is sent to this function.
  const mean=weightedOfficialMean({
    observations:obs,now,maxAgeMs:7_200_000,maxSkewMs:900_000,maxSeparationKm:25,
  });
  if(mean.state!=='CALCULO_EXPERIMENTAL_BLAISE')
    return result('OBSERVATIONS_NOT_COMPARABLE',{...common,
      calculationReason:mean.reason,action:'REVIEW_MEASUREMENT_COMPATIBILITY'});
  return result('COMPARABLE_OFFICIAL_OBSERVATIONS',{
    ...common,spread,screeningThreshold:threshold.maxDifference,
    calculatedValue:mean.value,
    calculatedEstimate:Object.freeze({
      ...mean,officialMeasurement:false,mayTriggerAlert:false,
      comparisonWithInpeIsNotAnObservation:true,
    }),
    action:'DISPLAY_DERIVED_OFFICIAL_OBSERVATION_MEAN_WITH_PROVENANCE',
  });
}

/**
 * Optional FORECAST-ONLY weighted mean. Requires at least two different
 * product providers, same model variable/valid time/location and documented
 * independently backtested skill weights. No mixing with observations.
 */
export function weightedComparableForecastMean({forecasts=[],ibge,variable,
  now=Date.now(),maxValidTimeSkewMs=3_600_000}={}) {
  if(!CODES.has(String(ibge))||!Object.hasOwn(THRESHOLDS,variable))return result('INVALID_SCOPE');
  if(!Array.isArray(forecasts)||forecasts.length<2||forecasts.length>12
    ||!numeric(maxValidTimeSkewMs,0,3_600_000))return result('INSUFFICIENT_COMPARABLE_FORECASTS');
  const group=validatedForecast(forecasts,{ibge,variable,now});
  if(group.length!==forecasts.length) return result('MODEL_INPUT_NOT_VALIDATED');
  if(new Set(group.map(f=>f.sourceId)).size!==group.length)return result('DUPLICATE_PROVIDER_OR_CORRELATED_PRODUCTS');
  const times=group.map(f=>Date.parse(f.validAt));
  if(Math.max(...times)-Math.min(...times)>maxValidTimeSkewMs)
    return result('FORECAST_VALID_TIMES_DIFFER');
  if(group.some(f=>!numeric(f.weight,0.01,1)
    ||f.weightBasis!=='VERIFIED_HISTORICAL_SKILL_FOR_VARIABLE_LOCATION_AND_LEAD'
    ||typeof f.skillEvidenceId!=='string'||f.skillEvidenceId.length<4))
    return result('FORECAST_WEIGHTS_NOT_CALIBRATED');
  const denominator=group.reduce((s,f)=>s+f.weight,0);
  const avg=group.reduce((s,f)=>s+f.weight*f.value,0)/denominator;
  return result('COMPARABLE_FORECAST_MODELS',{
    ibge:String(ibge),variable,unit:THRESHOLDS[variable].unit,
    calculatedValue:Math.round(avg*100)/100,
    calculatedEstimate:Object.freeze({
      kind:'CALCULO_EXPERIMENTAL_BLAISE_SOMENTE_PREVISOES',
      method:'WEIGHTED_AVERAGE_OF_INDEPENDENT_VALIDATED_FORECASTS',
      providers:Object.freeze(group.map(f=>f.sourceId)),
      validAt:new Date(Math.max(...times)).toISOString(),
      comparisonEvidenceIds:Object.freeze(group.map(f=>f.skillEvidenceId)),
      notOfficialObservation:true,
      notAnAlert:true,
      officialMeasurement:false,
    }),
    action:'DISPLAY_AS_UNCERTAIN_MODEL_FORECAST_ONLY',
  });
}
