/**
 * MATRIZ BLAISE V6 RJ — ATLÂNTICO INTEGRADO | 25 FENÔMENOS
 * Version 2026-10-11. Approved 25-number index; extends (never replaces)
 * the 28-event source-priority rules already recorded in PR #102.
 *
 * Configuration/catalogue ONLY. A viewer URL is NOT a licensed data API.
 * Source roles: OFFICIAL_ALERT, OBSERVATION, MODEL_OR_DERIVED,
 * SATELLITE_CONTEXT, OCEAN_PRODUCT, REQUIRES_PRODUCT_VALIDATION.
 * No active network ingestion, attribution or license is implied.
 */
import { RJ_EVENT_SOURCE_POLICY } from './rj-user-source-priority-policy.mjs';

export const RJ_ATLANTIC_25_NAME = 'Matriz Blaise V6 RJ — Atlântico Integrado | 25 Fenômenos';
export const RJ_ATLANTIC_25_VERSION = '2026-10-11-atlantico-integrado-v1';
export const RJ_ATLANTIC_25_AREAS = Object.freeze([
  'RJ_92_MUNICIPIOS','RJ_LITORAL','ATLANTICO_ADJACENTE_IMPACTO_RJ',
]);
export const RJ_ATLANTIC_25_PROVIDERS = Object.freeze({
  OPENWEATHER: Object.freeze({
    id:'OPENWEATHER', name:'OpenWeatherMap / OpenWeather',
    website:'https://openweathermap.org/',
    products:'CURRENT_WEATHER_AND_FORECAST_AS_LICENSED',
    usage:'COMPLEMENTARY_AGGREGATED_WEATHER_OR_FORECAST_NOT_OFFICIAL_WARNING',
    status:'NOT_CONNECTED_SECRET_NOT_CONFIGURED_IN_BACKEND',
    credentialEnvName:'OPENWEATHER_API_KEY',
    keyPolicy:'SERVER_SIDE_ONLY_NO_APP_OR_GITHUB_PUBLIC_SOURCE',
    credit:'Weather data provided by OpenWeather',
    license:'VERIFY_PLAN_AND_ODBL_ATTRIBUTION_AND_DERIVED_DATA_RIGHTS',
  }),
  COPERNICUS_MARINE: Object.freeze({
    id:'COPERNICUS_MARINE', name:'Copernicus Marine (UE)',
    website:'https://marine.copernicus.eu/access-data/myocean-viewer',
    dataCatalog:'https://data.marine.copernicus.eu/',
    recommendedInterface:'COPERNICUS_MARINE_TOOLBOX_PRODUCT_SUBSET_API',
    usage:'OCEAN_MODEL_AND_SATELLITE_OBSERVATION_PER_SELECTED_PRODUCT',
    status:'NOT_CONNECTED_PRODUCT_AND_LICENSE_CHECK_REQUIRED',
    license:'VERIFY_PRODUCT_DOI_CITATION_CREDIT_AND_TERMS',
    credit:'E.U. Copernicus Marine Service Information (product DOI)',
  }),
  EUMETSAT: Object.freeze({
    id:'EUMETSAT', name:'EUMETSAT (Europa)',
    website:'https://view.eumetsat.int/',
    dataCatalog:'https://data.eumetsat.int/',
    recommendedInterface:'EUMETSAT_DATA_STORE_EUMDAC_OR_AUTHORIZED_OGC',
    usage:'SATELLITE_DATA_ONLY_IF_PRODUCT_COVERS_RJ_ATLANTIC',
    status:'NOT_CONNECTED_PRODUCT_FOOTPRINT_AND_LICENSE_CHECK_REQUIRED',
    license:'VERIFY_SATELLITE_PRODUCT_AND_EUMETSAT_DATA_POLICY',
    credit:'EUMETSAT — credit according to selected product license',
  }),
});
const EXT_OW=Object.freeze({
  sourceId:'OPENWEATHER',role:'COMPLEMENTARY_WEATHER_AGGREGATE_OR_MODEL',
  canConfirmOfficialWarning:false,
  requires:'MATCHED_ENDPOINT_PLAN_GEOLOCATION_VALID_TIME_UNIT_AND_ATTRIBUTION',
});
const euro=(sourceId,role,variable,limitation)=>Object.freeze({
  sourceId,role,variable,limitation,
  canConfirmOfficialWarning:false,
  requires:'PRODUCT_ID_FOOTPRINT_ATLANTIC_RJ_VALID_TIME_LICENSE_PROVENANCE',
});
const EUM=(role,variable,limitation='SATELLITE_CONTEXT_NOT_GROUND_WARNING')=>
  euro('EUMETSAT',role,variable,limitation);
const COP=(role,variable,limitation='OCEAN_CONTEXT_NOT_OFFICIAL_WARNING')=>
  euro('COPERNICUS_MARINE',role,variable,limitation);

