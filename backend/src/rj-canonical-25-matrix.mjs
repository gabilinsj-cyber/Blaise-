/**
 * Blaise V6 RJ canonical, user-approved P1 matrix of 25 monitoring phenomena.
 * It is a PROGRAMMATIC SPECIFICATION, not 25 deployed collectors.
 * Existing low-level routing may cover a broader/different 23 categories.
 * Distinguish official observations from model forecasts and official alerts.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';
import { RJ_PHENOMENA, rjSourceRouting } from './rj-phenomenon-source-policy.mjs';

const TYPE='USER_APPROVED_CANONICAL_25_NOT_LIVE_CONNECTOR_STATUS';
const canonical=Object.freeze([
  [
    "TEMPERATURA",
    "Temperatura",
    "Alerta Rio (capital), Defesa Civil RJ, INMET",
    "INPE/CPTEC; Windy",
    "Medição pontual + média ponderada somente quando compatível",
    "TEMPERATURA"
  ],
  [
    "SENSACAO_TERMICA",
    "Sensação térmica",
    "Alerta Rio (capital), Defesa Civil RJ, INMET",
    "INPE/CPTEC; Windy",
    "Índice de calor ou vento-frio conforme domínio da fórmula",
    "SENSACAO_TERMICA"
  ],
  [
    "CHUVA_ATUAL",
    "Chuva atual",
    "Alerta Rio (capital), Defesa Civil RJ, INMET; CEMADEN onde houver",
    "INPE/CPTEC; Windy",
    "Taxa/intensidade de chuva com intervalo e pluviômetro identificado",
    null
  ],
  [
    "CHUVA_ACUMULADA",
    "Chuva acumulada",
    "Alerta Rio (capital), Defesa Civil RJ, INMET; CEMADEN onde houver",
    "INPE/CPTEC; Windy",
    "mm nas janelas 5/10/15/30 min, 1h, 24h e outras autorizadas",
    "CHUVA_ACUMULADA"
  ],
  [
    "CHUVA_INTENSA_TEMPORAL",
    "Chuva intensa e temporal",
    "Alerta Rio (capital), Defesa Civil RJ, INMET; CEMADEN",
    "INPE/CPTEC; Windy",
    "Radar/instabilidade/deslocamento; avisos oficiais não são médias",
    "TEMPORAL"
  ],
  [
    "VENTO_SUSTENTADO",
    "Vento sustentado",
    "Alerta Rio (capital), Defesa Civil RJ, INMET",
    "INPE/CPTEC; Windy",
    "Direção, velocidade e advecção com unidade e altura de referência",
    "VENTO"
  ],
  [
    "RAJADAS_FORTES",
    "Rajadas fortes",
    "Alerta Rio (capital), Defesa Civil RJ, INMET",
    "INPE/CPTEC; Windy",
    "Picos de rajada e janela, sem misturar vento médio",
    "RAJADA"
  ],
  [
    "PRESSAO_ATMOSFERICA",
    "Pressão atmosférica",
    "INMET e estações oficiais locais",
    "INPE/CPTEC; Windy",
    "Tendência, gradiente e redução ao nível do mar condicionada a perfil",
    null
  ],
  [
    "UMIDADE_RELATIVA",
    "Umidade relativa",
    "INMET, Alerta Rio na capital e redes oficiais locais",
    "INPE/CPTEC; Windy",
    "Ponto de orvalho, bulbo úmido, razão de mistura",
    "UMIDADE"
  ],
  [
    "GRANIZO",
    "Granizo",
    "Defesa Civil, INMET, CEMADEN, Alerta Rio na capital",
    "INPE/CPTEC; Windy",
    "Avisos/ocorrências confirmadas; potencial convectivo não prova queda de granizo",
    "GRANIZO"
  ],
  [
    "RAIOS_DESCARGAS",
    "Raios e descargas elétricas",
    "NOAA GOES/GLM e redes terrestres autorizadas",
    "INPE/CPTEC e Defesa Civil conforme produto",
    "Localização/frequência e evolução; preservar diferenças satélite/rede terrestre",
    null
  ],
  [
    "CICLONE_EXTRATROPICAL",
    "Ciclone extratropical",
    "Marinha/CHM, INMET e NOAA",
    "INPE/CPTEC; Windy",
    "Trajetória, pressão, rajadas e possível aproximação do RJ",
    "CICLONE_EXTRATROPICAL"
  ],
  [
    "RESSACA",
    "Ressaca",
    "Marinha/CHM e avisos costeiros oficiais",
    "NOAA; INMET costeiro; INPE/CPTEC; Windy",
    "Altura, período/direção e vigência do aviso",
    "RESSACA"
  ],
  [
    "ONDAS_ALTURA",
    "Altura das ondas",
    "Marinha/CHM, NOAA e boias oficiais",
    "INPE/CPTEC; Windy",
    "Altura, período, direção e propagação",
    "ONDAS"
  ],
  [
    "MARES",
    "Marés",
    "Marinha/CHM (tábua/estações maregráficas)",
    "Autoridades/estações costeiras competentes",
    "Preamar, baixa-mar, hora e altura local",
    null
  ],
  [
    "TEMPERATURA_DO_MAR",
    "Temperatura do mar",
    "NOAA, Marinha e boias oficiais",
    "INPE/CPTEC, modelos oceânicos autorizados",
    "Temperatura superficial/anomalia, produto e resolução",
    null
  ],
  [
    "NIVEL_DOS_RIOS",
    "Nível dos rios",
    "ANA, SGB/SACE e redes hidrológicas oficiais",
    "CEMADEN/Defesa Civil para contexto de risco",
    "Cota e tendência por estação, sem equivaler a vazão",
    null
  ],
  [
    "VAZAO_DOS_RIOS",
    "Vazão dos rios",
    "ANA/HidroWeb e redes oficiais de vazão",
    "SGB/SACE quando houver medição adequada",
    "Vazão em m³/s com estação e validade",
    "VAZAO_RIO"
  ],
  [
    "ENCHENTE_INUNDACAO",
    "Enchente e inundação",
    "Defesa Civil, CEMADEN, SGB/SACE e ANA",
    "Alerta Rio na capital conforme produto",
    "Aviso/risco, tendência de nível e chuva; não diluir aviso por média",
    "RISCO_HIDROLOGICO"
  ],
  [
    "DESLIZAMENTO",
    "Deslizamento",
    "Defesa Civil, CEMADEN, Geo-Rio e SGB",
    "ANA/chuva acumulada como dado auxiliar",
    "Avisos geológicos; chuva e solo não confirmam ocorrência isoladamente",
    "DESLIZAMENTO"
  ],
  [
    "SISMOS",
    "Sismos",
    "USGS e redes sismológicas oficiais",
    "Defesa Civil, NOAA e Marinha se houver risco costeiro",
    "Magnitude/profundidade/local; avaliar impacto com confirmação",
    "SISMO"
  ],
  [
    "TSUNAMI_MAREMOTO",
    "Tsunami e maremoto",
    "NOAA, Marinha e autoridades brasileiras",
    "USGS na investigação sísmica; Defesa Civil",
    "Tsunami meteorológico separado do sísmico; só aviso competente autoriza alarme",
    "TSUNAMI"
  ],
  [
    "SECA_ESTIAGEM",
    "Seca e estiagem",
    "CEMADEN, INMET e ANA",
    "SGB/SACE e boletins hidrometeorológicos",
    "Déficit pluviométrico, balanço hídrico e níveis hidrológicos",
    null
  ],
  [
    "EL_NINO_LA_NINA",
    "El Niño / La Niña",
    "NOAA, INPE/CPTEC e INMET",
    "Modelos climáticos licenciados incluindo Windy quando adequado",
    "Anomalias oceânicas/atmosféricas; impactos locais como hipótese",
    "EL_NINO_LA_NINA"
  ],
  [
    "PREVISAO_1_7_DIAS",
    "Previsão de 1 a 7 dias",
    "INMET e INPE/CPTEC",
    "NOAA nos produtos adequados; Windy para comparação",
    "Prazo, rodada do modelo, grade, incerteza e data de validade",
    null
  ]
].map(
  ([id,name,primarySources,comparisonSources,calculation,existingRoute])=>Object.freeze({
    id,name,primarySources,comparisonSources,calculation,existingRoute,
    operationalStatus: TYPE,
  })
));
export const RJ_CANONICAL_25_PHENOMENA = canonical;
export const RJ_CANONICAL_25_COUNT = canonical.length;
export const RJ_SOURCE_TIEBREAK_ORDER = Object.freeze([
  'ALERTA_RIO_RIO_CITY_ONLY',
  'DEFESA_CIVIL_LOCAL_AUTHORITY',
  'INMET_STATION',
  'INPE_CPTEC_FORECAST_FIRST_MODEL_COMPARISON',
  'WINDY_MODEL_ONLY_IF_INPE_INCONCLUSIVE',
]);
export const RJ_CANONICAL_SOURCE_GATES = Object.freeze({
  inea: 'EXCLUDED',
  geographicScope:'ONLY_92_RJ_MUNICIPALITIES_AND_RELEVANT_ADJACENT_ATLANTIC',
  rioAlertaCoverage:'RIO_MUNICIPALITY_ONLY',
  modelIsNotObservedStation:true,
  weightedObservationMeanOnlyWhenComparable:true,
  neverAverageWarningSeverities:true,
  missingReadingMayNotBeInvented:true,
  seismicAndMarineWarningsRequireCompetentAuthority:true,
});

const canonicalIds=new Set(canonical.map(x=>x.id));
if (canonical.length!==25 || canonicalIds.size!==25 || RJ_MUNICIPALITIES.length!==92)
  throw new Error('rj_canonical_25_source_matrix_invariant');
for (const row of canonical)if(row.existingRoute&&!RJ_PHENOMENA.includes(row.existingRoute))
  throw new Error('rj_canonical_25_missing_existing_route_'+row.id);

/** Plan municipality-specific sources without claiming any live sensor data. */
export function rjCanonical25Consultation({phenomenonId,ibge,region='MUNICIPAL'}={}) {
  const row=canonical.find(x=>x.id===phenomenonId);
  if(!row)throw new TypeError('rj_unknown_canonical_phenomenon');
  const municipality=RJ_MUNICIPALITIES.find(m=>m.ibge===String(ibge));
  if(region==='MUNICIPAL'&&!municipality)throw new TypeError('rj_unknown_municipality');
  if(!['MUNICIPAL','LITORAL','ATLANTICO'].includes(region))throw new TypeError('rj_unknown_region');
  const route=row.existingRoute?rjSourceRouting({
    ibge:municipality?.ibge??null,phenomenon:row.existingRoute,region
  }):null;
  return Object.freeze({
    phenomenonId:row.id,
    phenomenonName:row.name,
    municipalityIbge:municipality?.ibge??null,
    region,
    primarySources:row.primarySources,
    comparisonSources:row.comparisonSources,
    calculation:row.calculation,
    existingRoute:row.existingRoute,
    eligibleSources:route?.sources??Object.freeze([]),
    routingImplementation:route?'EXISTING_CATEGORY_ROUTING_PRESENT':'CANONICAL_SPEC_PENDING_DEDICATED_ADAPTER',
    dataStatus:'NOT_VALIDATED_CURRENT',
    consensusConfirmed:false,
    automatedAlertIssued:false,
  });
}
