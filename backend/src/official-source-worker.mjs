import { probeAlertaRioLiveRainfall } from './alerta-rio-source.mjs';
import { createCemadenRjHydrologicalRiskCache } from './cemaden-rj-cache.mjs';
import { probeCemadenRjHydrologicalRisk } from './cemaden-rj-source.mjs';
import { createChmWarningsInventoryCache } from './chm-warning-cache.mjs';
import { probeChmWarnings } from './chm-source.mjs';
import { createDefesaCivilRioAssetsCache } from './defesa-civil-rio-assets-cache.mjs';
import { probeDefesaCivilRioMapAssets } from './defesa-civil-rio-assets.mjs';
import { probeIneaStationSnapshot } from './inea-source.mjs';
import { INMET_P0_POLICY_ID } from './inmet-p0-policy.mjs';
import { stageInmetP0Batch } from './inmet-p0-publish.mjs';
import { createInmetCapWarningsCache } from './inmet-warning-cache.mjs';
import { probeInmetCapWarnings } from './inmet-source.mjs';
import {
  createAlertaRioRainfallCache,
  createIneaHydrometStationCache,
} from './official-source-cache.mjs';
import { createOfficialSourceScheduler } from './official-source-scheduler.mjs';

export const OFFICIAL_SOURCE_WORKER_CONTRACT = 'OFFICIAL_SOURCE_FAIL_CLOSED_WORKER';
export const INMET_P0_RUNTIME_STATUS_CONTRACT = 'INMET_P0_RUNTIME_EVALUATION_V1';
export const ALERTA_RIO_RAINFALL_TASK_ID = 'alerta-rio-rainfall';
export const INEA_STATION_TASK_ID = 'inea-station';
export const CEMADEN_RJ_TASK_ID = 'cemaden-rj-hydrological-risk';
export const CHM_WARNINGS_TASK_ID = 'chm-marine-warnings';
export const INMET_WARNINGS_TASK_ID = 'inmet-cap-warnings';
export const DEFESA_CIVIL_RIO_ASSETS_TASK_ID = 'defesa-civil-rio-map-assets';

const INEA_STATION_URL = /^https:\/\/alertadecheias\.inea\.rj\.gov\.br\/alertadecheias\/\d{8,20}\.html$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

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

function inmetP0Status({
  configured,
  status = configured ? 'AWAITING_SOURCE_REFRESH' : 'NOT_CONFIGURED',
  lastAttemptAt = null,
  lastErrorCode = null,
  evaluatedAt = null,
  candidateCount = null,
  blockedCount = null,
  ineligibleCount = null,
  batchSha256 = null,
  delivery = configured ? 'NOT_PERFORMED_AWAITING_SOURCE' : 'NOT_CONFIGURED',
} = {}) {
  return Object.freeze({
    contract: INMET_P0_RUNTIME_STATUS_CONTRACT,
    policyId: INMET_P0_POLICY_ID,
    configured: Boolean(configured),
    status,
    lastAttemptAt,
    lastErrorCode,
    evaluatedAt,
    candidateCount,
    blockedCount,
    ineligibleCount,
    batchSha256,
    delivery,
    publication: 'NOT_PERFORMED',
    fcmDelivery: 'NOT_PROVEN',
    automaticPublication: 'DISABLED',
    candidatePayloadRetention: 'NONE_AFTER_STATUS_PROJECTION',
  });
}

