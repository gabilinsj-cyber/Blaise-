import { probeAlertaRioLiveRainfall } from './alerta-rio-source.mjs';
import { probeIneaStationSnapshot } from './inea-source.mjs';
import {
  createAlertaRioRainfallCache,
  createIneaHydrometStationCache,
} from './official-source-cache.mjs';
import { createOfficialSourceScheduler } from './official-source-scheduler.mjs';

export const OFFICIAL_SOURCE_WORKER_CONTRACT = 'OFFICIAL_SOURCE_FAIL_CLOSED_WORKER';
export const ALERTA_RIO_RAINFALL_TASK_ID = 'alerta-rio-rainfall';
export const INEA_STATION_TASK_ID = 'inea-station';

const INEA_STATION_URL = /^https:\/\/alertadecheias\.inea\.rj\.gov\.br\/alertadecheias\/\d{8,20}\.html$/;

export class OfficialSourceWorkerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'OfficialSourceWorkerError';
    this.code = code;
  }
}

function parseBoolean(value, { defaultValue = false, code }) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new OfficialSourceWorkerError(code);
}

function safeSourceErrorCode(error) {
  const code = typeof error?.code === 'string' ? error.code : 'source_refresh_failed';
  return /^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(code) ? code : 'source_refresh_failed';
}

function validateIneaStationUrl(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const normalized = String(value).trim();
  if (!INEA_STATION_URL.test(normalized)) {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_inea_station_url');
  }
  return normalized;
}

export function loadOfficialSourceWorkerConfig(env = process.env) {
  if (!env || typeof env !== 'object') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_environment');
  }
  const enabled = parseBoolean(env.BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED, {
    defaultValue: false,
    code: 'official_source_worker_invalid_enabled_flag',
  });
  const severe = parseBoolean(env.BLAISE_OFFICIAL_SOURCE_SEVERE, {
    defaultValue: false,
    code: 'official_source_worker_invalid_severe_flag',
  });
  const ineaStationUrl = validateIneaStationUrl(env.BLAISE_INEA_STATION_URL);

  return Object.freeze({
    enabled,
    initialMode: severe ? 'severe' : 'normal',
    ineaStationUrl,
  });
}

function sourceStateWithoutPayload(reading) {
  return Object.freeze({
    sourceId: reading.sourceId,
    state: reading.state,
    reason: reading.reason,
    mode: reading.mode,
    refreshIntervalMs: reading.refreshIntervalMs,
    refreshDue: reading.refreshDue,
    nextRefreshDueAt: reading.nextRefreshDueAt,
    lastAttemptAt: reading.lastAttemptAt,
    lastErrorCode: reading.lastErrorCode,
    fetchedAt: reading.fetchedAt,
    observedAt: reading.observedAt ?? null,
    dataAgeMs: reading.dataAgeMs,
    cacheAgeMs: reading.cacheAgeMs,
    payloadExposed: false,
  });
}

export function createOfficialSourceWorker({
  config = loadOfficialSourceWorkerConfig(),
  now = () => Date.now(),
  fetchImpl = globalThis.fetch,
  autoSchedule = true,
  maxConcurrency = 2,
  onEvent = () => {},
  probeAlertaRio = probeAlertaRioLiveRainfall,
  probeIneaStation = probeIneaStationSnapshot,
} = {}) {
  if (!config || typeof config !== 'object') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_config');
  }
  if (typeof config.enabled !== 'boolean') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_enabled_flag');
  }
  if (!['normal', 'severe'].includes(config.initialMode)) {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_mode');
  }
  const ineaStationUrl = validateIneaStationUrl(config.ineaStationUrl);
  if (typeof now !== 'function' || typeof fetchImpl !== 'function') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_runtime');
  }
  if (typeof probeAlertaRio !== 'function' || typeof probeIneaStation !== 'function') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_probe');
  }
  if (typeof onEvent !== 'function') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_event_handler');
  }

  const alertaRioCache = createAlertaRioRainfallCache({ now });
  const ineaCache = ineaStationUrl ? createIneaHydrometStationCache({ now }) : null;

  const tasks = [{
    id: ALERTA_RIO_RAINFALL_TASK_ID,
    run: async ({ startedAt }) => {
      try {
        const snapshot = await probeAlertaRio({ fetchImpl });
        alertaRioCache.recordSuccess(snapshot, { fetchedAt: startedAt });
      } catch (error) {
        alertaRioCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
        throw error;
      }
    },
  }];

  if (ineaStationUrl) {
    tasks.push({
      id: INEA_STATION_TASK_ID,
      run: async ({ startedAt }) => {
        try {
          const snapshot = await probeIneaStation({ stationUrl: ineaStationUrl, fetchImpl });
          ineaCache.recordSuccess(snapshot, { fetchedAt: startedAt });
        } catch (error) {
          ineaCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
          throw error;
        }
      },
    });
  }

  const scheduler = createOfficialSourceScheduler({
    tasks,
    now,
    autoSchedule,
    maxConcurrency,
    onEvent,
  });
  if (config.initialMode === 'severe') scheduler.setMode('severe');

  function start() {
    if (!config.enabled) return false;
    return scheduler.start({ immediate: true });
  }

  function stop() {
    return scheduler.stop();
  }

  function setMode(mode) {
    return scheduler.setMode(mode);
  }

  function readSource(taskId) {
    if (taskId === ALERTA_RIO_RAINFALL_TASK_ID) {
      return alertaRioCache.read({ mode: scheduler.snapshot().mode });
    }
    if (taskId === INEA_STATION_TASK_ID && ineaCache) {
      return ineaCache.read({ mode: scheduler.snapshot().mode });
    }
    throw new OfficialSourceWorkerError('official_source_worker_unknown_source');
  }

  function status() {
    const schedulerStatus = scheduler.snapshot();
    const sourceStates = [
      sourceStateWithoutPayload(alertaRioCache.read({ mode: schedulerStatus.mode })),
    ];
    if (ineaCache) {
      sourceStates.push(sourceStateWithoutPayload(ineaCache.read({ mode: schedulerStatus.mode })));
    }

    return Object.freeze({
      contract: OFFICIAL_SOURCE_WORKER_CONTRACT,
      enabled: config.enabled,
      started: schedulerStatus.started,
      mode: schedulerStatus.mode,
      taskCount: schedulerStatus.taskCount,
      maxConcurrency: schedulerStatus.maxConcurrency,
      ineaStationConfigured: Boolean(ineaStationUrl),
      payloadRetention: 'MEMORY_ONLY_IN_SOURCE_CACHE',
      statusPayloads: 'REDACTED',
      externalPolling: config.enabled ? 'EXPLICITLY_ENABLED' : 'DISABLED_FAIL_CLOSED',
      scheduler: schedulerStatus,
      sources: Object.freeze(sourceStates),
    });
  }

  return Object.freeze({
    start,
    stop,
    setMode,
    readSource,
    status,
    tick: scheduler.tick,
  });
}
