#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {evaluateScaleReadiness} from './rj-scale-policy.mjs';
const result=evaluateScaleReadiness({
 activeSubscribers:process.env.BLAISE_VERIFIED_ACTIVE_SUBSCRIBERS,
 observedAt:process.env.BLAISE_SUBSCRIBERS_OBSERVED_AT,
 lastReportedMilestone:process.env.BLAISE_LAST_REPORTED_MILESTONE,
});
const report={product:'Blaise V6 RJ',checkedAt:new Date().toISOString(),milestone:500000,...result,limits:[
 'Subscriber count is not concurrent sessions or requests per second.',
 'No user-count metrics, actual purchases, capacity reservations, deployments or application updates are performed here.',
 'Security tools must be tested against Android app functions and official feed access before enforcement.',
 'Official alert ingestion and public P0 delivery must remain isolated from premium user traffic.',
 'All price quotes must come from official vendors and be approved by the project owner before purchase.'
]};
await mkdir('evidence/maintenance',{recursive:true});
await writeFile('evidence/maintenance/scale.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log('BLAISE_RJ_SCALE='+report.status);
if(report.count!==undefined)console.log('VERIFIED_ACTIVE_SUBSCRIBERS='+report.count);
if(report.pendingMilestones)console.log('REPORT_DUE_MILESTONES='+report.pendingMilestones.join(','));
if(process.env.GITHUB_STEP_SUMMARY)await (async()=>{
 const {appendFile}=await import('node:fs/promises');
 await appendFile(process.env.GITHUB_STEP_SUMMARY,
   '\n### Blaise V6 RJ — revisão de escala\n\n- Status: **'+report.status+'**\n- Ação: '+(report.action||'Validar métricas')+'\n- Nenhuma compra, deploy ou alteração automática.\n');
})();
if(report.status==='INVALID_INPUT'||report.status==='STALE_METRIC')process.exitCode=2;
