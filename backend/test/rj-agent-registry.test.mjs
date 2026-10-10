import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLAISE_RJ_AGENTS, RJ_AGENT_CADENCE, RJ_AGENT_PROJECT,
  agentByNumber, rjCadenceForLevel, evaluateExtremeAudioGate,
  subscriberScaleReview,
} from '../src/rj-agent-registry.mjs';

test('ten numbered names and functions preserved with explicit deployment honesty', () => {
  assert.equal(RJ_AGENT_PROJECT, 'Blaise V6 RJ');
  assert.deepEqual(BLAISE_RJ_AGENTS.map(a => a.number), [1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(BLAISE_RJ_AGENTS.slice(0,8).map(a => a.name), [
    'Blaise Sentinel RJ','Blaise Vector RJ','Blaise Fusion RJ','Blaise Track RJ',
    'Blaise Hydro RJ','Blaise Ocean RJ','Blaise Seismo RJ','Blaise Audit RJ',
  ]);
  assert.equal(agentByNumber(9).name, 'Correção Horária RJ');
  assert.equal(agentByNumber(10).name, 'Auditoria Profunda RJ');
  assert.match(agentByNumber(9).historicalName, /NOT_CONFIRMED/);
  assert.match(agentByNumber(10).historicalName, /NOT_CONFIRMED/);
  assert.equal(BLAISE_RJ_AGENTS.every(a => a.runtimeStatus === 'SPECIFIED_NOT_AUTONOMOUSLY_DEPLOYED'), true);
  assert.equal(BLAISE_RJ_AGENTS.some(a => /INEA/.test(a.name)), false);
  assert.throws(() => agentByNumber(11), RangeError);
});
test('normal, severe and confirmed-extreme science cadence cannot activate 25s network polling', () => {
  assert.equal(rjCadenceForLevel(3).observationUpdateMs, 300000);
  assert.equal(rjCadenceForLevel(4).observationUpdateMs, 60000);
  assert.equal(rjCadenceForLevel(5).calculationRecheckMs, 60000);
  const extreme = rjCadenceForLevel(5, {independentOfficialLevel5Alerts: 2, scientificRevalidationLevel: 5});
  assert.equal(extreme.calculationRecheckMs, 25000);
  assert.equal(extreme.sourceMayBePolledEvery25s, false);
  assert.equal(RJ_AGENT_CADENCE.audioOnlyOnLevel5, true);
  assert.throws(() => rjCadenceForLevel(6), RangeError);
});
const NOW = Date.parse('2026-10-10T18:00:00Z');
const ISO = ms => new Date(ms).toISOString();
const warn = (authority, changes = {}) => ({
  authority, type:'OFFICIAL_WARNING', validation:'VERIFIED_LIVE',
  severity:5, ibge:'3304557', phenomenon:'TEMPORAL',
  evidenceId:'official-warning-'+authority,
  validFrom:ISO(NOW-180000), validUntil:ISO(NOW+180000), ...changes,
});
const diagnostic = {
  ibge:'3304557', phenomenon:'TEMPORAL', scale:5,
  state:'VALIDATED_INTERNAL_DIAGNOSTIC',
  independentInputValidation:true, allowAutomaticWarning:false,
  calculatedAt:ISO(NOW-12000),
};
test('two independent official warnings and matching diagnostic only authorize P0 publisher REVIEW', () => {
  const result=evaluateExtremeAudioGate({alerts:[warn('INMET'),warn('DEFESA_CIVIL_RJ')],diagnostic,now:NOW});
  assert.equal(result.state,'ELIGIBLE_FOR_PUBLISHER_REVIEW');
  assert.equal(result.requiresPublisherAuthorization,true);
  assert.equal(result.audio,false);assert.equal(result.siren,false);assert.equal(result.publish,false);
});
test('duplicated agency, Windy, stale warning, mismatched location/time and nonlevel-5 fail closed', () => {
  const cases=[
    [warn('INMET'),warn('INMET',{evidenceId:'different'})],
    [warn('INMET'),warn('WINDY_MODELO')],
    [warn('INMET'),warn('DEFESA_CIVIL_RJ',{ibge:'3303302'})],
    [warn('INMET'),warn('DEFESA_CIVIL_RJ',{phenomenon:'RESSACA'})],
    [warn('INMET'),warn('DEFESA_CIVIL_RJ',{severity:4})],
    [warn('INMET'),warn('DEFESA_CIVIL_RJ',{validUntil:ISO(NOW-2)})],
  ];
  for(const pair of cases){
    const result=evaluateExtremeAudioGate({alerts:pair,diagnostic,now:NOW});
    assert.equal(result.state,'NOT_AUTHORIZED');
    assert.equal(result.audio,false);
  }
  assert.equal(evaluateExtremeAudioGate({alerts:[warn('INMET'),warn('CEMADEN')],
    diagnostic:{...diagnostic,scale:4},now:NOW}).state,'NOT_AUTHORIZED');
  assert.equal(evaluateExtremeAudioGate({alerts:[warn('INMET'),warn('CEMADEN')],
    diagnostic:{...diagnostic,calculatedAt:ISO(NOW-80000)},now:NOW}).state,'NOT_AUTHORIZED');
});
test('Agent10 reports every 500k of VERIFIED subscriptions through 2 million and beyond; no purchase', () => {
  const r=subscriberScaleReview({verifiedActiveSubscribers:2_200_000,previousReportedMilestone:500000});
  assert.deepEqual(r.milestonesNeedingReview,[1_000_000,1_500_000,2_000_000]);
  assert.equal(r.purchasesExecuted,false);
  assert.equal(r.procurementStatus,'REQUIRES_HUMAN_APPROVAL');
  assert.deepEqual(r.currency,['USD','EUR']);
  assert.deepEqual(subscriberScaleReview({verifiedActiveSubscribers:2_520_000,
    previousReportedMilestone:2_000_000}).milestonesNeedingReview,[2_500_000]);
  assert.deepEqual(subscriberScaleReview({verifiedActiveSubscribers:499999}).milestonesNeedingReview,[]);
  assert.throws(() => subscriberScaleReview({verifiedActiveSubscribers:2.5}));
});
