import test from 'node:test';
import assert from 'node:assert/strict';
import { obfuscatedPlayAccountId, matchesVerifiedPlayOwner } from '../src/subscription-account-binding-rj.mjs';

const uid = 'uid-123';
const expected = '823efa41574067e32b6c596a8687b985b33c21ce52d71996f8a306f62bac9685';
const playPurchase = (value) => ({
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  externalAccountIdentifiers: { obfuscatedExternalAccountId: value },
});

test('deterministic RJ account id is a 64-character SHA-256 hex string, never raw UID', () => {
  assert.equal(obfuscatedPlayAccountId(uid), expected);
  assert.equal(obfuscatedPlayAccountId(uid).length, 64);
  assert.equal(obfuscatedPlayAccountId('uid-124') === expected, false);
});

test('verified Play account identifier matches the authenticated account', () => {
  assert.equal(matchesVerifiedPlayOwner(playPurchase(expected), uid), true);
  assert.equal(matchesVerifiedPlayOwner(playPurchase(expected), 'uid-124'), false);
  assert.equal(matchesVerifiedPlayOwner(playPurchase(expected.toUpperCase()), uid), false);
});

test('legacy purchases without trusted account attribution fail closed', () => {
  assert.equal(matchesVerifiedPlayOwner({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE' }, uid), false);
  assert.equal(matchesVerifiedPlayOwner(playPurchase(undefined), uid), false);
  assert.equal(matchesVerifiedPlayOwner(playPurchase(uid), uid), false);
  assert.equal(matchesVerifiedPlayOwner(null, uid), false);
});

test('unverified, malformed, and PII-like account identifiers are rejected', () => {
  for (const candidate of [null, '', '  ', 'a@b.example', '\nuid-123', 'é', 'a'.repeat(129)]) {
    assert.equal(obfuscatedPlayAccountId(candidate), null);
    assert.equal(matchesVerifiedPlayOwner(playPurchase(expected), candidate), false);
  }
  assert.equal(matchesVerifiedPlayOwner(playPurchase('not-a-hash'), uid), false);
  assert.equal(matchesVerifiedPlayOwner(playPurchase('f'.repeat(64)), uid), false);
});

test('no subscription state alone can bypass ownership matching', () => {
  for (const state of ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_CANCELED']) {
    assert.equal(matchesVerifiedPlayOwner({ subscriptionState: state }, uid), false);
  }
});