function projectInmetP0BatchStatus(batch, startedAt) {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)
      || batch.policyId !== INMET_P0_POLICY_ID
      || batch.delivery !== 'STAGED_NOT_PUBLISHED'
      || !Number.isInteger(batch.candidateCount) || batch.candidateCount < 0
      || !Number.isInteger(batch.blockedCount) || batch.blockedCount < 0
      || !Number.isInteger(batch.ineligibleCount) || batch.ineligibleCount < 0
      || typeof batch.batchSha256 !== 'string' || !SHA256_HEX.test(batch.batchSha256)
      || typeof batch.evaluatedAt !== 'string' || !Number.isFinite(Date.parse(batch.evaluatedAt))) {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_inmet_p0_stage');
  }
  return inmetP0Status({
    configured: true,
    status: 'READY_STAGED_NOT_PUBLISHED',
    lastAttemptAt: startedAt,
    evaluatedAt: batch.evaluatedAt,
    candidateCount: batch.candidateCount,
    blockedCount: batch.blockedCount,
    ineligibleCount: batch.ineligibleCount,
    batchSha256: batch.batchSha256,
    delivery: batch.delivery,
  });
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
  const cemadenRjEnabled = parseBoolean(env.BLAISE_CEMADEN_RJ_ENABLED, {
    defaultValue: false,
    code: 'official_source_worker_invalid_cemaden_rj_enabled_flag',
  });
  const chmWarningsEnabled = parseBoolean(env.BLAISE_CHM_WARNINGS_ENABLED, {
    defaultValue: false,
    code: 'official_source_worker_invalid_chm_warnings_enabled_flag',
  });
  const inmetWarningsEnabled = parseBoolean(env.BLAISE_INMET_WARNINGS_ENABLED, {
    defaultValue: false,
    code: 'official_source_worker_invalid_inmet_warnings_enabled_flag',
  });
  const defesaCivilRioAssetsEnabled = parseBoolean(env.BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED, {
    defaultValue: false,
    code: 'official_source_worker_invalid_defesa_civil_rio_assets_enabled_flag',
  });

  const config = {
    enabled,
    initialMode: severe ? 'severe' : 'normal',
    ineaStationUrl,
  };
  if (env.BLAISE_CEMADEN_RJ_ENABLED !== undefined
      && env.BLAISE_CEMADEN_RJ_ENABLED !== null
      && env.BLAISE_CEMADEN_RJ_ENABLED !== '') {
    config.cemadenRjEnabled = cemadenRjEnabled;
  }
  if (env.BLAISE_CHM_WARNINGS_ENABLED !== undefined
      && env.BLAISE_CHM_WARNINGS_ENABLED !== null
      && env.BLAISE_CHM_WARNINGS_ENABLED !== '') {
    config.chmWarningsEnabled = chmWarningsEnabled;
  }
  if (env.BLAISE_INMET_WARNINGS_ENABLED !== undefined
      && env.BLAISE_INMET_WARNINGS_ENABLED !== null
      && env.BLAISE_INMET_WARNINGS_ENABLED !== '') {
    config.inmetWarningsEnabled = inmetWarningsEnabled;
  }
  if (env.BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED !== undefined
      && env.BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED !== null
      && env.BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED !== '') {
    config.defesaCivilRioAssetsEnabled = defesaCivilRioAssetsEnabled;
  }
  return Object.freeze(config);
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
    semanticValidity: reading.semanticValidity ?? null,
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
  probeCemadenRj = probeCemadenRjHydrologicalRisk,
  probeChmWarningsLive = probeChmWarnings,
  probeInmetWarningsLive = probeInmetCapWarnings,
  stageInmetP0 = stageInmetP0Batch,
  probeDefesaCivilRioAssetsLive = probeDefesaCivilRioMapAssets,
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
  const cemadenRjEnabled = config.cemadenRjEnabled ?? false;
  const chmWarningsEnabled = config.chmWarningsEnabled ?? false;
  const inmetWarningsEnabled = config.inmetWarningsEnabled ?? false;
  const defesaCivilRioAssetsEnabled = config.defesaCivilRioAssetsEnabled ?? false;
  if (typeof cemadenRjEnabled !== 'boolean') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_cemaden_rj_enabled_flag');
  }
  if (typeof chmWarningsEnabled !== 'boolean') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_chm_warnings_enabled_flag');
  }
  if (typeof inmetWarningsEnabled !== 'boolean') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_inmet_warnings_enabled_flag');
  }
  if (typeof defesaCivilRioAssetsEnabled !== 'boolean') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_defesa_civil_rio_assets_enabled_flag');
  }
  if (typeof now !== 'function' || typeof fetchImpl !== 'function') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_runtime');
  }
  if (typeof probeAlertaRio !== 'function'
      || typeof probeIneaStation !== 'function'
      || typeof probeCemadenRj !== 'function'
      || typeof probeChmWarningsLive !== 'function'
      || typeof probeInmetWarningsLive !== 'function'
      || typeof stageInmetP0 !== 'function'
      || typeof probeDefesaCivilRioAssetsLive !== 'function') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_probe');
  }
  if (typeof onEvent !== 'function') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_event_handler');
  }

  const alertaRioCache = createAlertaRioRainfallCache({ now });
  const ineaCache = ineaStationUrl ? createIneaHydrometStationCache({ now }) : null;
  const cemadenRjCache = cemadenRjEnabled ? createCemadenRjHydrologicalRiskCache({ now }) : null;
  const chmWarningsCache = chmWarningsEnabled ? createChmWarningsInventoryCache({ now }) : null;
  const inmetWarningsCache = inmetWarningsEnabled ? createInmetCapWarningsCache({ now }) : null;
  const defesaCivilRioAssetsCache = defesaCivilRioAssetsEnabled ? createDefesaCivilRioAssetsCache({ now }) : null;
  let inmetP0Evaluation = inmetP0Status({ configured: inmetWarningsEnabled });

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

  if (cemadenRjEnabled) {
    tasks.push({
      id: CEMADEN_RJ_TASK_ID,
      run: async ({ startedAt }) => {
        try {
          const snapshot = await probeCemadenRj({ fetchImpl });
          cemadenRjCache.recordSuccess(snapshot, { fetchedAt: startedAt });
        } catch (error) {
          cemadenRjCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
          throw error;
        }
      },
    });
  }

  if (chmWarningsEnabled) {
    tasks.push({
      id: CHM_WARNINGS_TASK_ID,
      run: async ({ startedAt }) => {
        try {
          const snapshot = await probeChmWarningsLive({ fetchImpl });
          chmWarningsCache.recordSuccess(snapshot, { fetchedAt: startedAt });
        } catch (error) {
          chmWarningsCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
          throw error;
        }
      },
    });
  }

  if (inmetWarningsEnabled) {
    tasks.push({
      id: INMET_WARNINGS_TASK_ID,
      run: async ({ startedAt }) => {
        let snapshot;
        try {
          snapshot = await probeInmetWarningsLive({ fetchImpl });
          inmetWarningsCache.recordSuccess(snapshot, { fetchedAt: startedAt });
        } catch (error) {
          const errorCode = safeSourceErrorCode(error);
          inmetWarningsCache.recordFailure(errorCode, { attemptedAt: startedAt });
          inmetP0Evaluation = inmetP0Status({
            configured: true,
            status: 'BLOCKED_SOURCE_UNAVAILABLE',
            lastAttemptAt: startedAt,
            lastErrorCode: errorCode,
            delivery: 'NOT_PERFORMED_SOURCE_UNAVAILABLE',
          });
          throw error;
        }

        try {
          const nowMillis = Date.parse(startedAt);
          if (!Number.isFinite(nowMillis)) {
            throw new OfficialSourceWorkerError('official_source_worker_invalid_inmet_p0_clock');
          }
          const batch = stageInmetP0(snapshot, nowMillis);
          inmetP0Evaluation = projectInmetP0BatchStatus(batch, startedAt);
        } catch (error) {
          inmetP0Evaluation = inmetP0Status({
            configured: true,
            status: 'BLOCKED_POLICY_OR_STAGING_CONTRACT',
            lastAttemptAt: startedAt,
            lastErrorCode: safeSourceErrorCode(error),
            delivery: 'NOT_PERFORMED_POLICY_BLOCKED',
          });
        }
      },
    });
  }

  if (defesaCivilRioAssetsEnabled) {
    tasks.push({
      id: DEFESA_CIVIL_RIO_ASSETS_TASK_ID,
      run: async ({ startedAt }) => {
        try {
          const snapshot = await probeDefesaCivilRioAssetsLive({ fetchImpl });
          defesaCivilRioAssetsCache.recordSuccess(snapshot, { fetchedAt: startedAt });
        } catch (error) {
          defesaCivilRioAssetsCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
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
    if (taskId === CEMADEN_RJ_TASK_ID && cemadenRjCache) {
      return cemadenRjCache.read({ mode: scheduler.snapshot().mode });
    }
    if (taskId === CHM_WARNINGS_TASK_ID && chmWarningsCache) {
      return chmWarningsCache.read({ mode: scheduler.snapshot().mode });
    }
    if (taskId === INMET_WARNINGS_TASK_ID && inmetWarningsCache) {
      return inmetWarningsCache.read({ mode: scheduler.snapshot().mode });
    }
    if (taskId === DEFESA_CIVIL_RIO_ASSETS_TASK_ID && defesaCivilRioAssetsCache) {
      return defesaCivilRioAssetsCache.read({ mode: scheduler.snapshot().mode });
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
    if (cemadenRjCache) {
      sourceStates.push(sourceStateWithoutPayload(cemadenRjCache.read({ mode: schedulerStatus.mode })));
    }
    if (chmWarningsCache) {
      sourceStates.push(sourceStateWithoutPayload(chmWarningsCache.read({ mode: schedulerStatus.mode })));
    }
    if (inmetWarningsCache) {
      sourceStates.push(sourceStateWithoutPayload(inmetWarningsCache.read({ mode: schedulerStatus.mode })));
    }
    if (defesaCivilRioAssetsCache) {
      sourceStates.push(sourceStateWithoutPayload(defesaCivilRioAssetsCache.read({ mode: schedulerStatus.mode })));
    }

    return Object.freeze({
      contract: OFFICIAL_SOURCE_WORKER_CONTRACT,
      enabled: config.enabled,
      started: schedulerStatus.started,
      mode: schedulerStatus.mode,
      taskCount: schedulerStatus.taskCount,
      maxConcurrency: schedulerStatus.maxConcurrency,
      ineaStationConfigured: Boolean(ineaStationUrl),
      cemadenRjConfigured: cemadenRjEnabled,
      chmWarningsConfigured: chmWarningsEnabled,
      inmetWarningsConfigured: inmetWarningsEnabled,
      inmetP0Evaluation,
      defesaCivilRioAssetsConfigured: defesaCivilRioAssetsEnabled,
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
