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
  'SISMO', 'TSUNAMI',
]);
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
  USGS: definition('USGS_EARTHQUAKE', OFFICIAL, 'CATALOGO_SISMICO_ATLANTICO_RJ_CONFORME_EVENTO'),
  WINDY: definition('WINDY_MODELO', COMPARE, 'CONFERENCIA_DE_MODELO_NAO_MEDICAO'),
});

function series(keys) { return Object.freeze(keys.map(k => sources[k])); }
const ROUTES = Object.freeze({
  TEMPERATURA: series(['INMET','DEFESA_CIVIL','INPE','WINDY']),
  SENSACAO_TERMICA: series(['INMET','DEFESA_CIVIL','INPE','WINDY']),
  UMIDADE: series(['INMET','DEFESA_CIVIL','INPE','WINDY']),
  VENTO: series(['INMET','DEFESA_CIVIL','INPE','WINDY']),
  RAJADA: series(['DEFESA_CIVIL','INMET','INPE','WINDY']),
  CHUVA_ACUMULADA: series(['CEMADEN','DEFESA_CIVIL','INMET','INPE','WINDY']),
  TEMPORAL: series(['DEFESA_CIVIL','CEMADEN','INMET','INPE','WINDY']),
  TEMPESTADE: series(['DEFESA_CIVIL','CEMADEN','INMET','INPE','WINDY']),
  RISCO_HIDROLOGICO: series(['DEFESA_CIVIL','CEMADEN','SGB','ANA']),
  VAZAO_RIO: series(['ANA','SGB']),
  RESSACA: series(['MARINHA','INMET','NOAA','INPE','WINDY']),
  ONDAS: series(['MARINHA','NOAA','INPE','WINDY']),
  CICLONE_EXTRATROPICAL: series(['MARINHA','INMET','DEFESA_CIVIL','NOAA','INPE','WINDY']),
  CHUVA_ATLANTICO: series(['MARINHA','NOAA','INPE','WINDY']),
  MASSA_AR: series(['INMET','MARINHA','NOAA','INPE','WINDY']),
  RADAR: series(['CEMADEN','DEFESA_CIVIL']),
  GRANIZO: series(['DEFESA_CIVIL','INMET','CEMADEN','INPE','WINDY']),
  DESLIZAMENTO: series(['DEFESA_CIVIL','CEMADEN','SGB','ANA']),
  ALAGAMENTO: series(['DEFESA_CIVIL','CEMADEN','ANA','SGB']),
  FRENTE_FRIA: series(['INMET','DEFESA_CIVIL','MARINHA','NOAA','INPE','WINDY']),
  EL_NINO_LA_NINA: series(['INMET','NOAA','INPE','WINDY']),
  SISMO: series(['USGS','DEFESA_CIVIL','MARINHA','NOAA']),
  TSUNAMI: series(['MARINHA','NOAA','DEFESA_CIVIL','USGS']),
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
  const withRio = rioCity && ['CHUVA_ACUMULADA','TEMPORAL','TEMPESTADE','RADAR','VENTO','RAJADA','TEMPERATURA','SENSACAO_TERMICA'].includes(phenomenon)
    ? [sources.ALERTA_RIO, ...keys] : [...keys];
  const eligible = withRio.filter(s => {
    if (s.id === 'ALERTA_RIO' && !rioCity) return false;
    if (region === 'ATLANTICO') return ['MARINHA_CHM','NOAA','WINDY_MODELO','INMET_STATION','INPE_CPTEC_FORECAST','USGS_EARTHQUAKE'].includes(s.id);
    if (region === 'LITORAL' && s.id === 'ALERTA_RIO' && !rioCity) return false;
    return true;
  });
  return Object.freeze({
    locality: region === 'MUNICIPAL' ? String(ibge) : region,
    phenomenon,
    sources: Object.freeze(eligible),
    historicalGuarantee: 'NONE',
    municipalitySelectionCoverage: RJ_MUNICIPALITY_COUNT,
    geographicScope: 'RJ_INCLUI_MUNICIPIOS_DE_DIVISA_SEM_CONFUNDIR_DADOS_DE_ESTADOS_VIZINHOS',
    locationMatching: 'VALIDATE_IBGE_STATION_COORDINATES_AND_SOURCE_COVERAGE',
    crossBorderDataPolicy: 'OUTSIDE_RJ_ONLY_AS_EXPLICITLY_LABELED_REGIONAL_CONTEXT_NOT_RJ_OBSERVATION',
    liveData: 'NOT_CONFIRMED',
    disputePolicy: 'OFFICIAL_OBSERVATIONS_SAME_PLACE_TIME_VARIABLE_FIRST',
    windyPolicy: 'MODEL_COMPARISON_NO_OFFICIAL_TIE_BREAK',
    inpePolicy: 'OFFICIAL_FORECAST_GUIDANCE_NOT_OBSERVATION_OR_AUTOMATIC_TIE_BREAK',
    ineaPolicy: 'EXCLUDED',
  });
}
