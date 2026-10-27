import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

/**
 * Approved Blaise V6 RJ source routing policy.
 * This is a catalog of eligible sources, NOT proof of data availability.
 * A public/model viewer (fontes complementares autorizadas) cannot supersede an authoritative warning.
 */
export const RJ_PHENOMENA = Object.freeze([
  'TEMPERATURA', 'SENSACAO_TERMICA', 'UMIDADE', 'VENTO', 'RAJADA',
  'CHUVA_ACUMULADA', 'TEMPORAL', 'TEMPESTADE', 'RISCO_HIDROLOGICO',
  'VAZAO_RIO', 'RESSACA', 'ONDAS', 'CICLONE_EXTRATROPICAL',
  'CHUVA_ATLANTICO', 'MASSA_AR', 'RADAR', 'GRANIZO',
  'DESLIZAMENTO', 'ALAGAMENTO', 'FRENTE_FRIA', 'EL_NINO_LA_NINA',
  'SISMO', 'TSUNAMI', 'PRESSAO_ATMOSFERICA', 'RAIOS',
  'CHUVA_ATUAL', 'MARE', 'SWELL', 'CORRENTES_MARINHAS', 'TEMPERATURA_MAR',
]);
if (RJ_PHENOMENA.length !== 30 || new Set(RJ_PHENOMENA).size !== 30)
  throw new Error('rj_30_phenomena_matrix_invalid');
export const RJ_SOURCE_CLASS = Object.freeze({
  AUTHORITATIVE: 'AVISO_OU_MEDICAO_OFICIAL',
  OFFICIAL_MODEL: 'PRODUTO_OFICIAL_MODELO_OU_SATELITE',
  COMPARISON: 'MODELO_DE_TERCEIROS_APENAS_COMPARACAO',
});

const municipal = Object.freeze(new Set(RJ_MUNICIPALITIES.map(c => c.ibge)));
if (municipal.size !== 92) throw new Error('rj_source_policy_noncanonical_rj_catalog');
export const RJ_MUNICIPALITY_COUNT = municipal.size;
export const RJ_CITY_IBGE = '3304557';

const OFFICIAL = RJ_SOURCE_CLASS.AUTHORITATIVE;
const MODEL = RJ_SOURCE_CLASS.OFFICIAL_MODEL;
const COMPARE = RJ_SOURCE_CLASS.COMPARISON;

const definition = (id, role, scope) => Object.freeze({ id, role, scope,
  dataAvailability: 'REQUIRES_LIVE_VALIDATION', automaticAlertAuthority: false });
const sources = Object.freeze({
  ALERTA_RIO: definition('ALERTA_RIO', OFFICIAL, 'MUNICIPIO_RIO_APENAS'),
  DEFESA_CIVIL: definition('DEFESA_CIVIL_RJ_REGIONAL', OFFICIAL, 'CONFORME_COMPETENCIA_MUNICIPIO'),
  CEMADEN: definition('CEMADEN_RJ', OFFICIAL, 'CONFORME_COBERTURA_MUNICIPIO'),
  INMET: definition('INMET_STATION', OFFICIAL, 'ESTACOES_PRESENTES_NAO_92_GARANTIDOS'),
  INPE: definition('INPE_CPTEC_FORECAST', MODEL, 'FORECAST_MODELS_AND_SATELLITE_PRODUCTS_RJ_AS_APPLICABLE'),
  ANA: definition('ANA_HIDROWEB', OFFICIAL, 'ESTACAO_HIDROLOGICA'),
  SGB: definition('SGB_SACE', OFFICIAL, 'AREA_HIDROLOGICA'),
  NOAA: definition('NOAA', MODEL, 'ATLANTICO_PRODUTOS_PERTINENTES'),
  REDE_RAIOS: definition('REDE_RAIOS_AUTORIZADA', OFFICIAL, 'DESCARGAS_ELETRICAS_REDE_TERRESTRE_COM_LICENCA'),

  USGS: definition('USGS_EARTHQUAKE', OFFICIAL, 'CATALOGO_SISMICO_ATLANTICO_RJ_CONFORME_EVENTO'),
  OPENWEATHER: definition('OPENWEATHERMAP_API', COMPARE, 'COMPLEMENTAR_10_VARIAVEIS_CONFORME_PRODUTO_LICENCA_E_LOCALIDADE'),
  EUMETSAT: definition('EUMETSAT_SATELLITE', MODEL, 'NUVENS_TEMPESTADES_CICLONES_ATLANTICO_NAO_ALERTA_OFICIAL'),
});

