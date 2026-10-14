import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

/**
 * Approved Blaise V6 RJ source routing policy.
 * This is a catalog of eligible sources, NOT proof of data availability.
 * A public/model viewer (Windy) cannot supersede an authoritative warning.
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
  MARINHA: definition('MARINHA_CHM', OFFICIAL, 'LITORAL_E_ATLANTICO_CONFORME_AVISO'),
  NOAA: definition('NOAA', MODEL, 'ATLANTICO_PRODUTOS_PERTINENTES'),
  REDE_RAIOS: definition('REDE_RAIOS_AUTORIZADA', OFFICIAL, 'DESCARGAS_ELETRICAS_REDE_TERRESTRE_COM_LICENCA'),

  USGS: definition('USGS_EARTHQUAKE', OFFICIAL, 'CATALOGO_SISMICO_ATLANTICO_RJ_CONFORME_EVENTO'),
  WINDY: definition('WINDY_MODELO', COMPARE, 'CONFERENCIA_DE_MODELO_NAO_MEDICAO'),
  OPENWEATHER: definition('OPENWEATHERMAP_API', COMPARE, 'COMPLEMENTAR_10_VARIAVEIS_CONFORME_PRODUTO_LICENCA_E_LOCALIDADE'),
  COPERNICUS: definition('COPERNICUS_MARINE', MODEL, 'DADOS_OCEANICOS_GRADE_NIVEL_CORRENTES_ONDAS_TEMPERATURA'),
  EUMETSAT: definition('EUMETSAT_SATELLITE', MODEL, 'NUVENS_TEMPESTADES_CICLONES_ATLANTICO_NAO_ALERTA_OFICIAL'),
});

function series(keys) { return Object.freeze(keys.map(k => sources[k])); }
const ROUTES = Object.freeze({
  TEMPERATURA: series(['DEFESA_CIVIL','INMET','INPE','WINDY']),
  CHUVA_ATUAL: series(['DEFESA_CIVIL','INMET','INPE','WINDY','CEMADEN']),
  SENSACAO_TERMICA: series(['DEFESA_CIVIL','INMET','INPE','WINDY']),
  UMIDADE: series(['DEFESA_CIVIL','INMET','INPE','WINDY']),
  VENTO: series(['DEFESA_CIVIL','INMET','INPE','WINDY']),
  RAJADA: series(['DEFESA_CIVIL','INMET','INPE','WINDY']),
  CHUVA_ACUMULADA: series(['DEFESA_CIVIL','INMET','INPE','WINDY','CEMADEN']),
  TEMPORAL: series(['DEFESA_CIVIL','INMET','INPE','WINDY','CEMADEN']),
  TEMPESTADE: series(['DEFESA_CIVIL','INMET','INPE','WINDY','CEMADEN','EUMETSAT']),
  RISCO_HIDROLOGICO: series(['DEFESA_CIVIL','CEMADEN','SGB','ANA']),
  VAZAO_RIO: series(['ANA','SGB']),
  RESSACA: series(['MARINHA','INMET','NOAA','COPERNICUS','INPE','WINDY']),
  ONDAS: series(['MARINHA','NOAA','COPERNICUS','INPE','WINDY']),
  SWELL: series(['MARINHA','NOAA','COPERNICUS','INPE','WINDY']),
  MARE: series(['MARINHA','COPERNICUS','NOAA']),
  CORRENTES_MARINHAS: series(['MARINHA','COPERNICUS','NOAA']),
  TEMPERATURA_MAR: series(['MARINHA','COPERNICUS','NOAA']),
  CICLONE_EXTRATROPICAL: series(['MARINHA','INMET','DEFESA_CIVIL','NOAA','EUMETSAT','COPERNICUS','INPE','WINDY']),
  CHUVA_ATLANTICO: series(['MARINHA','NOAA','EUMETSAT','INPE','WINDY']),
  MASSA_AR: series(['INMET','MARINHA','NOAA','EUMETSAT','INPE','WINDY']),
  RADAR: series(['CEMADEN','DEFESA_CIVIL']),
  GRANIZO: series(['DEFESA_CIVIL','INMET','CEMADEN','INPE','WINDY']),
  DESLIZAMENTO: series(['DEFESA_CIVIL','CEMADEN','SGB','ANA']),
  ALAGAMENTO: series(['DEFESA_CIVIL','CEMADEN','ANA','SGB']),
  FRENTE_FRIA: series(['INMET','DEFESA_CIVIL','MARINHA','NOAA','EUMETSAT','INPE','WINDY']),
  EL_NINO_LA_NINA: series(['INMET','NOAA','INPE','WINDY']),
  SISMO: series(['USGS','DEFESA_CIVIL','MARINHA','NOAA']),
  TSUNAMI: series(['MARINHA','NOAA','DEFESA_CIVIL','USGS']),
  PRESSAO_ATMOSFERICA: series(['DEFESA_CIVIL','INMET','INPE','WINDY']),
  RAIOS: series(['REDE_RAIOS','NOAA','DEFESA_CIVIL']),
});


// Complementary, product-specific data channels do NOT change the primary
// official alert hierarchy or the INPE->Windy forecast dispute cascade.
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
  copernicusMarine: Object.freeze({ sourceId:'COPERNICUS_MARINE',
    role:'OCEAN_MODEL_AND_OBSERVATION_PRODUCT_WITH_PROVENANCE_BY_VARIABLE',
    phenomena:Object.freeze(['ONDAS','SWELL','RESSACA','MARE','CORRENTES_MARINHAS','TEMPERATURA_MAR','CICLONE_EXTRATROPICAL']),
    ingestion:'NOT_CONNECTED',permission:'REQUIRES_PRODUCT_TERMS_VALIDATION',
  }),
  eumetsat: Object.freeze({ sourceId:'EUMETSAT_SATELLITE',
    role:'SATELLITE_CLOUD_STORM_CYCLONE_MONITORING_NOT_TSUNAMI_ALERT',
    phenomena:Object.freeze(['TEMPESTADE','CICLONE_EXTRATROPICAL','CHUVA_ATLANTICO','MASSA_AR','FRENTE_FRIA']),
    ingestion:'NOT_CONNECTED',permission:'REQUIRES_PRODUCT_TERMS_VALIDATION',
  }),
});
/**
 * Two-table RJ meteorology consultation policy from the approved screenshots:
 * P1 is a JOINT local priority. The third Table-1 complement is OpenWeatherMap,
 * which is NOT a Brazilian authority or a second independent official station.
 * Exactly one compatible Table-2 product can confirm ONE Table-1 measurement.
 * Geography/source access and actual product type must be checked at runtime.
 */
