import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ClientInputError,
  configuredProductIds,
  decodeRtdnEnvelope,
  evaluateSubscription,
  validateVerifyPayload,
} from '../src/core.mjs';

const config = {
  packageName: 'br.com.blaise.rj',
  monthlyProductId: 'monthly.test',
  annualProductId: 'annual.test',
};
const nowMillis = Date.parse('2026-09-06T00:00:00Z');
const future = '2026-10-06T00:00:00Z';

function subscription(state = 'SUBSCRIPTION_STATE_ACTIVE', overrides = {}) {
  return {
    subscriptionState: state,
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    lineItems: [{ productId: 'monthly.test', expiryTime: future }],
    ...overrides,
  };
}

test('active, grace and canceled-before-expiry remain entitled', () => {
  for (const state of ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']) {
    const result = evaluateSubscription(subscription(state), {
      allowedProductIds: configuredProductIds(config),
      requestedProductIds: new Set(['monthly.test']),
      nowMillis,
    });
    assert.equal(result.active, true, state);
  }
});

test('pending, paused, hold and expired states fail closed', () => {
  for (const state of ['SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_PAUSED', 'SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_EXPIRED']) {
    const result = evaluateSubscription(subscription(state), {
      allowedProductIds: configuredProductIds(config),
      requestedProductIds: new Set(['monthly.test']),
      nowMillis,
    });
    assert.equal(result.active, false, state);
  }
});

test('expired line item and wrong product fail closed', () => {
  const expired = evaluateSubscription(subscription('SUBSCRIPTION_STATE_ACTIVE', {
    lineItems: [{ productId: 'monthly.test', expiryTime: '2026-08-01T00:00:00Z' }],
  }), {
    allowedProductIds: configuredProductIds(config),
    requestedProductIds: new Set(['monthly.test']),
    nowMillis,
  });
  assert.equal(expired.active, false);

  const wrongProduct = evaluateSubscription(subscription(), {
    allowedProductIds: configuredProductIds(config),
    requestedProductIds: new Set(['annual.test']),
    nowMillis,
  });
  assert.equal(wrongProduct.active, false);
});

test('test purchases are blocked unless explicitly enabled', () => {
  const purchase = subscription('SUBSCRIPTION_STATE_ACTIVE', { testPurchase: {} });
  assert.equal(evaluateSubscription(purchase, {
    allowedProductIds: configuredProductIds(config),
    requestedProductIds: new Set(['monthly.test']),
    nowMillis,
  }).active, false);
  assert.equal(evaluateSubscription(purchase, {
    allowedProductIds: configuredProductIds(config),
    requestedProductIds: new Set(['monthly.test']),
    allowTestPurchases: true,
    nowMillis,
  }).active, true);
});

test('verify payload only accepts exact package and configured products', () => {
  const valid = validateVerifyPayload({
    packageName: config.packageName,
    purchaseToken: 'token-12345678',
    productIds: ['monthly.test'],
  }, config);
  assert.deepEqual([...valid.requestedProductIds], ['monthly.test']);

  assert.throws(() => validateVerifyPayload({
    packageName: 'other.package',
    purchaseToken: 'token-12345678',
    productIds: ['monthly.test'],
  }, config), ClientInputError);

  assert.throws(() => validateVerifyPayload({
    packageName: config.packageName,
    purchaseToken: 'token-12345678',
    productIds: ['unconfigured'],
  }, config), ClientInputError);
});

test('RTDN decoder accepts subscription events and rejects package mismatch', () => {
  const data = Buffer.from(JSON.stringify({
    version: '1.0',
    packageName: config.packageName,
    eventTimeMillis: '1788652800000',
    subscriptionNotification: {
      version: '1.0',
      notificationType: 2,
      purchaseToken: 'token-12345678',
    },
  })).toString('base64');
  const decoded = decodeRtdnEnvelope({ message: { messageId: 'msg-1', data } }, config.packageName);
  assert.equal(decoded.kind, 'subscription');
  assert.equal(decoded.notificationType, 2);

  const wrongData = Buffer.from(JSON.stringify({ packageName: 'other.package', testNotification: { version: '1.0' } })).toString('base64');
  assert.throws(() => decodeRtdnEnvelope({ message: { messageId: 'msg-2', data: wrongData } }, config.packageName), ClientInputError);
});
