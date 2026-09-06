import http from 'node:http';
import { pathToFileURL } from 'node:url';
import {
  ClientInputError,
  configuredProductIds,
  decodeRtdnEnvelope,
  evaluateSubscription,
  validateVerifyPayload,
} from './core.mjs';

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const MAX_REQUEST_BYTES = 16_384;
const DEFAULT_REPLAY_TTL_MILLIS = 24 * 60 * 60 * 1_000;
const DEFAULT_REPLAY_MAX_ENTRIES = 4_096;

export function loadConfig(env = process.env) {
  const packageName = (env.BLAISE_ANDROID_PACKAGE || 'br.com.blaise.rj').trim();
  const monthlyProductId = (env.BLAISE_MONTHLY_PRODUCT_ID || '').trim();
  const annualProductId = (env.BLAISE_ANNUAL_PRODUCT_ID || '').trim();
  if (!packageName || !monthlyProductId || !annualProductId || monthlyProductId === annualProductId) {
    throw new Error('production_billing_configuration_missing');
  }
  return {
    packageName,
    monthlyProductId,
    annualProductId,
    allowTestPurchases: env.BLAISE_ALLOW_TEST_PURCHASES === 'true',
    pubsubAudience: (env.BLAISE_PUBSUB_AUDIENCE || '').trim(),
    pubsubServiceAccount: (env.BLAISE_PUBSUB_SERVICE_ACCOUNT || '').trim(),
    port: Number.parseInt(env.PORT || '8080', 10),
  };
}

export function createRtdnReplayGuard({
  maxEntries = DEFAULT_REPLAY_MAX_ENTRIES,
  ttlMillis = DEFAULT_REPLAY_TTL_MILLIS,
} = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || !Number.isFinite(ttlMillis) || ttlMillis < 1) {
    throw new Error('invalid_replay_guard_configuration');
  }

  const seen = new Map();
  const prune = (nowMillis) => {
    for (const [messageId, expiresAt] of seen) {
      if (expiresAt <= nowMillis) seen.delete(messageId);
    }
  };

  return {
    has(messageId, nowMillis = Date.now()) {
      prune(nowMillis);
      return seen.has(messageId);
    },
    mark(messageId, nowMillis = Date.now()) {
      prune(nowMillis);
      if (seen.has(messageId)) seen.delete(messageId);
      while (seen.size >= maxEntries) {
        const oldest = seen.keys().next().value;
        if (oldest === undefined) break;
        seen.delete(oldest);
      }
      seen.set(messageId, nowMillis + ttlMillis);
    },
    get size() {
      return seen.size;
    },
  };
}

export async function createGooglePlayGateway(config) {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: [ANDROID_PUBLISHER_SCOPE] });
  let clientPromise;
  const authClient = () => (clientPromise ??= auth.getClient());

  return {
    async getSubscription(purchaseToken) {
      const client = await authClient();
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
      try {
        const response = await client.request({ url, method: 'GET', timeout: 7_000 });
        return response.data;
      } catch (error) {
        const status = error?.response?.status;
        if (status === 404 || status === 410) return null;
        throw new Error('google_play_lookup_failed');
      }
    },

    async acknowledge(purchaseToken, productId) {
      const client = await authClient();
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
      try {
        await client.request({ url, method: 'POST', data: {}, timeout: 7_000 });
      } catch {
        throw new Error('google_play_acknowledge_failed');
      }
    },
  };
}

export async function createPubSubOidcVerifier(config) {
  if (!config.pubsubAudience || !config.pubsubServiceAccount) return null;
  const { OAuth2Client } = await import('google-auth-library');
  const client = new OAuth2Client();
  return async (authorizationHeader) => {
    if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Bearer ')) return false;
    const idToken = authorizationHeader.slice('Bearer '.length).trim();
    if (!idToken) return false;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: config.pubsubAudience });
      const payload = ticket.getPayload();
      return Boolean(
        payload &&
        payload.aud === config.pubsubAudience &&
        payload.email === config.pubsubServiceAccount &&
        payload.email_verified !== false,
      );
    } catch {
      return false;
    }
  };
}

