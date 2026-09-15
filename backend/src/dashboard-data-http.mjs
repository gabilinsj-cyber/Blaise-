import { ALERTA_RIO_EXPECTED_ACTIVE_STATIONS, ALERTA_RIO_LIVE_SOURCE_ID } from './alerta-rio-source.mjs';
import { ClientInputError } from './core.mjs';
import { ALERTA_RIO_RAINFALL_TASK_ID } from './official-source-worker.mjs';
import { ServiceBusyError, createConcurrencyGate } from './resilience.mjs';
import { verifyPurchasePayload } from './server.mjs';

export const DASHBOARD_DATA_HTTP_PATH = '/v1/data/dashboard';
export const DASHBOARD_DATA_HTTP_CONTRACT = 'PAID_OFFICIAL_DASHBOARD_SNAPSHOT_V1';
export const DASHBOARD_DATA_HTTP_MAX_REQUEST_BYTES = 16_384;
export const DASHBOARD_DATA_HTTP_MAX_RESPONSE_BYTES = 64 * 1024;
export const DASHBOARD_DATA_HTTP_DEFAULT_MAX_CONCURRENT = 32;
export const DASHBOARD_RAINFALL_COVERAGE = 'RIO_CITY_ALERTA_RIO_STATIONS';

const CURRENT_STATES = new Set(['CURRENT', 'CURRENT_DEGRADED']);

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

function parseRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ClientInputError('invalid_dashboard_request');
  }
  const allowed = new Set(['packageName', 'purchaseToken', 'productIds']);
  const keys = Object.keys(payload);
  if (keys.length !== allowed.size || keys.some((key) => !allowed.has(key))) {
    throw new ClientInputError('invalid_dashboard_request_shape');
  }
  return Object.freeze({
    packageName: payload.packageName,
    purchaseToken: payload.purchaseToken,
    productIds: payload.productIds,
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
  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, 'utf8') > DASHBOARD_DATA_HTTP_MAX_RESPONSE_BYTES) {
    throw new Error('dashboard_response_too_large');
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(serialized);
}

function increment(metrics, name) {
  metrics?.increment?.(name);
}

function safeFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function maxNullable(values) {
  const finite = values.filter((value) => Number.isFinite(value) && value >= 0);
  return finite.length === 0 ? null : Math.max(...finite);
}

function projectSourceState(source) {
  if (!source || typeof source !== 'object') return null;
  if (typeof source.sourceId !== 'string' || typeof source.state !== 'string' || typeof source.reason !== 'string') {
    return null;
  }
  return Object.freeze({
    sourceId: source.sourceId,
    state: source.state,
    reason: source.reason,
    fetchedAt: typeof source.fetchedAt === 'string' ? source.fetchedAt : null,
    observedAt: typeof source.observedAt === 'string' ? source.observedAt : null,
    dataAgeMs: safeFiniteNonNegative(source.dataAgeMs),
    cacheAgeMs: safeFiniteNonNegative(source.cacheAgeMs),
    semanticValidity: typeof source.semanticValidity === 'string' ? source.semanticValidity : null,
  });
}

function summarizeAlertaRioRainfall(reading) {
  if (!reading || !CURRENT_STATES.has(reading.state) || !reading.snapshot) return null;
  const snapshot = reading.snapshot;
  if (snapshot.sourceId !== ALERTA_RIO_LIVE_SOURCE_ID
      || !Array.isArray(snapshot.stations)
      || snapshot.stationCount !== ALERTA_RIO_EXPECTED_ACTIVE_STATIONS
      || snapshot.stations.length !== ALERTA_RIO_EXPECTED_ACTIVE_STATIONS
      || typeof snapshot.freshestObservedAt !== 'string'
      || !Number.isFinite(Date.parse(snapshot.freshestObservedAt))) {
    return null;
  }

  const stations = snapshot.stations;
  const max15mMm = maxNullable(stations.map((station) => station?.rain15mMm));
  const max1hMm = maxNullable(stations.map((station) => station?.rain1hMm));
  const max24hMm = maxNullable(stations.map((station) => station?.rain24hMm));
  const wetStationCount = stations.reduce(
    (total, station) => total + (Number.isFinite(station?.rain15mMm) && station.rain15mMm > 0 ? 1 : 0),
    0,
  );

  return Object.freeze({
    sourceId: snapshot.sourceId,
    coverage: DASHBOARD_RAINFALL_COVERAGE,
    state: reading.state,
    reason: reading.reason,
    observedAt: snapshot.freshestObservedAt,
    fetchedAt: reading.fetchedAt,
    stationCount: snapshot.stationCount,
    wetStationCount,
    missingValueCount: Number.isInteger(snapshot.missingValueCount) ? snapshot.missingValueCount : null,
    max15mMm,
    max1hMm,
    max24hMm,
  });
}

