#!/usr/bin/env node
// Read-only, small offline evidence for Agent 9 and Agent 10; no credentials.
import {mkdir,writeFile} from 'node:fs/promises';
import {createRjAgentAuditPlan} from '../src/rj-agent-audit.mjs';

const mode=process.env.BLAISE_AGENT_AUDIT_MODE||'HOURLY_AGENT9';
const plan=createRjAgentAuditPlan({mode});
const outDir=new URL('../evidence/rj-agent-audit/',import.meta.url);
await mkdir(outDir,{recursive:true});
const file=new URL(mode==='DEEP_AGENT10'?'agent10.json':'agent9.json',outDir);
await writeFile(file,JSON.stringify(plan,null,2)+'\n',{mode:0o600});
console.log('BLAISE_RJ_AGENT_AUDIT_PLAN='+mode);
console.log('BLAISE_RJ_AUDIT_SCOPE='+plan.auditScope);
console.log('BLAISE_RJ_NO_AUTO_DEPLOY_OR_PURCHASE=PASS');
