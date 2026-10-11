/**
 * Blaise V6 RJ — approved supplementary source matrices from the owner's
 * screenshots dated 2026-10-11. These are routing specifications, NOT data
 * collectors, live alerts, or permission to redistribute third-party feeds.
 *
 * IMPORTANT: The canonical 25-phenomenon Table 1 and separate arbitration
 * Table 2 retain their existing names and contents. This is the first-ten
 * THIRD SOURCE column and the independent MARITIME supplement.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

export const RJ_OPENWEATHER_THIRD_SOURCE_VERSION='2026-10-11';
const municipal=new Set(RJ_MUNICIPALITIES.map(c=>String(c.ibge)));
const FIRST_TEN=Object.freeze([
  ['TEMPERATURA','Temperatura'],
  ['SENSACAO_TERMICA','Sensação térmica'],
  ['CHUVA_ATUAL','Chuva atual'],
  ['CHUVA_ACUMULADA','Chuva acumulada'],
  ['TEMPORAL','Chuva intensa e temporais'],
  ['VENTO','Vento sustentado'],
  ['RAJADA','Rajadas fortes'],
  ['PRESSAO_ATMOSFERICA','Pressão atmosférica'],
  ['UMIDADE','Umidade relativa'],
  ['GRANIZO','Granizo'],
].map(([code,phenomenon])=>Object.freeze({
  code,phenomenon,
  jointP1:Object.freeze(['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']),
  thirdSource:'OPENWEATHERMAP',
  thirdRole:'THIRD_PARTY_COMPLEMENTARY_QUERY_NOT_AN_OFFICIAL_WARNING',
  doesNotSupersede:['INMET_STATION','INPE_CPTEC_FORECAST','WINDY_MODELO'],
  availability:'UNVERIFIED',
  license:'PRODUCT_SPECIFIC_USAGE_TERMS_REQUIRED',
  alwaysIndependent:false,
})));
export const RJ_TABLE1_OPENWEATHER_FIRST_TEN=FIRST_TEN;
export const RJ_MARINE_SOURCE_COMPLEMENT=Object.freeze([
  {
    code:'CICLONE_OCEANICO',name:'Ciclones oceânicos',
    sources:['MARINHA_CHM','NOAA','EUMETSAT_SATELLITE','COPERNICUS_MARINE'],
    purpose:'Acompanhar evolução atmosférica e efeitos no mar',
  },
  {
    code:'TEMPESTADE_ATLANTICO',name:'Tempestades no Atlântico',
    sources:['MARINHA_CHM','NOAA','EUMETSAT_SATELLITE'],
    purpose:'Monitorar nuvens, sistemas intensos e deslocamento',
  },
  {
    code:'ONDAS_SWELL',name:'Ondas e swell',
    sources:['MARINHA_CHM','NOAA','COPERNICUS_MARINE'],
    purpose:'Altura, período, direção e propagação das ondas',
  },
  {
    code:'RESSACA_LITORAL_RJ',name:'Ressaca no litoral RJ',
    sources:['MARINHA_CHM','BOIAS_OCEANOGRAFICAS_AUTORIZADAS','COPERNICUS_MARINE','NOAA'],
    purpose:'Avisos, condições do mar e avaliação contextual do risco costeiro',
  },
  {
    code:'TSUNAMI',name:'Tsunami / maremoto',
    sources:['NOAA','MARINHA_CHM','AUTORIDADES_BRASILEIRAS_COMPETENTES'],
    purpose:'Avisos oficiais e observações do nível do mar para confirmação da ameaça',
  },
].map(row=>Object.freeze({
  ...row, sources:Object.freeze(row.sources),
  status:'CATALOG_ONLY_NOT_LIVE',automaticAlertAllowed:false,
  commercialPermission:'VERIFY_EACH_DATA_PRODUCT',
})));

if(municipal.size!==92||FIRST_TEN.length!==10||RJ_MARINE_SOURCE_COMPLEMENT.length!==5)
  throw new Error('rj_supplemental_source_matrix_invalid');

/** Municipality-specific P1; Alerta Rio never gets state-wide attribution. */
export function rjOpenWeatherComplement({ibge,phenomenon}={}) {
  if(!municipal.has(String(ibge)))throw new TypeError('rj_only_municipalities_allowed');
  const item=FIRST_TEN.find(x=>x.code===phenomenon);
  if(!item)throw new TypeError('unknown_table1_phenomenon');
  return Object.freeze({
    code:item.code,municipalityIbge:String(ibge),
    p1Sources:Object.freeze(String(ibge)==='3304557'
      ?['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL']
      :['DEFESA_CIVIL_RJ_REGIONAL']),
    p1JointOnlyWhenBothHaveProductCoverage:true,
    thirdSource:item.thirdSource,
    thirdRole:item.thirdRole,
    requiredChecks:Object.freeze(['PRODUCT_COMPATIBILITY','LOCATION','VARIABLE',
      'TIME_WINDOW','SOURCE_PROVENANCE','TERMS_AND_COMMERCIAL_PERMISSION',
      'NO_REPUBLISHED_SOURCES_COUNTED_INDEPENDENTLY']),
    sourceDataStatus:'NOT_FETCHED',
    notAnOfficialAlert:true,
    noInventedWeather:true,
  });
}
