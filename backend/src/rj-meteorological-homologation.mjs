/**
 * BLAISE-RJ-METEO-HOMOLOG-01
 *
 * Consolidated and versioned two-table meteorological SOURCE SPECIFICATION.
 * All 30 registered phenomena use the same existing rjSourceRouting policy.
 * Table 1 is SOURCE ELIGIBILITY BY LOCATION, NOT live proof.
 * Table 2 is DISAGREEMENT/RECONCILIATION DECISION POLICY, NOT a forecast.
 *
 * Deliberately no network, credentials, background workers or silent
 * commercial permission bypass. Live homologation requires actual
 * product/contract/operator evidence outside this module.
 */
import {RJ_PHENOMENA,rjSourceRouting,RJ_CITY_IBGE} from './rj-phenomenon-source-policy.mjs';
import {RJ_TABLE1_THREE,RJ_TABLE2_FIVE,RJ_TABLE1_TEN_COMPLEMENT,RJ_TABLES_VERSION} from './rj-canonical-table-sources.mjs';

export const RJ_METEO_HOMOLOGATION_ID='BLAISE-RJ-METEO-HOMOLOG-01';
export const RJ_METEO_HOMOLOGATION_VERSION=RJ_TABLES_VERSION;
export const RJ_METEO_SOURCE_STATUS=Object.freeze({
  NOT_HOMOLOGATED:'NAO_HOMOLOGADA',
  PRODUCT_UNDER_REVIEW:'PRODUTO_EM_REVISAO',
  LICENSE_PENDING:'LICENCA_PENDENTE',
  LIVE_PROOF_PENDING:'PROVA_OPERACIONAL_PENDENTE',
  LIVE_PROOF_VERIFIED:'PROVA_OPERACIONAL_VERIFICADA',
  UNAVAILABLE:'INDISPONIVEL',
});

