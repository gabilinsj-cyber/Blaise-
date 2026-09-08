const CONTRACT = 'official_monitoring_page_provenance+official_radar_tool_gateway+embedded_viewer_resolution+media_candidate_discovery+binary_envelope_validation';

function failStage(stage, errorCode, extra = {}) {
  if (stage?.status === 'PASS') return stage;
  return Object.freeze({ status: 'FAIL', errorCode, ...extra });
}

export function createIneaRadarProbeEvidence(checkedAt) {
  if (typeof checkedAt !== 'string' || checkedAt.length < 1) {
    throw new TypeError('checkedAt is required');
  }
  return {
    sourceId: 'inea-radar-tool-gateway',
    contract: CONTRACT,
    status: 'IN_PROGRESS',
    checkedAt,
    officialProvenance: { status: 'NOT_RUN' },
    gatewayContract: { status: 'NOT_RUN' },
    embeddedViewerResolution: { status: 'NOT_RUN' },
    mediaCandidateDiscovery: { status: 'NOT_RUN' },
    frameBinaryValidation: { status: 'NOT_RUN', binaryContentRetention: 'NONE' },
    radarIdentityValidation: 'NOT_IMPLEMENTED',
    frameTimestampValidation: 'NOT_IMPLEMENTED',
    frameFreshnessValidation: 'NOT_IMPLEMENTED',
    liveRadarFrameIngestion: 'NOT_IMPLEMENTED',
  };
}

export function markIneaRadarProvenancePass(evidence, provenance) {
  return {
    ...evidence,
    officialProvenance: {
      status: 'PASS',
      contract: provenance.contract,
      monitoringPageHost: provenance.monitoringPageHost,
      publicRadarHost: provenance.publicRadarHost,
      publicRadarUrlSha256: provenance.publicRadarUrlSha256,
      rawPublicRadarUrl: 'REDACTED',
      cadenceMinutes: provenance.cadenceMinutes,
      provenanceSha256: provenance.provenanceSha256,
    },
  };
}

export function markIneaRadarToolPass(evidence, result) {
  return {
    ...evidence,
    sourceId: result.sourceId,
    status: 'PASS',
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
}

export function markIneaRadarProbeFailure(evidence, errorCode) {
  const code = typeof errorCode === 'string' && errorCode.length > 0 ? errorCode : 'unexpected_error';
  return {
    ...evidence,
    status: 'FAIL',
    officialProvenance: failStage(evidence.officialProvenance, code),
    gatewayContract: failStage(evidence.gatewayContract, code),
    embeddedViewerResolution: failStage(evidence.embeddedViewerResolution, code),
    mediaCandidateDiscovery: failStage(evidence.mediaCandidateDiscovery, code),
    frameBinaryValidation: failStage(evidence.frameBinaryValidation, code, { binaryContentRetention: 'NONE' }),
    radarIdentityValidation: 'NOT_IMPLEMENTED',
    frameTimestampValidation: 'NOT_IMPLEMENTED',
    frameFreshnessValidation: 'NOT_IMPLEMENTED',
    liveRadarFrameIngestion: 'NOT_IMPLEMENTED',
  };
}
