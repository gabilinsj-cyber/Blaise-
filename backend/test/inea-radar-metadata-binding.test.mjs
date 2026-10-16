import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INEA_RADAR_INVENTORY_CONTRACT,
} from '../src/inea-radar-inventory.mjs';
import {
  INEA_RADAR_BINARY_VALIDATION_CONTRACT,
  INEA_RADAR_METADATA_BINDING_CONTRACT,
  INEA_RADAR_METADATA_EVIDENCE_ORIGIN,
  INEA_RADAR_PROVENANCE_CONTRACT,
  IneaRadarMetadataBindingError,
  bindIneaRadarFrameMetadata,
  isTrustedIneaRadarMetadataBoundFrame,
} from '../src/inea-radar-metadata-binding.mjs';
import { INEA_RADAR_SOURCE_ID } from '../src/inea-radar-source.mjs';

const CANDIDATE = '1'.repeat(64);
const CONTENT = '2'.repeat(64);
const PROVENANCE = '3'.repeat(64);
const IDENTITY = '4'.repeat(64);
const TIMESTAMP = '5'.repeat(64);
const INVENTORY = '8'.repeat(64);

function input(overrides = {}) {
  const candidateEvidence = {
    sourceId: INEA_RADAR_SOURCE_ID,
    candidateRefSha256: CANDIDATE,
    contentSha256: CONTENT,
    imageType: 'png',
    byteLength: 2048,
    binaryValidationContract: INEA_RADAR_BINARY_VALIDATION_CONTRACT,
    ...(overrides.candidateEvidence ?? {}),
  };
  const metadataEvidence = {
    contract: INEA_RADAR_METADATA_BINDING_CONTRACT,
    origin: INEA_RADAR_METADATA_EVIDENCE_ORIGIN,
    ambiguityDetected: false,
    candidateRefSha256: CANDIDATE,
    radarId: 'guaratiba',
    observedAt: '2026-09-08T15:55:00.000Z',
    identityEvidenceSha256: IDENTITY,
    timestampEvidenceSha256: TIMESTAMP,
    ...(overrides.metadataEvidence ?? {}),
  };
  const provenanceEvidence = {
    contract: INEA_RADAR_PROVENANCE_CONTRACT,
    provenanceSha256: PROVENANCE,
    ...(overrides.provenanceEvidence ?? {}),
  };
  const inventoryEvidence = overrides.inventoryEvidence === null
    ? null
    : {
        contract: INEA_RADAR_INVENTORY_CONTRACT,
        identities: ['guaratiba', 'macae'],
        inventorySha256: INVENTORY,
        ...(overrides.inventoryEvidence ?? {}),
      };
  return { candidateEvidence, metadataEvidence, provenanceEvidence, inventoryEvidence };
}

function assertCode(fn, code) {
  assert.throws(
    fn,
    (error) => error instanceof IneaRadarMetadataBindingError && error.code === code,
  );
}

test('creates a trusted immutable frame only from same-candidate metadata plus official inventory proof', () => {
  const frame = bindIneaRadarFrameMetadata(input());
  assert.equal(isTrustedIneaRadarMetadataBoundFrame(frame), true);
  assert.equal(Object.isFrozen(frame), true);
  assert.equal(frame.sourceId, INEA_RADAR_SOURCE_ID);
  assert.equal(frame.radarId, 'guaratiba');
  assert.equal(frame.observedAt, '2026-09-08T15:55:00.000Z');
  assert.equal(frame.contentSha256, CONTENT);
  assert.equal(frame.candidateRefSha256, CANDIDATE);
  assert.equal(frame.metadataBindingContract, INEA_RADAR_METADATA_BINDING_CONTRACT);
  assert.equal(frame.inventoryContract, INEA_RADAR_INVENTORY_CONTRACT);
  assert.match(frame.bindingSha256, /^[a-f0-9]{64}$/);
  assert.equal('rawUrl' in frame, false);
  assert.equal('bytes' in frame, false);
});

test('does not trust a structurally identical caller-created object', () => {
  const frame = bindIneaRadarFrameMetadata(input());
  assert.equal(isTrustedIneaRadarMetadataBoundFrame({ ...frame }), false);
});

test('fails closed without a validated official two-radar inventory', () => {
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ inventoryEvidence: null })),
    'inea_radar_binding_inventory_evidence_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ inventoryEvidence: { contract: 'UNVERIFIED' } })),
    'inea_radar_binding_inventory_contract_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ inventoryEvidence: { inventorySha256: 'bad' } })),
    'inea_radar_binding_inventory_digest_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ inventoryEvidence: { identities: ['guaratiba'] } })),
    'inea_radar_binding_inventory_identities_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ inventoryEvidence: { identities: ['guaratiba', 'unknown'] } })),
    'inea_radar_binding_inventory_identities_invalid',
  );
});

test('fails closed when binary and metadata evidence do not reference the exact same candidate', () => {
  assertCode(
    () => bindIneaRadarFrameMetadata(input({
      metadataEvidence: { candidateRefSha256: '6'.repeat(64) },
    })),
    'inea_radar_binding_candidate_ref_mismatch',
  );
});

test('fails closed on non-live, ambiguous or unsupported metadata binding claims', () => {
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ metadataEvidence: { origin: 'TEST_FIXTURE' } })),
    'inea_radar_binding_origin_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ metadataEvidence: { ambiguityDetected: true } })),
    'inea_radar_binding_ambiguous',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ metadataEvidence: { radarId: 'unknown-radar' } })),
    'inea_radar_binding_identity_invalid',
  );
});

test('fails closed on malformed timestamp, evidence digests and validation contracts', () => {
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ metadataEvidence: { observedAt: '08/09/2026 15:55' } })),
    'inea_radar_binding_timestamp_format_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ metadataEvidence: { identityEvidenceSha256: 'bad' } })),
    'inea_radar_binding_identity_evidence_digest_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ candidateEvidence: { binaryValidationContract: 'UNVERIFIED' } })),
    'inea_radar_binding_binary_contract_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ provenanceEvidence: { contract: 'UNVERIFIED' } })),
    'inea_radar_binding_provenance_contract_invalid',
  );
});

test('fails closed on malformed binary frame metadata before the window can ingest it', () => {
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ candidateEvidence: { contentSha256: 'abc' } })),
    'inea_radar_binding_content_digest_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ candidateEvidence: { imageType: 'bmp' } })),
    'inea_radar_binding_image_type_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ candidateEvidence: { byteLength: 3 } })),
    'inea_radar_binding_size_invalid',
  );
  assertCode(
    () => bindIneaRadarFrameMetadata(input({ candidateEvidence: { sourceId: 'spoofed-source' } })),
    'inea_radar_binding_source_invalid',
  );
});
