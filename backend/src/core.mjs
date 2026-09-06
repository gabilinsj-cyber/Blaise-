const ENTITLED_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
]);

const MAX_TOKEN_LENGTH = 8_192;
const MAX_PRODUCT_ID_LENGTH = 256;

export class ClientInputError extends Error {}

export function configuredProductIds(config) {
  return new Set([config.monthlyProductId, config.annualProductId].filter(Boolean));
}

export function validateVerifyPayload(payload, config) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ClientInputError('invalid_payload');
  }
  if (payload.packageName !== config.packageName) {
    throw new ClientInputError('package_mismatch');
  }
  if (typeof payload.purchaseToken !== 'string' || payload.purchaseToken.length < 8 || payload.purchaseToken.length > MAX_TOKEN_LENGTH) {
    throw new ClientInputError('invalid_purchase_token');
  }
  if (!Array.isArray(payload.productIds) || payload.productIds.length < 1 || payload.productIds.length > 2) {
    throw new ClientInputError('invalid_product_ids');
  }

  const allowed = configuredProductIds(config);
  const productIds = new Set();
  for (const value of payload.productIds) {
    if (typeof value !== 'string' || value.length < 1 || value.length > MAX_PRODUCT_ID_LENGTH || !allowed.has(value)) {
      throw new ClientInputError('unrecognized_product');
    }
    productIds.add(value);
  }
  if (productIds.size === 0) throw new ClientInputError('invalid_product_ids');

  return {
    purchaseToken: payload.purchaseToken,
    requestedProductIds: productIds,
  };
}

export function evaluateSubscription(subscription, options) {
  const {
    allowedProductIds,
    requestedProductIds = allowedProductIds,
    allowTestPurchases = false,
    nowMillis = Date.now(),
  } = options;

  if (!subscription || typeof subscription !== 'object') return inactive('missing');
  if (subscription.testPurchase && !allowTestPurchases) return inactive('test_purchase_blocked');

  const state = subscription.subscriptionState;
  if (!ENTITLED_STATES.has(state)) return inactive('state_not_entitled');

  const lines = Array.isArray(subscription.lineItems) ? subscription.lineItems : [];
  const matching = lines.filter((line) => {
    if (!line || typeof line !== 'object') return false;
    if (!allowedProductIds.has(line.productId) || !requestedProductIds.has(line.productId)) return false;
    const expiryMillis = Date.parse(line.expiryTime || '');
    return Number.isFinite(expiryMillis) && expiryMillis > nowMillis;
  });

  if (matching.length === 0) return inactive('no_live_matching_line_item');

  const first = matching[0];
  return {
    active: true,
    productId: first.productId,
    expiryTime: first.expiryTime,
    acknowledgementPending: subscription.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
  };
}

function inactive(reason) {
  return { active: false, reason, acknowledgementPending: false };
}

export function decodeRtdnEnvelope(envelope, expectedPackageName) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new ClientInputError('invalid_pubsub_envelope');
  }
  const message = envelope.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new ClientInputError('invalid_pubsub_message');
  }
  const messageId = message.messageId;
  if (typeof messageId !== 'string' || messageId.length < 1 || messageId.length > 256) {
    throw new ClientInputError('invalid_pubsub_message_id');
  }
  const encoded = message.data;
  if (typeof encoded !== 'string' || encoded.length < 4 || encoded.length > 65_536 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new ClientInputError('invalid_pubsub_data');
  }

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    throw new ClientInputError('invalid_rtdn_json');
  }
  if (!decoded || typeof decoded !== 'object' || decoded.packageName !== expectedPackageName) {
    throw new ClientInputError('rtdn_package_mismatch');
  }

  if (decoded.testNotification) {
    return { messageId, kind: 'test', purchaseToken: null, notificationType: null };
  }

  const subscription = decoded.subscriptionNotification;
  if (!subscription) {
    return { messageId, kind: 'ignored', purchaseToken: null, notificationType: null };
  }
  if (typeof subscription.purchaseToken !== 'string' || subscription.purchaseToken.length < 8 || subscription.purchaseToken.length > MAX_TOKEN_LENGTH) {
    throw new ClientInputError('invalid_rtdn_purchase_token');
  }
  if (!Number.isInteger(subscription.notificationType)) {
    throw new ClientInputError('invalid_rtdn_notification_type');
  }

  return {
    messageId,
    kind: 'subscription',
    purchaseToken: subscription.purchaseToken,
    notificationType: subscription.notificationType,
  };
}
