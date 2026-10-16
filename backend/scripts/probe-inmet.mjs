import { mkdir, writeFile } from 'node:fs/promises';

import {
  INMET_SOURCE_ID,
  InmetSourceContractError,
  probeInmetCapWarnings,
} from '../src/inmet-source.mjs';
import { evaluateInmetP0Policy } from '../src/inmet-p0-policy.mjs';

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
    certainty: record.certainty,
    onset: record.onset,
    expires: record.expires,
    areaCount: record.areaCount,
    affectsRioDeJaneiro: record.affectsRioDeJaneiro,
    rjMatchMethod: record.rjMatchMethod,
    rjMunicipalityIbges: record.rjMunicipalityIbges,
  }));
}

function reasonCounts(entries) {
  const counts = {};
  for (const entry of entries) counts[entry.reason] = (counts[entry.reason] || 0) + 1;
  return counts;
}

const evidence = {
  sourceId: INMET_SOURCE_ID,
  contract: 'official_cap_warning_feed+rj_geofence+dry_run_p0_policy',
  status: 'BLOCKED_SOURCE_CONTRACT',
  execution: 'LIVE_PUBLIC_SOURCE_PROBE',
  liveAlertDeliveryToApp: 'NOT_IMPLEMENTED',
  fcmPublication: 'NOT_PERFORMED',
  p0PromotionPolicy: 'IMPLEMENTED_DRY_RUN_ONLY',
};

try {
  const result = await probeInmetCapWarnings();
  const p0Policy = evaluateInmetP0Policy(result);
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
  evidence.p0Policy = {
    policyId: p0Policy.policyId,
    evaluatedAt: p0Policy.evaluatedAt,
    candidateCount: p0Policy.candidateCount,
    blockedCount: p0Policy.blockedCount,
    ineligibleCount: p0Policy.ineligibleCount,
    blockedReasons: reasonCounts(p0Policy.blocked),
    ineligibleReasons: reasonCounts(p0Policy.ineligible),
    threshold: p0Policy.threshold,
    municipalScope: p0Policy.municipalScope,
    delivery: p0Policy.delivery,
  };
} catch (error) {
  evidence.errorCode = errorCode(error);
}

await mkdir('evidence/official-sources', { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

if (evidence.status !== 'PASS_SOURCE_CONTRACT') {
  console.error(`INMET_SOURCE_PROBE=BLOCKED:${evidence.errorCode}`);
  process.exitCode = 1;
} else {
  console.log(`INMET_SOURCE_PROBE=PASS:rj=${evidence.rjWarningCount}:total=${evidence.activeWarningCount}:p0_candidates=${evidence.p0Policy.candidateCount}`);
}
