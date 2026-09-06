import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRtdnReplayGuard,
  processRtdnPayload,
  verifyPurchasePayload,
} from '../src/server.mjs';

const config = {
  packageName: 'br.com.blaise.rj',
  monthlyProductId: 'monthly.test',
  annualProductId: 'annual.test',
  allowTestPurchases: false,
};
const nowMillis = Date.parse('2026-09-06T00:00:00Z');

function activeSubscription(ack = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
  return {
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: ack,
    lineItems: [{ productId: 'monthly.test', expiryTime: '2026-10-06T00:00:00Z' }],
  };
}

const payload = {
  packageName: config.packageName,
  purchaseToken: 'token-12345678',
  productIds: ['monthly.test'],
};

function rtdnPayload(messageId = 'msg-1') {
  return {
    message: {
      messageId,
      data: Buffer.from(JSON.stringify({
        version: '1.0',
        packageName: config.packageName,
        subscriptionNotification: {
          version: '1.0',
          notificationType: 4,
          purchaseToken: payload.purchaseToken,
        },
      })).toString('base64'),
    },
  };
}

test('verified active purchase returns only active=true', async () => {
  const gateway = {
    async getSubscription() { return activeSubscription(); },
    async acknowledge() { throw new Error('should not be called'); },
  };
  assert.deepEqual(await verifyPurchasePayload(payload, { config, gateway, nowMillis }), { active: true });
});

test('pending acknowledgement is acknowledged before entitlement is returned', async () => {
  let acknowledged = false;
  const gateway = {
    async getSubscription() { return activeSubscription('ACKNOWLEDGEMENT_STATE_PENDING'); },
    async acknowledge(token, productId) {
      assert.equal(token, payload.purchaseToken);
      assert.equal(productId, 'monthly.test');
      acknowledged = true;
    },
  };
  assert.deepEqual(await verifyPurchasePayload(payload, { config, gateway, nowMillis }), { active: true });
  assert.equal(acknowledged, true);
});

test('ack race is accepted only after a refreshed acknowledged state', async () => {
  let lookups = 0;
  const gateway = {
    async getSubscription() {
      lookups += 1;
      return lookups === 1 ? activeSubscription('ACKNOWLEDGEMENT_STATE_PENDING') : activeSubscription();
    },
    async acknowledge() { throw new Error('race'); },
  };
  assert.deepEqual(await verifyPurchasePayload(payload, { config, gateway, nowMillis }), { active: true });
  assert.equal(lookups, 2);
});

test('non-entitled purchase returns active=false without leaking reason', async () => {
  const gateway = {
    async getSubscription() {
      return {
        subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD',
        acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
        lineItems: [{ productId: 'monthly.test', expiryTime: '2026-10-06T00:00:00Z' }],
      };
    },
    async acknowledge() {},
  };
  assert.deepEqual(await verifyPurchasePayload(payload, { config, gateway, nowMillis }), { active: false });
});

test('RTDN subscription refreshes Google state and acknowledges when necessary', async () => {
  let acked = false;
  const gateway = {
    async getSubscription() { return activeSubscription('ACKNOWLEDGEMENT_STATE_PENDING'); },
    async acknowledge() { acked = true; },
  };
  assert.equal(await processRtdnPayload(rtdnPayload(), { config, gateway, nowMillis }), 'subscription');
  assert.equal(acked, true);
});

test('duplicate RTDN message id is processed only once inside one instance', async () => {
  let lookups = 0;
  const gateway = {
    async getSubscription() {
      lookups += 1;
      return activeSubscription();
    },
    async acknowledge() {},
  };
  const replayGuard = createRtdnReplayGuard();
  const event = rtdnPayload('msg-dedupe');

  assert.equal(
    await processRtdnPayload(event, { config, gateway, nowMillis, replayGuard }),
    'subscription',
  );
  assert.equal(
    await processRtdnPayload(event, { config, gateway, nowMillis, replayGuard }),
    'duplicate',
  );
  assert.equal(lookups, 1);
  assert.equal(replayGuard.size, 1);
});

test('failed RTDN processing is not marked so Pub/Sub retry can recover', async () => {
  let lookups = 0;
  const gateway = {
    async getSubscription() {
      lookups += 1;
      if (lookups === 1) throw new Error('temporary_lookup_failure');
      return activeSubscription();
    },
    async acknowledge() {},
  };
  const replayGuard = createRtdnReplayGuard();
  const event = rtdnPayload('msg-retry');

  await assert.rejects(
    processRtdnPayload(event, { config, gateway, nowMillis, replayGuard }),
    /temporary_lookup_failure/,
  );
  assert.equal(replayGuard.size, 0);
  assert.equal(
    await processRtdnPayload(event, { config, gateway, nowMillis, replayGuard }),
    'subscription',
  );
  assert.equal(lookups, 2);
});

test('replay guard expires and bounds instance-local message ids', () => {
  const guard = createRtdnReplayGuard({ maxEntries: 2, ttlMillis: 1_000 });
  guard.mark('a', 0);
  guard.mark('b', 0);
  guard.mark('c', 0);
  assert.equal(guard.has('a', 0), false);
  assert.equal(guard.has('b', 0), true);
  assert.equal(guard.has('c', 0), true);
  assert.equal(guard.has('b', 1_001), false);
  assert.equal(guard.size, 0);
});
