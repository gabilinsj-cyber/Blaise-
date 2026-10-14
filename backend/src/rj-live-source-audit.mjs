import {createOfficialSourceScheduler} from './official-source-scheduler.mjs';

/** Runtime evidence from the actual worker; no code repair, security scan or invented source data. */
export function createRjLiveSourceAudit({worker,now=Date.now,onReport=()=>{},autoSchedule=true}={}) {
 if(typeof worker?.status!=='function'||typeof now!=='function'||typeof onReport!=='function')throw TypeError('live_audit_worker_required');
 let lastHourly=null,lastDeepDay=null;
 const reports=[];
 const local=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
 function record(mode,time){
  const status=worker.status();
  const sources=(status.sources??[]).slice(0,32).map(source=>{
   const fetched=Date.parse(source.fetchedAt),observed=Date.parse(source.observedAt);
   const fetchedCurrent=Number.isFinite(fetched)&&fetched<=time&&time-fetched<=300000;
   return Object.freeze({sourceId:String(source.sourceId??'unknown').slice(0,80),state:source.state,
    fetchedAt:Number.isFinite(fetched)?new Date(fetched).toISOString():null,
    observedAt:Number.isFinite(observed)?new Date(observed).toISOString():null,
    freshCollection:fetchedCurrent&&['CURRENT','CURRENT_DEGRADED'].includes(source.state),
    originalObservationTimestampPreserved:true});
  });
  const report=Object.freeze({project:'Blaise V6 RJ',mode,agentNumber:mode==='HOURLY_SOURCE_AUDIT'?9:10,
   checkedAt:new Date(time).toISOString(),scope:'WORKER_SOURCE_HEALTH_ONLY',workerStarted:status.started===true,
   sources:Object.freeze(sources),failures:Object.freeze(sources.filter(s=>!s.freshCollection).map(s=>s.sourceId)),
   fullSecurityAuditPerformed:false,automaticRepairPerformed:false});
  reports.push(report);if(reports.length>256)reports.shift();
  onReport(report);return report;
 }
 const scheduler=createOfficialSourceScheduler({now,autoSchedule,refreshIntervalsMs:{normal:30000,severe:30000},tasks:[{id:'rj-source-health-audit',run:()=>{
  const time=now();if(!Number.isFinite(time))throw TypeError('live_audit_clock_invalid');
  if(lastHourly===null||time-lastHourly>=3600000){record('HOURLY_SOURCE_AUDIT',time);lastHourly=time;}
  const parts=Object.fromEntries(local.formatToParts(new Date(time)).map(p=>[p.type,p.value]));
  const day=`${parts.year}-${parts.month}-${parts.day}`;
  if(parts.hour==='01'&&lastDeepDay!==day){record('DAILY_01H_SOURCE_AUDIT',time);lastDeepDay=day;}
 }}]});
 return Object.freeze({start:scheduler.start,stop:scheduler.stop,tick:scheduler.tick,
  snapshot:()=>Object.freeze({scheduler:scheduler.snapshot(),reports:Object.freeze([...reports])})});
}
