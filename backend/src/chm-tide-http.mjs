import { ClientInputError } from './core.mjs';
import { buildChmTideDelivery } from './chm-tide-pipeline.mjs';
import { ServiceBusyError, createConcurrencyGate } from './resilience.mjs';
import { verifyPurchasePayload } from './server.mjs';

export const CHM_TIDE_HTTP_PATH = '/v1/data/chm/tide';
export const CHM_TIDE_HTTP_CONTRACT = 'PAID_ENTITLEMENT_CHM_TIDE_HTTPS_V1';
export const CHM_TIDE_HTTP_MAX_REQUEST_BYTES = 20_480;
export const CHM_TIDE_HTTP_DEFAULT_MAX_CONCURRENT = 32;

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

function boundedInteger(value, min, max, code) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ClientInputError(code);
  }
  return value;
}

function parseRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ClientInputError('invalid_chm_tide_request');
  }
  const allowed = new Set(['packageName', 'purchaseToken', 'productIds', 'stationNumber', 'calendarYear']);
  if (Object.keys(payload).length !== allowed.size || Object.keys(payload).some((key) => !allowed.has(key))) {
    throw new ClientInputError('invalid_chm_tide_request_shape');
  }
  return Object.freeze({
    entitlement: Object.freeze({
      packageName: payload.packageName,
      purchaseToken: payload.purchaseToken,
      productIds: payload.productIds,
    }),
    stationNumber: boundedInteger(payload.stationNumber, 1, 99, 'invalid_chm_tide_station_number'),
    calendarYear: boundedInteger(payload.calendarYear, 2020, 2100, 'invalid_chm_tide_calendar_year'),
  });
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
  setCommonHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function increment(metrics, name) {
  metrics?.increment?.(name);
}

export function createChmTideHttpHandler(
  delegate,
  {
    config,
    gateway,
    chmTideCache = null,
    metrics = null,
    maxConcurrent = CHM_TIDE_HTTP_DEFAULT_MAX_CONCURRENT,
  } = {},
) {
  if (typeof delegate !== 'function') throw new Error('chm_tide_http_delegate_invalid');
  if (!config || typeof config !== 'object') throw new Error('chm_tide_http_config_invalid');
  if (!gateway || typeof gateway.getSubscription !== 'function') throw new Error('chm_tide_http_gateway_invalid');
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 1_000) {
    throw new Error('chm_tide_http_concurrency_invalid');
  }
  if (chmTideCache !== null && typeof chmTideCache.read !== 'function') {
    throw new Error('chm_tide_http_cache_invalid');
  }

  const gate = createConcurrencyGate({ maxConcurrent });

  return async (req, res) => {
    if (req.url !== CHM_TIDE_HTTP_PATH) return delegate(req, res);

    increment(metrics, 'requests_total');
    try {
      if (req.method !== 'POST') {
        increment(metrics, 'client_error_total');
        sendJson(res, 405, { error: 'method_not_allowed' });
        return;
      }
      if (!isJsonContentType(req)) {
        increment(metrics, 'client_error_total');
        sendJson(res, 415, { error: 'unsupported_media_type' });
        return;
      }

      const payload = parseRequest(await readJson(req, CHM_TIDE_HTTP_MAX_REQUEST_BYTES));
      const delivery = await gate.run(async () => {
        const entitlement = await verifyPurchasePayload(payload.entitlement, { config, gateway });
        if (!entitlement.active) return Object.freeze({ kind: 'denied' });
        if (!chmTideCache) return Object.freeze({ kind: 'unavailable' });

        const reading = chmTideCache.read({
          stationNumber: payload.stationNumber,
          calendarYear: payload.calendarYear,
        });
        if (reading.state !== 'CURRENT' && reading.state !== 'CURRENT_DEGRADED') {
          return Object.freeze({ kind: 'unavailable' });
        }
        return Object.freeze({ kind: 'delivery', body: buildChmTideDelivery(reading) });
      });

      if (delivery.kind === 'denied') {
        increment(metrics, 'chm_tide_denied_total');
        sendJson(res, 403, { error: 'access_denied' });
        return;
      }
      if (delivery.kind === 'unavailable') {
        increment(metrics, 'chm_tide_unavailable_total');
        sendJson(res, 503, { error: 'source_unavailable' });
        return;
      }

      increment(metrics, 'chm_tide_success_total');
      sendJson(res, 200, delivery.body);
    } catch (error) {
      if (error instanceof ClientInputError || error?.message === 'invalid_json' || error?.message === 'request_too_large') {
        increment(metrics, 'client_error_total');
        sendJson(res, 400, { error: 'invalid_request' });
        return;
      }
      if (error instanceof ServiceBusyError) {
        increment(metrics, 'chm_tide_busy_total');
        res.setHeader('Retry-After', '1');
        sendJson(res, 503, { error: 'temporarily_unavailable' });
        return;
      }
      increment(metrics, 'server_error_total');
      increment(metrics, 'chm_tide_unavailable_total');
      console.error('chm_tide_request_failed');
      sendJson(res, 503, { error: 'source_unavailable' });
    }
  };
}