const meta=Object.freeze({
  TEMPERATURA:['Temperatura do ar','92 municípios, conforme estação','°C; medição e previsão identificadas'],
  SENSACAO_TERMICA:['Sensação térmica','92 municípios, com entradas locais válidas','°C; cálculo Blaise, não sensor'],
  UMIDADE:['Umidade relativa','92 municípios, conforme estação','%; medição observada'],
  VENTO:['Vento médio','92 municípios, conforme estação','km/h; intervalo e altitude'],
  RAJADA:['Rajada de vento','92 municípios, conforme estação','km/h; rajada não é média do vento'],
  CHUVA_ACUMULADA:['Chuva acumulada','92 municípios, conforme pluviômetro','mm; 5/10/15/30/60 min e 24h, janela completa'],
  TEMPORAL:['Temporal','92 municípios, áreas de aviso','aviso vigente e classe, não média de categorias'],
  TEMPESTADE:['Tempestade severa','92 municípios, áreas de aviso','aviso e radar calibrado, sem risco inventado'],
  RISCO_HIDROLOGICO:['Cheia / inundação','Bacias do RJ, conforme rede','cota e boletim de risco; fonte especializada'],
  VAZAO_RIO:['Vazão de rios','Estações ANA/SGB no RJ','m³/s, estação e observação'],
  RESSACA:['Ressaca e ondas altas','Litoral do RJ','aviso Marinha/CHM vigente'],
  ONDAS:['Ondas, marés e temperatura do mar','Litoral RJ e Atlântico próximo','altura/período/direção; nível de maré e TSM por produto'],
  CICLONE_EXTRATROPICAL:['Ciclone extratropical','Atlântico Sul com potencial impacto RJ','trajetória/vento/pressão e avisos marítimos'],
  CHUVA_ATLANTICO:['Precipitação no Atlântico','Atlântico adjacente ao RJ','satélite/grade espacial por produto e validade'],
  MASSA_AR:['Massas de ar quente e polar','RJ e sistemas de escala regional','advecção, pressão e temperatura em perfis compatíveis'],
  RADAR:['Radar meteorológico próprio','RJ conforme cobertura do instrumento','campos georreferenciados autorizados; não imagens de terceiros'],
  GRANIZO:['Granizo','92 municípios onde houver aviso','evento/aviso confirmado; radar especializado'],
  DESLIZAMENTO:['Deslizamentos','Áreas suscetíveis do RJ','risco/boletim competente e chuva real'],
  ALAGAMENTO:['Alagamentos','Municípios e vias RJ','ocorrências oficiais georreferenciadas'],
  FRENTE_FRIA:['Frentes frias','Divisas do RJ, litoral e Atlântico','deslocamento/chegada com incerteza'],
  EL_NINO_LA_NINA:['El Niño / La Niña','Contexto climático com efeitos RJ','boletim climático, não alerta local isolado'],
  SISMO:['Abalos sísmicos','RJ, Atlântico e eventos globais da seção sísmica','magnitude/local/profundidade/hora USGS'],
  TSUNAMI:['Tsunami, maremoto e meteotsunami','Costa RJ/Atlântico com potencial impacto','avisos oficiais marítimos/sismológicos; não inferir por magnitude'],
  PRESSAO_ATMOSFERICA:['Pressão e tendência barométrica','92 municípios com estação adequada','hPa e tendência comparável por método'],
  RAIOS:['Raios e descargas elétricas','RJ conforme cobertura do sensor/satélite','NOAA GOES GLM e rede terrestre licenciada'],
  CHUVA_ATUAL:['Chuva atual','RJ conforme estação e cobertura','Alerta Rio + Defesa Civil P1; OpenWeatherMap complementar quando autorizado'],
  MARE:['Marés e nível do mar','Litoral RJ conforme estação/grade','Marinha/CHM; Copernicus Marine e NOAA por produto'],
  SWELL:['Ondulação/swell','Litoral e Atlântico próximo','Marinha, NOAA e Copernicus Marine: altura, período, direção'],
  CORRENTES_MARINHAS:['Correntes marítimas','Litoral/Atlântico RJ conforme grade','Marinha/CHM, Copernicus Marine e NOAA'],
  TEMPERATURA_MAR:['Temperatura do mar','Litoral/Atlântico RJ conforme produto','Marinha/CHM, Copernicus Marine e NOAA'],

});
const scope=Object.freeze({
  RESSACA:'LITORAL',ONDAS:'LITORAL',CICLONE_EXTRATROPICAL:'ATLANTICO',
  CHUVA_ATLANTICO:'ATLANTICO',
  MARE:'LITORAL',SWELL:'LITORAL',CORRENTES_MARINHAS:'LITORAL',TEMPERATURA_MAR:'LITORAL',
  // Keep SISMO and TSUNAMI in municipal routing when presenting the
  // catalog so Defesa Civil is retained alongside Marinha/NOAA/USGS.
  // The coverage text still includes the Atlantic risk perimeter.
});