function series(keys) { return Object.freeze(keys.map(k => sources[k])); }
const ROUTES = Object.freeze({
  TEMPERATURA: series(['DEFESA_CIVIL','INMET','INPE']),
  CHUVA_ATUAL: series(['DEFESA_CIVIL','INMET','INPE','CEMADEN']),
  SENSACAO_TERMICA: series(['DEFESA_CIVIL','INMET','INPE']),
  UMIDADE: series(['DEFESA_CIVIL','INMET','INPE']),
  VENTO: series(['DEFESA_CIVIL','INMET','INPE']),
  RAJADA: series(['DEFESA_CIVIL','INMET','INPE']),
  CHUVA_ACUMULADA: series(['DEFESA_CIVIL','INMET','INPE','CEMADEN']),
  TEMPORAL: series(['DEFESA_CIVIL','INMET','INPE','CEMADEN']),
  TEMPESTADE: series(['DEFESA_CIVIL','INMET','INPE','CEMADEN','EUMETSAT']),
  RISCO_HIDROLOGICO: series(['DEFESA_CIVIL','CEMADEN','SGB','ANA']),
  VAZAO_RIO: series(['ANA','SGB']),
  RESSACA: series(['INMET','NOAA','INPE']),
  ONDAS: series(['NOAA','INPE']),
  SWELL: series(['NOAA','INPE']),
  MARE: series(['NOAA']),
  CORRENTES_MARINHAS: series(['NOAA']),
  TEMPERATURA_MAR: series(['NOAA']),
  CICLONE_EXTRATROPICAL: series(['INMET','DEFESA_CIVIL','NOAA','EUMETSAT','INPE']),
  CHUVA_ATLANTICO: series(['NOAA','EUMETSAT','INPE']),
  MASSA_AR: series(['INMET','NOAA','EUMETSAT','INPE']),
  RADAR: series(['CEMADEN','DEFESA_CIVIL']),
  GRANIZO: series(['DEFESA_CIVIL','INMET','CEMADEN','INPE']),
  DESLIZAMENTO: series(['DEFESA_CIVIL','CEMADEN','SGB','ANA']),
  ALAGAMENTO: series(['DEFESA_CIVIL','CEMADEN','ANA','SGB']),
  FRENTE_FRIA: series(['INMET','DEFESA_CIVIL','NOAA','EUMETSAT','INPE']),
  EL_NINO_LA_NINA: series(['INMET','NOAA','INPE']),
  SISMO: series(['USGS','DEFESA_CIVIL','NOAA']),
  TSUNAMI: series(['NOAA','DEFESA_CIVIL','USGS']),
  PRESSAO_ATMOSFERICA: series(['DEFESA_CIVIL','INMET','INPE']),
  RAIOS: series(['REDE_RAIOS','NOAA','DEFESA_CIVIL']),
});


// Complementary, product-specific data channels do NOT change the primary
// official alert hierarchy or the INPE forecast dispute cascade.
export const RJ_TEN_WEATHER_COMPLEMENTS = Object.freeze([
  'TEMPERATURA','SENSACAO_TERMICA','CHUVA_ATUAL','CHUVA_ACUMULADA',
  'TEMPORAL','VENTO','RAJADA','PRESSAO_ATMOSFERICA','UMIDADE','GRANIZO',
]);
export const RJ_SUPPLEMENTAL_PRODUCTS = Object.freeze({
  openWeatherMap: Object.freeze({ sourceId:'OPENWEATHERMAP_API',
    role:'THIRD_COMPLEMENTARY_DATA_PRODUCT_NOT_THIRD_OFFICIAL_ALERT_AUTHORITY',
    phenomena:RJ_TEN_WEATHER_COMPLEMENTS,
    ingestion:'NOT_CONNECTED',permission:'REQUIRES_PRODUCT_TERMS_VALIDATION',
    neverCountsAsIndependentRepublishedStation:true,
  }),
  eumetsat: Object.freeze({ sourceId:'EUMETSAT_SATELLITE',
    role:'SATELLITE_CLOUD_STORM_CYCLONE_MONITORING_NOT_TSUNAMI_ALERT',
    phenomena:Object.freeze(['TEMPESTADE','CICLONE_EXTRATROPICAL','CHUVA_ATLANTICO','MASSA_AR','FRENTE_FRIA']),
    ingestion:'NOT_CONNECTED',permission:'REQUIRES_PRODUCT_TERMS_VALIDATION',
  }),
});

