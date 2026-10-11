/**
 * BLAISE-RJ-METEO-HOMOLOG-01
 *
 * Consolidated and versioned two-table meteorological SOURCE SPECIFICATION.
 * All 28 registered categories use the same existing rjSourceRouting policy.
 * Table 1 is SOURCE ELIGIBILITY BY LOCATION, NOT live proof.
 * Table 2 is DISAGREEMENT/RECONCILIATION DECISION POLICY, NOT a forecast.
 *
 * Deliberately no network, credentials, background workers or silent
 * commercial permission bypass. Live homologation requires actual
 * product/contract/operator evidence outside this module.
 */
import {RJ_PHENOMENA,rjSourceRouting,RJ_CITY_IBGE} from './rj-phenomenon-source-policy.mjs';

export const RJ_METEO_HOMOLOGATION_ID='BLAISE-RJ-METEO-HOMOLOG-01';
export const RJ_METEO_HOMOLOGATION_VERSION='2026-10-11.v2';
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
  EXCESSO_CALOR_SAUDE:['Excesso de calor e risco à saúde','92 municípios conforme indicador da SES-RJ','Monitora RJ/SES como painel de saúde secundário, sem independência se republicar INMET; validar série/produto'],
  QUALIDADE_AR:['Qualidade do ar e poluentes (IQAr)','MonitorAr-Rio apenas município do Rio, demais redes locais conforme produto','SMAC/MonitorAr-Rio: IQAr, PM2,5, PM10, O3, NO2 e demais poluentes por estação; não interpolar 92 municípios'],
  INDICE_UV:['Índice de radiação UV','Municípios RJ com produto e resolução adequados','INPE/CPTEC e INMET conforme produto; NOAA quando houver cobertura e base apropriada; não supor índice local'],
});
const scope=Object.freeze({
  RESSACA:'LITORAL',ONDAS:'LITORAL',CICLONE_EXTRATROPICAL:'ATLANTICO',
  CHUVA_ATLANTICO:'ATLANTICO',
  // Keep SISMO and TSUNAMI in municipal routing when presenting the
  // catalog so Defesa Civil is retained alongside Marinha/NOAA/USGS.
  // The coverage text still includes the Atlantic risk perimeter.
});

export const RJ_METEO_TABLE2=Object.freeze([
  Object.freeze({step:1,code:'PRIMEIRAS_TRES',condition:'Temperatura, umidade, vento, rajada, chuva e alertas',
    decision:'Priorizar Alerta Rio (somente cidade Rio) → Defesa Civil competente → INMET. Fontes especializadas por fenômeno permanecem elegíveis.',
    method:'VALIDAR_GEOGRAFIA_HORARIO_PRODUTO_UNIDADE_LICENCA'}),
  Object.freeze({step:2,code:'DUAS_OFICIAIS',condition:'Duas medições oficiais independentes e comparáveis',
    decision:'Aceitar a primeira dupla hierárquica; média ponderada somente com pesos e variáveis compatíveis. Parar a consulta de desempate.',
    method:'SOMA_PESOS_VEZES_VALORES_DIVIDIDA_PELA_SOMA_DOS_PESOS'}),
  Object.freeze({step:3,code:'OFICIAIS_DIVERGENTES',condition:'Duas primeiras divergentes ou coberturas incompatíveis',
    decision:'Consultar a terceira fonte oficial e especialistas pertinentes; conservar todas as medições com origem e horário.',
    method:'COMPARAR_UNIDADE_JANELA_TEMPO_DISTANCIA_QUALIDADE'}),
  Object.freeze({step:4,code:'INPE_PRIMEIRO',condition:'Sem dupla observada compatível após fontes oficiais',
    decision:'INPE/CPTEC primeiro para proximidade com medição real; mostrar medição + previsão em linhas separadas, nunca média mista.',
    method:'PROXIMIDADE_DE_MODELO_NAO_PROVA_CORRECAO_DE_SENSOR'}),
  Object.freeze({step:5,code:'WINDY_SUBSIDIARIO',condition:'INPE inconclusivo, inadequado ou indisponível',
    decision:'Consultar Windy, sujeito a licença e validação; previsão pode apoiar destaque, jamais substituir medição ou aviso.',
    method:'CONSULTA_MODELO_SECUNDARIO_SEM_AUTORIDADE_DE_ALERTA'}),
  Object.freeze({step:6,code:'DUAS_FONTES_EXIBIDAS',condition:'Persistem valores discrepantes',
    decision:'Exibir duas fontes reais identificadas (duas medições ou medição oficial + previsão); preservar demais leituras no histórico; nunca média mista de modelo e sensor. Não inventar empate ou concordância.',
    method:'EXIBICAO_COM_PROVENIENCIA_E_DIVERGENCIA_EXPLICITA'}),
  Object.freeze({step:7,code:'SEM_DADO_NOVO',condition:'Nenhum registro atual e verificável',
    decision:'Tentar próxima fonte autorizada e cache recente; se não há medição real, nenhuma fórmula a cria. Não declarar segurança nem emitir alerta.',
    method:'FAIL_CLOSED_SEM_VALOR_SINTETICO'}),
  Object.freeze({step:8,code:'CATEGORIAS_ESPECIAIS',condition:'Alertas, mar, sismo, tsunami, raios, rios, calor/saúde e qualidade do ar',
    decision:'Competência da fonte especializada prevalece. Monitora RJ pode republicar INMET (não contar duas vezes); MonitorAr-Rio limita-se ao Rio. Plataforma Clima é agregadora e pode conter dados INEA, excluídos operacionalmente. Nunca ponderar categorias de alerta, magnitudes ou alarmes.',
    method:'FONTES_ESPECIALIZADAS_ORIGEM_PRIMARIA_SEM_REPUBLICACAO_DUPLA'}),
]);

if(Object.keys(meta).length!==28||RJ_PHENOMENA.length!==28
  ||RJ_PHENOMENA.some(id=>!Object.hasOwn(meta,id)))
  throw new Error('rj_28_categories_homologation_drift');

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
      provenance: 'CADA_FONTE_EXIGE_PRODUTO_ORIGINAL_E_LICENCA_VALIDOS',
      aggregatedOrRepublishedSourcesAreNotIndependent: true,
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
    'MONITORA_RJ_SES','MONITORAR_RIO_SMAC','PLATAFORMA_CLIMA_RIO',
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
