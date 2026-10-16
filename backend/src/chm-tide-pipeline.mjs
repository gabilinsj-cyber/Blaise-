import { createHash } from 'node:crypto';

import { extractChmTidePdfValuesWithPdftotext } from './chm-tide-live-text.mjs';
import { CHM_TIDE_VALUE_SOURCE_ID } from './chm-tide-values.mjs';

export const CHM_TIDE_DELIVERY_CONTRACT = 'OFFICIAL_CHM_TIDE_VALUES_DELIVERY_V1';
export const CHM_TIDE_SOURCE_TO_CACHE_CONTRACT = 'OFFICIAL_CHM_TIDE_SOURCE_TO_CACHE_READBACK_V1';
export const CHM_TIDE_ANDROID_NETWORK_DELIVERY_STATUS = 'IMPLEMENTED_FAIL_CLOSED_REQUIRES_RUNTIME_CHM_TIDE_INGESTION_AND_REAL_PLAY_ENTITLEMENT_PROOF';

export class ChmTidePipelineError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmTidePipelineError';
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireCache(cache) {
  if (!cache
      || typeof cache.recordSuccess !== 'function'
      || typeof cache.recordFailure !== 'function'
      || typeof cache.read !== 'function') {
    throw new ChmTidePipelineError('chm_tide_pipeline_cache_invalid');
  }
  return cache;
}

function boundedInteger(value, min, max, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ChmTidePipelineError(code);
  }
  return parsed;
}

function errorCode(error) {
  const candidate = typeof error?.code === 'string' ? error.code : 'chm_tide_pipeline_failed';
  return /^[a-z0-9][a-z0-9_.:-]{0,79}$/iu.test(candidate)
    ? candidate
    : 'chm_tide_pipeline_failed';
}

export function buildChmTideDelivery(reading) {
  if (!reading || typeof reading !== 'object' || Array.isArray(reading)) {
    throw new ChmTidePipelineError('chm_tide_delivery_reading_invalid');
  }
  if (reading.sourceId !== CHM_TIDE_VALUE_SOURCE_ID) {
    throw new ChmTidePipelineError('chm_tide_delivery_source_invalid');
  }
  if (reading.state !== 'CURRENT' && reading.state !== 'CURRENT_DEGRADED') {
    throw new ChmTidePipelineError('chm_tide_delivery_state_not_current');
  }
  if (!reading.snapshot) throw new ChmTidePipelineError('chm_tide_delivery_snapshot_missing');

  const snapshot = reading.snapshot;
  const stationNumber = boundedInteger(reading.stationNumber, 1, 99, 'chm_tide_delivery_station_invalid');
  const calendarYear = boundedInteger(reading.calendarYear, 2020, 2100, 'chm_tide_delivery_year_invalid');
  if (snapshot.station?.stationNumber !== stationNumber || snapshot.calendarYear !== calendarYear) {
    throw new ChmTidePipelineError('chm_tide_delivery_identity_mismatch');
  }
  if (typeof reading.fetchedAt !== 'string' || !Number.isFinite(Date.parse(reading.fetchedAt))) {
    throw new ChmTidePipelineError('chm_tide_delivery_fetched_at_invalid');
  }
  if (!Number.isFinite(reading.verificationAgeMs) || reading.verificationAgeMs < 0) {
    throw new ChmTidePipelineError('chm_tide_delivery_verification_age_invalid');
  }

  const predictions = snapshot.predictions.map((prediction) => Object.freeze({
    localDate: prediction.localDate,
    localTime: prediction.localTime,
    instantUtc: prediction.instantUtc,
    heightMeters: prediction.heightMeters,
    phase: prediction.phase,
    sourcePage: prediction.sourcePage,
  }));

  return Object.freeze({
    contract: CHM_TIDE_DELIVERY_CONTRACT,
    sourceId: CHM_TIDE_VALUE_SOURCE_ID,
    stationNumber,
    calendarYear,
    state: reading.state,
    fetchedAt: reading.fetchedAt,
    verificationAgeMs: reading.verificationAgeMs,
    lastErrorCode: reading.lastErrorCode,
    snapshot: Object.freeze({
      station: Object.freeze({
        stationNumber: snapshot.station.stationNumber,
        name: snapshot.station.name,
        pageStart: snapshot.station.pageStart,
        pageEnd: snapshot.station.pageEnd,
      }),
      calendarYear: snapshot.calendarYear,
      timeBasis: snapshot.timeBasis,
      utcOffsetMinutes: snapshot.utcOffsetMinutes,
      sourceArtifactSha256: snapshot.sourceArtifactSha256,
      tideValueSha256: snapshot.tideValueSha256,
      predictionCount: snapshot.predictionCount,
      predictions: Object.freeze(predictions),
    }),
  });
}

export async function ingestChmTidePdfToCache({
  cache,
  bytes,
  station,
  calendarYear,
  sourceArtifactSha256,
  fetchedAt = Date.now(),
  mode = 'normal',
  execFileImpl,
  temporaryRoot,
} = {}) {
  requireCache(cache);
  const stationNumber = boundedInteger(
    station?.stationNumber,
    1,
    99,
    'chm_tide_pipeline_station_invalid',
  );
  const normalizedYear = boundedInteger(calendarYear, 2020, 2100, 'chm_tide_pipeline_year_invalid');

  try {
    const extracted = await extractChmTidePdfValuesWithPdftotext({
      bytes,
      station,
      calendarYear: normalizedYear,
      sourceArtifactSha256,
      execFileImpl,
      temporaryRoot,
    });
    cache.recordSuccess(extracted.snapshot, { fetchedAt });
    const reading = cache.read({
      stationNumber,
      calendarYear: normalizedYear,
      at: fetchedAt,
      mode,
    });
    if (reading.state !== 'CURRENT') {
      throw new ChmTidePipelineError('chm_tide_pipeline_cache_readback_not_current');
    }
    if (reading.snapshot?.tideValueSha256 !== extracted.snapshot.tideValueSha256) {
      throw new ChmTidePipelineError('chm_tide_pipeline_cache_readback_digest_mismatch');
    }

    const delivery = buildChmTideDelivery(reading);
    return Object.freeze({
      ...extracted.summary,
      liveTideValueIngestion: 'PASS_FAIL_CLOSED_MEMORY_CACHE_READBACK',
      sourceToCacheIngestion: 'PASS_FAIL_CLOSED_MEMORY_CACHE_READBACK',
      cacheState: reading.state,
      cacheContract: reading.contract,
      deliveryContract: CHM_TIDE_DELIVERY_CONTRACT,
      deliverySha256: sha256(JSON.stringify(delivery)),
      androidNetworkDelivery: CHM_TIDE_ANDROID_NETWORK_DELIVERY_STATUS,
      pipelineContract: CHM_TIDE_SOURCE_TO_CACHE_CONTRACT,
      delivery,
    });
  } catch (error) {
    try {
      cache.recordFailure(errorCode(error), {
        stationNumber,
        calendarYear: normalizedYear,
        attemptedAt: fetchedAt,
      });
    } catch {
      // Preserve the original source/cache failure. Failure telemetry must never mask it.
    }
    throw error;
  }
}
