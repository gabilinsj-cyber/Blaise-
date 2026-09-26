import http from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';

import { ALERTA_RIO_EXPECTED_ACTIVE_STATIONS, ALERTA_RIO_LIVE_SOURCE_ID } from '../src/alerta-rio-source.mjs';
import {
  buildPaidDashboardSnapshot,
  createPaidDashboardDataHttpHandler,
  DASHBOARD_DATA_HTTP_CONTRACT,
  DASHBOARD_DATA_HTTP_PATH,
} from '../src/dashboard-data-http.mjs';
import { createOperationalMetrics } from '../src/observability.mjs';

const NOW = Date.parse('2026-09-15T11:00:00Z');
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
    ...overrides,
  };
}

function stations() {
  return Array.from({ length: ALERTA_RIO_EXPECTED_ACTIVE_STATIONS }, (_, index) => ({
    code: index + 1,
    name: `Estacao ${index + 1}`,
    zone: 'Rio de Janeiro',
    observedAt: '2026-09-15T10:59:00.000Z',
    rain15mMm: index === 3 ? 12.5 : index === 8 ? 1.2 : 0,
    rain1hMm: index === 3 ? 28.4 : index === 8 ? 4.5 : 0,
    rain24hMm: index === 3 ? 85.7 : index === 8 ? 10.1 : 0,
  }));
}

function currentWorker({ state = 'CURRENT', enabled = true, started = true } = {}) {
  const reading = Object.freeze({
    sourceId: ALERTA_RIO_LIVE_SOURCE_ID,
    state,
    reason: state === 'CURRENT' ? 'fresh_snapshot' : 'cache_age_exceeded',
    mode: 'normal',
    fetchedAt: '2026-09-15T10:59:30.000Z',
    dataAgeMs: state === 'CURRENT' ? 60_000 : 999_999,
    cacheAgeMs: state === 'CURRENT' ? 30_000 : 999_999,
    snapshot: state === 'CURRENT' ? Object.freeze({
      sourceId: ALERTA_RIO_LIVE_SOURCE_ID,
      stationCount: ALERTA_RIO_EXPECTED_ACTIVE_STATIONS,
      missingValueCount: 0,
      freshestObservedAt: '2026-09-15T10:59:00.000Z',
      stations: Object.freeze(stations()),
    }) : null,
  });
  return Object.freeze({
    status() {
      return Object.freeze({
        enabled,
        started,
        mode: 'normal',
        sources: Object.freeze([Object.freeze({
          sourceId: ALERTA_RIO_LIVE_SOURCE_ID,
          state,
          reason: reading.reason,
          fetchedAt: reading.fetchedAt,
          observedAt: '2026-09-15T10:59:00.000Z',
          dataAgeMs: reading.dataAgeMs,
          cacheAgeMs: reading.cacheAgeMs,
          semanticValidity: null,
        })]),
      });
    },
    readSource() {
      return reading;
    },
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

function handlerWith({ gateway, sourceWorker = currentWorker(), metrics = createOperationalMetrics({ startedAtMillis: NOW }) } = {}) {
  const fallback = (_req, res) => {
    res.statusCode = 404;
    res.end();
  };
  return {
    metrics,
    handler: createPaidDashboardDataHttpHandler(fallback, {
      config,
      gateway: gateway ?? {
        async getSubscription() { return activeSubscription(); },
        async acknowledge() {},
      },
      sourceWorker,
      metrics,
    }),
  };
}

async function post(base, body) {
  return fetch(`${base}${DASHBOARD_DATA_HTTP_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('paid dashboard snapshot projects only bounded current Alerta Rio rainfall summary after Play verification', async () => {
  const { handler, metrics } = handlerWith();
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.contract, DASHBOARD_DATA_HTTP_CONTRACT);
    assert.equal(body.rainfall.sourceId, ALERTA_RIO_LIVE_SOURCE_ID);
    assert.equal(body.rainfall.stationCount, ALERTA_RIO_EXPECTED_ACTIVE_STATIONS);
    assert.equal(body.rainfall.wetStationCount, 2);
    assert.equal(body.rainfall.max15mMm, 12.5);
    assert.equal(body.rainfall.max1hMm, 28.4);
    assert.equal(body.rainfall.max24hMm, 85.7);
    assert.equal(body.currentSourceCount, 1);
    assert.equal(body.sources.length, 1);
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes('token-12345678'), false);
    assert.equal(serialized.includes('Estacao 4'), false);
    assert.equal(serialized.includes('productIds'), false);
    assert.deepEqual(body.privacy, {
      purchaseTokenExposed: false,
      rawStationPayloadExposed: false,
      userLocationStored: false,
    });
  });
  const counters = metrics.snapshot({ nowMillis: NOW }).counters;
  assert.equal(counters.dashboard_success_total, 1);
  assert.equal(counters.dashboard_denied_total, 0);
});

test('fresh official rainfall is projected through paid HTTP contract for Android consumption', async () => {
  const { handler } = handlerWith();
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.contract, DASHBOARD_DATA_HTTP_CONTRACT);
    assert.equal(body.rainfall.sourceId, ALERTA_RIO_LIVE_SOURCE_ID);
    assert.equal(body.rainfall.state, 'CURRENT');
    assert.equal(body.rainfall.stationCount, ALERTA_RIO_EXPECTED_ACTIVE_STATIONS);
    assert.equal(body.rainfall.max1hMm, 28.4);
    assert.equal(body.privacy.purchaseTokenExposed, false);
    assert.equal(body.privacy.rawStationPayloadExposed, false);
    assert.equal(body.privacy.userLocationStored, false);
  });
});

test('dashboard projection fails closed when official rainfall cache is stale', () => {
  assert.equal(buildPaidDashboardSnapshot(currentWorker({ state: 'STALE' }), { nowMillis: NOW }), null);
});

test('paid dashboard endpoint denies inactive subscriptions without source disclosure', async () => {
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
  assert.equal(metrics.snapshot({ nowMillis: NOW }).counters.dashboard_denied_total, 1);
});

test('paid dashboard endpoint returns 503 without weather payload when official rainfall is stale', async () => {
  const { handler, metrics } = handlerWith({ sourceWorker: currentWorker({ state: 'STALE' }) });
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.deepEqual(body, { error: 'source_unavailable' });
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes('rainfall'), false);
    assert.equal(serialized.includes('token-12345678'), false);
  });
  assert.equal(metrics.snapshot({ nowMillis: NOW }).counters.dashboard_unavailable_total, 1);
});

test('paid dashboard endpoint returns source_unavailable when worker is disabled or has no current verified rainfall', async () => {
  const { handler, metrics } = handlerWith({ sourceWorker: currentWorker({ enabled: false }) });
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'source_unavailable' });
  });
  assert.equal(metrics.snapshot({ nowMillis: NOW }).counters.dashboard_unavailable_total, 1);
});

test('paid dashboard endpoint rejects unexpected fields before Play lookup', async () => {
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
