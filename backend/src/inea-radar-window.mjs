import {
  INEA_RADAR_CADENCE_MINUTES,
  INEA_RADAR_MAX_FRAME_BYTES,
  INEA_RADAR_SOURCE_ID,
} from './inea-radar-source.mjs';

export const INEA_RADAR_WINDOW_MINUTES = 30;
export const INEA_RADAR_FRESHNESS_MINUTES = 10;
export const INEA_RADAR_MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;
export const INEA_RADAR_IDENTITIES = Object.freeze(['guaratiba', 'macae']);

const IMAGE_TYPES = new Set(['png', 'jpeg', 'gif', 'webp']);
const SHA256 = /^[a-f0-9]{64}$/;
const NORMALIZED_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const WINDOW_MS = INEA_RADAR_WINDOW_MINUTES * 60 * 1000;
const FRESHNESS_MS = INEA_RADAR_FRESHNESS_MINUTES * 60 * 1000;
const CADENCE_MS = INEA_RADAR_CADENCE_MINUTES * 60 * 1000;

export class IneaRadarWindowError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IneaRadarWindowError';
    this.code = code;
  }
}

function parseNormalizedUtc(value) {
  if (typeof value !== 'string' || !NORMALIZED_UTC.test(value)) {
    throw new IneaRadarWindowError('inea_radar_frame_timestamp_format_invalid');
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) {
    throw new IneaRadarWindowError('inea_radar_frame_timestamp_invalid');
  }
  return millis;
}

function assertNow(value) {
  if (!Number.isFinite(value)) throw new IneaRadarWindowError('inea_radar_window_clock_invalid');
  return value;
}

function sanitizeFrame(frame, nowMs) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
    throw new IneaRadarWindowError('inea_radar_frame_invalid');
  }
  if (frame.sourceId !== INEA_RADAR_SOURCE_ID) {
    throw new IneaRadarWindowError('inea_radar_frame_source_invalid');
  }
  if (!INEA_RADAR_IDENTITIES.includes(frame.radarId)) {
    throw new IneaRadarWindowError('inea_radar_frame_identity_invalid');
  }
  if (
    frame.provenanceValidated !== true
    || frame.binaryValidated !== true
    || frame.metadataBindingValidated !== true
  ) {
    throw new IneaRadarWindowError('inea_radar_frame_validation_chain_incomplete');
  }

  const observedAtMs = parseNormalizedUtc(frame.observedAt);
  if (observedAtMs > nowMs + INEA_RADAR_MAX_FUTURE_SKEW_MS) {
    throw new IneaRadarWindowError('inea_radar_frame_from_future');
  }
  if (observedAtMs < nowMs - WINDOW_MS) {
    throw new IneaRadarWindowError('inea_radar_frame_stale');
  }

  if (typeof frame.contentSha256 !== 'string' || !SHA256.test(frame.contentSha256)) {
    throw new IneaRadarWindowError('inea_radar_frame_digest_invalid');
  }
  if (!IMAGE_TYPES.has(frame.imageType)) {
    throw new IneaRadarWindowError('inea_radar_frame_image_type_invalid');
  }
  if (
    !Number.isInteger(frame.byteLength)
    || frame.byteLength < 12
    || frame.byteLength > INEA_RADAR_MAX_FRAME_BYTES
  ) {
    throw new IneaRadarWindowError('inea_radar_frame_size_invalid');
  }

  return Object.freeze({
    sourceId: INEA_RADAR_SOURCE_ID,
    radarId: frame.radarId,
    observedAt: new Date(observedAtMs).toISOString(),
    observedAtMs,
    contentSha256: frame.contentSha256,
    imageType: frame.imageType,
    byteLength: frame.byteLength,
  });
}

function cadenceGapCount(frames) {
  let gaps = 0;
  for (let index = 1; index < frames.length; index += 1) {
    if (frames[index].observedAtMs - frames[index - 1].observedAtMs > CADENCE_MS * 2) gaps += 1;
  }
  return gaps;
}

function publicFrame(frame) {
  return Object.freeze({
    radarId: frame.radarId,
    observedAt: frame.observedAt,
    contentSha256: frame.contentSha256,
    imageType: frame.imageType,
    byteLength: frame.byteLength,
  });
}

export class IneaRadarFrameWindow {
  #frames = [];
  #now;

  constructor({ now = () => Date.now() } = {}) {
    if (typeof now !== 'function') throw new IneaRadarWindowError('inea_radar_window_clock_invalid');
    this.#now = now;
  }

  #prune(nowMs) {
    const floor = nowMs - WINDOW_MS;
    this.#frames = this.#frames.filter((frame) => frame.observedAtMs >= floor);
  }

  ingest(frame) {
    const nowMs = assertNow(Number(this.#now()));
    this.#prune(nowMs);
    const sanitized = sanitizeFrame(frame, nowMs);

    const duplicate = this.#frames.find(
      (existing) => existing.radarId === sanitized.radarId && existing.observedAtMs === sanitized.observedAtMs,
    );
    if (duplicate) {
      throw new IneaRadarWindowError('inea_radar_frame_timestamp_duplicate');
    }

    this.#frames.push(sanitized);
    this.#frames.sort((left, right) => (
      left.observedAtMs - right.observedAtMs || left.radarId.localeCompare(right.radarId)
    ));
    return publicFrame(sanitized);
  }

  snapshot() {
    const nowMs = assertNow(Number(this.#now()));
    this.#prune(nowMs);

    const radars = INEA_RADAR_IDENTITIES.map((radarId) => {
      const frames = this.#frames
        .filter((frame) => frame.radarId === radarId)
        .sort((left, right) => left.observedAtMs - right.observedAtMs);
      const latest = frames.at(-1) ?? null;
      const latestAgeMs = latest ? Math.max(0, nowMs - latest.observedAtMs) : null;
      const fresh = latest !== null && latestAgeMs <= FRESHNESS_MS;
      const gaps = cadenceGapCount(frames);

      return Object.freeze({
        radarId,
        fresh,
        latestObservedAt: latest?.observedAt ?? null,
        latestAgeMs,
        frameCount: frames.length,
        cadenceGapCount: gaps,
        animationReady: fresh && frames.length >= 2 && gaps === 0,
        frames: Object.freeze(frames.map(publicFrame)),
      });
    });

    const operational = radars.every((radar) => radar.fresh);
    const animationReady = radars.every((radar) => radar.animationReady);

    return Object.freeze({
      contract: 'INEA_RADAR_VALIDATED_30_MINUTE_WINDOW',
      sourceId: INEA_RADAR_SOURCE_ID,
      radarCadenceMinutes: INEA_RADAR_CADENCE_MINUTES,
      windowMinutes: INEA_RADAR_WINDOW_MINUTES,
      freshnessMinutes: INEA_RADAR_FRESHNESS_MINUTES,
      interpolation: 'FORBIDDEN',
      storage: 'MEMORY_ONLY',
      rawMediaUrls: 'NOT_RETAINED',
      binaryContentRetention: 'NONE',
      operational,
      animationReady,
      radars: Object.freeze(radars),
    });
  }
}
