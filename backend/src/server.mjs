import http from 'node:http';
import { pathToFileURL } from 'node:url';
import {
  ClientInputError,
  configuredProductIds,
  decodeRtdnEnvelope,
  evaluateSubscription,
  validateVerifyPayload,
} from './core.mjs';
import { buildP0TopicMessage, createFcmGateway } from './fcm.mjs';
import { createOperationalMetrics } from './observability.mjs';
import {
  ServiceBusyError,
  createConcurrencyGate,
  retryTransient,
} from './resilience.mjs';

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const MAX_REQUEST_BYTES = 16_384;
const DEFAULT_REPLAY_TTL_MILLIS = 24 * 60 * 60 * 1_000;
const DEFAULT_REPLAY_MAX_ENTRIES = 4_096;
const DEFAULT_VERIFY_MAX_CONCURRENT = 128;
const DEFAULT_RTDN_MAX_CONCURRENT = 64;
const DEFAULT_P0_MAX_CONCURRENT = 32;

export function loadConfig(env = process.env) {
  const packageName = (env.BLAISE_ANDROID_PACKAGE || 'br.com.blaise.rj').trim();
  const monthlyProductId = (env.BLAISE_MONTHLY_PRODUCT_ID || '').trim();
  const annualProductId = (env.BLAISE_ANNUAL_PRODUCT_ID || '').trim();
  if (!packageName || !monthlyProductId || !annualProductId || monthlyProductId === annualProductId) {
    throw new Error('production_billing_configuration_missing');
  }

  const pubsubAudience = (env.BLAISE_PUBSUB_AUDIENCE || '').trim();
  const pubsubServiceAccount = (env.BLAISE_PUBSUB_SERVICE_ACCOUNT || '').trim();
  const p0Audience = (env.BLAISE_P0_AUDIENCE || '').trim();
  const p0ServiceAccount = (env.BLAISE_P0_SERVICE_ACCOUNT || '').trim();
  const observabilityAudience = (env.BLAISE_OBSERVABILITY_AUDIENCE || '').trim();
  const observabilityServiceAccount = (env.BLAISE_OBSERVABILITY_SERVICE_ACCOUNT || '').trim();
  requirePair(pubsubAudience, pubsubServiceAccount, 'pubsub_oidc_configuration_incomplete');
  requirePair(p0Audience, p0ServiceAccount, 'p0_oidc_configuration_incomplete');
  requirePair(observabilityAudience, observabilityServiceAccount, 'observability_oidc_configuration_incomplete');

  return {
    packageName,
    monthlyProductId,
    annualProductId,
    allowTestPurchases: env.BLAISE_ALLOW_TEST_PURCHASES === 'true',
    pubsubAudience,
    pubsubServiceAccount,
    p0Audience,
    p0ServiceAccount,
    observabilityAudience,
    observabilityServiceAccount,
    firebaseProjectId: (env.BLAISE_FIREBASE_PROJECT_ID || '').trim(),
    fcmP0Topic: (env.BLAISE_FCM_P0_TOPIC || '').trim(),
    verifyMaxConcurrent: positiveIntEnv(
      env.BLAISE_VERIFY_MAX_CONCURRENT,
      DEFAULT_VERIFY_MAX_CONCURRENT,
      'invalid_verify_concurrency',
    ),
    rtdnMaxConcurrent: positiveIntEnv(
      env.BLAISE_RTDN_MAX_CONCURRENT,
      DEFAULT_RTDN_MAX_CONCURRENT,
      'invalid_rtdn_concurrency',
    ),
    p0MaxConcurrent: positiveIntEnv(
      env.BLAISE_P0_MAX_CONCURRENT,
      DEFAULT_P0_MAX_CONCURRENT,
      'invalid_p0_concurrency',
    ),
    port: positiveIntEnv(env.PORT, 8080, 'invalid_port', 65_535),
  };
}

