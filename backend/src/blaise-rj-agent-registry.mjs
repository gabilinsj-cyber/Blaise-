/** 
 * Catálogo e despachante seguro dos 10 agentes internos RJ.
 * Importar este módulo NÃO inicia rotinas, timers, coleta ou rede.
 * O worker de produção precisa registrar executores autorizados e telemetria
 * antes de considerar qualquer agente operacional.
 */
export const RJ_AGENT_REGISTRY_VERSION = 'rj-agents-20261113-v1';
export const RJ_AGENT_DEFINITIONS = Object.freeze([
  {id:'integridade-correcao',name:'Integridade e correção contínua',cadence:'CONTINUOUS_MONITOR',access:'ADMIN',scope:'RJ',description:'Detectar falhas e propor correção auditável; nunca aplicar patch automaticamente à produção.'},
  {id:'checagem-horaria',name:'Verificação horária de fontes',cadence:'HOURLY',access:'ADMIN',scope:'RJ',description:'Conferir disponibilidade, horário, jurisdição e qualidade de cada fonte.'},
  {id:'rotina-01h',name:'Rotina noturna 01h Brasília',cadence:'DAILY_01_BRT',access:'ADMIN',scope:'RJ',description:'Revisão técnica diária com referência America/Sao_Paulo.'},
  {id:'auditoria-limpeza',name:'Auditoria e retenção mínima',cadence:'DAILY',access:'ADMIN',scope:'RJ',description:'Limpeza por TTL e auditoria sem apagar backups, dados de alerta ativos ou evidência válida.'},
  {id:'calculos-severos',name:'Diagnósticos de tempo severo',cadence:'SEVERE_30_60_SECONDS',access:'ADMIN',scope:'RJ',description:'Executar núcleos científicos em perfis validados; cálculos não são alertas oficiais.'},
  {id:'transito-rj',name:'Trânsito e riscos urbanos',cadence:'NORMAL_5_MIN',access:'ADMIN',scope:'RJ',description:'Conferir eventos georreferenciados e atualizados de órgãos municipais aprovados.'},
  {id:'maritimo-rj',name:'Monitoramento costeiro e oceânico',cadence:'NORMAL_5_MIN',access:'ADMIN',scope:'RJ',description:'Verificar ondas, swell, correntes e avisos por produto e fonte aprovada, sem inferir tsunami.'},
  {id:'voz-perguntas',name:'Assistente de voz e perguntas',cadence:'ON_DEMAND',access:'ADMIN',scope:'RJ',description:'Responder perguntas usando dados válidos, sem histórico desnecessário de voz/localização.'},
  {id:'fiscalizacao-fontes',name:'Fiscalização de fontes e licenças',cadence:'HOURLY',access:'ADMIN',scope:'RJ',description:'Bloquear fonte sem licença, domínio, produto, timestamp ou jurisdição verificados.'},
  {id:'seguranca-escala',name:'Segurança, assinaturas e escala',cadence:'CONTINUOUS_MONITOR',access:'ADMIN',scope:'RJ',description:'Autorização P0/premium, anomalias, limites de recursos, canary e rollback.'},
].map(row=>Object.freeze(row)));

const APPROVED_SOURCE_IDS = new Set([
  'alerta-rio','cor-rio','cet-rio','geo-rio','defesa-civil-rj',
  'defesa-civil-municipal-rj','inmet','inpe-cptec','cemaden',
  'noaa','eumetsat','jaxa-gsmap','usgs','ana-hidroweb','sgb-sace'
]);
const BANNED_SOURCE_IDS = new Set(['inea','chm','marinha','marinha-do-brasil','windy','copernicus']);
const AGENTS = new Map(RJ_AGENT_DEFINITIONS.map(row=>[row.id,row]));

export function validateRjAgentSource(sourceId) {
  return typeof sourceId==='string'&&APPROVED_SOURCE_IDS.has(sourceId)&&!BANNED_SOURCE_IDS.has(sourceId);
}

export function rjAgentCatalog() {
  return RJ_AGENT_DEFINITIONS.map(agent=>({
    ...agent,status:'DECLARED_NOT_WIRED', // status de catálogo, não status de execução
    operational:false,
  }));
}

/** Executors must be separately wired and explicitly enabled; no silent background jobs. */
export async function dispatchRjAgent(agentId,{enabled=false,executor=null,sourceId=null,now=Date.now}={}) {
  const agent=AGENTS.get(agentId);
  if(!agent)return {status:'BLOCKED',reason:'unknown_agent'};
  if(!enabled||typeof executor!=='function')return {status:'NOT_CONFIGURED',agentId,operational:false};
  if(sourceId!==null&&!validateRjAgentSource(sourceId))return {status:'BLOCKED',agentId,reason:'source_not_approved',operational:false};
  const timestamp=now();
  if(!Number.isFinite(timestamp))return {status:'BLOCKED',agentId,reason:'invalid_clock',operational:false};
  try {
    const result=await executor({agentId,scope:'RJ',now:timestamp,sourceId});
    return {status:'COMPLETED',agentId,completedAt:new Date(timestamp).toISOString(),result,officialAlert:false};
  } catch {
    return {status:'FAILED',agentId,reason:'executor_error',officialAlert:false};
  }
}
