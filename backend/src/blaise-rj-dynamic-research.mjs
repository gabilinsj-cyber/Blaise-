/**
 * Blaise IA: request-scoped weather and climate research across RJ, Southeast
 * Brazil, South Atlantic and the global climate *only when relevant to RJ*.
 *
 * This is an integration contract, not an active internet search client.
 * Network retrieval and source-anchored synthesis must be wired by an
 * approved server deployment. The module never scrapes, stores prompts,
 * issues warnings or invents real-time evidence.
 */
const MAX_QUESTION=600,MAX_EXCERPT=1800,MAX_EVIDENCE=8;
export const RJ_RESEARCH_AGENT_ID='blaise-ia-pesquisa';
export const RJ_RESEARCH_CONTRACT='BLAISE_RJ_RESEARCH_WITH_EVIDENCE_V1';
const CLIMATE_IDS=new Set(['noaa','inpe-cptec','inmet','eumetsat','jaxa-gsmap','wmo','ipcc']);
const PROVIDERS=Object.freeze({
  'alerta-rio':['alertario.rio.rj.gov.br','websempre.rio.rj.gov.br'],
  'cor-rio':['cor.rio','cor.rio.rj.gov.br'],
  'defesa-civil-rj':['defesacivil.rj.gov.br'],
  'inmet':['inmet.gov.br','apitempo.inmet.gov.br'],
  'inpe-cptec':['inpe.br','cptec.inpe.br'],
  'cemaden':['cemaden.gov.br'],
  'noaa':['noaa.gov','climate.gov','ncep.noaa.gov'],
  'eumetsat':['eumetsat.int'],
  'jaxa-gsmap':['jaxa.jp'],
  'usgs':['usgs.gov','earthquake.usgs.gov'],
  'wmo':['wmo.int'],
  'ipcc':['ipcc.ch'],
});
const RETIRED=/\b(inea|marinha|chm|windy|copernicus)\b/i;
const GEOGRAPHIES=new Set(['RIO_DE_JANEIRO','SUDESTE_BRASIL','ATLANTICO_SUL','GLOBAL_CLIMA_RELEVANTE_RJ']);
const KINDS=new Set(['OBSERVATION','FORECAST','CLIMATE_REPORT','EDUCATIONAL','OFFICIAL_ALERT']);

