import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createIneaRadarProbeEvidence,
  markIneaRadarInventoryPass,
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

function inventoryFixture() {
  return {
    contract: 'OFFICIAL_INEA_RADAR_INVENTORY_VALIDATED',
    sourceHost: 'www.inea.rj.gov.br',
    sourceUrlSha256: '8'.repeat(64),
    identities: ['guaratiba', 'macae'],
    identityCount: 2,
    inventorySha256: '9'.repeat(64),
    sameCandidateIdentityBinding: 'NOT_IMPLEMENTED',
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

test('preserves proven official provenance and inventory when the downstream radar gateway times out', () => {
  let evidence = createIneaRadarProbeEvidence(checkedAt);
  evidence = markIneaRadarProvenancePass(evidence, provenanceFixture());
  evidence = markIneaRadarInventoryPass(evidence, inventoryFixture());
  evidence = markIneaRadarProbeFailure(evidence, 'inea_radar_source_timeout');

  assert.equal(evidence.status, 'FAIL');
  assert.equal(evidence.officialProvenance.status, 'PASS');
  assert.equal(evidence.officialProvenance.rawPublicRadarUrl, 'REDACTED');
  assert.equal(evidence.officialRadarInventory.status, 'PASS');
  assert.equal(evidence.officialRadarInventory.rawSourceUrl, 'REDACTED');
  assert.deepEqual(evidence.officialRadarInventory.identities, ['guaratiba', 'macae']);
  assert.equal(evidence.gatewayContract.status, 'FAIL');
  assert.equal(evidence.gatewayContract.errorCode, 'inea_radar_source_timeout');
  assert.equal(evidence.embeddedViewerResolution.status, 'FAIL');
  assert.equal(evidence.mediaCandidateDiscovery.status, 'FAIL');
  assert.equal(evidence.frameBinaryValidation.status, 'FAIL');
  assert.equal(evidence.frameBinaryValidation.binaryContentRetention, 'NONE');
  assert.equal(evidence.radarIdentityValidation, 'NOT_IMPLEMENTED');
  assert.equal(evidence.liveRadarFrameIngestion, 'NOT_IMPLEMENTED');
});

test('preserves provenance but fails inventory and downstream stages when inventory validation fails', () => {
  let evidence = createIneaRadarProbeEvidence(checkedAt);
  evidence = markIneaRadarProvenancePass(evidence, provenanceFixture());
  evidence = markIneaRadarProbeFailure(evidence, 'inea_radar_inventory_source_timeout');

  assert.equal(evidence.status, 'FAIL');
  assert.equal(evidence.officialProvenance.status, 'PASS');
  assert.equal(evidence.officialRadarInventory.status, 'FAIL');
  assert.equal(evidence.officialRadarInventory.errorCode, 'inea_radar_inventory_source_timeout');
  assert.equal(evidence.gatewayContract.status, 'FAIL');
});

test('marks provenance, inventory and downstream stages failed when failure happens before provenance is proven', () => {
  const evidence = markIneaRadarProbeFailure(
    createIneaRadarProbeEvidence(checkedAt),
    'inea_radar_provenance_source_timeout',
  );
  assert.equal(evidence.status, 'FAIL');
  assert.equal(evidence.officialProvenance.status, 'FAIL');
  assert.equal(evidence.officialProvenance.errorCode, 'inea_radar_provenance_source_timeout');
  assert.equal(evidence.officialRadarInventory.status, 'FAIL');
  assert.equal(evidence.gatewayContract.status, 'FAIL');
});

test('records a complete bounded tool pass while same-candidate identity and time semantics remain unproven', () => {
  let evidence = createIneaRadarProbeEvidence(checkedAt);
  evidence = markIneaRadarProvenancePass(evidence, provenanceFixture());
  evidence = markIneaRadarInventoryPass(evidence, inventoryFixture());
  evidence = markIneaRadarToolPass(evidence, toolFixture());

  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.officialProvenance.status, 'PASS');
  assert.equal(evidence.officialRadarInventory.status, 'PASS');
  assert.equal(evidence.officialRadarInventory.identityCount, 2);
  assert.equal(evidence.officialRadarInventory.sameCandidateIdentityBinding, 'NOT_IMPLEMENTED');
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
