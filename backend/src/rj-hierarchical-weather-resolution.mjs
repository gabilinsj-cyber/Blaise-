/**
 * Blaise V6 RJ — two compatible sources in strict source priority.
 *
 * This is NOT a live connector and NEVER generates fake observations.
 * Source adapters must independently validate credentials, access rights,
 * station metadata, freshness and licensing before providing input records.
 *
 * Hierarchy comes from the selected RJ municipality + phenomenon routing,
 * rather than a single order for rain, temperature and marine conditions.
 * The first TWO *compatible and independent* official station providers are
 * enough. If sources 1–2 disagree, continue to 3–5 and beyond when the
 * phenomenon requires its specialist sources.
 *
 * Forecast sources (INPE/CPTEC, Windy) are not station measurements. They
 * may form a separate forecast pair if historical skill weights are verified,
 * but cannot be combined with observed readings nor overrule official alerts.
 */
import { rjSourceRouting } from './rj-phenomenon-source-policy.mjs';
import { weightedOfficialMean } from './rj-scientific-calculator.mjs';
import {
  weightedComparableForecastMean,
  compareInpeWindyToDiscrepantObservations,
} from './rj-weather-source-reconciliation.mjs';

export const RJ_PRIORITY_RESOLUTION_VERSION = 'rj-two-compatible-2026-10-10-v1';
const OFFICIAL_SOURCE_MAP = Object.freeze({
  ALERTA_RIO: 'ALERTA_RIO',
  DEFESA_CIVIL: 'DEFESA_CIVIL_RJ_REGIONAL',
  DEFESA_CIVIL_RJ_REGIONAL: 'DEFESA_CIVIL_RJ_REGIONAL',
  CEMADEN: 'CEMADEN_RJ',
  CEMADEN_RJ: 'CEMADEN_RJ',
  INMET: 'INMET_STATION',
  INMET_STATION: 'INMET_STATION',
  ANA: 'ANA_HIDROWEB',
  ANA_HIDROWEB: 'ANA_HIDROWEB',
  SGB_SACE: 'SGB_SACE',
  MARINHA_CHM: 'MARINHA_CHM',
});
const OBSERVED = new Set(Object.values(OFFICIAL_SOURCE_MAP));
const FORECAST = new Set(['INPE_CPTEC_FORECAST', 'WINDY_MODELO', 'NOAA']);
const MEASURES = Object.freeze({
  TEMPERATURA_C: { phenomenon:'TEMPERATURA', unit:'°C', range:[-30,60], tolerance:2 },
  VENTO_KMH: { phenomenon:'VENTO', unit:'km/h', range:[0,400], tolerance:12 },
  RAJADA_KMH: { phenomenon:'RAJADA', unit:'km/h', range:[0,400], tolerance:16 },
  CHUVA_MM_1H: { phenomenon:'CHUVA_ACUMULADA', unit:'mm', range:[0,400], tolerance:8 },
  UMIDADE_PERCENTUAL: { phenomenon:'UMIDADE', unit:'%', range:[0,100], tolerance:10 },
});
const finite = x => typeof x === 'number' && Number.isFinite(x);
const within = (v,lo,hi) => finite(v) && v>=lo && v<=hi;
const noWarning = Object.freeze({
  automaticAlertAuthorized: false, audibleAlertAuthorized: false,
  sourceMeasurementsAreNotMunicipalAverages: true,
});
const safe = (state, extra = {}) => Object.freeze({
  state,
  value: null,
  unit: null,
  resultKind: 'NOT_A_WEATHER_MEASUREMENT',
  officialMeasurement: false,
  selectedSourceIds: Object.freeze([]),
  ...noWarning,
  ...extra,
});
function stationAllowed(v, sourceId, spec, ibge, now) {
  const observed=Date.parse(v?.observedAt);
  return v?.origin === 'OFFICIAL_OBSERVATION'
    && OFFICIAL_SOURCE_MAP[v?.sourceId] === sourceId
    && String(v?.ibge) === String(ibge)
    && v?.variable === spec.variable && v?.unit === spec.unit
    && within(v?.value, ...spec.range)
    && typeof v?.stationId === 'string' && v.stationId.length > 0
    && within(v?.latitude, -23.7, -20.4) && within(v?.longitude, -45.5, -40.4)
    && typeof v?.sourceUrl === 'string' && v.sourceUrl.startsWith('https://')
    && finite(observed) && now-observed >= 0 && now-observed <= 7_200_000
    && within(v?.weight, 0.01, 5);
}
function forecastAllowed(f, sourceId, spec, ibge, now) {
  const issued=Date.parse(f?.issuedAt), valid=Date.parse(f?.validAt);
  return f?.kind === 'MODEL_FORECAST'
    && f.sourceId === sourceId && String(f.ibge) === String(ibge)
    && f.variable === spec.variable && f.unit === spec.unit
    && within(f.value,...spec.range)
    && finite(issued) && now-issued>=0 && now-issued<=24*3_600_000
    && finite(valid) && Math.abs(now-valid)<=24*3_600_000
    && typeof f?.productId === 'string' && f.productId.length>0
    && typeof f?.modelRunId === 'string' && f.modelRunId.length>0
    && typeof f?.sourceUrl === 'string' && f.sourceUrl.startsWith('https://')
    && f.usagePermissionStatus === 'VERIFIED_FOR_APP_DATA_DISPLAY';
}

