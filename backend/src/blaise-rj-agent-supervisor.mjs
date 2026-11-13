/**
 * Optional controller for twelve predefined RJ agents.
 * NO timers, network, publishing or self-rewriting are started here.
 * Production must explicitly wire handlers, authorization, and scheduling.
 * Source worker / official P0 pipeline stays independently fail-closed.
 */
import {RJ_AGENT_DEFINITIONS,dispatchRjAgent} from './blaise-rj-agent-registry.mjs';

const DAY=86400000,HOUR=3600000,MINUTE=60000;
const KNOWN=new Set(RJ_AGENT_DEFINITIONS.map(x=>x.id));
export const RJ_AGENT_SUPERVISOR_VERSION='rj-supervisor-explicit-20261113-v2';

export function rjAgentDueIntervalMs(id,{severity=1,doubleRed=false}={}) {
  if(!KNOWN.has(id)||!Number.isInteger(severity)||severity<1||severity>5||typeof doubleRed!=='boolean')
    throw new TypeError('valid_rj_agent_cadence_required');
  if(id==='voz-perguntas'||id==='blaise-ia-pesquisa'||id==='geodados-fusao-licenciada'||id==='rotina-01h') return null;
  if(id==='auditoria-limpeza') return DAY;
  if(['integridade-correcao','checagem-horaria','fiscalizacao-fontes'].includes(id)) return HOUR;
  if(id==='calculos-severos') return doubleRed?25000:severity>=5?30000:severity>=3?MINUTE:5*MINUTE;
  if(['transito-rj','maritimo-rj','seguranca-escala'].includes(id)) return 5*MINUTE;
  throw new TypeError('unsupported_agent_id');
}
function localDateAndHour(ms) {
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(ms));
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {day:p.year+'-'+p.month+'-'+p.day,hour:Number(p.hour)};
}
export function createRjAgentSupervisor({
  handlers={}, enabled=false, now=Date.now, onEvent=()=>{}
}={}) {
  if(typeof enabled!=='boolean'||typeof now!=='function'||typeof onEvent!=='function')throw new TypeError('invalid_supervisor_options');
  if(!handlers||Array.isArray(handlers)||typeof handlers!=='object')throw new TypeError('handlers_required');
  for(const [id,handler] of Object.entries(handlers)) {
    if(!KNOWN.has(id)||typeof handler?.run!=='function')throw new TypeError('unknown_or_invalid_agent_handler');
  }
  const history=new Map();
  let stopped=false,active=false;

  async function runOne(id,at) {
    const handler=handlers[id];
    if(!handler)return {id,status:'NOT_CONFIGURED'};
    history.set(id,{status:'RUNNING',lastAttemptAt:at});
    const result=await dispatchRjAgent(id,{
      enabled:true,executor:handler.run,sourceId:handler.sourceId??null,now:()=>at
    });
    history.set(id,{status:result.status,lastAttemptAt:at});
    onEvent({agentId:id,status:result.status,at:new Date(at).toISOString()});
    return {id,status:result.status};
  }
  return {
    version:RJ_AGENT_SUPERVISOR_VERSION,
    async tick({severity=1,doubleRed=false}={}) {
      if(stopped)return {status:'STOPPED',results:[]};
      if(!enabled)return {status:'DISABLED',results:[]};
      if(active)return {status:'BUSY',results:[]};
      active=true;
      try {
        const at=now();
        if(!Number.isFinite(at)||at<0)throw new TypeError('invalid_clock');
        const results=[];
        for(const agent of RJ_AGENT_DEFINITIONS) {
          const id=agent.id;
          if(id==='voz-perguntas'||id==='blaise-ia-pesquisa'||id==='geodados-fusao-licenciada'||!handlers[id])continue;
          const interval=rjAgentDueIntervalMs(id,{severity,doubleRed});
          const previous=history.get(id)?.lastAttemptAt;
          let due=false;
          if(id==='rotina-01h') {
            const today=localDateAndHour(at);
            due=today.hour>=1&&(previous===undefined||localDateAndHour(previous).day!==today.day);
          } else due=previous===undefined||at-previous>=interval;
          if(due)results.push(await runOne(id,at));
        }
        return {status:'TICK_COMPLETED',results,configured:Object.keys(handlers).length};
      } finally {active=false;}
    },
    async onDemandVoice() {
      if(stopped||!enabled)return {id:'voz-perguntas',status:'DISABLED'};
      return runOne('voz-perguntas',now());
    },
    async onDemandResearch() {
      if(stopped||!enabled)return {id:'blaise-ia-pesquisa',status:'DISABLED'};
      // Research is explicitly triggered by an incoming request; this
      // supervisor does not pull the internet or hold user questions.
      return runOne('blaise-ia-pesquisa',now());
    },
    async onDemandLicensedGeodata() {
      if(stopped||!enabled)return {id:'geodados-fusao-licenciada',status:'DISABLED'};
      // Only an explicitly registered authorized handler runs here. No stealth.
      return runOne('geodados-fusao-licenciada',now());
    },
    snapshot() {
      return RJ_AGENT_DEFINITIONS.map(agent=>{
        const status=history.get(agent.id);
        return {id:agent.id,configured:!!handlers[agent.id],
          status:status?.status??'NOT_STARTED',
          lastAttemptAt:status?.lastAttemptAt===undefined?null:new Date(status.lastAttemptAt).toISOString()};
      });
    },
    stop(){stopped=true;}
  };
}