function normalize(raw) {
  return raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 ]/g,' ').replace(/ +/g,' ').trim();
}
function message(status,reason,at,scope) {
  return Object.freeze({contract:RJ_RESEARCH_CONTRACT,agentId:RJ_RESEARCH_AGENT_ID,
    status,reason,asOf:new Date(at).toISOString(),timeZone:'America/Sao_Paulo',
    geography:scope,answer:null,evidence:[],officialAlert:false,
    factType:null,autonomousExecution:false});
}
export function classifyRjResearch(question,geography='RIO_DE_JANEIRO') {
  if(typeof question!=='string'||question.trim().length<4||question.length>MAX_QUESTION
    ||/[\u0000-\u001f]/.test(question)||!GEOGRAPHIES.has(geography))
    throw new TypeError('invalid_rj_research_question_or_geography');
  const normalized=normalize(question);
  const climate=/\b(el nino|la nina|aquecimento global|mudanca climatica|efeito estufa|climatologia|oceano pacifico|enso)\b/.test(normalized);
  const forecast=/\b(amanha|proximos dias|semana que vem|previsao|projecao|vai chover|vai fazer)\b/.test(normalized);
  const current=/\b(hoje|agora|neste momento|atualmente|em tempo real|ultima hora|nesta tarde)\b/.test(normalized);
  const alert=/\b(alerta|sirenes|aviso oficial|tsunami|evacuacao|deslizamento|risco de vida)\b/.test(normalized);
  const factType=alert?'OFFICIAL_ALERT_REQUEST':climate?'CLIMATE_RESEARCH':
    forecast?'FORECAST_REQUEST':current?'CURRENT_OBSERVATION':'SCIENTIFIC_EXPLANATION';
  // A climate explanation may be many years old; a claim about an active
  // ENSO phase must use up-to-date climate reports.
  const requiresCurrentClimate=climate&&current;
  return Object.freeze({factType,climate,requiresCurrentClimate,geography,
    query:question.trim(),normalized,requiresSources:true});
}
function trustedHost(sourceId, rawUrl) {
  const entries=PROVIDERS[sourceId];
  if(!entries||RETIRED.test(sourceId)||typeof rawUrl!=='string')return false;
  let url;
  try {url=new URL(rawUrl);}catch{return false;}
  if(url.protocol!=='https:'||url.username||url.password||url.port
    ||url.hash||url.hostname.endsWith('.')||url.hostname.includes('..'))return false;
  return entries.some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain));
}
export function validateRjResearchEvidence(raw,plan,now) {
  if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!/^[a-z0-9_-]{3,64}$/.test(raw.id)
    ||!KINDS.has(raw.kind)||!trustedHost(raw.sourceId,raw.url)
    ||typeof raw.excerpt!=='string'||raw.excerpt.trim().length<10
    ||raw.excerpt.length>MAX_EXCERPT)return null;
  const issue=Date.parse(raw.issuedAt);
  if(!Number.isFinite(issue)||issue>now+60000||issue<0)return null;
  const age=now-issue;
  // A published explanation may be older, but an answer about "now"
  // is never constructed from an archived scientific report.
  const maxAge=plan.factType==='CURRENT_OBSERVATION'||plan.factType==='OFFICIAL_ALERT_REQUEST'
    ?2*3600000
    :plan.factType==='FORECAST_REQUEST'?24*3600000
    :plan.requiresCurrentClimate?180*86400000
    :plan.factType==='CLIMATE_RESEARCH'?730*86400000
    :5*365*86400000;
  if(age>maxAge)return null;
  if(raw.kind==='OFFICIAL_ALERT'&&
      (raw.sourceId==='wmo'||raw.sourceId==='ipcc'))return null;
  if(plan.climate&&!CLIMATE_IDS.has(raw.sourceId))return null;
  if(plan.factType==='FORECAST_REQUEST'&&raw.kind==='OBSERVATION')return null;
  if(plan.factType==='CURRENT_OBSERVATION'&&raw.kind==='EDUCATIONAL')return null;
  if(plan.factType==='OFFICIAL_ALERT_REQUEST'&&raw.kind!=='OFFICIAL_ALERT')return null;
  if(raw.validUntil!==undefined&&raw.validUntil!==null) {
    const until=Date.parse(raw.validUntil);
    if(!Number.isFinite(until)||until<=now||until<issue)return null;
  }
  if(raw.geography!==undefined&&raw.geography!==plan.geography&&
    raw.geography!=='GLOBAL_CLIMA_RELEVANTE_RJ')return null;
  return Object.freeze({
    id:raw.id,sourceId:raw.sourceId,url:raw.url,kind:raw.kind,
    issuedAt:new Date(issue).toISOString(),validUntil:raw.validUntil??null,
    geography:raw.geography??plan.geography,excerpt:raw.excerpt.trim()
  });
}
export function createRjDynamicResearchAgent({
  enabled=false,retrieve=null,compose=null,now=Date.now
}={}) {
  if(typeof enabled!=='boolean'||typeof now!=='function'
    ||(retrieve!==null&&typeof retrieve!=='function')
    ||(compose!==null&&typeof compose!=='function'))
    throw new TypeError('invalid_rj_research_configuration');
  return Object.freeze({
    agentId:RJ_RESEARCH_AGENT_ID,enabled:enabled&&!!retrieve&&!!compose,
    async answer({question,geography='RIO_DE_JANEIRO'}={}) {
      const at=now();
      if(!Number.isSafeInteger(at)||at<0)
        return message('BLOCKED','invalid_clock',Date.now(),'RIO_DE_JANEIRO');
      let plan;
      try {plan=classifyRjResearch(question,geography);}
      catch{return message('BLOCKED','invalid_question_or_geography',at,geography);}
      if(!enabled||!retrieve||!compose)
        return message('NOT_CONFIGURED','approved_online_retrieval_and_reasoning_not_connected',at,geography);
      try {
        const docs=await retrieve({question:plan.query,geography:plan.geography,
          factType:plan.factType,asOf:new Date(at).toISOString(),limit:MAX_EVIDENCE});
        if(!Array.isArray(docs)||docs.length>MAX_EVIDENCE)
          return message('UNAVAILABLE','invalid_retrieval_results',at,geography);
        const valid=docs.map(doc=>validateRjResearchEvidence(doc,plan,at)).filter(Boolean);
        const dedup=[...new Map(valid.map(d=>[d.id,d])).values()];
        if(dedup.length===0)return message('UNAVAILABLE','no_current_authorized_sources',at,geography);
        // The model receives *only* externally validated evidence, not raw
        // internet HTML. Its output must refer to these source IDs.
        const draft=await compose({question:plan.query,geography,
          factType:plan.factType,asOf:new Date(at).toISOString(),
          evidence:dedup});
        if(!draft||typeof draft.answer!=='string'
          ||draft.answer.trim().length<12||draft.answer.length>2400
          ||!Array.isArray(draft.usedEvidenceIds)||draft.usedEvidenceIds.length<1)
          return message('UNAVAILABLE','uncited_research_answer',at,geography);
        const approved=new Map(dedup.map(doc=>[doc.id,doc]));
        const ids=[...new Set(draft.usedEvidenceIds)];
        if(ids.length>MAX_EVIDENCE||ids.some(id=>!approved.has(id)))
          return message('UNAVAILABLE','unverified_research_citation',at,geography);
        const sources=ids.map(id=>approved.get(id));
        return Object.freeze({
          contract:RJ_RESEARCH_CONTRACT,agentId:RJ_RESEARCH_AGENT_ID,
          status:'EVIDENCE_GROUNDED_DRAFT',answer:draft.answer.trim(),
          evidence:sources.map(({id,sourceId,url,issuedAt,kind,geography})=>
            ({id,sourceId,url,issuedAt,kind,geography})),
          asOf:new Date(at).toISOString(),timeZone:'America/Sao_Paulo',
          geography,factType:plan.factType,
          officialAlert:false,autonomousExecution:false,
          needsHumanOrSemanticVerification:true
        });
      }catch{return message('UNAVAILABLE','authorized_research_service_failed',at,geography);}
    }
  });
}