const EU_BY_NUMBER = Object.freeze({
  11: Object.freeze([
    EUM('SATELLITE_LIGHTNING','MTG_LIGHTNING_IMAGER_WHERE_GEOGRAPHICALLY_COVERED',
      'CHECK_GEO_FOOTPRINT_AND_PRODUCT_FLASH_NOT_SURFACE_LIGHTNING'),
    COP('NON_APPLICABLE_DIRECT','NONE','NO_DIRECT_LIGHTNING_PRODUCT_DO_NOT_INGEST_AS_RAIO'),
  ]),
  12: Object.freeze([
    COP('OCEAN_STORM_SUPPORT','WAVES_CURRENTS_SEA_LEVEL_SEA_TEMPERATURE',
      'OCEAN_CONDITIONS_ONLY_NOT_CYCLONE_WARNING'),
    EUM('SATELLITE_STORM_SUPPORT','CLOUDS_WIND_FIELDS_AIR_MASS_IF_PRODUCT_COVERS_RJ'),
  ]),
  13: Object.freeze([
    COP('MARINE_WAVE_DATA','SIGNIFICANT_WAVE_HEIGHT_PERIOD_DIRECTION'),
    EUM('SATELLITE_WAVE_CONTEXT','ALTIMETRY_OR_OCEAN_WIND_IF_PRODUCT_AVAILABLE',
      'NOT_EVERY_SATELLITE_PRODUCT_REPORTS_WAVES'),
  ]),
  14: Object.freeze([
    COP('MARINE_SEA_STATE_SUPPORT','WAVE_HEIGHT_PERIOD_AND_COASTAL_OCEAN_CONTEXT',
      'RESSACA_WARNING_REMAINS_MARINHA_BRASIL_AUTHORITY'),
    EUM('SATELLITE_MARINE_CONTEXT','OCEAN_WINDS_AND_WAVES_IF_AVAILABLE',
      'NOT_A_FORMAL_RESSACA_WARNING'),
  ]),
  15: Object.freeze([
    COP('OCEAN_SEA_LEVEL','SEA_LEVEL_ANOMALY_AND_COASTAL_OCEAN_MODEL',
      'MODEL_SEA_LEVEL_IS_NOT_LOCAL_HARBOR_TIDE_TABLE'),
    EUM('SATELLITE_ALTIMETRY_CONTEXT','OCEAN_SURFACE_HEIGHT_ALTIMETRY',
      'SATELLITE_ALTIMETRY_NOT_LOCAL_TIDE_GAUGE'),
  ]),
  16: Object.freeze([
    COP('OCEAN_TEMPERATURE','SEA_SURFACE_TEMPERATURE_ATLANTIC_RJ'),
    EUM('SATELLITE_OCEAN_TEMPERATURE','SEA_SURFACE_TEMPERATURE_IF_COVERED'),
  ]),
  22: Object.freeze([
    COP('COASTAL_FLOOD_CONTEXT','SEA_LEVEL_WAVES_CURRENTS_COASTAL_COMPOUND_FLOOD',
      'COASTAL_CONTEXT_ONLY_NOT_INLAND_STREET_FLOOD_MEASUREMENT'),
    EUM('SATELLITE_HEAVY_RAIN_CONTEXT','CLOUDS_RAINFALL_PRODUCTS_IF_COVERED',
      'NOT_A_DIRECT_RJ_STREET_WATER_OBSERVATION'),
  ]),
  24: Object.freeze([
    COP('INDIRECT_MARINE_HEAT_CONTEXT','SEA_SURFACE_TEMPERATURE_MARINE_HEATWAVE',
      'NOT_A_DIRECT_HUMAN_HEAT_INDEX_OR_UV_MEASUREMENT'),
    EUM('INDIRECT_ATMOSPHERIC_CONTEXT','SATELLITE_AIR_MASS_SURFACE_PRODUCTS_IF_COVERED',
      'NOT_A_DIRECT_PERSONAL_UV_INDEX_OR_HEALTH_WARNING'),
  ]),
});

