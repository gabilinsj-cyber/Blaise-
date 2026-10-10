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
import { weightedComparableForecastMean } from './rj-weather-source-reconciliation.mjs';

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
  const observations=[],forecasts=[],failures=[];
  for(const source of route.sources) {
    const cb=adapters[source.id];
    if(typeof cb!=='function')continue;
    try {
      const batch=await cb(Object.freeze({ibge:String(ibge),variable,
        sourceId:source.id,now}));
      if(!batch || typeof batch!=='object')continue;
      if(Array.isArray(batch.observations))observations.push(...batch.observations.slice(0,20));
      if(Array.isArray(batch.forecasts))forecasts.push(...batch.forecasts.slice(0,20));
    } catch(_) {
      failures.push(source.id); // no raw tokens, URLs or personal data in logs
    }
    if(observations.length>100||forecasts.length>100)break;
    const provisional=resolveRjCompatibleSources({ibge,variable,observations,forecasts,now});
    if(provisional.state==='TWO_COMPATIBLE_OFFICIAL_SOURCES') {
      return Object.freeze({...provisional,consultedSourceIds:Object.freeze(
        route.sources.filter(s=>typeof adapters[s.id]==='function')
          .slice(0,route.sources.findIndex(s=>s.id===source.id)+1).map(s=>s.id)),
        connectorFailures:Object.freeze(failures)});
    }
  }
  return Object.freeze({...resolveRjCompatibleSources({ibge,variable,
    observations,forecasts,now}),connectorFailures:Object.freeze(failures)});
}
