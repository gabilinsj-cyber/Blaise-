import { mkdir, writeFile } from 'node:fs/promises';

import { probeIneaRadarTool } from '../src/inea-radar-source.mjs';

const evidenceDir = new URL('../../evidence/official-sources/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
const evidenceFile = new URL('inea-radar.json', evidenceDir);
const checkedAt = new Date().toISOString();

function errorCode(reason) {
  return typeof reason?.code === 'string' ? reason.code : 'unexpected_error';
}

let evidence;
try {
  const result = await probeIneaRadarTool();
  evidence = {
    sourceId: result.sourceId,
    contract: 'official_radar_tool_gateway+embedded_viewer_resolution+media_candidate_discovery+binary_envelope_validation',
    status: 'PASS',
    checkedAt,
    gatewayContract: {
      status: 'PASS',
      sourceHost: result.sourceHost,
      radarCadenceMinutes: result.radarCadenceMinutes,
      embeddedViewerDetected: result.embeddedViewerDetected,
      iframeCount: result.iframeCount,
      gatewaySha256: result.gatewaySha256,
    },
    embeddedViewerResolution: {
      status: 'PASS',
      contract: result.viewerContract,
      viewerHost: result.viewerHost,
      viewerUrlSha256: result.viewerUrlSha256,
      rawViewerUrl: 'REDACTED',
    },
    mediaCandidateDiscovery: {
      status: 'PASS',
      contract: result.mediaCandidateDiscovery,
      candidateCount: result.mediaCandidateCount,
      candidateHosts: result.mediaCandidateHosts,
      candidateSetSha256: result.mediaCandidateSetSha256,
      rawMediaUrls: 'REDACTED',
    },
    frameBinaryValidation: {
      status: 'PASS',
      contract: result.frameBinaryValidation,
      validatedCandidateCount: result.binaryValidatedCandidateCount,
      imageTypes: result.binaryImageTypes,
      totalValidatedBytes: result.binaryTotalValidatedBytes,
      duplicateContentCount: result.binaryDuplicateContentCount,
      binarySetSha256: result.binarySetSha256,
      rawMediaUrls: 'REDACTED',
      binaryContentRetention: result.binaryContentRetention,
    },
    radarIdentityValidation: result.radarIdentityValidation,
    frameTimestampValidation: result.frameTimestampValidation,
    frameFreshnessValidation: result.frameFreshnessValidation,
    liveRadarFrameIngestion: result.frameIngestion,
  };
  console.log('INEA_RADAR_GATEWAY_CONTRACT=PASS');
  console.log('INEA_RADAR_EMBEDDED_VIEWER_RESOLUTION=PASS');
  console.log('INEA_RADAR_MEDIA_CANDIDATE_DISCOVERY=PASS');
  console.log('INEA_RADAR_FRAME_BINARY_VALIDATION=PASS');
  console.log(`INEA_RADAR_IDENTITY_VALIDATION=${result.radarIdentityValidation}`);
  console.log(`INEA_RADAR_FRAME_TIMESTAMP_VALIDATION=${result.frameTimestampValidation}`);
  console.log(`INEA_RADAR_FRAME_FRESHNESS_VALIDATION=${result.frameFreshnessValidation}`);
  console.log(`INEA_LIVE_RADAR_FRAME_INGESTION=${result.frameIngestion}`);
} catch (error) {
  evidence = {
    sourceId: 'inea-radar-tool-gateway',
    contract: 'official_radar_tool_gateway+embedded_viewer_resolution+media_candidate_discovery+binary_envelope_validation',
    status: 'FAIL',
    checkedAt,
    gatewayContract: {
      status: 'FAIL',
      errorCode: errorCode(error),
    },
    embeddedViewerResolution: {
      status: 'FAIL',
      errorCode: errorCode(error),
    },
    mediaCandidateDiscovery: {
      status: 'FAIL',
      errorCode: errorCode(error),
    },
    frameBinaryValidation: {
      status: 'FAIL',
      errorCode: errorCode(error),
      binaryContentRetention: 'NONE',
    },
    radarIdentityValidation: 'NOT_IMPLEMENTED',
    frameTimestampValidation: 'NOT_IMPLEMENTED',
    frameFreshnessValidation: 'NOT_IMPLEMENTED',
    liveRadarFrameIngestion: 'NOT_IMPLEMENTED',
  };
  console.error('INEA_RADAR_GATEWAY_CONTRACT=FAIL');
  process.exitCode = 1;
}

await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