const INDEX = Object.freeze([
  [1,'Temperatura','TEMPERATURA',['TEMPERATURA'],'RJ_MUNICIPAL'],
  [2,'Sensação térmica','SENSACAO_TERMICA',['SENSACAO_TERMICA'],'RJ_MUNICIPAL'],
  [3,'Chuva atual e acumulada','CHUVA_ATUAL_ACUMULADA',['CHUVA_ATUAL','CHUVA_ACUMULADA'],'RJ_MUNICIPAL'],
  [4,'Previsão de chuva','PREVISAO_CHUVA',['PREVISAO_1_7_DIAS'],'RJ_MUNICIPAL'],
  [5,'Temporais e tempestades','TEMPORAIS',['TEMPORAL'],'RJ_MUNICIPAL'],
  [6,'Vento sustentado e direção','VENTO',['VENTO'],'RJ_MUNICIPAL'],
  [7,'Rajadas de vento','RAJADAS',['RAJADA'],'RJ_MUNICIPAL'],
  [8,'Pressão atmosférica','PRESSAO',['PRESSAO'],'RJ_MUNICIPAL'],
  [9,'Umidade relativa','UMIDADE',['UMIDADE'],'RJ_MUNICIPAL'],
  [10,'Granizo','GRANIZO',['GRANIZO'],'RJ_MUNICIPAL'],
  [11,'Raios','RAIOS',['RAIOS'],'RJ_E_ATLANTICO'],
  [12,'Ciclones e tempestades extratropicais','CICLONES_EXTRA',['CICLONE'],'ATLANTICO_E_LITORAL_RJ'],
  [13,'Ondas','ONDAS',['ONDAS'],'ATLANTICO_E_LITORAL_RJ'],
  [14,'Ressaca','RESSACA',['RESSACA'],'ATLANTICO_E_LITORAL_RJ'],
  [15,'Marés e nível do mar','MARES_NIVEL_MAR',['MARES'],'ATLANTICO_E_LITORAL_RJ'],
  [16,'Temperatura do mar','TEMPERATURA_MAR',['TEMPERATURA_MAR'],'ATLANTICO_E_LITORAL_RJ'],
  [17,'Tsunami sísmico e meteorológico','TSUNAMI',['TSUNAMI'],'ATLANTICO_E_LITORAL_RJ'],
  [18,'Nível e vazão dos rios','RIOS',['NIVEL_RIOS','VAZAO_RIOS'],'RJ_HIDROLOGIA'],
  [19,'Cheias, enchentes e inundações','ENCHENTE',['ENCHENTE'],'RJ_HIDROLOGIA'],
  [20,'Deslizamentos','DESLIZAMENTO',['DESLIZAMENTO'],'RJ_GEOLOGIA'],
  [21,'Abalos sísmicos','SISMOS',['SISMOS'],'RJ_E_ATLANTICO'],
  [22,'Alagamentos','ALAGAMENTOS',['ENCHENTE'],'RJ_URBANO_E_COSTEIRO'],
  [23,'Trânsito e interdições','TRANSITO',[],'RJ_URBANO'],
  [24,'Calor extremo e índice UV','CALOR_EXTREMO_UV',['EXCESSO_CALOR_SAUDE','RADIACAO_SOLAR'],'RJ_SAUDE_E_ATLANTICO_CONTEXTO'],
  [25,'Qualidade do ar','QUALIDADE_AR',['QUALIDADE_AR'],'RJ_MUNICIPAL'],
]);

// Preserve all specialized alerts and source priorities already approved.
export const RJ_ATLANTIC_MATRIX_25 = Object.freeze(INDEX.map(([number,title,id,policyKeys,scope])=>{
  const legacy=policyKeys.map(key=>RJ_EVENT_SOURCE_POLICY[key]);
  if(policyKeys.some((key,i)=>!legacy[i]))throw new Error('rj_missing_source_policy_key_'+id);
  const primary=[...new Set(legacy.flatMap(x=>x.primary))];
  const tiebreak=[...new Set(legacy.flatMap(x=>x.tiebreak))];
  // No OpenWeather data as an independent official station or warning.
  const external=number<=10?[EXT_OW]:(EU_BY_NUMBER[number]||[]);
  return Object.freeze({
    number,title,id,scope,
    sourcePolicyKeys:Object.freeze(policyKeys),
    priorityOfficialAndSpecialized:Object.freeze(primary),
    existingTieBreakAndContext:Object.freeze(tiebreak),
    newComplementarySources:Object.freeze(external),
    dataStatus:'REQUIRES_PRODUCT_SPECIFIC_LIVE_VALIDATION',
    canPublishP0FromNewSource:false,
    originAndObservationTimeMandatory:true,
    avoidDoubleCountingRepublishedData:true,
  });
}));
export function rjAtlanticMatrixRow(number) {
  if(!Number.isInteger(number)||number<1||number>25)
    throw new RangeError('invalid_rj_25_phenomenon_number');
  return RJ_ATLANTIC_MATRIX_25[number-1];
}
export function europeanProductUsableForPhenomenon(number, sourceId, evidence={}) {
  if(!['COPERNICUS_MARINE','EUMETSAT'].includes(sourceId))return false;
  const row=rjAtlanticMatrixRow(number);
  const ref=row.newComplementarySources.find(x=>x.sourceId===sourceId);
  if(!ref||ref.role==='NON_APPLICABLE_DIRECT')return false;
  return evidence?.productId?.length>0
    && evidence?.dataLicenseVerified===true
    && evidence?.spatialCoverageRjAtlantic===true
    && evidence?.georeferenced===true
    && evidence?.freshForPhenomenon===true
    && evidence?.variableMatchesPhenomenon===true
    && evidence?.provenanceIndependent===true;
}
