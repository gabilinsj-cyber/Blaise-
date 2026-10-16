import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateInmetP0Policy, INMET_P0_POLICY_ID } from '../src/inmet-p0-policy.mjs';
import { InmetSourceContractError, validateInmetCapFeedXml } from '../src/inmet-source.mjs';
import { validateP0Alert } from '../src/fcm.mjs';

function alertXml({
  identifier = 'urn:oid:2.49.0.0.76.0.2026.30000.1',
  sent = '2026-09-09T15:00:00-03:00',
  event = 'Chuvas Intensas',
  urgency = 'Immediate',
  severity = 'Severe',
  certainty = 'Likely',
  onset = '2026-09-09T15:05:00-03:00',
  expires = '2026-09-09T23:00:00-03:00',
  areaDesc = 'Rio de Janeiro e Região Metropolitana',
  geocode = '<geocode><valueName>IBGE</valueName><value>3304557 3304904</value></geocode>',
} = {}) {
  return `<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
    <identifier>${identifier}</identifier>
    <sender>info.aviso@inmet.gov.br</sender>
    <sent>${sent}</sent>
    <status>Actual</status>
    <msgType>Alert</msgType>
    <scope>Public</scope>
    <info>
      <language>pt-BR</language>
      <category>Met</category>
      <event>${event}</event>
      <urgency>${urgency}</urgency>
      <severity>${severity}</severity>
      <certainty>${certainty}</certainty>
      <onset>${onset}</onset>
      <expires>${expires}</expires>
      <area>
        <areaDesc>${areaDesc}</areaDesc>
        ${geocode}
      </area>
    </info>
  </alert>`;
}

function snapshot(records) {
  return validateInmetCapFeedXml(`<?xml version="1.0"?><feed>${records.join('\n')}</feed>`);
}

const NOW = Date.parse('2026-09-09T18:30:00Z');

test('normalizes exact canonical RJ municipality scope and creates one P0 candidate per municipality', () => {
  const result = snapshot([alertXml()]);
  assert.equal(result.rjWarnings[0].certainty, 'Likely');
  assert.deepEqual(result.rjWarnings[0].rjMunicipalityIbges, ['3304557', '3304904']);

  const policy = evaluateInmetP0Policy(result, NOW);
  assert.equal(policy.policyId, INMET_P0_POLICY_ID);
  assert.equal(policy.candidateCount, 2);
  assert.equal(policy.blockedCount, 0);
  assert.equal(policy.ineligibleCount, 0);
  assert.deepEqual(policy.candidates.map((entry) => entry.alert.cityName), ['Rio de Janeiro', 'São Gonçalo']);
  for (const entry of policy.candidates) {
    assert.equal(entry.scope, 'MUNICIPALITY');
    assert.equal(entry.alert.authority, 'official');
    assert.equal(entry.alert.severity, 'P0');
    assert.match(entry.alert.id, /^inmet:[a-f0-9]{64}$/);
    validateP0Alert(entry.alert, NOW);
  }
});

test('creates one statewide P0 candidate when CAP explicitly scopes the whole RJ state', () => {
  const result = snapshot([alertXml({
    geocode: '<geocode><valueName>ISO 3166-2</valueName><value>BR-RJ</value></geocode>',
    areaDesc: 'Estado do Rio de Janeiro',
  })]);
  const policy = evaluateInmetP0Policy(result, NOW);
  assert.equal(policy.candidateCount, 1);
  assert.equal(policy.candidates[0].scope, 'STATEWIDE');
  assert.equal(policy.candidates[0].alert.cityName, undefined);
  validateP0Alert(policy.candidates[0].alert, NOW);
});

test('does not promote moderate CAP warnings to P0', () => {
  const result = snapshot([alertXml({ severity: 'Moderate' })]);
  const policy = evaluateInmetP0Policy(result, NOW);
  assert.equal(policy.candidateCount, 0);
  assert.equal(policy.ineligibleCount, 1);
  assert.equal(policy.ineligible[0].reason, 'below_p0_threshold');
});

test('does not promote uncertain CAP warnings to P0', () => {
  const result = snapshot([alertXml({ certainty: 'Possible' })]);
  const policy = evaluateInmetP0Policy(result, NOW);
  assert.equal(policy.candidateCount, 0);
  assert.equal(policy.ineligibleCount, 1);
});

test('blocks otherwise severe INMET warnings whose official sent-to-expiry window exceeds the P0 24h contract', () => {
  const result = snapshot([alertXml({
    sent: '2026-09-09T10:00:00-03:00',
    onset: '2026-09-09T10:05:00-03:00',
    expires: '2026-09-10T12:30:00-03:00',
  })]);
  const policy = evaluateInmetP0Policy(result, NOW);
  assert.equal(policy.candidateCount, 0);
  assert.equal(policy.blockedCount, 1);
  assert.equal(policy.blocked[0].reason, 'p0_validity_too_long');
});

test('fails closed when an RJ-looking seven-digit geocode is not one of the canonical 92 municipalities', () => {
  assert.throws(
    () => snapshot([alertXml({
      geocode: '<geocode><valueName>IBGE</valueName><value>3399999</value></geocode>',
    })]),
    (error) => error instanceof InmetSourceContractError && error.code === 'inmet_rj_municipality_ibge_untrusted',
  );
});
