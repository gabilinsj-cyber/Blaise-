/**
 * Five supplementary disagreement checks for Blaise V6 RJ.
 *
 * Primary official observation/alert priority stays Alerta Rio (Rio city)
 * + Defesa Civil, then eligible INMET station; this is a SECONDARY
 * quality-control matrix. Source mention does NOT establish live availability.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';
const RJ=new Set(RJ_MUNICIPALITIES.map(x=>String(x.ibge)));
export const RJ_FIVE_TIEBREAK_CHECKS=Object.freeze([
  Object.freeze({
    order:1,code:'INPE_CPTEC',providerIds:Object.freeze(['INPE_CPTEC_FORECAST']),
    title:'INPE/CPTEC • primeira consulta meteorológica de desempate',
    role:'OFFICIAL_FORECAST_COMPARISON',
    rule:'Verificar prazo de previsão, modelo, município/célula e proximidade com a leitura oficial; não transformar previsão em medição.',
  }),
  Object.freeze({
    order:2,code:'INMET_STATION',providerIds:Object.freeze(['INMET_STATION']),
    title:'INMET • conferência de medição oficial',
    role:'INDEPENDENT_OFFICIAL_STATION_READING',
    rule:'Checar observação de estação no município, qualidade, janela e horário, sem extrapolar para outros 91 municípios.',
  }),
  Object.freeze({
    order:3,code:'OPENWEATHER_THIRD',providerIds:Object.freeze(['OPENWEATHERMAP_API']),
    title:'OpenWeatherMap • terceira consulta complementar',
    role:'THIRD_PARTY_MULTISOURCE_DATA_PRODUCT',
    rule:'Comparar produto atual com hora e geolocalização; verificar direitos; não contar a mesma estação republicada como fonte independente.',
  }),
  Object.freeze({
    order:4,code:'WINDY_SECONDARY',providerIds:Object.freeze(['WINDY_MODELO']),
    title:'Windy • comparação adicional de modelos',
    role:'MODEL_COMPARISON_ONLY',
    rule:'Consultar apenas quando INPE inconclusivo ou produto não adequado; diferenciar modelo, corrida, tempo de validade e licença.',
  }),
  Object.freeze({
    order:5,code:'MAR_ATLANTICO_SPECIALIST',
    providerIds:Object.freeze(['MARINHA_CHM','NOAA','COPERNICUS_MARINE','EUMETSAT_SATELLITE']),
    title:'Marinha / NOAA / Copernicus / EUMETSAT • revisão especializada',
    role:'SPECIALIST_SOURCE_BY_MARINE_OR_ATMOSPHERIC_EVENT',
    rule:'Ondas e ressaca: Marinha/boias e Copernicus; ciclones/nuvens: NOAA e EUMETSAT; tsunami só por aviso oficial competente.',
  }),
]);
if(RJ_FIVE_TIEBREAK_CHECKS.length!==5
  ||RJ_FIVE_TIEBREAK_CHECKS.some((c,i)=>c.order!==i+1)
  ||RJ_FIVE_TIEBREAK_CHECKS[0].code!=='INPE_CPTEC'
  ||RJ_FIVE_TIEBREAK_CHECKS[1].code!=='INMET_STATION')
  throw Error('rj_five_tiebreak_checks_invalid');
const MARINE=new Set(['ONDAS','SWELL','MARE','RESSACA','CORRENTES_MARINHAS',
  'TEMPERATURA_MAR','CICLONE_EXTRATROPICAL','CHUVA_ATLANTICO','TSUNAMI',
  'MASSA_AR','FRENTE_FRIA','TEMPESTADE']);
export function planRjFiveDisagreementChecks({ibge,phenomenon}={}) {
  if(!RJ.has(String(ibge))||typeof phenomenon!=='string'||phenomenon.length<3)
    throw TypeError('rj_invalid_five_check_scope');
  const isRio=String(ibge)==='3304557';
  const marine=MARINE.has(phenomenon);
  return Object.freeze({
    municipalityIbge:String(ibge),phenomenon,
    primaryOfficialPriority:Object.freeze(isRio
      ?['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']
      :['DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']),
    fiveSupplementalChecks:Object.freeze(RJ_FIVE_TIEBREAK_CHECKS.map(c=>Object.freeze({
      ...c,
      applicable:c.order!==5||marine,
      observedLiveProduct:false,
      notAutomaticWarning:true,
    }))),
    canAverageObservationAndForecast:false,
    stopEarlyWhenTwoIndependentCompatibleOfficialObservations:true,
    sourceAvailability:'NEEDS_LIVE_VERIFICATION',
    mayIssueAlert:false,
    note:'Five checks are an ordered decision specification, not five collected measurements.',
  });
}
