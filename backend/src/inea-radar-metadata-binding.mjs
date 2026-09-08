import { createHash } from 'node:crypto';

import {
  INEA_RADAR_MAX_FRAME_BYTES,
  INEA_RADAR_SOURCE_ID,
} from './inea-radar-source.mjs';

export const INEA_RADAR_METADATA_BINDING_CONTRACT = 'OFFICIAL_INEA_SAME_CANDIDATE_METADATA_BINDING';
export const INEA_RADAR_METADATA_EVIDENCE_ORIGIN = 'OFFICIAL_LIVE_VIEWER_SAME_CANDIDATE';
export const INEA_RADAR_BINARY_VALIDATION_CONTRACT = 'OFFICIAL_IMAGE_BINARY_ENVELOPES_VALIDATED';
export const INEA_RADAR_PROVENANCE_CONTRACT = 'OFFICIAL_INEA_RADAR_PROVENANCE_VALIDATED';
export const INEA_RADAR_BOUND_IDENTITIES = Object.freeze(['guaratiba', 'macae']);

const SHA256 = /^[a-f0-9]{64}$/;
const NORMALIZED_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const IMAGE_TYPES = new Set(['png', 'jpeg', 'gif', 'webp']);
const trustedFrames = new WeakSet();

export class IneaRadarMetadataBindingError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IneaRadarMetadataBindingError';
    this.code = code;
  }
}

function requireSha256(value, code) {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new IneaRadarMetadataBindingError(code);
  }
  return value;
}

function normalizedObservedAt(value) {
  if (typeof value !== 'string' || !NORMALIZED_UTC.test(value)) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_timestamp_format_invalid');
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_timestamp_invalid');
  }
  return new Date(millis).toISOString();
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function bindIneaRadarFrameMetadata({
  candidateEvidence,
  metadataEvidence,
  provenanceEvidence,
} = {}) {
  if (!candidateEvidence || typeof candidateEvidence !== 'object' || Array.isArray(candidateEvidence)) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_candidate_evidence_invalid');
  }
  if (!metadataEvidence || typeof metadataEvidence !== 'object' || Array.isArray(metadataEvidence)) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_metadata_evidence_invalid');
  }
  if (!provenanceEvidence || typeof provenanceEvidence !== 'object' || Array.isArray(provenanceEvidence)) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_provenance_evidence_invalid');
  }

  if (candidateEvidence.sourceId !== INEA_RADAR_SOURCE_ID) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_source_invalid');
  }
  if (candidateEvidence.binaryValidationContract !== INEA_RADAR_BINARY_VALIDATION_CONTRACT) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_binary_contract_invalid');
  }
  if (provenanceEvidence.contract !== INEA_RADAR_PROVENANCE_CONTRACT) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_provenance_contract_invalid');
  }
  if (metadataEvidence.contract !== INEA_RADAR_METADATA_BINDING_CONTRACT) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_metadata_contract_invalid');
  }
  if (metadataEvidence.origin !== INEA_RADAR_METADATA_EVIDENCE_ORIGIN) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_origin_invalid');
  }
  if (metadataEvidence.ambiguityDetected !== false) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_ambiguous');
  }

  const candidateRefSha256 = requireSha256(
    candidateEvidence.candidateRefSha256,
    'inea_radar_binding_candidate_ref_invalid',
  );
  const metadataCandidateRefSha256 = requireSha256(
    metadataEvidence.candidateRefSha256,
    'inea_radar_binding_metadata_candidate_ref_invalid',
  );
  if (candidateRefSha256 !== metadataCandidateRefSha256) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_candidate_ref_mismatch');
  }

  const contentSha256 = requireSha256(
    candidateEvidence.contentSha256,
    'inea_radar_binding_content_digest_invalid',
  );
  const provenanceSha256 = requireSha256(
    provenanceEvidence.provenanceSha256,
    'inea_radar_binding_provenance_digest_invalid',
  );
  const identityEvidenceSha256 = requireSha256(
    metadataEvidence.identityEvidenceSha256,
    'inea_radar_binding_identity_evidence_digest_invalid',
  );
  const timestampEvidenceSha256 = requireSha256(
    metadataEvidence.timestampEvidenceSha256,
    'inea_radar_binding_timestamp_evidence_digest_invalid',
  );

  if (!INEA_RADAR_BOUND_IDENTITIES.includes(metadataEvidence.radarId)) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_identity_invalid');
  }
  if (!IMAGE_TYPES.has(candidateEvidence.imageType)) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_image_type_invalid');
  }
  if (
    !Number.isInteger(candidateEvidence.byteLength)
    || candidateEvidence.byteLength < 12
    || candidateEvidence.byteLength > INEA_RADAR_MAX_FRAME_BYTES
  ) {
    throw new IneaRadarMetadataBindingError('inea_radar_binding_size_invalid');
  }

  const observedAt = normalizedObservedAt(metadataEvidence.observedAt);
  const bindingSha256 = sha256(JSON.stringify({
    sourceId: INEA_RADAR_SOURCE_ID,
    candidateRefSha256,
    contentSha256,
    radarId: metadataEvidence.radarId,
    observedAt,
    provenanceSha256,
    identityEvidenceSha256,
    timestampEvidenceSha256,
    metadataContract: INEA_RADAR_METADATA_BINDING_CONTRACT,
    origin: INEA_RADAR_METADATA_EVIDENCE_ORIGIN,
  }));

  const frame = Object.freeze({
    sourceId: INEA_RADAR_SOURCE_ID,
    radarId: metadataEvidence.radarId,
    observedAt,
    contentSha256,
    imageType: candidateEvidence.imageType,
    byteLength: candidateEvidence.byteLength,
    candidateRefSha256,
    metadataBindingContract: INEA_RADAR_METADATA_BINDING_CONTRACT,
    bindingSha256,
  });
  trustedFrames.add(frame);
  return frame;
}

export function isTrustedIneaRadarMetadataBoundFrame(frame) {
  return Boolean(frame && typeof frame === 'object' && trustedFrames.has(frame));
}
