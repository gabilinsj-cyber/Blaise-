import test from 'node:test';
import assert from 'node:assert/strict';
import { processRtdnPayload, verifyPurchasePayload } from '../src/server.mjs';

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
  const rtdn = {
    message: {
      messageId: 'msg-1',
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
  assert.equal(await processRtdnPayload(rtdn, { config, gateway, nowMillis }), 'subscription');
  assert.equal(acked, true);
});
