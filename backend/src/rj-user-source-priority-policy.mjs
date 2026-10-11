/**
 * Blaise V6 RJ — approved source-priority policy (configuration only).
 * Not a live feed, not an authorization to scrape, not an alert engine.
 * Validate licensing, coverage, provenance, age, units and independence in adapters.
 */
export const RJ_SOURCE_POLICY_VERSION = '2026-10-11-v4-five-source-hierarchy';
const joint = ['ALERTA_RIO', 'DEFESA_CIVIL_RJ'];
// For five-source MUNICIPAL weather: Alerta Rio (Rio city only),
// Civil Defence, INMET first; INPE forecast then Windy as dispute context.
const fiveWeather = [...joint, 'INMET'];
const forecastDispute = ['INPE_CPTEC','WINDY_MODELO'];
const met = ['INMET', 'INPE_CPTEC', 'WINDY_MODELO', 'NOAA', 'CEMADEN_RJ'];
const row = (primary, tiebreak, aggregation='NO_MEAN') =>
  Object.freeze({primary:Object.freeze(primary),tiebreak:Object.freeze(tiebreak),aggregation});
export const RJ_EVENT_SOURCE_POLICY = Object.freeze({
  TEMPERATURA:row(fiveWeather,[...forecastDispute,'MONITORAR_RIO_SMAC','NOAA'],'CONDITIONAL_WEIGHTED'),
  SENSACAO_TERMICA:row(fiveWeather,[...forecastDispute,'BLAISE_DERIVED','NOAA'],'SAME_METHOD_ONLY'),
  CHUVA_ATUAL:row(fiveWeather,[...forecastDispute,'CEMADEN_RJ','MONITORAR_RIO_SMAC','RADAR_OFICIAL'],'CONDITIONAL_WEIGHTED'),
  CHUVA_ACUMULADA:row(fiveWeather,[...forecastDispute,'CEMADEN_RJ','MONITORAR_RIO_SMAC','RADAR_CALIBRADO'],'SAME_WINDOW_ONLY'),
  TEMPORAL:row(fiveWeather,[...forecastDispute,'CEMADEN_RJ','NOAA']),
  VENTO:row(fiveWeather,[...forecastDispute,'NOAA','MARINHA_CHM'],'CONDITIONAL_WEIGHTED'),
  RAJADA:row(fiveWeather,[...forecastDispute,'MARINHA_CHM','NOAA']),
  PRESSAO:row(['INMET'],['MARINHA_CHM','NOAA','INPE_CPTEC'],'SAME_REFERENCE_LEVEL_ONLY'),
  UMIDADE:row(fiveWeather,[...forecastDispute,'NOAA'],'CONDITIONAL_WEIGHTED'),
  GRANIZO:row(fiveWeather,[...forecastDispute,'RADAR_OFICIAL','CEMADEN_RJ']),
  RAIOS:row(['NOAA_GLM','REDE_TERRESTRE_AUTORIZADA'],['REDE_TERRESTRE_INDEPENDENTE','NOAA_GLM','RADAR_CONTEXTO']),
  CICLONE:row(['MARINHA_CHM','INMET'],['NOAA','INPE_CPTEC','WINDY_MODELO']),
  RESSACA:row(['MARINHA_CHM'],['NOAA','BOIAS_OFICIAIS','INPE_CPTEC','WINDY_MODELO']),
  ONDAS:row(['MARINHA_CHM','BOIAS_OFICIAIS'],['NOAA','MODELO_OCEANICO_AUTORIZADO','INPE_CPTEC','WINDY_MODELO'],'CONDITIONAL_WEIGHTED'),
  MARES:row(['MARINHA_CHM'],['MAREGRAFOS_OFICIAIS','MODELO_MARE_VALIDADO']),
  TEMPERATURA_MAR:row(['NOAA','BOIAS_OFICIAIS'],['SATELITES_AUTORIZADOS','MODELOS_OCEANICOS','WINDY_MODELO'],'CONDITIONAL_WEIGHTED'),
  NIVEL_RIOS:row(['ANA','SGB_SACE'],['REDE_HIDROLOGICA_LOCAL','CEMADEN_RJ']),
  VAZAO_RIOS:row(['ANA'],['SGB_SACE','REDE_HIDROLOGICA_LOCAL']),
  ENCHENTE:row(['DEFESA_CIVIL_RJ','SGB_SACE'],['CEMADEN_RJ','ANA']),
  DESLIZAMENTO:row(['DEFESA_CIVIL_RJ','GEO_RIO'],['CEMADEN_RJ','DEFESA_CIVIL_LOCAL']),
  SISMOS:row(['USGS','REDE_SISMOLOGICA_OFICIAL'],['CENTRO_SISMOLOGICO_REGIONAL']),
  TSUNAMI:row(['NOAA_TSUNAMI','MARINHA_CHM','AUTORIDADE_BRASILEIRA_COMPETENTE'],['CENTRO_OFICIAL_ALERTA','USGS','MAREGRAFOS_DART']),
  SECA:row(['CEMADEN_RJ','ANA','INMET'],['INPE_CPTEC','MONITOR_CLIMATICO_AUTORIZADO','WINDY_MODELO']),
  ENSO:row(['NOAA','CENTRO_CLIMATICO_OFICIAL'],['INPE_CPTEC']),
  EXCESSO_CALOR_SAUDE:row(['MONITORA_RJ_SES'],['INMET','ALERTA_RIO','MONITORAR_RIO_SMAC']),
  QUALIDADE_AR:row(['MONITORAR_RIO_SMAC'],['DATA_RIO','REDE_OFICIAL_AR','INDICADOR_AR_VALIDADO']),
  RADIACAO_SOLAR:row(['MONITORAR_RIO_SMAC'],['INMET','SATELITE_OFICIAL','MODELO_AUTORIZADO'],'CONDITIONAL_WEIGHTED'),
  PREVISAO_1_7_DIAS:row(['INMET','MODELO_OFICIAL'],['INPE_CPTEC','NOAA','WINDY_MODELO','MODELO_AUTORIZADO'],'CALIBRATED_FORECAST_ENSEMBLE'),
});
export function sourcePolicyForRjEvent(event) {
  if (typeof event !== 'string' || !Object.hasOwn(RJ_EVENT_SOURCE_POLICY,event))
    throw new TypeError('unknown_rj_event');
  return RJ_EVENT_SOURCE_POLICY[event];
}
export function canAverageRjEvent(event, evidence) {
  const policy=sourcePolicyForRjEvent(event);
  if (!['CONDITIONAL_WEIGHTED','SAME_WINDOW_ONLY','SAME_REFERENCE_LEVEL_ONLY','SAME_METHOD_ONLY','CALIBRATED_FORECAST_ENSEMBLE'].includes(policy.aggregation)) return false;
  return Array.isArray(evidence) && evidence.length>=2 &&
    evidence.every(x=>x?.independent===true && x?.authorized===true &&
      x?.fresh===true && x?.sameLocation===true && x?.sameTimeWindow===true &&
      x?.sameUnits===true && x?.calibratedWeights===true);
}
