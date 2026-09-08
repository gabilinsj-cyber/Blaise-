import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createIneaRadarProbeEvidence,
  markIneaRadarProbeFailure,
  markIneaRadarProvenancePass,
  markIneaRadarToolPass,
} from '../src/inea-radar-probe-evidence.mjs';

const checkedAt = '2026-09-08T16:36:48.183Z';

function provenanceFixture() {
  return {
    contract: 'OFFICIAL_INEA_RADAR_PROVENANCE_VALIDATED',
    monitoringPageHost: 'www.inea.rj.gov.br',
    publicRadarHost: 'alertadecheias.inea.rj.gov.br',
    publicRadarUrlSha256: 'a'.repeat(64),
    cadenceMinutes: 5,
    provenanceSha256: 'b'.repeat(64),
  };
}

function toolFixture() {
  return {
    sourceId: 'inea-radar-tool-gateway',
    sourceHost: 'alertadecheias.inea.rj.gov.br',
    radarCadenceMinutes: 5,
    embeddedViewerDetected: true,
    iframeCount: 1,
    gatewaySha256: 'c'.repeat(64),
    viewerContract: 'OFFICIAL_HTTPS_IFRAME_RESOLVED',
    viewerHost: 'alertadecheias.inea.rj.gov.br',
    viewerUrlSha256: 'd'.repeat(64),
    mediaCandidateDiscovery: 'OFFICIAL_HTTPS_RADAR_MEDIA_CANDIDATES_DISCOVERED',
    mediaCandidateCount: 2,
    mediaCandidateHosts: ['alertadecheias.inea.rj.gov.br'],
    mediaCandidateSetSha256: 'e'.repeat(64),
    frameBinaryValidation: 'OFFICIAL_IMAGE_BINARY_ENVELOPES_VALIDATED',
    binaryValidatedCandidateCount: 2,
    binaryImageTypes: ['png'],
    binaryTotalValidatedBytes: 2048,
    binaryDuplicateContentCount: 0,
    binarySetSha256: 'f'.repeat(64),
    binaryContentRetention: 'NONE',
    radarIdentityValidation: 'NOT_IMPLEMENTED',
    frameTimestampValidation: 'NOT_IMPLEMENTED',
    frameFreshnessValidation: 'NOT_IMPLEMENTED',
    frameIngestion: 'NOT_IMPLEMENTED',
  };
}

test('preserves a proven official provenance stage when the downstream radar gateway times out', () => {
  let evidence = createIneaRadarProbeEvidence(checkedAt);
  evidence = markIneaRadarProvenancePass(evidence, provenanceFixture());
  evidence = markIneaRadarProbeFailure(evidence, 'inea_radar_source_timeout');

  assert.equal(evidence.status, 'FAIL');
  assert.equal(evidence.officialProvenance.status, 'PASS');
  assert.equal(evidence.officialProvenance.rawPublicRadarUrl, 'REDACTED');
  assert.equal(evidence.gatewayContract.status, 'FAIL');
  assert.equal(evidence.gatewayContract.errorCode, 'inea_radar_source_timeout');
  assert.equal(evidence.embeddedViewerResolution.status, 'FAIL');
  assert.equal(evidence.mediaCandidateDiscovery.status, 'FAIL');
  assert.equal(evidence.frameBinaryValidation.status, 'FAIL');
  assert.equal(evidence.frameBinaryValidation.binaryContentRetention, 'NONE');
  assert.equal(evidence.radarIdentityValidation, 'NOT_IMPLEMENTED');
  assert.equal(evidence.liveRadarFrameIngestion, 'NOT_IMPLEMENTED');
});

test('marks provenance and downstream stages failed when failure happens before provenance is proven', () => {
  const evidence = markIneaRadarProbeFailure(
    createIneaRadarProbeEvidence(checkedAt),
    'inea_radar_provenance_source_timeout',
  );
  assert.equal(evidence.status, 'FAIL');
  assert.equal(evidence.officialProvenance.status, 'FAIL');
  assert.equal(evidence.officialProvenance.errorCode, 'inea_radar_provenance_source_timeout');
  assert.equal(evidence.gatewayContract.status, 'FAIL');
});

test('records a complete bounded tool pass without upgrading unproven frame semantics', () => {
  let evidence = createIneaRadarProbeEvidence(checkedAt);
  evidence = markIneaRadarProvenancePass(evidence, provenanceFixture());
  evidence = markIneaRadarToolPass(evidence, toolFixture());

  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.officialProvenance.status, 'PASS');
  assert.equal(evidence.gatewayContract.status, 'PASS');
  assert.equal(evidence.embeddedViewerResolution.status, 'PASS');
  assert.equal(evidence.mediaCandidateDiscovery.status, 'PASS');
  assert.equal(evidence.frameBinaryValidation.status, 'PASS');
  assert.equal(evidence.frameBinaryValidation.binaryContentRetention, 'NONE');
  assert.equal(evidence.radarIdentityValidation, 'NOT_IMPLEMENTED');
  assert.equal(evidence.frameTimestampValidation, 'NOT_IMPLEMENTED');
  assert.equal(evidence.frameFreshnessValidation, 'NOT_IMPLEMENTED');
  assert.equal(evidence.liveRadarFrameIngestion, 'NOT_IMPLEMENTED');
  assert.doesNotMatch(JSON.stringify(evidence), /https:\/\/alertadecheias\.inea\.rj\.gov\.br\/radar\.php/);
});