export const RJ_METEO_TABLE2=Object.freeze([
  Object.freeze({step:1,code:'PRIMEIRAS_TRES',condition:'Três fontes da Tabela 1',
    decision:'Alerta Rio (somente cidade Rio) + Defesa Civil competente (P1 conjunta) + INMET (terceira medição oficial). OpenWeatherMap continua consulta complementar das 10 variáveis, sem virar sensor independente. Duas medições independentes convergentes bastam.',
    method:'CONVERGENCIA_2_DE_3_VALIDAR_OBSERVACAO_INDEPENDENCIA_E_LICENCA'}),
  Object.freeze({step:2,code:'DUAS_OFICIAIS',condition:'Duas medições oficiais independentes e comparáveis',
    decision:'Aceitar a primeira dupla hierárquica; média ponderada somente com pesos e variáveis compatíveis. Parar a consulta de desempate.',
    method:'SOMA_PESOS_VEZES_VALORES_DIVIDIDA_PELA_SOMA_DOS_PESOS'}),
  Object.freeze({step:3,code:'OFICIAIS_DIVERGENTES',condition:'Não há duas leituras independentes convergentes entre as três fontes da Tabela 1',
    decision:'Verificar primeiro Alerta Rio, Defesa Civil e INMET por localidade e tipo de dado; se não houver dupla compatível, comparar com previsão INPE/CPTEC e somente se esta for inconclusiva consultar Windy. Fontes especializadas continuam por fenômeno.',
    method:'COMPARAR_UNIDADE_JANELA_TEMPO_DISTANCIA_QUALIDADE'}),
  Object.freeze({step:4,code:'INPE_PRIMEIRO',condition:'Divergência entre as três fontes da Tabela 1',
    decision:'INPE/CPTEC é a primeira previsão de desempate APÓS consultar as medições oficiais Alerta Rio/Defesa Civil/INMET. Se aproximar de uma delas, apresentar medição e previsão rotuladas separadamente, sem misturar valores.',
    method:'PRIMEIRO_MATCH_COMPATIVEL_COM_UMA_DAS_TRES_PRIMARIAS'}),
  Object.freeze({step:5,code:'WINDY_SUBSIDIARIO',condition:'INPE/CPTEC, INMET e CEMADEN inconclusivos',
    decision:'Windy é a segunda previsão de desempate, somente quando INPE for inconclusivo ou indisponível. NOAA e CEMADEN permanecem especializados por fenômeno; previsão não vira sensor nem anula avisos oficiais.',
    method:'WINDY_4_NOAA_5_SEM_MEDIA_MISTA_DE_PREVISAO_E_MEDICAO'}),
  Object.freeze({step:6,code:'DUAS_FONTES_EXIBIDAS',condition:'Persistem valores discrepantes',
    decision:'Exibir duas fontes reais identificadas (duas medições ou medição oficial + previsão); preservar demais leituras no histórico; nunca média mista de modelo e sensor. Não inventar empate ou concordância.',
    method:'EXIBICAO_COM_PROVENIENCIA_E_DIVERGENCIA_EXPLICITA'}),
  Object.freeze({step:7,code:'SEM_DADO_NOVO',condition:'Nenhum registro atual e verificável',
    decision:'Tentar próxima fonte autorizada e cache recente; se não há medição real, nenhuma fórmula a cria. Não declarar segurança nem emitir alerta.',
    method:'FAIL_CLOSED_SEM_VALOR_SINTETICO'}),
  Object.freeze({step:8,code:'CATEGORIAS_ESPECIAIS',condition:'Alertas, mar, sismo, tsunami, raios, rios e radar',
    decision:'Competência da fonte especializada/aviso vigente prevalece; nunca ponderar categorias de alerta, magnitudes ou alarmes.',
    method:'FONTES_ESPECIALIZADAS_E_CONFIRMACAO_INDEPENDENTE'}),
  Object.freeze({step:9,code:'P1_CONJUNTA',condition:'Rio: Alerta Rio + Defesa Civil por produto',
    decision:'P1 conjunta; dados republicados não formam duas medições independentes.',
    method:'IDENTIDADE_DE_ORIGEM_E_COMPETENCIA'}),
  Object.freeze({step:10,code:'OPENWEATHER_COMPLEMENTAR',condition:'As dez variáveis meteorológicas de referência',
    decision:'OpenWeatherMap é complemento separado para as 10 variáveis meteorológicas, sem prioridade sobre INMET, sem suposta independência, com licença e atribuição por produto.',
    method:'LICENCA_PRODUTO_E_NAO_DUPLICACAO'}),
  Object.freeze({step:11,code:'PONDERACAO_COMPATIVEL',condition:'Grandeza, unidade, tempo, local e pesos comparáveis',
    decision:'Sem compatibilidade ou evidência estatística, não criar média observacional ou aviso.',
    method:'MEDIA_PONDERADA_SOMENTE_DADOS_COMPATIVEIS'}),
  Object.freeze({step:12,code:'MAR_SATELITE_ESPECIALIZADO',condition:'Ondas, ressaca, swell, ciclone e tsunami',
    decision:'Marinha/NOAA/Copernicus por produto; EUMETSAT para nuvens/ciclones; tsunami depende de autoridade competente.',
    method:'ROTEAMENTO_POR_AUTORIDADE_E_TIPO_DE_PRODUTO'}),
  Object.freeze({step:13,code:'AUTORIZACAO_E_FRESCOR',condition:'Origem e direitos de cada produto',
    decision:'Atribuição, licença, autorização, localização, horário e produto comprovados antes de publicar.',
    method:'FAIL_CLOSED_SEM_PROVA_OPERACIONAL'}),
]);

