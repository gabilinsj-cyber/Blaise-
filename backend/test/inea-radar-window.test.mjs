import assert from 'node:assert/strict';
import test from 'node:test';

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

function frame({
  radarId = 'guaratiba',
  observedAt = '2026-09-08T15:55:00.000Z',
  contentSha256 = DIGEST_A,
  imageType = 'png',
  byteLength = 1024,
  sourceId = INEA_RADAR_SOURCE_ID,
  provenanceValidated = true,
  binaryValidated = true,
  metadataBindingValidated = true,
} = {}) {
  return {
    sourceId,
    radarId,
    observedAt,
    contentSha256,
    imageType,
    byteLength,
    provenanceValidated,
    binaryValidated,
    metadataBindingValidated,
    rawUrl: 'https://should-not-be-retained.invalid/frame.png',
    bytes: new Uint8Array([1, 2, 3]),
  };
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
  window.ingest(frame({ observedAt: '2026-09-08T15:50:00.000Z', contentSha256: DIGEST_A }));
  window.ingest(frame({ observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_B }));
  window.ingest(frame({ radarId: 'macae', observedAt: '2026-09-08T15:50:00.000Z', contentSha256: DIGEST_C }));
  window.ingest(frame({ radarId: 'macae', observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_D }));

  const snapshot = window.snapshot();
  assert.equal(snapshot.operational, true);
  assert.equal(snapshot.animationReady, true);
  assert.equal(snapshot.interpolation, 'FORBIDDEN');
  assert.equal(snapshot.storage, 'MEMORY_ONLY');
  assert.equal(snapshot.rawMediaUrls, 'NOT_RETAINED');
  assert.equal(snapshot.binaryContentRetention, 'NONE');
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

test('rejects an unrecognized radar identity fail-closed', () => {
  const window = fixedWindow();
  assertCode(
    () => window.ingest(frame({ radarId: 'unknown-radar' })),
    'inea_radar_frame_identity_invalid',
  );
});

test('requires provenance, binary and metadata binding validation before ingestion', () => {
  for (const missing of ['provenanceValidated', 'binaryValidated', 'metadataBindingValidated']) {
    const window = fixedWindow();
    const candidate = frame();
    candidate[missing] = false;
    assertCode(
      () => window.ingest(candidate),
      'inea_radar_frame_validation_chain_incomplete',
    );
  }
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
  window.ingest(frame({ observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_A }));
  assertCode(
    () => window.ingest(frame({ observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_B })),
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
  window.ingest(frame({ observedAt: '2026-09-08T15:40:00.000Z', contentSha256: DIGEST_A }));
  window.ingest(frame({ observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_B }));
  window.ingest(frame({ radarId: 'macae', observedAt: '2026-09-08T15:50:00.000Z', contentSha256: DIGEST_C }));
  window.ingest(frame({ radarId: 'macae', observedAt: '2026-09-08T15:55:00.000Z', contentSha256: DIGEST_D }));

  const guaratiba = window.snapshot().radars.find((entry) => entry.radarId === 'guaratiba');
  assert.equal(guaratiba.cadenceGapCount, 1);
  assert.equal(guaratiba.animationReady, false);
});

test('rejects malformed digest, image type, size, timestamp and source contracts', () => {
  assertCode(() => fixedWindow().ingest(frame({ contentSha256: 'abc' })), 'inea_radar_frame_digest_invalid');
  assertCode(() => fixedWindow().ingest(frame({ imageType: 'bmp' })), 'inea_radar_frame_image_type_invalid');
  assertCode(() => fixedWindow().ingest(frame({ byteLength: 3 })), 'inea_radar_frame_size_invalid');
  assertCode(() => fixedWindow().ingest(frame({ observedAt: '08/09/2026 15:55' })), 'inea_radar_frame_timestamp_format_invalid');
  assertCode(() => fixedWindow().ingest(frame({ sourceId: 'spoofed-source' })), 'inea_radar_frame_source_invalid');
});