export async function verifyPurchasePayload(payload, { config, gateway, nowMillis = Date.now() }) {
  const validated = validateVerifyPayload(payload, config);
  const subscription = await gateway.getSubscription(validated.purchaseToken);
  let decision = evaluateSubscription(subscription, {
    allowedProductIds: configuredProductIds(config),
    requestedProductIds: validated.requestedProductIds,
    allowTestPurchases: config.allowTestPurchases,
    nowMillis,
  });
  if (!decision.active) return { active: false };

  if (decision.acknowledgementPending) {
    try {
      await gateway.acknowledge(validated.purchaseToken, decision.productId);
    } catch {
      const refreshed = await gateway.getSubscription(validated.purchaseToken);
      decision = evaluateSubscription(refreshed, {
        allowedProductIds: configuredProductIds(config),
        requestedProductIds: validated.requestedProductIds,
        allowTestPurchases: config.allowTestPurchases,
        nowMillis,
      });
      if (!decision.active || decision.acknowledgementPending) {
        throw new Error('acknowledgement_not_confirmed');
      }
    }
  }

  return { active: true };
}

export async function processRtdnPayload(
  payload,
  { config, gateway, nowMillis = Date.now(), replayGuard = null },
) {
  const event = decodeRtdnEnvelope(payload, config.packageName);
  if (replayGuard?.has(event.messageId, nowMillis)) return 'duplicate';

  if (event.kind !== 'subscription') {
    replayGuard?.mark(event.messageId, nowMillis);
    return event.kind;
  }

  const subscription = await gateway.getSubscription(event.purchaseToken);
  const decision = evaluateSubscription(subscription, {
    allowedProductIds: configuredProductIds(config),
    requestedProductIds: configuredProductIds(config),
    allowTestPurchases: config.allowTestPurchases,
    nowMillis,
  });

  if (decision.active && decision.acknowledgementPending) {
    try {
      await gateway.acknowledge(event.purchaseToken, decision.productId);
    } catch {
      const refreshed = await gateway.getSubscription(event.purchaseToken);
      const refreshedDecision = evaluateSubscription(refreshed, {
        allowedProductIds: configuredProductIds(config),
        requestedProductIds: configuredProductIds(config),
        allowTestPurchases: config.allowTestPurchases,
        nowMillis,
      });
      if (!refreshedDecision.active || refreshedDecision.acknowledgementPending) {
        throw new Error('rtdn_acknowledgement_not_confirmed');
      }
    }
  }

  replayGuard?.mark(event.messageId, nowMillis);
  return 'subscription';
}

export function createHttpHandler({
  config,
  gateway,
  oidcVerifier,
  replayGuard = createRtdnReplayGuard(),
}) {
  return async (req, res) => {
    setCommonHeaders(res);
    try {
      if (req.method === 'GET' && req.url === '/healthz') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/entitlements/verify') {
        if (!isJsonContentType(req)) {
          sendJson(res, 415, { error: 'unsupported_media_type' });
          return;
        }
        const payload = await readJson(req, MAX_REQUEST_BYTES);
        const result = await verifyPurchasePayload(payload, { config, gateway });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/google-play/rtdn') {
        if (!oidcVerifier) {
          sendJson(res, 503, { error: 'rtdn_not_configured' });
          return;
        }
        if (!(await oidcVerifier(req.headers.authorization))) {
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        if (!isJsonContentType(req)) {
          sendJson(res, 415, { error: 'unsupported_media_type' });
          return;
        }
        const payload = await readJson(req, MAX_REQUEST_BYTES * 4);
        await processRtdnPayload(payload, { config, gateway, replayGuard });
        res.statusCode = 204;
        res.end();
        return;
      }

      sendJson(res, 404, { error: 'not_found' });
    } catch (error) {
      if (error instanceof ClientInputError || error?.message === 'invalid_json' || error?.message === 'request_too_large') {
        sendJson(res, 400, { error: 'invalid_request' });
      } else {
        console.error('request_failed');
        sendJson(res, 503, { error: 'verification_unavailable' });
      }
    }
  };
}

function isJsonContentType(req) {
  const value = req.headers['content-type'];
  if (typeof value !== 'string') return false;
  return value.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

async function readJson(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('invalid_json');
  }
}

function setCommonHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function main() {
  const config = loadConfig();
  const gateway = await createGooglePlayGateway(config);
  const oidcVerifier = await createPubSubOidcVerifier(config);
  const replayGuard = createRtdnReplayGuard();
  const server = http.createServer(createHttpHandler({ config, gateway, oidcVerifier, replayGuard }));
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 5_000;
  server.listen(config.port, '0.0.0.0', () => console.log(`blaise_entitlement_backend_listening:${config.port}`));
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch(() => {
    console.error('startup_failed');
    process.exitCode = 1;
  });
}
