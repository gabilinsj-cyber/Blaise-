import {OPENWEATHER_TASK_ID,probeOpenWeatherRio,createOpenWeatherCache} from './openweather-complement.mjs';
import { REDEMET_TASK_ID, probeRedemetRjMetar, createRedemetCache } from './redemet-source.mjs';
import { probeInmetWis2Warnings } from './inmet-wis2-source.mjs';
import { CEMADEN_NATIONAL_TASK_ID, probeCemadenNationalAlerts, createCemadenNationalCache } from './cemaden-national-source.mjs';
import { rjAlertActiveUntil, rjAlertIsActive } from './rj-alert-retention.mjs';
import { probeAlertaRioLiveRainfall } from './alerta-rio-source.mjs';
import { createCemadenRjHydrologicalRiskCache } from './cemaden-rj-cache.mjs';
import { probeCemadenRjHydrologicalRisk } from './cemaden-rj-source.mjs';
import { createChmWarningsInventoryCache } from './chm-warning-cache.mjs';
import { probeChmWarnings } from './chm-source.mjs';
import { createDefesaCivilRioAssetsCache } from './defesa-civil-rio-assets-cache.mjs';
import { probeDefesaCivilRioMapAssets } from './defesa-civil-rio-assets.mjs';
import { INMET_P0_POLICY_ID } from './inmet-p0-policy.mjs';
import { stageInmetP0Batch } from './inmet-p0-publish.mjs';
import { createInmetCapWarningsCache } from './inmet-warning-cache.mjs';
import { probeInmetCapWarnings } from './inmet-source.mjs';
import {
  createAlertaRioRainfallCache,
} from './official-source-cache.mjs';
import { createOfficialSourceScheduler } from './official-source-scheduler.mjs';

export const OFFICIAL_SOURCE_WORKER_CONTRACT = 'OFFICIAL_SOURCE_FAIL_CLOSED_WORKER';
export const INMET_P0_RUNTIME_STATUS_CONTRACT = 'INMET_P0_RUNTIME_EVALUATION_V1';
export const ALERTA_RIO_RAINFALL_TASK_ID = 'alerta-rio-rainfall';
export const CEMADEN_RJ_TASK_ID = 'cemaden-rj-hydrological-risk';
export const CHM_WARNINGS_TASK_ID = 'chm-marine-warnings';
export const INMET_WARNINGS_TASK_ID = 'inmet-cap-warnings';
export const DEFESA_CIVIL_RIO_ASSETS_TASK_ID = 'defesa-civil-rio-map-assets';

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
  acceptedCount = null,
  duplicateCount = null,
  newlyAcceptedCount = null,
  delivery = configured ? 'NOT_PERFORMED_AWAITING_SOURCE' : 'NOT_CONFIGURED',
  publication = 'NOT_PERFORMED',
  fcmDelivery = 'NOT_PROVEN',
  automaticPublication = 'DISABLED',
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
    acceptedCount,
    duplicateCount,
    newlyAcceptedCount,
    delivery,
    publication,
    fcmDelivery,
    automaticPublication,
    candidatePayloadRetention: 'NONE_AFTER_STATUS_PROJECTION',
  });
}

function projectInmetP0BatchStatus(batch, startedAt, automaticPublication) {
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
    automaticPublication,
  });
}

