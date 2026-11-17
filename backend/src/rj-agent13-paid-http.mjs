/**
 * Optional paid, explicitly requested Agent 13 estimate.
 * No automatic polling, no user coordinates, no provider key in responses.
 * Only calibrated reference points are eligible; the other RJ municipalities
 * continue to use approved official sources until validated coordinates exist.
 */
import { ClientInputError } from './core.mjs';
import { verifyPurchasePayload } from './server.mjs';
import { requireSubscriberUid } from './firebase-subscriber-auth-rj.mjs';
import { ServiceBusyError, createConcurrencyGate } from './resilience.mjs';
import { findRjMunicipality } from './rio-municipalities.mjs';

export const AGENT13_PAID_HTTP_PATH = '/v1/data/agent13/current';
export const AGENT13_PAID_HTTP_CONTRACT = 'BLAISE_RJ_AGENT13_PAID_CURRENT_V1';
export const AGENT13_PAID_MAX_CURRENT_AGE_MS = 12 * 60_000;
export const AGENT13_PAID_MAX_REQUEST_BYTES = 4_096;

/** Approximate municipal reference points, not weather-station locations. */
const CALIBRATED_TARGETS = new Map([
  ['3304557', Object.freeze({ibge: '3304557', latitude: -22.9068, longitude: -43.1729})],
  ['3303302', Object.freeze({ibge: '3303302', latitude: -22.8833, longitude: -43.1036})],
]);

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > AGENT13_PAID_MAX_REQUEST_BYTES) throw new ClientInputError('agent13_request_too_large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ClientInputError('agent13_invalid_json'); }
}
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new ClientInputError('agent13_invalid_payload');
  const keys = Object.keys(payload).sort();
  if (JSON.stringify(keys)!==JSON.stringify(['municipalityIbge','packageName','productIds','purchaseToken']))
    throw new ClientInputError('agent13_invalid_shape');
  if (!Number.isInteger(payload.municipalityIbge))
    throw new ClientInputError('agent13_invalid_municipality');
  const ibge = String(payload.municipalityIbge);
  if (!findRjMunicipality(ibge)) throw new ClientInputError('agent13_invalid_municipality');
  return {
    payload: {
      packageName: payload.packageName,
      purchaseToken: payload.purchaseToken,
      productIds: payload.productIds,
    },
    ibge,
  };
}
function bounded(value, low, high) {
  return typeof value === 'number' && Number.isFinite(value) &&
    value >= low && value <= high ? value : null;
}
export function projectAgent13CurrentEstimate(collectorResult, ibge, now = Date.now()) {
  if (collectorResult?.status !== 'CURRENT_ESTIMATE_AVAILABLE') return null;
  const data = collectorResult.weather;
  if (data?.status !== 'AVAILABLE_PROVIDER_CURRENT_ESTIMATE' ||
      data.sourceId !== 'OPENWEATHER_ONECALL4_CURRENT' ||
      data.ibge !== ibge ||
      data.type !== 'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT' ||
      data.officialObservation !== false ||
      data.officialAlert !== false) return null;
  const validMs = Date.parse(data.validAt);
  const fetchedMs = Date.parse(data.retrievedAt);
  if (!Number.isFinite(validMs) || !Number.isFinite(fetchedMs) ||
      validMs > now || now - validMs > AGENT13_PAID_MAX_CURRENT_AGE_MS ||
      fetchedMs > now || fetchedMs < validMs - 60_000 ||
      now - fetchedMs > AGENT13_PAID_MAX_CURRENT_AGE_MS) return null;
  const values = data.values;
  const temperatureC = bounded(values?.temperatureC, -60, 65);
  if (temperatureC === null) return null;
  return Object.freeze({
    contract: AGENT13_PAID_HTTP_CONTRACT,
    status: 'CURRENT_ESTIMATE_AVAILABLE',
    ibge,
    source: 'OpenWeather One Call 4.0',
    nature: 'ESTIMATIVA_DE_MODELO',
    sourceUrl: 'https://openweathermap.org/api/one-call-4',
    validAt: data.validAt,
    retrievedAt: data.retrievedAt,
    maximumAgeSeconds: 720,
    values: Object.freeze({
      temperatureC,
      feelsLikeC: bounded(values.providerFeelsLikeC, -80, 80),
      humidityPercent: bounded(values.relativeHumidityPct, 0, 100),
      windKmh: bounded(values.windKmh, 0, 400),
      gustKmh: bounded(values.gustKmh, 0, 504),
      pressureHpa: bounded(values.pressureHpa, 800, 1150),
      rainMm1h: bounded(values.rainMm1h, 0, 500),
    }),
    officialObservation: false,
    officialAlert: false,
    privacy: Object.freeze({ purchaseTokenExposed: false, userLocationStored: false }),
  });
}

/**
 * Wraps core/dash handlers; no privileged route or provider call unless purchase
 * and, where required, Firebase UID are successfully validated.
 */
export function createPaidAgent13HttpHandler(delegate, {
  config, gateway, subscriberVerifier = null,
  agent13Runtime, maxConcurrent = 8, clock = () => Date.now(),
} = {}) {
  if (typeof delegate !== 'function' || !config || !gateway ||
      typeof gateway.getSubscription !== 'function' ||
      !agent13Runtime || typeof agent13Runtime.collect !== 'function' ||
      !Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 32)
    throw new TypeError('invalid_agent13_paid_http_dependencies');
  const gate = createConcurrencyGate({ maxConcurrent });
  return async (req, res) => {
    if (req.url !== AGENT13_PAID_HTTP_PATH) return delegate(req, res);
    if (req.method !== 'POST') { send(res, 405, { error: 'method_not_allowed' }); return; }
    if (typeof req.headers['content-type'] !== 'string' ||
        req.headers['content-type'].split(';')[0].trim().toLowerCase() !== 'application/json') {
      send(res, 415, { error: 'unsupported_media_type' }); return;
    }
    try {
      const authenticatedUid = await requireSubscriberUid(req, config, subscriberVerifier);
      if (config.requireSubscriberIdentity === true && !authenticatedUid) {
        send(res, 401, { error: 'unauthorized' }); return;
      }
      const { payload, ibge } = validatePayload(await readBody(req));
      const outcome = await gate.run(async () => {
        const authorized = await verifyPurchasePayload(payload, {
          config, gateway, authenticatedUid,
        });
        if (!authorized.active) return { kind: 'denied' };
        const target = CALIBRATED_TARGETS.get(ibge);
        if (!target || agent13Runtime.configured !== true)
          return { kind: 'unavailable' };
        const now = clock();
        const result = await agent13Runtime.collect({ target, now });
        const estimate = projectAgent13CurrentEstimate(result, ibge, now);
        return estimate ? { kind: 'current', estimate } : { kind: 'unavailable' };
      });
      if (outcome.kind === 'denied') send(res, 403, { error: 'access_denied' });
      else if (outcome.kind === 'current') send(res, 200, outcome.estimate);
      else send(res, 503, { error: 'estimate_unavailable' });
    } catch (error) {
      if (error instanceof ClientInputError) send(res, 400, { error: 'invalid_request' });
      else if (error instanceof ServiceBusyError) {
        res.setHeader('Retry-After', '3');
        send(res, 503, { error: 'temporarily_unavailable' });
      } else {
        // Never include provider errors, raw subscription data or credentials.
        console.error('agent13_paid_request_failed');
        send(res, 503, { error: 'estimate_unavailable' });
      }
    }
  };
}