/** Official and observational candidates, not assertions of live connectivity.
 * Compare NOAA marine forecasts against an independently driven Brazilian
 * REMO/INPE wave product only when its actual dataset is available and licensed.
 * Use buoy/satellite observations for verification, not as model duplicates.
 */
export const RJ_VALIDATION_CANDIDATES = Object.freeze({
  japaneseOceanRain: Object.freeze({source:'JAXA_GSMAP',role:'SATELLITE_PRECIPITATION_COMPARISON',enabled:false,requiresCurrentProductAndCommercialPermission:true}),
  chineseSatelliteRainExcluded: true,
  marineWaves: Object.freeze({primary:'NOAA', comparison:'REMO_WW3_INDEPENDENT_RUN',
    observation:'AUTHORIZED_BUOY_OR_ALTIMETRY',
    enabled:false, requiresIndependentForcing:true, requiresLiveDatasetAndLicense:true}),
  eumetsatLiveValidation: Object.freeze({
    sourceId:'EUMETSAT_SATELLITE',
    primaryComparison:'NOAA',
    officialCatalog:'https://data.eumetsat.int/',
    officialApiDocumentation:'https://user.eumetsat.int/api-definitions/data-store-rest-api',
    accessMethod:'DATA_STORE_API_OR_EUMETVIEW_BY_PRODUCT',
    intendedProducts:Object.freeze(['ATLANTIC_CLOUDS','STORM_TRACKING','OCEAN_SURFACE_WIND_IF_COVERED']),
    status:'OFFICIAL_SERVICE_DOCUMENTED_PRODUCT_LIVE_UNVERIFIED',
    lastObservedProductTimestamp:null,
    collectionId:null,
    productLicenseVerified:false,
    productionIngestionEnabled:false,
    validationRequired:Object.freeze(['COLLECTION_ID','OBSERVATION_TIME','INGESTION_TIME','RJ_ATLANTIC_COVERAGE','LICENSE','DATA_QUALITY']),
    doNotDisplayAsLiveUntilVerified:true,
  }),
  marineCyclones: Object.freeze(['NOAA','INPE_CPTEC_FORECAST','EUMETSAT_SATELLITE','INMET_STATION']),
  weatherObservations: Object.freeze(['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION','CEMADEN_RJ']),
  rainfall: Object.freeze(['CEMADEN_RJ','ALERTA_RIO','INMET_STATION']),
  hydrology: Object.freeze(['ANA_HIDROWEB','SGB_SACE','CEMADEN_RJ']),
  requireSourceTimestampStationOrGridAndLicensing:true,
  neverRepresentForecastAsObservation:true,
  doNotTreatPublicDashboardAsAnAuthorizedApi:true,
});

