import http from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';

import { createChmTideValuesCache } from '../src/chm-tide-cache.mjs';
import { createChmTideHttpHandler, CHM_TIDE_HTTP_PATH } from '../src/chm-tide-http.mjs';
import { CHM_TIDE_TIME_BASIS, normalizeChmTideValues } from '../src/chm-tide-values.mjs';
import { createOperationalMetrics } from '../src/observability.mjs';

const NOW = Date.parse('2026-09-14T20:00:00Z');
const config = Object.freeze({
  packageName: 'br.com.blaise.rj',
  monthlyProductId: 'monthly.test',
  annualProductId: 'annual.test',
  allowTestPurchases: false,
});

function activeSubscription() {
  return {
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    lineItems: [{ productId: 'monthly.test', expiryTime: '2099-01-01T00:00:00Z' }],
  };
}

function validRequest(overrides = {}) {
  return {
    packageName: config.packageName,
    purchaseToken: 'token-12345678',
    productIds: ['monthly.test'],
    stationNumber: 40,
    calendarYear: 2026,
    ...overrides,
  };
}

function populatedCache() {
  const cache = createChmTideValuesCache({ now: () => NOW });
  const snapshot = normalizeChmTideValues({
    station: {
      stationNumber: 40,
      name: 'PORTO DO RIO DE JANEIRO - ILHA FISCAL',
      pageStart: 130,
      pageEnd: 132,
    },
    calendarYear: 2026,
    timeBasis: CHM_TIDE_TIME_BASIS,
    utcOffsetMinutes: -180,
    sourceArtifactSha256: 'a'.repeat(64),
    predictions: [
      { localDate: '2026-09-14', localTime: '03:20', heightMeters: 1.2, phase: 'HIGH', sourcePage: 131 },
      { localDate: '2026-09-14', localTime: '09:45', heightMeters: 0.3, phase: 'LOW', sourcePage: 131 },
    ],
  });
  cache.recordSuccess(snapshot, { fetchedAt: NOW });
  return cache;
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

function handlerWith({ gateway, cache = populatedCache(), metrics = createOperationalMetrics() } = {}) {
  const fallback = (_req, res) => {
    res.statusCode = 404;
    res.end();
  };
  return {
    metrics,
    handler: createChmTideHttpHandler(fallback, {
      config,
      gateway: gateway ?? {
        async getSubscription() { return activeSubscription(); },
        async acknowledge() {},
      },
      chmTideCache: cache,
      metrics,
    }),
  };
}

async function post(base, body) {
  return fetch(`${base}${CHM_TIDE_HTTP_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('paid CHM tide endpoint verifies Play entitlement before returning a current official snapshot', async () => {
  const { handler, metrics } = handlerWith();
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.contract, 'OFFICIAL_CHM_TIDE_VALUES_DELIVERY_V1');
    assert.equal(body.sourceId, 'chm-marine');
    assert.equal(body.stationNumber, 40);
    assert.equal(body.calendarYear, 2026);
    assert.equal(body.state, 'CURRENT');
    assert.equal(body.snapshot.predictionCount, 2);
    assert.equal(JSON.stringify(body).includes('purchaseToken'), false);
  });
  const snapshot = metrics.snapshot({ nowMillis: NOW });
  assert.equal(snapshot.counters.chm_tide_success_total, 1);
  assert.equal(snapshot.counters.chm_tide_denied_total, 0);
});

test('paid CHM tide endpoint denies non-entitled purchases without exposing reason or cached values', async () => {
  const { handler, metrics } = handlerWith({
    gateway: {
      async getSubscription() {
        return {
          subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD',
          acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
          lineItems: [{ productId: 'monthly.test', expiryTime: '2099-01-01T00:00:00Z' }],
        };
      },
      async acknowledge() {},
    },
  });
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'access_denied' });
  });
  assert.equal(metrics.snapshot({ nowMillis: NOW }).counters.chm_tide_denied_total, 1);
});

test('paid CHM tide endpoint fails closed when the runtime cache has no verified current snapshot', async () => {
  const empty = createChmTideValuesCache({ now: () => NOW });
  const { handler, metrics } = handlerWith({ cache: empty });
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'source_unavailable' });
  });
  assert.equal(metrics.snapshot({ nowMillis: NOW }).counters.chm_tide_unavailable_total, 1);
});

test('paid CHM tide endpoint rejects unexpected request fields before Play verification', async () => {
  let lookups = 0;
  const { handler } = handlerWith({
    gateway: {
      async getSubscription() { lookups += 1; return activeSubscription(); },
      async acknowledge() {},
    },
  });
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest({ debug: true }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'invalid_request' });
  });
  assert.equal(lookups, 0);
});
