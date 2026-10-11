/**
 * Blaise V6 RJ — approved source-priority policy (configuration only).
 * Not a live feed, not an authorization to scrape, not an alert engine.
 * Validate licensing, coverage, provenance, age, units and independence in adapters.
 */
export const RJ_SOURCE_POLICY_VERSION = '2026-10-11-v1';
const joint = ['ALERTA_RIO', 'DEFESA_CIVIL_RJ'];
const met = ['INMET', 'INPE_CPTEC', 'NOAA', 'CEMADEN_RJ'];
const row = (primary, tiebreak, aggregation='NO_MEAN') =>
  Object.freeze({primary:Object.freeze(primary),tiebreak:Object.freeze(tiebreak),aggregation});
export const RJ_EVENT_SOURCE_POLICY = Object.freeze({
  TEMPERATURA:row(joint,met,'CONDITIONAL_WEIGHTED'),
  SENSACAO_TERMICA:row(joint,['INMET','BLAISE_DERIVED','NOAA'],'SAME_METHOD_ONLY'),
  CHUVA_ATUAL:row(joint,['INMET','CEMADEN_RJ','INPE_CPTEC','NOAA'],'CONDITIONAL_WEIGHTED'),
  CHUVA_ACUMULADA:row(joint,['INMET','CEMADEN_RJ','RADAR_CALIBRADO'],'SAME_WINDOW_ONLY'),
  TEMPORAL:row(joint,met),
  VENTO:row(joint,['INMET','INPE_CPTEC','NOAA','MARINHA_CHM'],'CONDITIONAL_WEIGHTED'),
  RAJADA:row(joint,['INMET','MARINHA_CHM','NOAA']),
  PRESSAO:row(['INMET'],['MARINHA_CHM','NOAA','INPE_CPTEC'],'SAME_REFERENCE_LEVEL_ONLY'),
  UMIDADE:row(joint,['INMET','INPE_CPTEC','NOAA'],'CONDITIONAL_WEIGHTED'),
  GRANIZO:row(joint,['INMET','RADAR_OFICIAL','INPE_CPTEC']),
  RAIOS:row(['NOAA_GLM','REDE_TERRESTRE_AUTORIZADA'],['REDE_TERRESTRE_INDEPENDENTE','NOAA_GLM','RADAR_CONTEXTO']),
  CICLONE:row(['MARINHA_CHM','INMET'],['NOAA','INPE_CPTEC']),
  RESSACA:row(['MARINHA_CHM'],['NOAA','BOIAS_OFICIAIS']),
  ONDAS:row(['MARINHA_CHM','BOIAS_OFICIAIS'],['NOAA','MODELO_OCEANICO_AUTORIZADO'],'CONDITIONAL_WEIGHTED'),
  MARES:row(['MARINHA_CHM'],['MAREGRAFOS_OFICIAIS','MODELO_MARE_VALIDADO']),
  TEMPERATURA_MAR:row(['NOAA','BOIAS_OFICIAIS'],['SATELITES_AUTORIZADOS','MODELOS_OCEANICOS'],'CONDITIONAL_WEIGHTED'),
  NIVEL_RIOS:row(['ANA','SGB_SACE'],['REDE_HIDROLOGICA_LOCAL','CEMADEN_RJ']),
  VAZAO_RIOS:row(['ANA'],['SGB_SACE','REDE_HIDROLOGICA_LOCAL']),
  ENCHENTE:row(['DEFESA_CIVIL_RJ','SGB_SACE'],['CEMADEN_RJ','ANA']),
  DESLIZAMENTO:row(['DEFESA_CIVIL_RJ','GEO_RIO'],['CEMADEN_RJ','DEFESA_CIVIL_LOCAL']),
  SISMOS:row(['USGS','REDE_SISMOLOGICA_OFICIAL'],['CENTRO_SISMOLOGICO_REGIONAL']),
  TSUNAMI:row(['NOAA_TSUNAMI','MARINHA_CHM','AUTORIDADE_BRASILEIRA_COMPETENTE'],['CENTRO_OFICIAL_ALERTA','USGS','MAREGRAFOS_DART']),
  SECA:row(['CEMADEN_RJ','ANA','INMET'],['INPE_CPTEC','MONITOR_CLIMATICO_AUTORIZADO']),
  ENSO:row(['NOAA','CENTRO_CLIMATICO_OFICIAL'],['INPE_CPTEC']),
  PREVISAO_1_7_DIAS:row(['INMET','MODELO_OFICIAL'],['INPE_CPTEC','NOAA','MODELO_AUTORIZADO'],'CALIBRATED_FORECAST_ENSEMBLE'),
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
