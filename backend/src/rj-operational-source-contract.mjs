/**
 * Blaise V6 RJ — single explicit MUNICIPAL operational hierarchy.
 *
 * The supplementary Table 1 (Alerta Rio + Defesa Civil + optional
 * OpenWeatherMap) is a separate product COMPARISON catalog. It cannot
 * reorder the authoritative station path or turn a model into a station.
 * For temperature, humidity, wind, gust and observed rain, INMET is the
 * third official source; INPE is the first forecast tie-break, Windy next.
 *
 * Not a deployed connector and no network access, weather value or alert.
 */
import {
  rjSourceRouting,RJ_TEN_WEATHER_COMPLEMENTS,RJ_MUNICIPALITY_COUNT,
} from './rj-phenomenon-source-policy.mjs';

export const RJ_OPERATIONAL_SOURCES_V1='RJ_PRIMARY_THREE_THEN_MODEL_TWO_20261013';
export const RJ_PRIMARY_OFFICIAL=Object.freeze([
  'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION',
]);
export const RJ_MODEL_DISPUTE=Object.freeze([
  'INPE_CPTEC_FORECAST','WINDY_MODELO',
]);
const PRIMARY_VARIABLE_PHENOMENA=new Set([
  'TEMPERATURA','SENSACAO_TERMICA','UMIDADE','VENTO','RAJADA',
  'CHUVA_ACUMULADA','CHUVA_ATUAL','TEMPORAL','TEMPESTADE',
  'GRANIZO','PRESSAO_ATMOSFERICA',
]);

export function rjOperationalSources({ibge,phenomenon}={}) {
  const route=rjSourceRouting({ibge,phenomenon});
  const available=new Set(route.sources.map(s=>s.id));
  if(!PRIMARY_VARIABLE_PHENOMENA.has(phenomenon)) return Object.freeze({
    contract:RJ_OPERATIONAL_SOURCES_V1,
    phenomenon,municipalityIbge:String(ibge),
    specializedRouting:true,
    primaryOfficialSources:Object.freeze(
      route.sources.filter(s=>s.role==='AVISO_OU_MEDICAO_OFICIAL').map(s=>s.id)),
    modelTieBreakSources:Object.freeze([]),
    extraComplementaryProducts:Object.freeze([]),
    mandatoryProductConnections:false,
    sourceDataVerified:false,
  });
  return Object.freeze({
    contract:RJ_OPERATIONAL_SOURCES_V1,
    phenomenon,municipalityIbge:String(ibge),
    specializedRouting:false,
    primaryOfficialSources:Object.freeze(
      RJ_PRIMARY_OFFICIAL.filter(s=>available.has(s))),
    modelTieBreakSources:Object.freeze(
      RJ_MODEL_DISPUTE.filter(s=>available.has(s))),
    extraComplementaryProducts:Object.freeze(
      RJ_TEN_WEATHER_COMPLEMENTS.includes(phenomenon)
        ?['OPENWEATHERMAP_API']:[]),
    // OpenWeatherMap can be the third SUPPLEMENTARY product for the first
    // ten variables but never displaces third OFFICIAL station INMET.
    supplementaryIsNotOfficialPriority:true,
    requireTwoIndependentComparableObservations:true,
    doNotAverageModelWithMeasurement:true,
    automaticWeatherAlertAllowed:false,
    mandatoryProductConnections:false,
    sourceDataVerified:false,
    availableMunicipalities:RJ_MUNICIPALITY_COUNT,
  });
}