/**
 * Link every phenomenon in Table 1 to the applicable evaluation steps from
 * Table 2. Never weight warnings, hazard levels, seismic magnitudes or events.
 * Generic 01/07/09/13 always explain provenance, fallback, competence and
 * permission. Scientific formula rules are variable-specific.
 */
const WEIGHTABLE=Object.freeze(new Set([
  'TEMPERATURA','UMIDADE','VENTO','RAJADA','CHUVA_ATUAL',
  'CHUVA_ACUMULADA','PRESSAO_ATMOSFERICA',
]));
const DERIVED=Object.freeze(new Set(['SENSACAO_TERMICA']));
const MARITIME=Object.freeze(new Set([
  'RESSACA','ONDAS','SWELL','MARE','CORRENTES_MARINHAS',
  'TEMPERATURA_MAR','CICLONE_EXTRATROPICAL','CHUVA_ATLANTICO','TSUNAMI',
]));
const BASE_CODES=Object.freeze(['PRIMEIRAS_TRES','SEM_DADO_NOVO','P1_CONJUNTA','AUTORIZACAO_E_FRESCOR']);
const BY_CODE=new Map(RJ_METEO_TABLE2.map(x=>[x.code,x]));
export function linkedRjDisputeSteps(phenomenon) {
  if(!RJ_PHENOMENA.includes(phenomenon))throw TypeError('rj_unknown_linked_phenomenon');
  const chosen=new Set(BASE_CODES);
  if(WEIGHTABLE.has(phenomenon)) {
    for(const key of ['DUAS_OFICIAIS','OFICIAIS_DIVERGENTES','INPE_PRIMEIRO',
      'WINDY_SUBSIDIARIO','DUAS_FONTES_EXIBIDAS','PONDERACAO_COMPATIVEL',
      'OPENWEATHER_COMPLEMENTAR'])chosen.add(key);
  } else if(DERIVED.has(phenomenon)) {
    for(const key of ['OFICIAIS_DIVERGENTES','INPE_PRIMEIRO','WINDY_SUBSIDIARIO',
      'DUAS_FONTES_EXIBIDAS','OPENWEATHER_COMPLEMENTAR',
      'PONDERACAO_COMPATIVEL'])chosen.add(key);
  } else if(MARITIME.has(phenomenon)) {
    for(const key of ['CATEGORIAS_ESPECIAIS','MAR_SATELITE_ESPECIALIZADO',
      'DUAS_FONTES_EXIBIDAS'])chosen.add(key);
  } else {
    for(const key of ['CATEGORIAS_ESPECIAIS','OFICIAIS_DIVERGENTES',
      'DUAS_FONTES_EXIBIDAS'])chosen.add(key);
    if(['GRANIZO','TEMPORAL','TEMPESTADE'].includes(phenomenon))
      chosen.add('OPENWEATHER_COMPLEMENTAR');
  }
  return Object.freeze(RJ_METEO_TABLE2.filter(x=>chosen.has(x.code)));
}

