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
    contract: 'official_radar_tool_gateway+embedded_viewer_resolution',
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
    liveRadarFrameIngestion: 'NOT_IMPLEMENTED',
  };
  console.log('INEA_RADAR_GATEWAY_CONTRACT=PASS');
  console.log('INEA_RADAR_EMBEDDED_VIEWER_RESOLUTION=PASS');
  console.log('INEA_LIVE_RADAR_FRAME_INGESTION=NOT_IMPLEMENTED');
} catch (error) {
  evidence = {
    sourceId: 'inea-radar-tool-gateway',
    contract: 'official_radar_tool_gateway+embedded_viewer_resolution',
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
    liveRadarFrameIngestion: 'NOT_IMPLEMENTED',
  };
  console.error('INEA_RADAR_GATEWAY_CONTRACT=FAIL');
  process.exitCode = 1;
}

await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