function projectInmetP0PublishStatus(batch, result, startedAt) {
  if (!result || typeof result !== 'object' || Array.isArray(result)
      || result.schema !== batch.schema
      || result.batchSha256 !== batch.batchSha256
      || result.delivery !== 'BACKEND_P0_ENDPOINT_ACCEPTED'
      || !Number.isInteger(result.acceptedCount) || result.acceptedCount < 0
      || !Number.isInteger(result.duplicateCount) || result.duplicateCount < 0
      || !Number.isInteger(result.newlyAcceptedCount) || result.newlyAcceptedCount < 0
      || result.acceptedCount !== batch.candidateCount
      || result.duplicateCount > result.acceptedCount
      || result.newlyAcceptedCount !== result.acceptedCount - result.duplicateCount) {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_inmet_p0_publish_result');
  }
  return inmetP0Status({
    configured: true,
    status: 'BACKEND_ACCEPTED',
    lastAttemptAt: startedAt,
    evaluatedAt: batch.evaluatedAt,
    candidateCount: batch.candidateCount,
    blockedCount: batch.blockedCount,
    ineligibleCount: batch.ineligibleCount,
    batchSha256: batch.batchSha256,
    acceptedCount: result.acceptedCount,
    duplicateCount: result.duplicateCount,
    newlyAcceptedCount: result.newlyAcceptedCount,
    delivery: result.delivery,
    publication: 'PERFORMED',
    fcmDelivery: 'BACKEND_ACCEPTED_NOT_DEVICE_PROVEN',
    automaticPublication: 'ENABLED_EXPLICIT',
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
  // INEA was retired by project policy. Do not permit it to be reactivated
  // through environment variables or an accidental deployment setting.
  if (String(env.BLAISE_INEA_STATION_URL ?? '').trim() !== '') {
    throw new OfficialSourceWorkerError('official_source_worker_retired_source_inea');
  }
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
  const inmetP0PublishEnabled = parseBoolean(env.BLAISE_INMET_P0_PUBLISH_ENABLED, {
    defaultValue: false,
    code: 'official_source_worker_invalid_inmet_p0_publish_enabled_flag',
  });
  if (inmetP0PublishEnabled && !inmetWarningsEnabled) {
    throw new OfficialSourceWorkerError('official_source_worker_inmet_p0_publish_requires_warnings');
  }
  const defesaCivilRioAssetsEnabled = parseBoolean(env.BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED, {
    defaultValue: false,
    code: 'official_source_worker_invalid_defesa_civil_rio_assets_enabled_flag',
  });

  const alternativeFlags = {};
  for (const [key, envKey] of [['openWeatherEnabled','BLAISE_OPENWEATHER_ENABLED'],['openWeatherUsageApproved','BLAISE_OPENWEATHER_USAGE_APPROVED'],['inmetWis2Enabled', 'BLAISE_INMET_WIS2_ENABLED'], ['cemadenNationalEnabled', 'BLAISE_CEMADEN_NATIONAL_ENABLED'], ['redemetEnabled', 'BLAISE_REDEMET_ENABLED'], ['redemetUsageApproved', 'BLAISE_REDEMET_USAGE_APPROVED']]) {
    if (env[envKey] != null && env[envKey] !== '') alternativeFlags[key] = parseBoolean(env[envKey], { defaultValue: false, code: 'official_source_worker_invalid_alternative_flag' });
  }
  const config = {
    ...alternativeFlags,
    ...(env.BLAISE_OPENWEATHER_API_KEY ? {openWeatherApiKey:env.BLAISE_OPENWEATHER_API_KEY}:{}),
    ...(env.BLAISE_REDEMET_API_KEY ? { redemetApiKey: env.BLAISE_REDEMET_API_KEY } : {}),
    enabled,
    initialMode: severe ? 'severe' : 'normal',
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
  if (env.BLAISE_INMET_P0_PUBLISH_ENABLED !== undefined
      && env.BLAISE_INMET_P0_PUBLISH_ENABLED !== null
      && env.BLAISE_INMET_P0_PUBLISH_ENABLED !== '') {
    config.inmetP0PublishEnabled = inmetP0PublishEnabled;
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
    totalRecordCount: reading.totalRecordCount ?? null,
    currentRecordCount: reading.currentRecordCount ?? null,
    excludedRecordCount: reading.excludedRecordCount ?? null,
    oldestDataAgeMs: reading.oldestDataAgeMs ?? null,
    dataAgeMs: reading.dataAgeMs,
    cacheAgeMs: reading.cacheAgeMs,
    timestampMeaning: reading.timestampMeaning ?? null,
    oldestUpdatedAt: reading.oldestUpdatedAt ?? null,
    latestUpdatedAt: reading.latestUpdatedAt ?? null,
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
  refreshIntervalsMs = null,
  cadenceMode = 'after_completion',
  onEvent = () => {},
  probeRedemet = probeRedemetRjMetar,
  probeInmetWis2 = probeInmetWis2Warnings,
  probeCemadenNational = probeCemadenNationalAlerts,
  probeAlertaRio = probeAlertaRioLiveRainfall,
  probeCemadenRj = probeCemadenRjHydrologicalRisk,
  probeChmWarningsLive = probeChmWarnings,
  probeInmetWarningsLive = probeInmetCapWarnings,
  stageInmetP0 = stageInmetP0Batch,
  publishInmetP0 = null,
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
  if (String(config.ineaStationUrl ?? '').trim() !== '') {
    throw new OfficialSourceWorkerError('official_source_worker_retired_source_inea');
  }
  const openWeatherCache = config.openWeatherEnabled === true ? createOpenWeatherCache({now}) : null;
  const redemetEnabled = config.redemetEnabled ?? false;
  if (typeof redemetEnabled !== 'boolean' || typeof (config.redemetUsageApproved ?? false) !== 'boolean') throw new OfficialSourceWorkerError('official_source_worker_invalid_alternative_flag');
  const redemetCache = redemetEnabled ? createRedemetCache({ now }) : null;
  const cemadenNationalEnabled = config.cemadenNationalEnabled ?? false;
  const inmetWis2Enabled = config.inmetWis2Enabled ?? false;
  if (typeof cemadenNationalEnabled !== 'boolean' || typeof inmetWis2Enabled !== 'boolean') throw new OfficialSourceWorkerError('official_source_worker_invalid_alternative_flag');
  const nationalCache = cemadenNationalEnabled ? createCemadenNationalCache({ now }) : null;
  const cemadenRjEnabled = config.cemadenRjEnabled ?? false;
  const chmWarningsEnabled = config.chmWarningsEnabled ?? false;
  const inmetWarningsEnabled = config.inmetWarningsEnabled ?? false;
  const inmetP0PublishEnabled = config.inmetP0PublishEnabled ?? false;
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
  if (typeof inmetP0PublishEnabled !== 'boolean') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_inmet_p0_publish_enabled_flag');
  }
  if (inmetP0PublishEnabled && !inmetWarningsEnabled) {
    throw new OfficialSourceWorkerError('official_source_worker_inmet_p0_publish_requires_warnings');
  }
  if (inmetP0PublishEnabled && typeof publishInmetP0 !== 'function') {
    throw new OfficialSourceWorkerError('official_source_worker_inmet_p0_publisher_missing');
  }
  if (typeof defesaCivilRioAssetsEnabled !== 'boolean') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_defesa_civil_rio_assets_enabled_flag');
  }
  if (typeof now !== 'function' || typeof fetchImpl !== 'function') {
    throw new OfficialSourceWorkerError('official_source_worker_invalid_runtime');
  }
  if (typeof probeAlertaRio !== 'function'
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
  const cemadenRjCache = cemadenRjEnabled ? createCemadenRjHydrologicalRiskCache({ now }) : null;
  const chmWarningsCache = chmWarningsEnabled ? createChmWarningsInventoryCache({ now }) : null;
  const inmetWarningsCache = inmetWarningsEnabled ? createInmetCapWarningsCache({ now }) : null;
  const defesaCivilRioAssetsCache = defesaCivilRioAssetsEnabled ? createDefesaCivilRioAssetsCache({ now }) : null;
  const inmetAutomaticPublication = inmetP0PublishEnabled ? 'ENABLED_EXPLICIT' : 'DISABLED';
  let inmetP0Evaluation = inmetP0Status({
    configured: inmetWarningsEnabled,
    automaticPublication: inmetAutomaticPublication,
  });

  let heldCriticalUntil = 0;
  let manualMode = null;
  const tasks = [{
    id: ALERTA_RIO_RAINFALL_TASK_ID,
    run: async ({ startedAt }) => {
      try {
        const snapshot = await probeAlertaRio({ fetchImpl });
        alertaRioCache.recordSuccess(snapshot, { fetchedAt: startedAt });
        reconcileCadence();
      } catch (error) {
        alertaRioCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
        reconcileCadence();
        throw error;
      }
    },
  }];

  if (openWeatherCache) tasks.push({id:OPENWEATHER_TASK_ID,run:async()=>{
    try {openWeatherCache.recordSuccess(await probeOpenWeatherRio({fetchImpl,now,apiKey:config.openWeatherApiKey??'',usageApproved:config.openWeatherUsageApproved===true}));}
    catch(error){openWeatherCache.recordFailure(safeSourceErrorCode(error));throw error;}
  }});
  if (redemetEnabled) tasks.push({
    id: REDEMET_TASK_ID,
    run: async () => {
      try {
        redemetCache.recordSuccess(await probeRedemet({ fetchImpl, now,
          apiKey: config.redemetApiKey ?? '', usageApproved: config.redemetUsageApproved ?? false }));
      } catch (error) {
        redemetCache.recordFailure(safeSourceErrorCode(error)); throw error;
      }
    },
  });
  if (cemadenNationalEnabled) tasks.push({
    id: CEMADEN_NATIONAL_TASK_ID,
    run: async ({ startedAt }) => {
      try {
        const snapshot = await probeCemadenNational({ fetchImpl, now });
        nationalCache.recordSuccess(snapshot, { fetchedAt: startedAt });
        reconcileCadence();
      } catch (error) {
        nationalCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
        reconcileCadence();
        throw error;
      }
    },
  });
  if (cemadenRjEnabled) {
    tasks.push({
      id: CEMADEN_RJ_TASK_ID,
      run: async ({ startedAt }) => {
        try {
          const snapshot = await probeCemadenRj({ fetchImpl });
          cemadenRjCache.recordSuccess(snapshot, { fetchedAt: startedAt });
        reconcileCadence();
        } catch (error) {
          cemadenRjCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
        reconcileCadence();
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
        reconcileCadence();
        } catch (error) {
          chmWarningsCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
        reconcileCadence();
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
          if (inmetWis2Enabled) {
            try { snapshot = await probeInmetWis2({ fetchImpl, now }); }
            catch { snapshot = await probeInmetWarningsLive({ fetchImpl }); }
          } else snapshot = await probeInmetWarningsLive({ fetchImpl });
          inmetWarningsCache.recordSuccess(snapshot, { fetchedAt: startedAt });
        reconcileCadence();
        } catch (error) {
          const errorCode = safeSourceErrorCode(error);
          inmetWarningsCache.recordFailure(errorCode, { attemptedAt: startedAt });
        reconcileCadence();
          inmetP0Evaluation = inmetP0Status({
            configured: true,
            status: 'BLOCKED_SOURCE_UNAVAILABLE',
            lastAttemptAt: startedAt,
            lastErrorCode: errorCode,
            delivery: 'NOT_PERFORMED_SOURCE_UNAVAILABLE',
            automaticPublication: inmetAutomaticPublication,
          });
          throw error;
        }

        const nowMillis = Date.parse(startedAt);
        let batch;
        try {
          if (!Number.isFinite(nowMillis)) {
            throw new OfficialSourceWorkerError('official_source_worker_invalid_inmet_p0_clock');
          }
          batch = stageInmetP0(snapshot, nowMillis);
          inmetP0Evaluation = projectInmetP0BatchStatus(batch, startedAt, inmetAutomaticPublication);
        } catch (error) {
          inmetP0Evaluation = inmetP0Status({
            configured: true,
            status: 'BLOCKED_POLICY_OR_STAGING_CONTRACT',
            lastAttemptAt: startedAt,
            lastErrorCode: safeSourceErrorCode(error),
            delivery: 'NOT_PERFORMED_POLICY_BLOCKED',
            automaticPublication: inmetAutomaticPublication,
          });
          return;
        }

        if (!inmetP0PublishEnabled) return;

        try {
          const result = await publishInmetP0(batch, { nowMillis });
          inmetP0Evaluation = projectInmetP0PublishStatus(batch, result, startedAt);
        } catch (error) {
          inmetP0Evaluation = inmetP0Status({
            configured: true,
            status: 'BLOCKED_PUBLICATION_FAILED',
            lastAttemptAt: startedAt,
            lastErrorCode: safeSourceErrorCode(error),
            evaluatedAt: batch.evaluatedAt,
            candidateCount: batch.candidateCount,
            blockedCount: batch.blockedCount,
            ineligibleCount: batch.ineligibleCount,
            batchSha256: batch.batchSha256,
            delivery: 'PUBLICATION_FAILED',
            publication: 'FAILED',
            automaticPublication: 'ENABLED_EXPLICIT',
          });
          throw error;
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
        reconcileCadence();
        } catch (error) {
          defesaCivilRioAssetsCache.recordFailure(safeSourceErrorCode(error), { attemptedAt: startedAt });
        reconcileCadence();
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
    refreshIntervalsMs,
    cadenceMode,
    onEvent,
  });
  if (config.initialMode === 'severe') scheduler.setMode('severe');

  function reconcileCadence() {
    if (manualMode !== null) return scheduler.setMode(manualMode);
    if (config.initialMode === 'severe') return scheduler.setMode('severe');
    const at = Number(now());
    const cap = inmetWarningsCache?.read();
    if (cap?.snapshot && ['CURRENT', 'CURRENT_DEGRADED'].includes(cap.state)) {
      const critical = cap.snapshot.rjWarnings.filter(w => ['Severe', 'Extreme'].includes(w.severity)
        && rjAlertIsActive(w.sent, w.expires, at));
      if (critical.length) heldCriticalUntil = Math.max(...critical.map(w => rjAlertActiveUntil(w.sent, w.expires)));
      else if (cap.state === 'CURRENT' && cap.snapshot.feedShape === 'RSS_INDEX_RESOLVED_CAP') heldCriticalUntil = 0;
    }
    const hydro = cemadenRjCache?.read();
    const highHydro = hydro?.snapshot?.records?.some(row => {
      const observed = Date.parse(row.observedAt);
      return ['CURRENT', 'CURRENT_DEGRADED'].includes(hydro.state) && [4, 5].includes(row.priority)
        && observed <= at && at - observed <= 300_000;
    }) === true;
    const national = nationalCache?.read();
    const highNational = national?.snapshot?.alerts?.some(alert => ['Alto', 'Muito Alto'].includes(alert.officialLevel)) === true;
    return scheduler.setMode(highHydro || highNational || at < heldCriticalUntil ? 'severe' : 'normal');
  }

  function start() {
    if (!config.enabled) return false;
    return scheduler.start({ immediate: true });
  }

  function stop() {
    return scheduler.stop();
  }

  function setMode(mode) {
    const changed = scheduler.setMode(mode);
    manualMode = mode;
    return changed;
  }

  function readSource(taskId) {
    reconcileCadence();
    if(taskId===OPENWEATHER_TASK_ID && openWeatherCache)return openWeatherCache.read();
    if (taskId === REDEMET_TASK_ID && redemetCache) return redemetCache.read();
    if (taskId === CEMADEN_NATIONAL_TASK_ID && nationalCache) return nationalCache.read();
    if (taskId === ALERTA_RIO_RAINFALL_TASK_ID) {
      return alertaRioCache.read({ mode: scheduler.snapshot().mode });
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
    reconcileCadence();
    const schedulerStatus = scheduler.snapshot();
    const sourceStates = [
      sourceStateWithoutPayload(alertaRioCache.read({ mode: schedulerStatus.mode })),
    ];
    if(openWeatherCache)sourceStates.push(sourceStateWithoutPayload(openWeatherCache.read()));
    if (redemetCache) sourceStates.push(sourceStateWithoutPayload(redemetCache.read()));
    if (nationalCache) sourceStates.push(sourceStateWithoutPayload(nationalCache.read()));
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
      retiredIneaSource: 'DISABLED_BY_POLICY',
      cemadenRjConfigured: cemadenRjEnabled,
      chmWarningsConfigured: chmWarningsEnabled,
      inmetWarningsConfigured: inmetWarningsEnabled,
      inmetP0PublishEnabled,
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
