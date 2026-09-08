import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INEA_RADAR_METADATA_BINDING_CONTRACT,
  INEA_RADAR_METADATA_EVIDENCE_ORIGIN,
  INEA_RADAR_BINARY_VALIDATION_CONTRACT,
  INEA_RADAR_PROVENANCE_CONTRACT,
  bindIneaRadarFrameMetadata,
} from '../src/inea-radar-metadata-binding.mjs';
import {
  INEA_RADAR_IDENTITIES,
  INEA_RADAR_WINDOW_MINUTES,
  IneaRadarFrameWindow,
  IneaRadarWindowError,
} from '../src/inea-radar-window.mjs';
import { INEA_RADAR_SOURCE_ID } from '../src/inea-radar-source.mjs';

const NOW = Date.parse('2026-09-08T16:00:00.000Z');
const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const DIGEST_C = 'c'.repeat(64);
const DIGEST_D = 'd'.repeat(64);
const CANDIDATE_A = '1'.repeat(64);
const CANDIDATE_B = '2'.repeat(64);
const PROVENANCE = '3'.repeat(64);
const IDENTITY_EVIDENCE = '4'.repeat(64);
const TIMESTAMP_EVIDENCE = '5'.repeat(64);

function frame({
  radarId = 'guaratiba',
  observedAt = '2026-09-08T15:55:00.000Z',
  contentSha256 = DIGEST_A,
  imageType = 'png',
  byteLength = 1024,
  candidateRefSha256 = CANDIDATE_A,
} = {}) {
  return bindIneaRadarFrameMetadata({
    candidateEvidence: {
      sourceId: INEA_RADAR_SOURCE_ID,
      candidateRefSha256,
      contentSha256,
      imageType,
      byteLength,
      binaryValidationContract: INEA_RADAR_BINARY_VALIDATION_CONTRACT,
    },
    metadataEvidence: {
      contract: INEA_RADAR_METADATA_BINDING_CONTRACT,
      origin: INEA_RADAR_METADATA_EVIDENCE_ORIGIN,
      ambiguityDetected: false,
      candidateRefSha256,
      radarId,
      observedAt,
      identityEvidenceSha256: IDENTITY_EVIDENCE,
      timestampEvidenceSha256: TIMESTAMP_EVIDENCE,
    },
    provenanceEvidence: {
      contract: INEA_RADAR_PROVENANCE_CONTRACT,
      provenanceSha256: PROVENANCE,
    },
  });
}

function fixedWindow() {
  return new IneaRadarFrameWindow({ now: () => NOW });
}

function assertCode(fn, code) {
  assert.throws(fn, (error) => error instanceof IneaRadarWindowError && error.code === code);
}

test('uses only the two official INEA radar identities in the operational contract', () => {
  assert.deepEqual(INEA_RADAR_IDENTITIES, ['guaratiba', 'macae']);
  assert.equal(INEA_RADAR_WINDOW_MINUTES, 30);
});

test('builds a fresh two-radar animation window without interpolation or raw media retention', () => {
  const window = fixedWindow();
  window.ingest(frame({ observedAt: '2026-09-08T15:50:00.000Z', contentSha256: DIGEST_A, candidateRefSha256: CANDIDATE_A }));
  window.ingest(frame({ observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_B, candidateRefSha256: CANDIDATE_B }));
  window.ingest(frame({ radarId: 'macae', observedAt: '2026-09-08T15:50:00.000Z', contentSha256: DIGEST_C, candidateRefSha256: '6'.repeat(64) }));
  window.ingest(frame({ radarId: 'macae', observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_D, candidateRefSha256: '7'.repeat(64) }));

  const snapshot = window.snapshot();
  assert.equal(snapshot.operational, true);
  assert.equal(snapshot.animationReady, true);
  assert.equal(snapshot.interpolation, 'FORBIDDEN');
  assert.equal(snapshot.storage, 'MEMORY_ONLY');
  assert.equal(snapshot.rawMediaUrls, 'NOT_RETAINED');
  assert.equal(snapshot.binaryContentRetention, 'NONE');
  assert.equal(snapshot.metadataBindingGate, 'TRUSTED_BINDER_REQUIRED');
  assert.deepEqual(snapshot.radars.map((entry) => entry.radarId), ['guaratiba', 'macae']);
  assert.deepEqual(snapshot.radars.map((entry) => entry.frameCount), [2, 2]);
  for (const radar of snapshot.radars) {
    for (const publicFrame of radar.frames) {
      assert.deepEqual(Object.keys(publicFrame).sort(), [
        'byteLength',
        'contentSha256',
        'imageType',
        'observedAt',
        'radarId',
      ]);
    }
  }
});