export function buildPaidDashboardSnapshot(sourceWorker, { nowMillis = Date.now() } = {}) {
  if (!sourceWorker || typeof sourceWorker.status !== 'function' || typeof sourceWorker.readSource !== 'function') {
    throw new Error('dashboard_source_worker_invalid');
  }
  if (!Number.isFinite(nowMillis) || nowMillis < 0) throw new Error('dashboard_clock_invalid');

  const status = sourceWorker.status();
  if (!status || status.enabled !== true || status.started !== true) return null;

  let rainfallReading;
  try {
    rainfallReading = sourceWorker.readSource(ALERTA_RIO_RAINFALL_TASK_ID);
  } catch {
    return null;
  }
  const rainfall = summarizeAlertaRioRainfall(rainfallReading);
  if (!rainfall) return null;

  const sources = Array.isArray(status.sources)
    ? status.sources.map(projectSourceState).filter(Boolean)
    : [];
  const currentSourceCount = sources.filter((source) => CURRENT_STATES.has(source.state)).length;

  return Object.freeze({
    contract: DASHBOARD_DATA_HTTP_CONTRACT,
    generatedAt: new Date(nowMillis).toISOString(),
    mode: status.mode === 'severe' ? 'severe' : 'normal',
    scope: 'RJ_OFFICIAL_SOURCES_WITH_RIO_CITY_RAINFALL',
    sourceCount: sources.length,
    currentSourceCount,
    rainfall,
    sources: Object.freeze(sources),
    privacy: Object.freeze({
      purchaseTokenExposed: false,
      rawStationPayloadExposed: false,
      userLocationStored: false,
    }),
  });
}

export function createPaidDashboardDataHttpHandler(
  delegate,
  {
    config,
    gateway,
    sourceWorker,
    metrics = null,
    maxConcurrent = DASHBOARD_DATA_HTTP_DEFAULT_MAX_CONCURRENT,
  } = {},
) {
  if (typeof delegate !== 'function') throw new Error('dashboard_http_delegate_invalid');
  if (!config || typeof config !== 'object') throw new Error('dashboard_http_config_invalid');
  if (!gateway || typeof gateway.getSubscription !== 'function') throw new Error('dashboard_http_gateway_invalid');
  if (!sourceWorker || typeof sourceWorker.status !== 'function' || typeof sourceWorker.readSource !== 'function') {
    throw new Error('dashboard_http_source_worker_invalid');
  }
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 1_000) {
    throw new Error('dashboard_http_concurrency_invalid');
  }

  const gate = createConcurrencyGate({ maxConcurrent });

  return async (req, res) => {
    if (req.url !== DASHBOARD_DATA_HTTP_PATH) return delegate(req, res);

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

      const payload = parseRequest(await readJson(req, DASHBOARD_DATA_HTTP_MAX_REQUEST_BYTES));
      const result = await gate.run(async () => {
        const entitlement = await verifyPurchasePayload(payload, { config, gateway });
        if (!entitlement.active) return Object.freeze({ kind: 'denied' });
        const snapshot = buildPaidDashboardSnapshot(sourceWorker);
        return snapshot
          ? Object.freeze({ kind: 'snapshot', snapshot })
          : Object.freeze({ kind: 'unavailable' });
      });

      if (result.kind === 'denied') {
        increment(metrics, 'dashboard_denied_total');
        sendJson(res, 403, { error: 'access_denied' });
        return;
      }
      if (result.kind === 'unavailable') {
        increment(metrics, 'dashboard_unavailable_total');
        sendJson(res, 503, { error: 'source_unavailable' });
        return;
      }

      increment(metrics, 'dashboard_success_total');
      sendJson(res, 200, result.snapshot);
    } catch (error) {
      if (error instanceof ClientInputError || error?.message === 'invalid_json' || error?.message === 'request_too_large') {
        increment(metrics, 'client_error_total');
        sendJson(res, 400, { error: 'invalid_request' });
        return;
      }
      if (error instanceof ServiceBusyError) {
        increment(metrics, 'dashboard_busy_total');
        res.setHeader('Retry-After', '1');
        sendJson(res, 503, { error: 'temporarily_unavailable' });
        return;
      }
      increment(metrics, 'server_error_total');
      increment(metrics, 'dashboard_unavailable_total');
      console.error('dashboard_data_request_failed');
      sendJson(res, 503, { error: 'source_unavailable' });
    }
  };
}