export const RJ_METEO_MARINE_TABLE=Object.freeze([
  Object.freeze({
    code:'CICLONES_OCEANICOS',phenomena:Object.freeze(['CICLONE_EXTRATROPICAL']),
    label:'Ciclones oceânicos',sources:Object.freeze([
      'MARINHA_CHM','NOAA','EUMETSAT_SATELLITE','COPERNICUS_MARINE']),
    purpose:'Acompanhar evolução atmosférica, trajetória e efeitos no mar',
    alertAuthority:'MARINHA_E_DEFESA_CIVIL_BRASILEIRAS',
  }),
  Object.freeze({
    code:'TEMPESTADES_ATLANTICO',phenomena:Object.freeze(['TEMPESTADE','CHUVA_ATLANTICO']),
    label:'Tempestades no Atlântico',sources:Object.freeze([
      'MARINHA_CHM','NOAA','EUMETSAT_SATELLITE']),
    purpose:'Nuvens, sistemas intensos e deslocamento; satélite não é radar medido',
    alertAuthority:'MARINHA_E_DEFESA_CIVIL_BRASILEIRAS',
  }),
  Object.freeze({
    code:'ONDAS_SWELL',phenomena:Object.freeze(['ONDAS','SWELL']),
    label:'Ondas e swell',sources:Object.freeze([
      'MARINHA_CHM','NOAA','COPERNICUS_MARINE']),
    purpose:'Altura, período, direção e propagação das ondas por produto',
    alertAuthority:'MARINHA_CHM',
  }),
  Object.freeze({
    code:'RESSACA_LITORAL',phenomena:Object.freeze(['RESSACA']),
    label:'Ressaca no litoral RJ',sources:Object.freeze([
      'MARINHA_CHM','BOIAS_AUTORIZADAS','COPERNICUS_MARINE','NOAA']),
    purpose:'Previsão de ondas e avaliação do risco costeiro',
    alertAuthority:'MARINHA_CHM',
  }),
  Object.freeze({
    code:'TSUNAMI',phenomena:Object.freeze(['TSUNAMI']),
    label:'Tsunami / maremoto',sources:Object.freeze([
      'NOAA','MARINHA_CHM','AUTORIDADES_BRASILEIRAS']),
    purpose:'Avisos oficiais, observação do nível do mar e ameaça confirmada',
    alertAuthority:'AUTORIDADES_BRASILEIRAS_E_AVISOS_COMPETENTES',
  }),
]);
const MARINE_CODES=new Set(RJ_METEO_MARINE_TABLE.map(x=>x.code));
if(MARINE_CODES.size!==5||RJ_METEO_MARINE_TABLE.some(row=>!row.label||!row.purpose))
  throw new Error('rj_marine_five_source_matrix_invalid');
if(Object.keys(meta).length!==30||RJ_PHENOMENA.length!==30
  ||RJ_PHENOMENA.some(id=>!Object.hasOwn(meta,id))
  ||RJ_METEO_TABLE2.length!==13)
  throw new Error('rj_30_phenomena_homologation_drift');

export function buildRjMeteorologicalHomologationTables({ibge=RJ_CITY_IBGE}={}) {
  // Calls existing 92-municipality validator for every phenomenon. Each row
  // reflects the eligible sources for this locality, not alleged connectivity.
  const t1=RJ_PHENOMENA.map(phenomenon=>{
    const route=rjSourceRouting({ibge,phenomenon,
      region:scope[phenomenon]??'MUNICIPAL'});
    const [label,coverage,criteria]=meta[phenomenon];
    return Object.freeze({
      id:phenomenon,label,coverage,criteria,
      sourceIds:Object.freeze(route.sources.map(x=>x.id)),
      sourceClasses:Object.freeze(route.sources.map(x=>x.role)),
      supplementaryThirdSource:route.complementaryThirdSource,
      primaryTable1Three:Object.freeze(RJ_TABLE1_THREE.filter(
        s=>s!=='ALERTA_RIO'||String(ibge)===RJ_CITY_IBGE)),
      disputeTable2Five:Object.freeze(RJ_TABLE2_FIVE.filter(id => id !== 'ALERTA_RIO' || String(ibge) === RJ_CITY_IBGE)),
      tenPhenomenaComplement:route.complementaryThirdSource ? RJ_TABLE1_TEN_COMPLEMENT : null,
      table2TriggeredOnlyIfNoPrimaryPair:true,
      disputeStepCodes:Object.freeze(linkedRjDisputeSteps(phenomenon).map(x=>x.code)),
      applicableToWeightedObservation:WEIGHTABLE.has(phenomenon),
      calculatedOnlyWithValidInputs:DERIVED.has(phenomenon),
      linkedMarineCategories:Object.freeze(RJ_METEO_MARINE_TABLE.filter(
        x=>x.phenomena.includes(phenomenon)).map(x=>x.code)),
      status:RJ_METEO_SOURCE_STATUS.NOT_HOMOLOGATED,
      evidenceRequired:true,
      observedLiveData:false,
      commercialUseAuthorized:false,
      automaticAlertAllowed:false,
    });
  });
  return Object.freeze({
    id:RJ_METEO_HOMOLOGATION_ID,version:RJ_METEO_HOMOLOGATION_VERSION,
    project:'Blaise V6 RJ',ibge:String(ibge),
    geographicCoverage:'92 RJ MUNICIPALITIES SELECTABLE; SOURCE COVERAGE BY PRODUCT',
    status:'CATALOGO_A_HOMOLOGAR_NAO_E_MONITORAMENTO_AO_VIVO',
    table1:Object.freeze(t1),table2:RJ_METEO_TABLE2,
    primaryTable1Sources:RJ_TABLE1_THREE,
    tenPhenomenaComplement:RJ_TABLE1_TEN_COMPLEMENT,
    disputeTable2FiveSources:RJ_TABLE2_FIVE,
    marineTable:RJ_METEO_MARINE_TABLE,
    operatorVerified:false,automaticPublication:false,
    excludedSource:'INEA',
  });
}