test('rejects legacy or caller-forged validation booleans instead of trusting them', () => {
  const window = fixedWindow();
  assertCode(
    () => window.ingest({
      sourceId: INEA_RADAR_SOURCE_ID,
      radarId: 'guaratiba',
      observedAt: '2026-09-08T15:55:00.000Z',
      contentSha256: DIGEST_A,
      imageType: 'png',
      byteLength: 1024,
      provenanceValidated: true,
      binaryValidated: true,
      metadataBindingValidated: true,
    }),
    'inea_radar_frame_metadata_binding_untrusted',
  );
});

test('rejects frames more than two minutes in the future', () => {
  const window = fixedWindow();
  assertCode(
    () => window.ingest(frame({ observedAt: '2026-09-08T16:02:00.001Z' })),
    'inea_radar_frame_from_future',
  );
});

test('rejects frames outside the 30 minute operational window', () => {
  const window = fixedWindow();
  assertCode(
    () => window.ingest(frame({ observedAt: '2026-09-08T15:29:59.999Z' })),
    'inea_radar_frame_stale',
  );
});

test('rejects duplicate temporal slots for the same radar even when content differs', () => {
  const window = fixedWindow();
  window.ingest(frame({ observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_A, candidateRefSha256: CANDIDATE_A }));
  assertCode(
    () => window.ingest(frame({ observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_B, candidateRefSha256: CANDIDATE_B })),
    'inea_radar_frame_timestamp_duplicate',
  );
});

test('marks stale or incomplete radar windows non-operational and prunes expired frames', () => {
  let now = NOW;
  const window = new IneaRadarFrameWindow({ now: () => now });
  window.ingest(frame({ radarId: 'guaratiba', observedAt: '2026-09-08T15:55:00.000Z' }));

  let snapshot = window.snapshot();
  assert.equal(snapshot.operational, false);
  assert.equal(snapshot.animationReady, false);
  assert.equal(snapshot.radars.find((entry) => entry.radarId === 'guaratiba').fresh, true);
  assert.equal(snapshot.radars.find((entry) => entry.radarId === 'macae').fresh, false);

  now = Date.parse('2026-09-08T16:26:00.001Z');
  snapshot = window.snapshot();
  assert.equal(snapshot.radars.find((entry) => entry.radarId === 'guaratiba').frameCount, 0);
  assert.equal(snapshot.operational, false);
});

test('detects cadence gaps larger than two official five-minute intervals', () => {
  const window = fixedWindow();
  window.ingest(frame({ observedAt: '2026-09-08T15:40:00.000Z', contentSha256: DIGEST_A, candidateRefSha256: CANDIDATE_A }));
  window.ingest(frame({ observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_B, candidateRefSha256: CANDIDATE_B }));
  window.ingest(frame({ radarId: 'macae', observedAt: '2026-09-08T15:50:00.000Z', contentSha256: DIGEST_C, candidateRefSha256: '6'.repeat(64) }));
  window.ingest(frame({ radarId: 'macae', observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_D, candidateRefSha256: '7'.repeat(64) }));

  const guaratiba = window.snapshot().radars.find((entry) => entry.radarId === 'guaratiba');
  assert.equal(guaratiba.cadenceGapCount, 1);
  assert.equal(guaratiba.animationReady, false);
});