export const RJ_TABLE1_SOURCE_IDS = Object.freeze([
  'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','OPENWEATHERMAP_API',
]);
export const RJ_TABLE2_SOURCE_IDS = Object.freeze([
  'INPE_CPTEC_FORECAST','INMET_STATION','CEMADEN_RJ','WINDY_MODELO','NOAA',
]);
export function rjTwoTableRouting({ ibge, phenomenon } = {}) {
  if(!municipal.has(String(ibge)))throw TypeError('rj_unknown_municipality');
  if(!RJ_TEN_WEATHER_COMPLEMENTS.includes(phenomenon))
    throw TypeError('rj_phenomenon_outside_ten_source_table');
  const t1=RJ_TABLE1_SOURCE_IDS
    .filter(id=>id!=='ALERTA_RIO'||String(ibge)===RJ_CITY_IBGE)
    .map(id=>Object.values(sources).find(s=>s.id===id));
  const t2=RJ_TABLE2_SOURCE_IDS
    .map(id=>Object.values(sources).find(s=>s.id===id));
  return Object.freeze({
    ibge:String(ibge),phenomenon,
    table1:Object.freeze(t1),
    table2:Object.freeze(t2),
    table1Order:'ALERTA_RIO_AND_DEFESA_CIVIL_JOINT_P1_OPENWEATHER_THIRD_COMPLEMENT',
    table2Order:'INPE_INMET_CEMADEN_WINDY_NOAA',
    minimumIndependentInputs:2,
    maxInputsUsedInOneMean:2,
    table2InputsToConfirmOneTable1:1,
    neverAverageWarningCategories:true,
    rejectRepublishedDuplicates:true,
    meteorologicalScope:'ONLY_RJ_MUNICIPALITIES',
    realTimeConnectionsVerified:false,
    automaticAlertAuthority:false,
  });
}

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
    if (region === 'ATLANTICO') return ['MARINHA_CHM','NOAA','WINDY_MODELO','INMET_STATION','INPE_CPTEC_FORECAST','USGS_EARTHQUAKE','COPERNICUS_MARINE','EUMETSAT_SATELLITE'].includes(s.id);
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
      ? 'MARINHA_NOAA_COPERNICUS_BY_PRODUCT' : null,
    geographicScope: 'RJ_INCLUI_MUNICIPIOS_DE_DIVISA_SEM_CONFUNDIR_DADOS_DE_ESTADOS_VIZINHOS',
    locationMatching: 'VALIDATE_IBGE_STATION_COORDINATES_AND_SOURCE_COVERAGE',
    crossBorderDataPolicy: 'OUTSIDE_RJ_ONLY_AS_EXPLICITLY_LABELED_REGIONAL_CONTEXT_NOT_RJ_OBSERVATION',
    liveData: 'NOT_CONFIRMED',
    disputePolicy: 'OBSERVATIONS_ALERARIO_DEFESACIVIL_INMET_THEN_INPE_THEN_WINDY_MODEL_REVIEW',
    minimumIndependentCompatibleSources: 2,
    fallthroughOnDisagreement: true,
    useWeightedMeanOnlyWhenComparable: true,
    forecastPolicy: 'SEPARATE_FROM_OFFICIAL_STATION_MEASUREMENTS',
    windyPolicy: 'MODEL_COMPARISON_NO_OFFICIAL_TIE_BREAK',
    inpePolicy: 'OFFICIAL_FORECAST_GUIDANCE_NOT_OBSERVATION_OR_AUTOMATIC_TIE_BREAK',
    ineaPolicy: 'EXCLUDED',
  });
}
