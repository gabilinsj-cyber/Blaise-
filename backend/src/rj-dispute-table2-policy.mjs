/**
 * Blaise V6 RJ — TABELA 2: priority for checking contradictory weather data.
 * This order is separate from Table 1's official collection/alert priority:
 *   INPE/CPTEC -> INMET -> CEMADEN -> Windy -> NOAA.
 *
 * Tabela 2 is a COMPARISON/REVIEW order. It does not allow one forecast
 * (or two re-publications of the same model) to certify a station reading.
 * In particular: no automatic warning, no weighted average of model +
 * measured station data, no claim of data availability or licensing.
 *
 * Some entries offer only particular products/locations. Skip inappropriate
 * entries without promoting a source to official authority for that event.
 */
export const RJ_TABLE2_VERSION = 'rj-table2-2026-10-14-v1';

const freeze = (sourceId, label, kind, supported, note) => Object.freeze({
  sourceId, label, kind, supportedPhenomena: Object.freeze([...supported]),
  note,
  connected: false,
  automaticallyAuthorizesAlert: false,
});

const CORE = Object.freeze([
  'TEMPERATURA','SENSACAO_TERMICA','UMIDADE','VENTO','RAJADA',
  'CHUVA_ATUAL','CHUVA_ACUMULADA','TEMPORAL','TEMPESTADE',
  'PRESSAO_ATMOSFERICA','GRANIZO','MASSA_AR','FRENTE_FRIA',
]);
const RAIN = Object.freeze([
  'CHUVA_ATUAL','CHUVA_ACUMULADA','TEMPORAL','TEMPESTADE',
  'GRANIZO','RISCO_HIDROLOGICO','DESLIZAMENTO','ALAGAMENTO',
]);
const BROAD_FORECAST = Object.freeze([
  ...CORE,'CICLONE_EXTRATROPICAL','CHUVA_ATLANTICO','RESSACA',
  'ONDAS','SWELL','TEMPERATURA_MAR','EL_NINO_LA_NINA',
]);
const INMET = Object.freeze([
  ...CORE,'CICLONE_EXTRATROPICAL','CHUVA_ATLANTICO',
  'RESSACA','EL_NINO_LA_NINA',
]);
const NOAA = Object.freeze([
  ...BROAD_FORECAST,'RAIOS','CORRENTES_MARINHAS',
]);

export const RJ_TABLE2_DISPUTE_PRIORITY = Object.freeze([
  freeze('INPE_CPTEC_FORECAST','INPE/CPTEC','OFFICIAL_FORECAST_OR_SATELLITE',
    BROAD_FORECAST,'Forecast/model/satellite products with verified local coverage, run and validity'),
  freeze('INMET_STATION','INMET','OFFICIAL_STATION_OR_WARNING',
    INMET,'Use verified station observations for the same variable, coordinates and time'),
  freeze('CEMADEN_RJ','CEMADEN','OFFICIAL_RAIN_OR_HYDRO',
    RAIN,'Rainfall and hydrometeorological products only where CEMADEN has actual coverage'),
  freeze('WINDY_MODELO','Windy','MODEL_COMPARISON_ONLY',
    BROAD_FORECAST,'A model view is never independent proof of a measurement or official alert'),
  freeze('NOAA','NOAA','OFFICIAL_FORECAST_SATELLITE_OR_MARINE_PRODUCT',
    NOAA,'Select a specific relevant forecast/satellite/marine product; never assume live coverage'),
]);

if(RJ_TABLE2_DISPUTE_PRIORITY.length!==5
  ||new Set(RJ_TABLE2_DISPUTE_PRIORITY.map(s=>s.sourceId)).size!==5)
  throw new Error('rj_table2_unique_five_sources_required');

const EXCLUSIVE_SPECIALIST_EVENTS = new Set([
  'SISMO','TSUNAMI','VAZAO_RIO','MARE','RADAR',
]);

/**
 * Return all five rows, preserving user priority, annotated as eligible or
 * not by variable. An eligible row is NOT proof of an actual record.
 */
export function rjDisputeTable2({phenomenon,region='MUNICIPAL'}={}) {
  if(typeof phenomenon!=='string'||!phenomenon.trim())throw TypeError('phenomenon_required');
  if(!['MUNICIPAL','LITORAL','ATLANTICO'].includes(region))throw TypeError('invalid_region');
  const excluded=EXCLUSIVE_SPECIALIST_EVENTS.has(phenomenon);
  const rows=RJ_TABLE2_DISPUTE_PRIORITY.map((item,index)=>Object.freeze({
    ...item,
    rank:index+1,
    eligible:!excluded && item.supportedPhenomena.includes(phenomenon),
    dataStatus:'NOT_VERIFIED_LIVE',
  }));
  return Object.freeze({
    project:'Blaise V6 RJ',
    table:'TABELA_2_CRITERIO_DESEMPATE',
    version:RJ_TABLE2_VERSION,
    phenomenon,region,
    rows:Object.freeze(rows),
    eligibleSources:Object.freeze(rows.filter(x=>x.eligible)),
    table1Unaffected:true,
    order:Object.freeze(rows.map(x=>x.sourceId)),
    officialAlertOverride:false,
    mayWeightForecastWithOfficialObservation:false,
    neverCountDuplicateModelAsIndependentSource:true,
    note:excluded
      ?'This event follows specialist authority, not meteorological dispute Table 2.'
      :'Consult suitable available products in ranked order, matching variables, place, time and license. Unverified values cannot be invented.',
  });
}
