// RJ marine evidence gate. Pure validation: no credentials, network calls or claims of live ingestion.
const SOURCES = new Set(['COPERNICUS_MARINE', 'NOAA']);
const KINDS = new Set(['OBSERVATION', 'FORECAST']);
const VARIABLES = Object.freeze({
  WAVE_HEIGHT: 'm', WAVE_PERIOD: 's', CURRENT_SPEED: 'm/s',
  SEA_SURFACE_TEMPERATURE: 'degC', SEA_LEVEL: 'm', WIND_SPEED: 'm/s',
});
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function utc(value) {
  if (typeof value !== 'string' || !ISO_UTC.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === new Date(value).toISOString() ? time : null;
}
export function reviewRjMarineSample(sample, { nowMs = Date.now(), maxObservationAgeMs = 3_600_000 } = {}) {
  const fail = reason => Object.freeze({ status: 'REJECTED', reason, live: false });
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return fail('invalid_sample');
  if (!SOURCES.has(sample.sourceId)) return fail('unapproved_source');
  if (typeof sample.productId !== 'string' || !/^[a-zA-Z0-9_.-]{3,120}$/.test(sample.productId)) return fail('invalid_product');
  if (sample.licenseVerified !== true || sample.redistributionAuthorized !== true) return fail('license_unverified');
  if (!KINDS.has(sample.kind)) return fail('invalid_kind');
  if (!Object.hasOwn(VARIABLES, sample.variable) || sample.unit !== VARIABLES[sample.variable]) return fail('invalid_unit');
  if (!Number.isFinite(sample.value)) return fail('invalid_value');
  if (!Number.isFinite(sample.latitude) || sample.latitude < -25 || sample.latitude > -18 ||
      !Number.isFinite(sample.longitude) || sample.longitude < -47 || sample.longitude > -37) return fail('outside_rj_marine_bounds');
  const observed = utc(sample.validTimeUtc), received = utc(sample.receivedAtUtc);
  if (observed === null || received === null || !Number.isFinite(nowMs) ||
      !Number.isFinite(maxObservationAgeMs) || maxObservationAgeMs <= 0) return fail('invalid_time');
  if (received > nowMs + 60_000 || observed > nowMs + 60_000 && sample.kind === 'OBSERVATION') return fail('future_observation');
  if (typeof sample.qualityFlag !== 'string' || sample.qualityFlag !== 'VALIDATED') return fail('quality_unverified');
  if (sample.kind === 'FORECAST') return Object.freeze({ status: 'FORECAST', reason: 'not_live_observation', live: false });
  if (nowMs - observed > maxObservationAgeMs || nowMs - received > maxObservationAgeMs) {
    return Object.freeze({ status: 'STALE', reason: 'observation_expired', live: false });
  }
  return Object.freeze({ status: 'CURRENT_OBSERVATION', reason: 'metadata_validated_not_runtime_proof', live: false });
}