export function rjSourceRouting({ ibge = null, phenomenon, region = 'MUNICIPAL' } = {}) {
  if (!RJ_PHENOMENA.includes(phenomenon)) throw new TypeError('rj_unknown_phenomenon');
  if (!['MUNICIPAL','LITORAL','ATLANTICO'].includes(region)) throw new TypeError('rj_unknown_region');
  if (region === 'MUNICIPAL' && !municipal.has(String(ibge))) throw new TypeError('rj_unknown_municipality');
  if (region !== 'MUNICIPAL' && ibge !== null && !municipal.has(String(ibge))) {
    throw new TypeError('rj_unknown_municipality');
  }
  const rioCity = String(ibge) === RJ_CITY_IBGE;
  const keys = ROUTES[phenomenon];
  const withRio = rioCity && ['CHUVA_ATUAL','CHUVA_ACUMULADA','TEMPORAL','TEMPESTADE','RADAR','VENTO','RAJADA','TEMPERATURA','SENSACAO_TERMICA','PRESSAO_ATMOSFERICA','UMIDADE','GRANIZO'].includes(phenomenon)
    ? [sources.ALERTA_RIO, ...keys] : [...keys];
  const eligible = withRio.filter(s => {
    if (s.id === 'ALERTA_RIO' && !rioCity) return false;
    if (region === 'ATLANTICO') return ['NOAA','INMET_STATION','INPE_CPTEC_FORECAST','USGS_EARTHQUAKE','EUMETSAT_SATELLITE'].includes(s.id);
    if (region === 'LITORAL' && s.id === 'ALERTA_RIO' && !rioCity) return false;
    return true;
  });
  return Object.freeze({
    locality: region === 'MUNICIPAL' ? String(ibge) : region,
    phenomenon,
    sources: Object.freeze(eligible),
    historicalGuarantee: 'NONE',
    municipalitySelectionCoverage: RJ_MUNICIPALITY_COUNT,
    phenomenonMatrixCount: RJ_PHENOMENA.length,
    complementaryThirdSource: RJ_TEN_WEATHER_COMPLEMENTS.includes(phenomenon)
      ? 'OPENWEATHERMAP_API_PRODUCT_CONSULTATION_ONLY' : null,
    specialistSeaSources: ['RESSACA','ONDAS','SWELL','MARE','CORRENTES_MARINHAS','TEMPERATURA_MAR','CICLONE_EXTRATROPICAL'].includes(phenomenon)
      ? 'NOAA_INPE_EUMETSAT_BY_VALIDATED_PRODUCT' : null,
    geographicScope: 'RJ_INCLUI_MUNICIPIOS_DE_DIVISA_SEM_CONFUNDIR_DADOS_DE_ESTADOS_VIZINHOS',
    locationMatching: 'VALIDATE_IBGE_STATION_COORDINATES_AND_SOURCE_COVERAGE',
    crossBorderDataPolicy: 'OUTSIDE_RJ_ONLY_AS_EXPLICITLY_LABELED_REGIONAL_CONTEXT_NOT_RJ_OBSERVATION',
    liveData: 'NOT_CONFIRMED',
    disputePolicy: 'OBSERVATIONS_ALERARIO_DEFESACIVIL_INMET_THEN_INPE_THEN_INPE_MODEL_REVIEW',
    minimumIndependentCompatibleSources: 2,
    fallthroughOnDisagreement: true,
    useWeightedMeanOnlyWhenComparable: true,
    forecastPolicy: 'SEPARATE_FROM_OFFICIAL_STATION_MEASUREMENTS',
    windyPolicy: 'MODEL_COMPARISON_NO_OFFICIAL_TIE_BREAK',
    inpePolicy: 'OFFICIAL_FORECAST_GUIDANCE_NOT_OBSERVATION_OR_AUTOMATIC_TIE_BREAK',
    ineaPolicy: 'EXCLUDED',
  });
}

/** Maritime observation display gate. Forecast cycles and official alerts must be handled separately. */
export const RJ_MARINE_OBSERVATION_MAX_AGE_MS = 30 * 60 * 1000;
export function selectCurrentRjMarineObservation(records, now = Date.now()) {
  const candidates = (Array.isArray(records) ? records : []).filter(item => {
    if (!Number.isFinite(now) || !item || item.kind !== 'OBSERVATION' || item.verified !== true ||
        item.licenseVerified !== true || item.coverageVerified !== true ||
        typeof item.source !== 'string' || !item.source.trim() ||
        typeof item.unit !== 'string' || !item.unit.trim() ||
        typeof item.value !== 'number' || !Number.isFinite(item.value)) return false;
    const observed = typeof item.observedAt === 'string' ? Date.parse(item.observedAt) : NaN;
    const collected = typeof item.collectedAt === 'string' ? Date.parse(item.collectedAt) : NaN;
    return Number.isFinite(observed) && Number.isFinite(collected) &&
      observed <= collected && collected <= now &&
      now - observed >= 0 && now - observed <= RJ_MARINE_OBSERVATION_MAX_AGE_MS;
  }).sort((a,b) => Date.parse(b.observedAt)-Date.parse(a.observedAt));
  if (!candidates.length) return Object.freeze({
    state:'AUSENCIA_DE_DADOS_ATUAIS', value:null,
    message:'Ausência de dados atuais (últimos 30 minutos)',
  });
  const selected = candidates[0];
  return Object.freeze({state:'OBSERVACAO_ATUAL',source:selected.source,
    value:selected.value,unit:selected.unit,observedAt:selected.observedAt,
    collectedAt:selected.collectedAt,checkedAt:new Date(now).toISOString()});
}