/**
 * The user-directed RJ dispute cascade: 3 authoritative observation sources,
 * then INPE/CPTEC forecast first, Windy only if INPE is inconclusive.
 *
 * This compares one *forecast* with official station readings and returns two
 * DIFFERENT data types for display. Never average a model and an observation,
 * never declare a forecast proximity proof of a malfunctioning sensor.
 */
function stagedForecastDispute(official, forecasts, spec, ibge, now) {
  const readings=official.map(o=>Object.freeze({
    sourceId:o.canonicalSourceId,stationId:o.stationId,
    value:o.value,unit:o.unit,observedAt:o.observedAt,
    sourceUrl:o.sourceUrl,latitude:o.latitude,longitude:o.longitude,
    readingType:'OFFICIAL_STATION_OBSERVATION',
  }));
  const rad=Math.PI/180;
  const distanceKm=(a,b)=>{
    const p=(b.latitude-a.latitude)*rad;
    const l=(b.longitude-a.longitude)*rad;
    const h=Math.sin(p/2)**2+Math.cos(a.latitude*rad)*
      Math.cos(b.latitude*rad)*Math.sin(l/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  };
  const modelOutput=(f,comparisons,favored,decision)=>Object.freeze({
    sourceId:f.sourceId,value:f.value,unit:f.unit,
    validAt:f.validAt,issuedAt:f.issuedAt,
    productId:f.productId,modelRunId:f.modelRunId,
    sourceUrl:f.sourceUrl,modelFamilyId:f.modelFamilyId||null,
    dataType:'MODEL_FORECAST_NOT_A_MEASURED_STATION',
    differenceFromStations:Object.freeze(comparisons),
    decision,
    favoredStationId:favored?.stationId||null,
    method:'FORECAST_PROXIMITY_ONLY_NO_SENSOR_CERTIFICATION',
    isOfficialObservation:false,
  });
  let inpeReference=null;
  for(const id of ['INPE_CPTEC_FORECAST','WINDY_MODELO']) {
    const f=forecasts.find(row=>row.sourceId===id);
    if(!f)continue;
    const eligible=official.filter(o=>
      within(f.latitude,-23.7,-20.4)&&within(f.longitude,-45.5,-40.4)
      &&within(f.gridResolutionKm,0.1,25)
      &&distanceKm(f,o)<=25
      &&Math.abs(Date.parse(f.validAt)-Date.parse(o.observedAt))<=3_600_000
      &&(spec.variable!=='CHUVA_MM_1H' ||
        (f.forecastWindowMinutes===60&&o.measurementWindowMinutes===60)));
    const differences=official.map(o=>Object.freeze({
      sourceId:o.canonicalSourceId,stationId:o.stationId,
      difference:Math.round(Math.abs(f.value-o.value)*100)/100,
      temporallyAndSpatiallyComparable:eligible.includes(o),
    }));
    const hasVerifiedSkill=f.weightBasis==='VERIFIED_HISTORICAL_SKILL_FOR_VARIABLE_LOCATION_AND_LEAD'
      &&typeof f.skillEvidenceId==='string'&&f.skillEvidenceId.length>=4
      &&typeof f.modelFamilyId==='string'&&f.modelFamilyId.length>=3;
    let favored=null;
    if(hasVerifiedSkill&&eligible.length>=2) {
      const ordered=[...eligible].sort((a,b)=>Math.abs(a.value-f.value)-Math.abs(b.value-f.value));
      const nearest=Math.abs(ordered[0].value-f.value);
      const runnerUp=Math.abs(ordered[1].value-f.value);
      if(runnerUp-nearest>Math.max(spec.tolerance*0.25,0.05))favored=ordered[0];
    }
    const evidence=modelOutput(f,differences,favored,
      favored?'CLOSER_TO_ONE_OFFICIAL_STATION_NOT_PROOF':'FORECAST_COMPARISON_INCONCLUSIVE');
    if(id==='INPE_CPTEC_FORECAST')inpeReference=evidence;
    if(favored) {
      return Object.freeze({
        state:id==='INPE_CPTEC_FORECAST'?'INPE_MODEL_GUIDED_REFERENCE':'WINDY_MODEL_GUIDED_REFERENCE',
        reference:favored,model:evidence,
        officialReadings:Object.freeze(readings),
        attemptedInpe:inpeReference,
        modelConfidence:'QUALITATIVE_PROXIMITY_NOT_CALIBRATED_SENSOR_CONSENSUS',
      });
    }
    if(id==='WINDY_MODELO') {
      return Object.freeze({
        state:'MODEL_TIEBREAK_INCONCLUSIVE',
        reference:official[0],
        model:evidence,
        officialReadings:Object.freeze(readings),
        attemptedInpe:inpeReference,
      });
    }
  }
  if(inpeReference) {
    return Object.freeze({
      state:'MODEL_TIEBREAK_INCONCLUSIVE',
      reference:official[0],
      model:inpeReference,
      officialReadings:Object.freeze(readings),
      attemptedInpe:inpeReference,
    });
  }
  return null;
}

export function resolveRjCompatibleSources({
  ibge, variable, observations = [], forecasts = [], now = Date.now(),
}={}) {
  const entry=MEASURES[variable];
  if(!entry)throw new TypeError('rj_unsupported_weather_variable');
  const routing=rjSourceRouting({ibge,phenomenon:entry.phenomenon});
  if(!finite(now)||!Array.isArray(observations)||!Array.isArray(forecasts)
     ||observations.length>100||forecasts.length>100)throw new TypeError('invalid_rj_source_records');
  const spec={...entry,variable};
  const examined=[];
  const confirmed=[];
  const predictions=[];
  const conflicts=[];
  const seenStation=new Set();
  const seenProduct=new Set();

  // The routing order is the user's hierarchy, and is locality-specific.
  // Stop at the earliest successful independent, compatible *official* pair.
  for(const source of routing.sources) {
    const id=source.id;
    examined.push(id);
    if(OBSERVED.has(id)) {
      const sourceRecords=observations
        .filter(o=>stationAllowed(o,id,spec,ibge,now))
        .sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
      for(const row of sourceRecords) {
        const stationKey=`${id}:${row.stationId}`;
        if(seenStation.has(stationKey))continue;
        seenStation.add(stationKey);
        for(const earlier of confirmed) {
          // A *source* must be independent, not merely a second station from
          // the same provider.
          if(earlier.canonicalSourceId===id)continue;
          const spread=Math.abs(earlier.value-row.value);
          if(spread>entry.tolerance) {
            conflicts.push(Object.freeze({
              sourceA:earlier.canonicalSourceId,
              sourceB:id,
              difference:Math.round(spread*100)/100,
              resolution:'SEEK_NEXT_HIERARCHICAL_SOURCE',
            }));
            continue;
          }
          const first={...earlier,sourceId:earlier.canonicalSourceId};
          const second={...row,sourceId:id};
          const weighted=weightedOfficialMean({
            observations:[first,second],now,maxAgeMs:7_200_000,
            maxSkewMs:900_000,maxSeparationKm:25,
          });
          if(weighted.state!=='CALCULO_EXPERIMENTAL_BLAISE') {
            conflicts.push(Object.freeze({
              sourceA:earlier.canonicalSourceId,sourceB:id,
              resolution:weighted.reason || 'INCOMPATIBLE_OBSERVATIONS',
            }));
            continue;
          }
          return safe('TWO_COMPATIBLE_OFFICIAL_SOURCES', {
            value:weighted.value,unit:entry.unit,
            resultKind:'CALCULO_BLAISE_SOBRE_DUAS_MEDICOES_OFICIAIS',
            selectedSourceIds:Object.freeze([earlier.canonicalSourceId,id]),
            selectedStationIds:Object.freeze([earlier.stationId,row.stationId]),
            measurementTimes:Object.freeze([earlier.observedAt,row.observedAt]),
            formula:weighted.formula,
            comparedSourceCount:examined.length,
            examinedSourceIds:Object.freeze([...examined]),
            conflictsEncountered:Object.freeze(conflicts),
            provenance:weighted,
            confidence:'TWO_INDEPENDENT_COMPATIBLE_OFFICIAL_STATIONS_NOT_A_CITY_WIDE_MEAN',
          });
        }
        confirmed.push({...row,canonicalSourceId:id});
      }
    } else if(FORECAST.has(id)) {
      const rows=forecasts.filter(f=>forecastAllowed(f,id,spec,ibge,now))
        .sort((a,b)=>Date.parse(b.issuedAt)-Date.parse(a.issuedAt));
      const candidate=rows[0];
      if(candidate && !seenProduct.has(id)){
        seenProduct.add(id);
        predictions.push(candidate);
      }
    }
  }
  // All three primary source slots have been searched. If their observations
  // disagree, INPE is consulted first; only an INPE inconclusive result
  // advances to Windy. The output always preserves all original observations.
  if(confirmed.length>=2 && conflicts.some(c=>typeof c.difference==='number'
    &&c.difference>entry.tolerance)) {
    const independent=[...new Map(confirmed.map(o=>[o.canonicalSourceId,o])).values()]
      .filter(o=>['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION'].includes(o.canonicalSourceId));
    if(independent.length>=2) {
      const disputed=stagedForecastDispute(independent,predictions,spec,ibge,now);
      if(disputed) {
        const highlighted=disputed.state!=='MODEL_TIEBREAK_INCONCLUSIVE';
        const reading=disputed.reference;
        return safe(highlighted
          ?'OFFICIAL_DISAGREEMENT_WITH_MODEL_GUIDED_DISPLAY_PRIORITY'
          :'OFFICIAL_DISAGREEMENT_WITH_TWO_SOURCE_CONTEXT',{
          value:highlighted?reading.value:null,
          unit:entry.unit,
          resultKind:highlighted
            ?'FAVORED_INDIVIDUAL_OFFICIAL_STATION_READING_NOT_CONSENSUS'
            :'OFFICIAL_OBSERVATION_PLUS_UNDECIDED_MODEL_FORECAST',
          officialMeasurement:highlighted,
          selectedSourceIds:Object.freeze([reading.canonicalSourceId,disputed.model.sourceId]),
          sourcePairForDisplay:Object.freeze([
            Object.freeze({
              sourceId:reading.canonicalSourceId,stationId:reading.stationId,
              value:reading.value,unit:reading.unit,observedAt:reading.observedAt,
              sourceUrl:reading.sourceUrl,dataType:'OFFICIAL_STATION_OBSERVATION',
            }),
            disputed.model,
          ]),
          officialReadings:disputed.officialReadings,
          modelTieBreak:disputed.model,
          inpeConsultation:disputed.attemptedInpe,
          showBothSourceMeasurements:true,
          consensusConfirmed:false,
          weightedMeanApplied:false,
          selectedReadingIsNotMunicipalAverage:true,
          examinedSourceIds:Object.freeze(examined),
          conflictsEncountered:Object.freeze(conflicts),
          note:'Displays an official station and a separate model forecast; other conflicting official readings remain visible.',
        });
      }
      return safe('OFFICIAL_DISAGREEMENT_DISPLAY_BOTH_READINGS',{
        unit:entry.unit,
        resultKind:'TWO_DISTINCT_OFFICIAL_READINGS_NO_WEIGHTED_MEAN',
        officialReadings:Object.freeze(independent.map(o=>Object.freeze({
          sourceId:o.canonicalSourceId,stationId:o.stationId,
          value:o.value,unit:o.unit,observedAt:o.observedAt,
          sourceUrl:o.sourceUrl,dataType:'OFFICIAL_STATION_OBSERVATION',
        }))),
        showBothSourceMeasurements:true,
        examinedSourceIds:Object.freeze(examined),
        conflictsEncountered:Object.freeze(conflicts),
        note:'No verified forecast for tie-break; display original disputed official measurements only.',
      });
    }
  }
  // If official stations fail to form a pair, retain one *measured* value,
  // clearly attributed and with no false weighted mean.
  if(confirmed.length>0) {
    const best=confirmed[0];
    return safe('ONE_VERIFIED_OFFICIAL_SOURCE', {
      value:best.value,unit:entry.unit,resultKind:'OBSERVACAO_PONTUAL_OFICIAL_FONTE_UNICA',
      officialMeasurement:true,
      requiresDisagreementReview:conflicts.length>0,
      consensusConfirmed:false,
      selectedSourceIds:Object.freeze([best.canonicalSourceId]),
      selectedStationIds:Object.freeze([best.stationId]),
      observedAt:best.observedAt,sourceUrl:best.sourceUrl,
      examinedSourceIds:Object.freeze(examined),
      conflictsEncountered:Object.freeze(conflicts),
      missingSecondCompatibleSource:true,
      note:'Value belongs to the identified station. Do not call it a reconciled municipal reading.',
    });
  }
  // Forecast-only path: TWO INDEPENDENT skill-weighted forecasts, never an
  // observational mean and never a severe-alert confirmation.
  for(let i=0;i<predictions.length;i++)for(let j=i+1;j<predictions.length;j++) {
    const first=predictions[i],second=predictions[j];
    if(Math.abs(first.value-second.value)>entry.tolerance)continue;
    const mixed=weightedComparableForecastMean({
      forecasts:[first,second],ibge,variable,now,
    });
    if(mixed.state==='COMPARABLE_FORECAST_MODELS') {
      return safe('TWO_COMPATIBLE_FORECAST_SOURCES', {
        value:mixed.calculatedValue,unit:entry.unit,
        resultKind:'PREVISAO_PONDERADA_BLAISE_NAO_OBSERVACAO',
        selectedSourceIds:Object.freeze([first.sourceId,second.sourceId]),
        forecastValidAt:mixed.calculatedEstimate.validAt,
        examinedSourceIds:Object.freeze(examined),
        conflictsEncountered:Object.freeze(conflicts),
        provenance:mixed.calculatedEstimate,
        confidence:'MODEL_ESTIMATE_REQUIRES_CONTINUING_VALIDATION',
      });
    }
  }
  if(predictions.length>0) {
    const f=predictions[0];
    return safe('ONE_VERIFIED_FORECAST_SOURCE',{
      value:f.value,unit:entry.unit,resultKind:'PREVISAO_ISOLADA_NAO_MEDICAO',
      selectedSourceIds:Object.freeze([f.sourceId]),
      forecastValidAt:f.validAt,
      examinedSourceIds:Object.freeze(examined),
      conflictsEncountered:Object.freeze(conflicts),
      missingSecondCompatibleSource:true,
    });
  }
  return safe('NO_VERIFIABLE_SOURCE_VALUE',{
    examinedSourceIds:Object.freeze(examined),
    conflictsEncountered:Object.freeze(conflicts),
    action:'KEEP_LAST_VERIFIED_READING_WITH_TRUE_TIMESTAMP_IF_VALID_ELSE_EXPLICIT_NO_MEASUREMENT',
    note:'Never fabricate or extrapolate weather measurements just to avoid an unavailable label.',
  });
}

/**
 * Sequential consultation of authorized adapters. Each adapter is a callback
 * returning {observations?,forecasts?}; it is not a deployed live connector.
 * A pair is accepted ONLY after both independently pass reconciliation.
 */
export async function consultRjSourcesUntilTwo({
  ibge, variable, adapters = {}, now = Date.now(),
}={}) {
  const entry=MEASURES[variable];
  if(!entry)throw new TypeError('rj_unsupported_weather_variable');
  const route=rjSourceRouting({ibge,phenomenon:entry.phenomenon});
  if(adapters===null||typeof adapters!=='object'||Array.isArray(adapters))
    throw new TypeError('rj_source_adapters_required');
  const observations=[],forecasts=[],failures=[],consulted=[];
  for(const source of route.sources) {
    const cb=adapters[source.id];
    if(typeof cb!=='function')continue;
    consulted.push(source.id);
    try {
      const batch=await cb(Object.freeze({ibge:String(ibge),variable,
        sourceId:source.id,now}));
      if(batch && typeof batch==='object') {
        // Connector A must never inject a record attributed to connector B.
        // This prevents a single feed from manufacturing "two sources".
        if(Array.isArray(batch.observations)) {
          observations.push(...batch.observations.slice(0,20)
            .filter(row=>OFFICIAL_SOURCE_MAP[row?.sourceId]===source.id));
        }
        if(Array.isArray(batch.forecasts)) {
          forecasts.push(...batch.forecasts.slice(0,20)
            .filter(row=>row?.sourceId===source.id));
        }
      }
    } catch(_) {
      failures.push(source.id); // no raw tokens, URLs or personal data in logs
    }
    if(observations.length>100||forecasts.length>100)break;
    const provisional=resolveRjCompatibleSources({ibge,variable,observations,forecasts,now});
    if(provisional.state==='TWO_COMPATIBLE_OFFICIAL_SOURCES'
      ||(source.id==='INPE_CPTEC_FORECAST'
        &&provisional.state==='OFFICIAL_DISAGREEMENT_WITH_MODEL_GUIDED_DISPLAY_PRIORITY'
        &&provisional.modelTieBreak?.sourceId==='INPE_CPTEC_FORECAST')) {
      return Object.freeze({...provisional,
        consultedSourceIds:Object.freeze([...consulted]),
        connectorFailures:Object.freeze(failures)});
    }
  }
  return Object.freeze({...resolveRjCompatibleSources({ibge,variable,
    observations,forecasts,now}),
    consultedSourceIds:Object.freeze([...consulted]),
    connectorFailures:Object.freeze(failures)});
}
