import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFirebaseSubscriberVerifier, verifiedSubscriberUid, requireSubscriberUid } from '../src/firebase-subscriber-auth-rj.mjs';
import { createHttpHandler, loadConfig, verifyPurchasePayload } from '../src/server.mjs';
import { obfuscatedPlayAccountId } from '../src/subscription-account-binding-rj.mjs';

const projectId = 'blaise-v6-rj';
const now = 1_790_000_000;
const payload = {
  aud: projectId, iss: `https://securetoken.google.com/${projectId}`,
  sub: 'rj-user-1', email_verified: true,
  iat: now - 15, exp: now + 1800, auth_time: now - 3600,
  firebase: { sign_in_provider: 'password' },
};
const config = {
  packageName: 'br.com.blaise.rj', monthlyProductId: 'monthly.test',
  annualProductId: 'annual.test', allowTestPurchases: false,
  verifyMaxConcurrent: 4, requireSubscriberIdentity: true,
};
const purchase = {
  packageName: config.packageName,
  purchaseToken: 'opaque-play-token-abc',
  productIds: ['monthly.test'],
};
const subscription = (owner = 'rj-user-1') => ({
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  lineItems: [{ productId: 'monthly.test', expiryTime: '2099-01-01T00:00:00Z' }],
  externalAccountIdentifiers: { obfuscatedExternalAccountId: obfuscatedPlayAccountId(owner) },
});
async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
async function verify(base, bearer) {
  return fetch(`${base}/v1/entitlements/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: bearer } : {}) },
    body: JSON.stringify(purchase),
  });
}

test('identity flag requires the real Firebase project and rejects invalid flags', () => {
  const env = { BLAISE_MONTHLY_PRODUCT_ID: 'm', BLAISE_ANNUAL_PRODUCT_ID: 'a' };
  assert.throws(() => loadConfig({ ...env, BLAISE_REQUIRE_SUBSCRIBER_IDENTITY: 'true' }), /subscriber_identity_firebase_project_missing/);
  assert.throws(() => loadConfig({ ...env, BLAISE_REQUIRE_SUBSCRIBER_IDENTITY: 'maybe' }), /invalid_subscriber_identity_flag/);
  assert.equal(loadConfig({ ...env, BLAISE_REQUIRE_SUBSCRIBER_IDENTITY: 'true', BLAISE_FIREBASE_PROJECT_ID: projectId }).requireSubscriberIdentity, true);
});

test('verified claims demand matching audience, issuer, verified email and valid times', () => {
  assert.equal(verifiedSubscriberUid(payload, projectId, now), 'rj-user-1');
  for (const changes of [
    { aud: 'other-project' },
    { iss: 'https://securetoken.google.com/not-rj' },
    { email_verified: false }, { email_verified: null },
    { exp: now }, { iat: now + 1 }, { auth_time: now + 1 },
    { sub: 'email@invalid.test' },
    { firebase: { sign_in_provider: 'anonymous' } },
    { firebase: { sign_in_provider: 'custom' } },
  ]) {
    assert.equal(verifiedSubscriberUid({ ...payload, ...changes }, projectId, now), null);
  }
});

test('Firebase certificate verifier rejects unsigned and malformed bearer tokens', async () => {
  let fetches = 0;
  const verifier = createFirebaseSubscriberVerifier({
    projectId,
    now: () => now * 1000,
    fetchImpl: async () => {
      fetches += 1;
      return {
        ok: true,
        headers: { get: (key) => key === 'content-type' ? 'application/json' : 'max-age=180' },
        text: async () => JSON.stringify({ abc: '-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----' }),
      };
    },
    oauth: { async verifySignedJwtWithCertsAsync() { return { getPayload: () => payload }; } },
  });
  assert.equal(await verifier(null), null);
  assert.equal(await verifier('Bearer not-a-jwt'), null);
  assert.equal(await verifier('Basic abc'), null);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'abc' })).toString('base64url');
  const pretend = `${header}.${Buffer.from('{}').toString('base64url')}.sig`;
  assert.equal(await verifier(`Bearer ${pretend}`), 'rj-user-1');
  assert.equal(await verifier(`Bearer ${pretend}`), 'rj-user-1');
  assert.equal(fetches, 1);
  const fakeAlgorithm = Buffer.from(JSON.stringify({ alg: 'none', kid: 'abc' })).toString('base64url');
  assert.equal(await verifier(`Bearer ${fakeAlgorithm}.e30.sig`), null);
  assert.equal(await verifier('Bearer invalid'), null);
});

test('authenticated account is mandatory before the Google Play billing lookup', async () => {
  let lookups = 0;
  const handler = createHttpHandler({
    config,
    gateway: { async getSubscription() { lookups++; return subscription(); }, async acknowledge() {} },
    oidcVerifier: null,
    subscriberVerifier: async (authorization) => authorization === 'Bearer signed-rj-user' ? 'rj-user-1' : null,
  });
  await withServer(handler, async (base) => {
    assert.equal((await verify(base, null)).status, 401);
    assert.equal((await verify(base, 'Bearer wrong')).status, 401);
    assert.equal(lookups, 0);
    const accepted = await verify(base, 'Bearer signed-rj-user');
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { active: true });
    assert.equal(lookups, 1);
  });
});

test('copied Play token from another authenticated account cannot unlock premium', async () => {
  let acknowledgements = 0;
  const gateway = {
    async getSubscription() { return subscription('rj-user-1'); },
    async acknowledge() { acknowledgements++; },
  };
  assert.deepEqual(await verifyPurchasePayload(purchase, { config, gateway, authenticatedUid: 'rj-user-2' }), { active: false });
  assert.deepEqual(await verifyPurchasePayload(purchase, { config, gateway, authenticatedUid: 'rj-user-1' }), { active: true });
  assert.equal(acknowledgements, 0);
  assert.deepEqual(await verifyPurchasePayload(purchase, {
    config,
    gateway: { ...gateway, async getSubscription() { const v = subscription(); delete v.externalAccountIdentifiers; return v; } },
    authenticatedUid: 'rj-user-1',
  }), { active: false });
});

test('subscriber verification fails closed when identity verifier is not configured', async () => {
  assert.equal(await requireSubscriberUid({ headers: { authorization: 'Bearer anything' } }, config, null), null);
  assert.equal(await requireSubscriberUid({ headers: { authorization: 'Bearer anything' } }, config, async () => { throw Error('unavailable'); }), null);
  assert.equal(await requireSubscriberUid({ headers: { authorization: 'Bearer anything' } }, config, async () => 'x@y.invalid'), null);
});