function requirePair(first, second, errorCode) {
  if (Boolean(first) !== Boolean(second)) throw new Error(errorCode);
}

function positiveIntEnv(value, fallback, errorCode, max = 10_000) {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || String(parsed) !== String(value).trim() || parsed < 1 || parsed > max) {
    throw new Error(errorCode);
  }
  return parsed;
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

export async function createGooglePlayGateway(config, { onRetry = () => {} } = {}) {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: [ANDROID_PUBLISHER_SCOPE] });
  let clientPromise;
  const authClient = () => (clientPromise ??= auth.getClient());

  return {
    async getSubscription(purchaseToken) {
      const client = await authClient();
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
      try {
        const response = await retryTransient(
          () => client.request({ url, method: 'GET', timeout: 7_000 }),
          { onRetry },
        );
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
        await retryTransient(
          () => client.request({ url, method: 'POST', data: {}, timeout: 7_000 }),
          { onRetry },
        );
      } catch {
        throw new Error('google_play_acknowledge_failed');
      }
    },
  };
}

export async function createServiceOidcVerifier(audience, serviceAccount) {
  if (!audience && !serviceAccount) return null;
  if (!audience || !serviceAccount) throw new Error('oidc_configuration_incomplete');
  const { OAuth2Client } = await import('google-auth-library');
  const client = new OAuth2Client();
  return async (authorizationHeader) => {
    if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Bearer ')) return false;
    const idToken = authorizationHeader.slice('Bearer '.length).trim();
    if (!idToken) return false;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      return Boolean(
        payload &&
        payload.email === serviceAccount &&
        payload.email_verified !== false,
      );
    } catch {
      return false;
    }
  };
}

