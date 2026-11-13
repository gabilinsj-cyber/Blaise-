import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_RESEARCH_AGENT_ID, classifyRjResearch,validateRjResearchEvidence,
  createRjDynamicResearchAgent} from '../src/blaise-rj-dynamic-research.mjs';
import {createRjAgentSupervisor} from '../src/blaise-rj-agent-supervisor.mjs';

const NOW=Date.parse('2026-11-13T18:00:00Z');
const sample=(overrides={})=>({
  id:'noaa-climate-20261113',
  sourceId:'noaa',url:'https://www.climate.gov/news-features/understanding-climate',
  kind:'CLIMATE_REPORT',issuedAt:new Date(NOW-86400000).toISOString(),
  geography:'GLOBAL_CLIMA_RELEVANTE_RJ',
  excerpt:'Boletim climático revisado, com referências temporais explícitas para interpretar ENSO no Atlântico Sul e no Sudeste.',
  ...overrides
});

test('Agent 11 is on-demand and never creates web calls when not configured',async()=>{
  let calls=0;
  const agent=createRjDynamicResearchAgent({
    now:()=>NOW,retrieve:async()=>{calls++;return[];},compose:async()=>({})});
  assert.equal(agent.agentId,RJ_RESEARCH_AGENT_ID);
  const result=await agent.answer({question:'Qual a fase de El Niño atualmente?',
    geography:'GLOBAL_CLIMA_RELEVANTE_RJ'});
  assert.equal(result.status,'NOT_CONFIGURED');
  assert.equal(result.answer,null);
  assert.equal(result.officialAlert,false);
  assert.equal(calls,0);
});
test('different temporal categories and geography are explicit',()=>{
  assert.equal(classifyRjResearch('Vai chover amanhã no Rio?').factType,'FORECAST_REQUEST');
  assert.equal(classifyRjResearch('Qual o vento agora?').factType,'CURRENT_OBSERVATION');
  assert.equal(classifyRjResearch('O que é aquecimento global?').factType,'CLIMATE_RESEARCH');
  assert.equal(classifyRjResearch('Quais alertas oficiais de tsunami?','ATLANTICO_SUL').factType,
    'OFFICIAL_ALERT_REQUEST');
  assert.throws(()=>classifyRjResearch('Qual o clima?','PLANETA_INTEIRO'));
  assert.throws(()=>classifyRjResearch('a'));
});
test('refuses banned source, forged domain, out-of-date report and inappropriate alert',()=>{
  const plan=classifyRjResearch('El Niño está acontecendo?','GLOBAL_CLIMA_RELEVANTE_RJ');
  assert.equal(validateRjResearchEvidence(sample({sourceId:'windy'}),plan,NOW),null);
  assert.equal(validateRjResearchEvidence(sample({sourceId:'marinha'}),plan,NOW),null);
  assert.equal(validateRjResearchEvidence(sample({
    url:'https://noaa.gov.evil.invalid/climate'}),plan,NOW),null);
  assert.equal(validateRjResearchEvidence(sample({
    issuedAt:'2020-01-01T00:00:00Z'}),plan,NOW),null);
  const alertPlan=classifyRjResearch('Existe alerta de tsunami no Atlântico Sul?','ATLANTICO_SUL');
  assert.equal(validateRjResearchEvidence(sample({kind:'EDUCATIONAL',
    geography:'ATLANTICO_SUL'}),alertPlan,NOW),null);
});
test('research answer carries validated sources, date and verification flag',async()=>{
  const agent=createRjDynamicResearchAgent({
    enabled:true,now:()=>NOW,
    retrieve:async({geography,factType})=>{
      assert.equal(geography,'GLOBAL_CLIMA_RELEVANTE_RJ');
      assert.equal(factType,'CLIMATE_RESEARCH');
      return [sample()];
    },
    compose:async({evidence})=>({
      answer:'Este boletim explica o fenômeno climático; não informa condições atuais de uma estação no RJ.',
      usedEvidenceIds:[evidence[0].id]
    })
  });
  const result=await agent.answer({question:'O que é El Niño?',
    geography:'GLOBAL_CLIMA_RELEVANTE_RJ'});
  assert.equal(result.status,'EVIDENCE_GROUNDED_DRAFT');
  assert.equal(result.evidence.length,1);
  assert.match(result.evidence[0].url,/climate\.gov/);
  assert.equal(result.asOf,new Date(NOW).toISOString());
  assert.equal(result.needsHumanOrSemanticVerification,true);
  assert.equal(result.officialAlert,false);
});
test('AI draft without traceable citation never becomes an answer',async()=>{
  const agent=createRjDynamicResearchAgent({enabled:true,now:()=>NOW,
    retrieve:async()=>[sample()],
    compose:async()=>({answer:'Resposta fabricada com números sem prova.',usedEvidenceIds:['nonexistent-id']})
  });
  const result=await agent.answer({question:'O que é La Niña?',
    geography:'GLOBAL_CLIMA_RELEVANTE_RJ'});
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.answer,null);
  assert.equal(result.reason,'unverified_research_citation');
});
test('the supervisor does not schedule Agent 11; explicit request alone runs it',async()=>{
  let calls=0;
  const s=createRjAgentSupervisor({enabled:true,now:()=>NOW,handlers:{
    'blaise-ia-pesquisa':{run:()=>{calls++;return {configured:true}}}
  }});
  assert.equal((await s.tick()).results.length,0);
  assert.equal(calls,0);
  const outcome=await s.onDemandResearch();
  assert.equal(outcome.status,'COMPLETED');
  assert.equal(calls,1);
});
