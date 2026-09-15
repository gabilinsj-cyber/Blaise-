import { createHash } from 'node:crypto';

import {
  SOUTH_AMERICA_SOURCES,
  WIS2_GLOBAL_BROKERS,
} from './south-america-meteorology.mjs';

export const SOUTH_AMERICA_SOURCE_PROBE_SCHEMA_VERSION = 1;
export const SOUTH_AMERICA_SOURCE_PROBE_POLICY = Object.freeze({
  timeoutMillis: 10_000,
  maximumResponseBytes: 262_144,
  minimumIndependentModelSources: 2,
  requireHttpsDiscoveryAndModelEndpoints: true,
  requireMqttsBrokerRegistry: true,
  liveMqttSubscriptionImplemented: false,
  numericalForecastIngestionImplemented: false,
});

const MODEL_MARKERS = Object.freeze({
  'ecmwf-ifs-open': Object.freeze(['OpenECPDS']),
  'noaa-gfs-0p25': Object.freeze(['NOMADS']),
});

export function validateSouthAmericaSourceRegistry({
  sources = SOUTH_AMERICA_SOURCES,
  brokers = WIS2_GLOBAL_BROKERS,
} = {}) {
  if (!Array.isArray(sources) || sources.length === 0) throw codedError('south_america_sources_required');
  if (!Array.isArray(brokers) || brokers.length === 0) throw codedError('wis2_brokers_required');

  const sourceIds = new Set();
  let modelSourceCount = 0;
  let wis2SourceCount = 0;
  for (const source of sources) {
    if (!source || typeof source !== 'object' || typeof source.id !== 'string' || source.id.length === 0) {
      throw codedError('invalid_south_america_source');
    }
    if (sourceIds.has(source.id)) throw codedError('duplicate_south_america_source_id');
    sourceIds.add(source.id);

    if (source.network === 'WMO_WIS2') {
      wis2SourceCount += 1;
      requireHttpsUrl(source.discoveryUrl, 'invalid_wis2_discovery_url');
      if (typeof source.datasetId !== 'string' || !source.datasetId.startsWith('urn:wmo:md:')) {
        throw codedError('invalid_wis2_dataset_id');
      }
      const topic = source.originTopic ?? source.brokerTopic;
      if (typeof topic !== 'string' || !topic.includes('/wis2/')) throw codedError('invalid_wis2_topic');
    }

    if (source.kind === 'MODEL') {
      modelSourceCount += 1;
      requireHttpsUrl(source.endpoint, 'invalid_model_endpoint');
      if (!MODEL_MARKERS[source.id]) throw codedError('model_probe_marker_missing');
    }
  }

  if (modelSourceCount < SOUTH_AMERICA_SOURCE_PROBE_POLICY.minimumIndependentModelSources) {
    throw codedError('insufficient_independent_model_sources');
  }

  const brokerIds = new Set();
  for (const broker of brokers) {
    if (!broker || typeof broker !== 'object' || typeof broker.id !== 'string' || broker.id.length === 0) {
      throw codedError('invalid_wis2_broker');
    }
    if (brokerIds.has(broker.id)) throw codedError('duplicate_wis2_broker_id');
    brokerIds.add(broker.id);
    const endpoint = new URL(broker.endpoint);
    if (endpoint.protocol !== 'mqtts:' || endpoint.port !== '8883') throw codedError('insecure_wis2_broker_endpoint');
    if (endpoint.username !== 'everyone' || endpoint.password !== 'everyone') throw codedError('unexpected_wis2_public_credentials');
    if (endpoint.search || endpoint.hash) throw codedError('invalid_wis2_broker_endpoint');
  }

  return Object.freeze({
    status: 'PASS',
    sourceCount: sources.length,
    wis2SourceCount,
    modelSourceCount,
    brokerCount: brokers.length,
  });
}

export function buildSouthAmericaSourceProbePlan({ sources = SOUTH_AMERICA_SOURCES } = {}) {
  validateSouthAmericaSourceRegistry({ sources, brokers: WIS2_GLOBAL_BROKERS });
  return Object.freeze(sources.map((source) => {
    const url = source.network === 'WMO_WIS2' ? source.discoveryUrl : source.endpoint;
    const expectedMarkers = source.network === 'WMO_WIS2'
      ? [source.datasetId, source.originTopic ?? source.brokerTopic]
      : [...MODEL_MARKERS[source.id]];
    return Object.freeze({
      sourceId: source.id,
      sourceKind: source.kind,
      network: source.network,
      url,
      expectedMarkers: Object.freeze(expectedMarkers),
    });
  }));
}

