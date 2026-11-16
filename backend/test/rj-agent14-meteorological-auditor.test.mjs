import test from 'node:test';
import assert from 'node:assert/strict';
import {
 AGENT14,
 prepareAgent14GptResearchQuestion,
 inspectAgent14AiLead,
 validateAgent14BrazilianReference,
 evaluateAgent14,
 continuityOfService,
 planAgent14PrimaryReference,
} from '../src/rj-agent14-meteorological-auditor.mjs';
import {planBrazilianInternalReview} from '../src/rj-international-source-policy.mjs';

const now=new Date('2026-11-16T14:00:00Z');
const candidate=(sourceId,value,qualityScore)=>({
  sourceId,value,qualityScore,phenomenon:'temperatureC',unit:'°C',scopeId:'3304557',
  type:'OBSERVATION',displayedAs:'OBSERVATION',
  productLicensedForCommercialApp:true,productAttributionSatisfied:true,
  municipalityMatch:true,independentlyObtained:true,
  independentProviderEvidence:true,verifiedOwnObservationTime:true,
  observedAt:new Date(now.valueOf()-60000),
  expiresAt:new Date(now.valueOf()+180000),
  comparisonTolerance:0.5,
});
const candidates=[candidate('NOAA',25.0,0.8),candidate('OPENWEATHER',27.2,0.9),candidate('EUMETSAT',24.7,0.7)];
const inmet={
  sourceId:'INMET',stationOwner:'INMET',containsPartnerData:false,
  authenticatedPrimaryStation:true,aiGenerated:false,
  value:24.8,scopeId:'3304557',phenomenon:'temperatureC',unit:'°C',
  observedAt:new Date(now.valueOf()-60000),
};

test('Agent 14 is offline by default; no paid AI/network access',()=>{
  assert.equal(AGENT14.number,14);
  assert.equal(AGENT14.enabledInProduction,false);
  assert.equal(AGENT14.mayQueryAI,false);
  assert.equal(AGENT14.mayFetchInmet,false);
  assert.equal(AGENT14.maxInternationalSourcesPerReview,3);
});
test('Alerta Rio/COR are not used in meteorological comparison; official safety links unaffected',()=>{
  for(const sourceId of ['ALERTA_RIO','COR_RIO']){
    assert.equal(planBrazilianInternalReview({
      sourceId,licenseAllowsInternalComparison:true,now,
    }).allowed,false);
  }
  assert.equal(AGENT14.publicSafetyLinksUnaffected,true);
});
test('GPT is only a research pointer, cannot contribute a number',()=>{
  const question=prepareAgent14GptResearchQuestion({municipality:'Rio de Janeiro',localDate:'2026-11-16'});
  assert.match(question,/estações próprias do INMET/);
  const p=inspectAgent14AiLead({
    officialUrl:'https://portal.inmet.gov.br/',
    value:1000, answer:'99 graus'
  });
  assert.equal(p.status,'REVIEW_URL_ONLY');
  assert.equal(p.value,undefined);
  assert.equal(inspectAgent14AiLead({officialUrl:'https://portal.inmet.gov.br.evil.example/'}).status,'REJECT');
  assert.equal(inspectAgent14AiLead({officialUrl:'http://portal.inmet.gov.br/'}).status,'REJECT');
  assert.equal(inspectAgent14AiLead({officialUrl:'https://cor.rio/'}).status,'REJECT');
});
test('INMET station owned, authenticated, licensed and fresh necessary for comparisons',()=>{
  assert.equal(validateAgent14BrazilianReference({record:inmet,now}),null);
  assert.equal(validateAgent14BrazilianReference({
    record:{...inmet,stationOwner:'ALERTA_RIO',containsPartnerData:true},
    comparisonUseLicensed:true,now
  }),null);
  assert.equal(validateAgent14BrazilianReference({
    record:{...inmet,aiGenerated:true},comparisonUseLicensed:true,now
  }),null);
  assert.equal(validateAgent14BrazilianReference({
    record:{...inmet,observedAt:new Date(now.valueOf()-86400000)},
    comparisonUseLicensed:true,now
  }),null);
  const ref=validateAgent14BrazilianReference({
    record:inmet,comparisonUseLicensed:true,now});
  assert.equal(ref.value,24.8);
  assert.equal(ref.stationOwner,undefined);
});
test('with explicit permission select closest licensed international input, not INMET reading',()=>{
  const r=evaluateAgent14({candidates,inmetRecord:inmet,comparisonUseLicensed:true,now});
  assert.equal(r.decision.sourceId,'EUMETSAT');
  assert.equal(r.decision.value,24.7);
  assert.equal(r.referenceMode,'INMET_PRIMARY_COMPARISON_PERMITTED');
  assert.equal(r.decision.brazilianReference,undefined);
  assert.equal(r.gptMode,'RESEARCH_POINTER_ONLY_NOT_USED_AS_MEASUREMENT');
});
test('without commercial comparison permission use international consensus',()=>{
  const r=evaluateAgent14({candidates,inmetRecord:inmet,comparisonUseLicensed:false,now});
  assert.equal(r.decision.strategy,'INTERNATIONAL_CONSENSUS');
  assert.equal(r.decision.sourceId,'NOAA');
});
test('Defesa Civil risk bulletin is never a temperature instrument',()=>{
  const r=evaluateAgent14({
    candidates,inmetRecord:{...inmet,sourceId:'DEFESA_CIVIL_RJ'},
    comparisonUseLicensed:true,now,
  });
  assert.equal(r.referenceMode,'INTERNATIONAL_CONSENSUS_OR_QUALITY');
});
test('when one valid international source exists it is used, without fabricated data',()=>{
  const r=evaluateAgent14({candidates:[candidates[0]],now});
  assert.equal(r.decision.action,'PUBLISH_VALID_INTERNATIONAL');
  assert.equal(r.decision.value,25);
  assert.equal(continuityOfService({decision:r.decision,now}).status,'CURRENT');
});
test('third unavailable: may still use prior checked value, never as real-time',()=>{
  const selected=evaluateAgent14({candidates:[],now});
  const result=continuityOfService({decision:selected.decision,
    lastVerified:{sourceId:'NOAA',value:25,observedAt:new Date(now.valueOf()-3600000)},now});
  assert.equal(result.status,'HISTORICAL_NOT_CURRENT');
  assert.equal(continuityOfService({decision:selected.decision,now}).status,'CURRENT_DATA_NOT_CONFIRMED');
});
test('only one authorized INMET comparison in thirty minute interval',()=>{
  const x=planAgent14PrimaryReference({
    now,previousCheckAt:new Date(now.valueOf()-10*60000),comparisonUseLicensed:true});
  assert.equal(x.allowed,false);
  assert.equal(x.reason,'THIRTY_MINUTE_INTERVAL');
  assert.equal(planAgent14PrimaryReference({now,comparisonUseLicensed:false}).allowed,false);
  assert.equal(planAgent14PrimaryReference({now,comparisonUseLicensed:true}).allowed,true);
});
