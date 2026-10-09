import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeniedTokenShield, createRequestLimiter } from '../src/blaise-shield-rj.mjs';
import { createHttpHandler } from '../src/server.mjs';

const config = {
  packageName: 'br.com.blaise.rj',
  monthlyProductId: 'monthly.test',
  annualProductId: 'annual.test',
  allowTestPurchases: false,
  verifyMaxConcurrent: 4,
};

const request = (purchaseToken, extra = {}) => ({
  packageName: config.packageName,
  purchaseToken,
  productIds: ['monthly.test'],
  ...extra,
});

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function verify(base, body) {
  return fetch(`${base}/v1/entitlements/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('Blaise Shield RJ limits requests and resets expired windows', () => {
  const check = createRequestLimiter({
    limit: 2,
    windowMs: 1000,
    maxEntries: 2
  });

  assert.equal(check('a', 0).allowed, true);
  assert.equal(check('a', 100).allowed, true);
  assert.equal(check('a', 200).allowed, false);
  assert.equal(check('b', 200).allowed, true);
  assert.equal(check('c', 200).allowed, false);
  assert.equal(check('c', 1001).allowed, true);
  assert.equal(check('a', 1001).allowed, false);
  assert.equal(check('', 1001).allowed, false);
});

test('Blaise Shield RJ rejects invalid configuration', () => {
  assert.throws(
    () => createRequestLimiter({ limit: 0 }),
    RangeError
  );
  assert.throws(
    () => createRequestLimiter({ windowMs: -1 }),
    RangeError
  );
  assert.throws(
    () => createRequestLimiter({ maxEntries: 0 }),
    RangeError
  );
});

test('shield keeps only bounded denial fingerprints and expires the window', () => {
  const shield = createDeniedTokenShield({
    maxDenied: 2,
    windowMillis: 1_000,
    maxEntries: 2,
    secret: Buffer.alloc(32, 1),
  });
  assert.equal(shield.allows('opaque-token-1', 0), true);
  shield.recordDenied('opaque-token-1', 0);
  assert.equal(shield.allows('opaque-token-1', 100), true);
  shield.recordDenied('opaque-token-1', 100);
  assert.equal(shield.allows('opaque-token-1', 100), false);
  assert.equal(shield.allows('opaque-token-2', 100), true);
  assert.equal(shield.size, 1);
  assert.equal(shield.allows('opaque-token-1', 1_000), true);
  assert.equal(shield.size, 0);

  shield.recordDenied('opaque-token-1', 2_000);
  shield.recordDenied('opaque-token-2', 2_000);
  shield.recordDenied('opaque-token-3', 2_000);
  assert.equal(shield.size, 2);
  assert.equal(shield.allows('opaque-token-1', 2_000), true);
  assert.deepEqual(Object.keys(shield).sort(), ['allows', 'recordDenied', 'size']);
});

test('shield cannot be started with weak secret or unbounded settings', () => {
  assert.throws(() => createDeniedTokenShield({ secret: Buffer.alloc(8) }), /invalid_blaise_shield_configuration/);
  assert.throws(() => createDeniedTokenShield({ maxEntries: 0 }), /invalid_blaise_shield_configuration/);
  assert.throws(() => createDeniedTokenShield({ maxDenied: 0 }), /invalid_blaise_shield_configuration/);
});

test('repeated denied verification is rate limited without raw token or billing API calls', async () => {
  let lookups = 0;
  const token = 'denied-token-long-value';
  const handler = createHttpHandler({
    config,
    gateway: {
      async getSubscription() { lookups += 1; return null; },
      async acknowledge() {},
    },
    oidcVerifier: null,
    deniedTokenShield: createDeniedTokenShield({ maxDenied: 2 }),
  });

  await withServer(handler, async (base) => {
    for (let i = 0; i < 2; i += 1) {
      const response = await verify(base, request(token));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { active: false });
    }
    const blocked = await verify(base, request(token));
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('cache-control'), 'no-store');
    assert.equal(blocked.headers.get('retry-after'), '60');
    const text = await blocked.text();
    assert.equal(text.includes(token), false);
    assert.deepEqual(JSON.parse(text), { error: 'rate_limited' });
    assert.equal(lookups, 2);

    const independent = await verify(base, request('different-token-12345'));
    assert.equal(independent.status, 200);
    assert.equal(lookups, 3);
  });
});

test('active purchases stay available and excessive personal fields are rejected', async () => {
  let lookups = 0;
  const handler = createHttpHandler({
    config,
    gateway: {
      async getSubscription() {
        lookups += 1;
        return {
          subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
          acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
          lineItems: [{ productId: 'monthly.test', expiryTime: '2040-01-01T00:00:00Z' }],
        };
      },
      async acknowledge() {},
    },
    oidcVerifier: null,
    deniedTokenShield: createDeniedTokenShield({ maxDenied: 1 }),
  });

  await withServer(handler, async (base) => {
    for (let i = 0; i < 3; i += 1) {
      const response = await verify(base, request('active-token-long-123'));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { active: true });
    }
    const extra = await verify(base, request('active-token-long-123', { email: 'never-store@example.invalid' }));
    assert.equal(extra.status, 400);
    assert.deepEqual(await extra.json(), { error: 'invalid_request' });
    assert.equal(lookups, 3);
  });
});