export async function probeSouthAmericaSourceAvailability({
  fetchImpl = globalThis.fetch,
  nowMillis = Date.now(),
  timeoutMillis = SOUTH_AMERICA_SOURCE_PROBE_POLICY.timeoutMillis,
  maximumResponseBytes = SOUTH_AMERICA_SOURCE_PROBE_POLICY.maximumResponseBytes,
} = {}) {
  if (typeof fetchImpl !== 'function') throw codedError('fetch_required');
  if (!Number.isSafeInteger(nowMillis) || nowMillis < 0) throw codedError('invalid_probe_time');
  if (!Number.isInteger(timeoutMillis) || timeoutMillis < 1 || timeoutMillis > 60_000) throw codedError('invalid_probe_timeout');
  if (!Number.isInteger(maximumResponseBytes) || maximumResponseBytes < 1 || maximumResponseBytes > 1_048_576) {
    throw codedError('invalid_probe_maximum_response_bytes');
  }

  const registry = validateSouthAmericaSourceRegistry();
  const plan = buildSouthAmericaSourceProbePlan();
  const settled = await Promise.all(plan.map(async (target) => {
    try {
      return await probeHttpTarget(target, { fetchImpl, timeoutMillis, maximumResponseBytes });
    } catch (error) {
      return Object.freeze({
        sourceId: target.sourceId,
        sourceKind: target.sourceKind,
        network: target.network,
        status: 'FAIL',
        errorCode: errorCode(error),
      });
    }
  }));

  const status = settled.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
  return deepFreeze({
    schemaVersion: SOUTH_AMERICA_SOURCE_PROBE_SCHEMA_VERSION,
    checkedAt: new Date(nowMillis).toISOString(),
    status,
    registry,
    httpAvailability: settled,
    mqttBrokerRegistry: 'PASS_SECURE_ENDPOINTS_VALIDATED',
    mqttLiveSubscription: 'NOT_IMPLEMENTED_NO_MQTT_CLIENT',
    numericalForecastIngestion: 'NOT_IMPLEMENTED_AVAILABILITY_ONLY',
    productionForecastIngestion: 'NOT_PROVEN',
    localRjOfficialPrecedencePreserved: true,
    canTriggerP0: false,
  });
}

async function probeHttpTarget(target, { fetchImpl, timeoutMillis, maximumResponseBytes }) {
  const requestedUrl = new URL(target.url);
  if (requestedUrl.protocol !== 'https:') throw codedError('probe_requires_https');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMillis);
  try {
    const response = await fetchImpl(requestedUrl.href, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/json;q=0.9,*/*;q=0.1',
        'user-agent': 'BlaiseV6RJ-SouthAmericaSourceProbe/1.0',
      },
    });
    if (!response || typeof response.status !== 'number') throw codedError('invalid_probe_response');
    if (response.status < 200 || response.status >= 300) throw codedError(`probe_http_${response.status}`);

    const resolvedUrl = response.url ? new URL(response.url) : requestedUrl;
    if (resolvedUrl.protocol !== 'https:' || resolvedUrl.hostname !== requestedUrl.hostname) {
      throw codedError('probe_redirect_outside_expected_host');
    }

    const body = await readBoundedText(response, maximumResponseBytes);
    if (body.length === 0) throw codedError('probe_empty_response');
    for (const marker of target.expectedMarkers) {
      if (!body.includes(marker)) throw codedError('probe_contract_marker_missing');
    }

    const bodyBuffer = Buffer.from(body, 'utf8');
    return Object.freeze({
      sourceId: target.sourceId,
      sourceKind: target.sourceKind,
      network: target.network,
      status: 'PASS',
      requestedHost: requestedUrl.hostname,
      resolvedHost: resolvedUrl.hostname,
      httpStatus: response.status,
      contentType: String(response.headers?.get?.('content-type') ?? '').slice(0, 160),
      responseBytes: bodyBuffer.byteLength,
      responseSha256: createHash('sha256').update(bodyBuffer).digest('hex'),
      latestRunToken: target.sourceKind === 'MODEL' ? extractLatestRunToken(target.sourceId, body) : null,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw codedError('probe_timeout');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedText(response, maximumResponseBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const value = await response.text();
    const bytes = Buffer.byteLength(value, 'utf8');
    if (bytes > maximumResponseBytes) throw codedError('probe_response_too_large');
    return value;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumResponseBytes) {
        await reader.cancel('response limit exceeded');
        throw codedError('probe_response_too_large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

function extractLatestRunToken(sourceId, body) {
  const expression = sourceId === 'noaa-gfs-0p25'
    ? /\bgfs\.(20\d{6})\b/g
    : /(?:^|["'/>\s])(20\d{6})\/?/g;
  const matches = new Set();
  for (const match of body.matchAll(expression)) matches.add(match[1]);
  return [...matches].sort().at(-1) ?? null;
}

function requireHttpsUrl(value, errorCodeValue) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw codedError(errorCodeValue);
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname) throw codedError(errorCodeValue);
  return parsed;
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function errorCode(error) {
  if (typeof error?.code === 'string') return error.code;
  if (typeof error?.message === 'string' && /^probe_http_\d+$/.test(error.message)) return error.message;
  return 'unexpected_error';
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
