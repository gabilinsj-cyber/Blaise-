import http from 'node:http';
import assert from 'node:assert/strict';
import { createConcurrencyGate } from '../src/resilience.mjs';
import { createHttpHandler } from '../src/server.mjs';

const config = {
  packageName: 'br.com.blaise.rj',
  monthlyProductId: 'ci.monthly',
  annualProductId: 'ci.annual',
  allowTestPurchases: false,
  verifyMaxConcurrent: 128,
  rtdnMaxConcurrent: 64,
};

function activeSubscription() {
  return {
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    lineItems: [{ productId: 'ci.monthly', expiryTime: '2030-01-01T00:00:00Z' }],
  };
}

function requestBody() {
  return JSON.stringify({
    packageName: config.packageName,
    purchaseToken: 'ci-load-token-12345678',
    productIds: ['ci.monthly'],
  });
}

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postVerify(base) {
  const response = await fetch(`${base}/v1/entitlements/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody(),
  });
  const text = await response.text();
  return { status: response.status, text };
}

async function runBounded(poolSize, count, task) {
  let cursor = 0;
  const workers = Array.from({ length: poolSize }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= count) return;
      await task(index);
    }
  });
  await Promise.all(workers);
}

const fastGateway = {
  async getSubscription() { return activeSubscription(); },
  async acknowledge() { throw new Error('unexpected_acknowledge'); },
};

const normalHandler = createHttpHandler({
  config,
  gateway: fastGateway,
  oidcVerifier: null,
  verifyGate: createConcurrencyGate({ maxConcurrent: 128 }),
  rtdnGate: createConcurrencyGate({ maxConcurrent: 64 }),
});

const normalStart = Date.now();
let normalOk = 0;
await withServer(normalHandler, async (base) => {
  await runBounded(48, 1_200, async () => {
    const result = await postVerify(base);
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.text), { active: true });
    normalOk += 1;
  });
});
const normalElapsedMillis = Date.now() - normalStart;
assert.equal(normalOk, 1_200);

const slowGateway = {
  async getSubscription() {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return activeSubscription();
  },
  async acknowledge() {},
};
const surgeGate = createConcurrencyGate({ maxConcurrent: 2 });
const surgeHandler = createHttpHandler({
  config,
  gateway: slowGateway,
  oidcVerifier: null,
  verifyGate: surgeGate,
  rtdnGate: createConcurrencyGate({ maxConcurrent: 2 }),
});

let surgeOk = 0;
let surgeBusy = 0;
await withServer(surgeHandler, async (base) => {
  const results = await Promise.all(Array.from({ length: 64 }, () => postVerify(base)));
  for (const result of results) {
    if (result.status === 200) surgeOk += 1;
    else if (result.status === 503) surgeBusy += 1;
    else assert.fail(`unexpected surge status ${result.status}`);
  }
});
assert.ok(surgeOk > 0);
assert.ok(surgeBusy > 0);
const surgeSnapshot = surgeGate.snapshot();
assert.equal(surgeSnapshot.peak, 2);
assert.equal(surgeSnapshot.rejected, surgeBusy);

console.log(`LOAD_SMOKE=PASS requests=${normalOk} concurrency=48 elapsed_ms=${normalElapsedMillis}`);
console.log(`BACKPRESSURE_SMOKE=PASS accepted=${surgeOk} rejected=${surgeBusy} peak=${surgeSnapshot.peak}`);
console.log('SCALE_3M_9M=NOT_RUN_EXTERNAL_ENVIRONMENT_REQUIRED');
console.log('MULTI_REGION_FAILOVER=NOT_RUN_EXTERNAL_INFRA_REQUIRED');
