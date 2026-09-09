import { mkdir, writeFile } from 'node:fs/promises';

import {
  INMET_SOURCE_ID,
  InmetSourceContractError,
  probeInmetCapWarnings,
} from '../src/inmet-source.mjs';

const evidencePath = 'evidence/official-sources/inmet.json';

function errorCode(error) {
  if (error instanceof InmetSourceContractError) return error.code;
  return 'inmet_unexpected_error';
}

function sanitizedWarnings(records) {
  return records.map((record) => ({
    identifier: record.identifier,
    sent: record.sent,
    event: record.event,
    urgency: record.urgency,
    severity: record.severity,
    onset: record.onset,
    expires: record.expires,
    areaCount: record.areaCount,
    affectsRioDeJaneiro: record.affectsRioDeJaneiro,
    rjMatchMethod: record.rjMatchMethod,
  }));
}

const evidence = {
  sourceId: INMET_SOURCE_ID,
  contract: 'official_cap_warning_feed+rj_geofence',
  status: 'BLOCKED_SOURCE_CONTRACT',
  execution: 'LIVE_PUBLIC_SOURCE_PROBE',
  liveAlertDeliveryToApp: 'NOT_IMPLEMENTED',
  p0PromotionPolicy: 'NOT_IMPLEMENTED',
};

try {
  const result = await probeInmetCapWarnings();
  evidence.status = 'PASS_SOURCE_CONTRACT';
  evidence.sourceHost = result.sourceHost;
  evidence.feedShape = result.feedShape;
  evidence.activeWarningCount = result.activeWarningCount;
  evidence.rjWarningCount = result.rjWarningCount;
  evidence.warningInventorySha256 = result.warningInventorySha256;
  evidence.identityValidation = result.identityValidation;
  evidence.temporalValidityValidation = result.temporalValidityValidation;
  evidence.rjGeofenceValidation = result.rjGeofenceValidation;
  evidence.polygonRetention = result.polygonRetention;
  evidence.rawFeedRetention = result.rawFeedRetention;
  evidence.warnings = sanitizedWarnings(result.warnings);
} catch (error) {
  evidence.errorCode = errorCode(error);
}

await mkdir('evidence/official-sources', { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

if (evidence.status !== 'PASS_SOURCE_CONTRACT') {
  console.error(`INMET_SOURCE_PROBE=BLOCKED:${evidence.errorCode}`);
  process.exitCode = 1;
} else {
  console.log(`INMET_SOURCE_PROBE=PASS:rj=${evidence.rjWarningCount}:total=${evidence.activeWarningCount}`);
}
