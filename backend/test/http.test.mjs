import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpHandler, loadConfig } from '../src/server.mjs';

const baseConfig = {
  packageName: 'br.com.blaise.rj',
  monthlyProductId: 'monthly.test',
  annualProductId: 'annual.test',
  allowTestPurchases: false,
  firebaseProjectId: 'blaise-test',
  fcmP0Topic: 'blaise-rj-p0',
  verifyMaxConcurrent: 4,
  rtdnMaxConcurrent: 2,
  p0MaxConcurrent: 2,
};

function validP0(id = 'p0-test-1') {
  const now = Date.now();
  return {
    authority: 'official',
    severity: 'P0',
    id,
    title: 'Alerta oficial controlado',
    source: 'Defesa Civil RJ',
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 60 * 60_000).toISOString(),
    cityName: 'Niterói',
    cityIbge: '3303302',
  };
}

function handlerWith(overrides = {}) {
  return createHttpHandler({
    config: baseConfig,
    gateway: {
      async getSubscription() { return null; },
      async acknowledge() {},
    },
    oidcVerifier: async () => true,
    fcmGateway: null,
    p0OidcVerifier: null,
    metricsOidcVerifier: null,
    ...overrides,
  });
}

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await callback(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('observability endpoint is OIDC-gated and returns no user or token dimensions', async () => {
  const handler = handlerWith({
    metricsOidcVerifier: async (authorization) => authorization === 'Bearer metrics-ok',
  });

  await withServer(handler, async (base) => {
    const denied = await fetch(`${base}/internal/metrics`);
    assert.equal(denied.status, 401);

    const accepted = await fetch(`${base}/internal/metrics`, {
      headers: { Authorization: 'Bearer metrics-ok' },
    });
    assert.equal(accepted.status, 200);
    const body = await accepted.json();
    assert.equal(body.schemaVersion, 1);
    assert.equal(typeof body.counters.requests_total, 'number');
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes('purchaseToken'), false);
    assert.equal(serialized.includes('userId'), false);
    assert.equal(serialized.includes('cityName'), false);
  });
});

test('official P0 endpoint requires service identity and deduplicates only after successful publish', async () => {
  let publishes = 0;
  const handler = handlerWith({
    p0OidcVerifier: async (authorization) => authorization === 'Bearer p0-ok',
    fcmGateway: {
      async publishOfficialP0() {
        publishes += 1;
        return 'accepted';
      },
    },
  });

  await withServer(handler, async (base) => {
    const unauthorized = await fetch(`${base}/v1/internal/p0`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validP0()),
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(publishes, 0);

    const first = await fetch(`${base}/v1/internal/p0`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer p0-ok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validP0()),
    });
    assert.equal(first.status, 202);
    assert.deepEqual(await first.json(), { accepted: true });
    assert.equal(publishes, 1);

    const duplicate = await fetch(`${base}/v1/internal/p0`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer p0-ok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validP0()),
    });
    assert.equal(duplicate.status, 202);
    assert.deepEqual(await duplicate.json(), { accepted: true, duplicate: true });
    assert.equal(publishes, 1);
  });
});

test('P0 endpoint rejects nonofficial content before fanout', async () => {
  let publishes = 0;
  const handler = handlerWith({
    p0OidcVerifier: async () => true,
    fcmGateway: {
      async publishOfficialP0() { publishes += 1; },
    },
  });

  await withServer(handler, async (base) => {
    const response = await fetch(`${base}/v1/internal/p0`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer p0-ok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...validP0('bad-1'), authority: 'unverified' }),
    });
    assert.equal(response.status, 400);
    assert.equal(publishes, 0);
  });
});

test('partial OIDC identity configuration fails startup closed', () => {
  assert.throws(() => loadConfig({
    BLAISE_MONTHLY_PRODUCT_ID: 'monthly.test',
    BLAISE_ANNUAL_PRODUCT_ID: 'annual.test',
    BLAISE_P0_AUDIENCE: 'https://example.invalid/p0',
  }), /p0_oidc_configuration_incomplete/);
});