/**
 * An auditable checklist, NOT actual integration. Requires product-level
 * proof. Never accepts claimed "homologado" without an independent review.
 */
export function checkRjSourceProductEvidence({
  sourceId,productId,sourceUrl,licenseProofId,
  lastObservedAt,checkedAt,now=Date.now(),
  approvedByOperator=false,observedSourceResponse=false,
}={}) {
  const invalid=reason=>Object.freeze({
    sourceId:typeof sourceId==='string'?sourceId:null,
    productId:typeof productId==='string'?productId:null,
    state:RJ_METEO_SOURCE_STATUS.NOT_HOMOLOGATED,
    reason,verified:false,mayPublish:false,
  });
  const eligibleIds=new Set([
    'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','CEMADEN_RJ',
    'INMET_STATION','INPE_CPTEC_FORECAST','ANA_HIDROWEB',
    'SGB_SACE','MARINHA_CHM','NOAA','USGS_EARTHQUAKE',
    'WINDY_MODELO','REDE_RAIOS_AUTORIZADA',
    'OPENWEATHERMAP_API','COPERNICUS_MARINE','EUMETSAT_SATELLITE',
  ]);
  if(typeof sourceId!=='string'||!eligibleIds.has(sourceId))
    return invalid('SOURCE_NOT_ELIGIBLE');
  if(typeof productId!=='string'||productId.length<3) return invalid('PRODUCT_NOT_IDENTIFIED');
  if(typeof sourceUrl!=='string'||!sourceUrl.startsWith('https://'))
    return invalid('SOURCE_URL_NOT_SECURE');
  if(typeof licenseProofId!=='string'||licenseProofId.length<5)
    return invalid('PRODUCT_RIGHTS_NOT_PROVEN');
  const measured=Date.parse(lastObservedAt),reviewed=Date.parse(checkedAt);
  if(!Number.isFinite(measured)||!Number.isFinite(reviewed)||!Number.isFinite(now)
    ||measured>now||reviewed>now||now-measured>15*60_000
    ||now-reviewed>30*24*60*60_000)
    return invalid('OBSERVATION_OR_REVIEW_TOO_OLD');
  if(approvedByOperator!==true||observedSourceResponse!==true)
    return invalid('NO_AUTHENTICATED_OPERATOR_AND_LIVE_RESPONSE');
  // This input is an evidence checklist only; a true approval must be
  // recorded separately by an authenticated production verifier.
  return Object.freeze({
    sourceId,productId,state:RJ_METEO_SOURCE_STATUS.LIVE_PROOF_PENDING,
    reason:'AWAIT_INDEPENDENT_AUTHENTICATED_PRODUCTION_HOMOLOGATION',
    verified:false,mayPublish:false,
  });
}