export async function createPubSubOidcVerifier(config) {
  return createServiceOidcVerifier(config.pubsubAudience, config.pubsubServiceAccount);
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
  fcmGateway = null,
  p0OidcVerifier = null,
  metricsOidcVerifier = null,
  metrics = createOperationalMetrics(),
  replayGuard = createRtdnReplayGuard(),
  p0ReplayGuard = createRtdnReplayGuard(),
  verifyGate = createConcurrencyGate({ maxConcurrent: config.verifyMaxConcurrent ?? DEFAULT_VERIFY_MAX_CONCURRENT }),
  rtdnGate = createConcurrencyGate({ maxConcurrent: config.rtdnMaxConcurrent ?? DEFAULT_RTDN_MAX_CONCURRENT }),
  p0Gate = createConcurrencyGate({ maxConcurrent: config.p0MaxConcurrent ?? DEFAULT_P0_MAX_CONCURRENT }),
}) {
  return async (req, res) => {
    setCommonHeaders(res);
    metrics.increment('requests_total');
    let busyRoute = '';
    try {
      if (req.method === 'GET' && req.url === '/healthz') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'GET' && req.url === '/readyz') {
        sendJson(res, 200, { status: 'ready' });
        return;
      }

      if (req.method === 'GET' && req.url === '/internal/metrics') {
        if (!metricsOidcVerifier) {
          sendJson(res, 404, { error: 'not_found' });
          return;
        }
        if (!(await metricsOidcVerifier(req.headers.authorization))) {
          metrics.increment('auth_rejected_total');
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        sendJson(res, 200, metrics.snapshot({
          verifyGate,
          rtdnGate,
          p0Gate,
          rtdnReplayGuard: replayGuard,
          p0ReplayGuard,
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/entitlements/verify') {
        busyRoute = 'verify';
        if (!isJsonContentType(req)) {
          metrics.increment('client_error_total');
          sendJson(res, 415, { error: 'unsupported_media_type' });
          return;
        }
        const payload = await readJson(req, MAX_REQUEST_BYTES);
        const result = await verifyGate.run(() => verifyPurchasePayload(payload, { config, gateway }));
        metrics.increment(result.active ? 'verify_active_total' : 'verify_denied_total');
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/google-play/rtdn') {
        busyRoute = 'rtdn';
        if (!oidcVerifier) {
          metrics.increment('server_error_total');
          sendJson(res, 503, { error: 'rtdn_not_configured' });
          return;
        }
        if (!(await oidcVerifier(req.headers.authorization))) {
          metrics.increment('auth_rejected_total');
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        if (!isJsonContentType(req)) {
          metrics.increment('client_error_total');
          sendJson(res, 415, { error: 'unsupported_media_type' });
          return;
        }
        const payload = await readJson(req, MAX_REQUEST_BYTES * 4);
        const outcome = await rtdnGate.run(() => processRtdnPayload(payload, { config, gateway, replayGuard }));
        metrics.increment(outcome === 'duplicate' ? 'rtdn_duplicate_total' : 'rtdn_success_total');
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/internal/p0') {
        busyRoute = 'p0';
        if (!p0OidcVerifier || !fcmGateway) {
          metrics.increment('p0_rejected_total');
          sendJson(res, 503, { error: 'p0_not_configured' });
          return;
        }
        if (!(await p0OidcVerifier(req.headers.authorization))) {
          metrics.increment('auth_rejected_total');
          metrics.increment('p0_rejected_total');
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        if (!isJsonContentType(req)) {
          metrics.increment('client_error_total');
          metrics.increment('p0_rejected_total');
          sendJson(res, 415, { error: 'unsupported_media_type' });
          return;
        }
        const payload = await readJson(req, MAX_REQUEST_BYTES);
        const preview = buildP0TopicMessage(payload, config);
        const alertId = preview.message.data.alertId;
        if (p0ReplayGuard.has(alertId)) {
          metrics.increment('p0_duplicate_total');
          sendJson(res, 202, { accepted: true, duplicate: true });
          return;
        }
        await p0Gate.run(() => fcmGateway.publishOfficialP0(payload));
        p0ReplayGuard.mark(alertId);
        metrics.increment('p0_publish_success_total');
        sendJson(res, 202, { accepted: true });
        return;
      }

      metrics.increment('client_error_total');
      sendJson(res, 404, { error: 'not_found' });
    } catch (error) {
      if (error instanceof ClientInputError || error?.message === 'invalid_json' || error?.message === 'request_too_large') {
        metrics.increment('client_error_total');
        if (busyRoute === 'p0') metrics.increment('p0_rejected_total');
        sendJson(res, 400, { error: 'invalid_request' });
      } else if (error instanceof ServiceBusyError) {
        if (busyRoute === 'verify') metrics.increment('verify_busy_total');
        if (busyRoute === 'rtdn') metrics.increment('rtdn_busy_total');
        if (busyRoute === 'p0') metrics.increment('p0_busy_total');
        res.setHeader('Retry-After', '1');
        sendJson(res, 503, { error: 'temporarily_unavailable' });
      } else {
        metrics.increment('server_error_total');
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
  const metrics = createOperationalMetrics();
  const gateway = await createGooglePlayGateway(config, {
    onRetry: () => metrics.increment('google_play_retry_total'),
  });
  const oidcVerifier = await createServiceOidcVerifier(config.pubsubAudience, config.pubsubServiceAccount);
  const p0OidcVerifier = await createServiceOidcVerifier(config.p0Audience, config.p0ServiceAccount);
  const metricsOidcVerifier = await createServiceOidcVerifier(
    config.observabilityAudience,
    config.observabilityServiceAccount,
  );
  const fcmGateway = config.firebaseProjectId
    ? await createFcmGateway(config, { onRetry: () => metrics.increment('fcm_retry_total') })
    : null;
  const replayGuard = createRtdnReplayGuard();
  const p0ReplayGuard = createRtdnReplayGuard();
  const server = http.createServer(createHttpHandler({
    config,
    gateway,
    oidcVerifier,
    fcmGateway,
    p0OidcVerifier,
    metricsOidcVerifier,
    metrics,
    replayGuard,
    p0ReplayGuard,
  }));
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
