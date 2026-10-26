import { mkdir, writeFile } from 'node:fs/promises';

import {
  CemadenRjCacheError,
  evaluateCemadenRjOperationalFreshness,
} from '../src/cemaden-rj-cache.mjs';
import {
  CEMADEN_RJ_SOURCE_ID,
  CemadenRjSourceContractError,
  probeCemadenRjHydrologicalRisk,
} from '../src/cemaden-rj-source.mjs';

const evidencePath = 'evidence/official-sources/cemaden-rj-hydrological-risk.json';

function errorCode(error) {
  if (error instanceof CemadenRjSourceContractError) return error.code;
  if (error instanceof CemadenRjCacheError) return error.code;
  if (typeof error?.code === 'string') return error.code;
  return 'cemaden_unexpected_error';
}

const evidence = {
  sourceId: CEMADEN_RJ_SOURCE_ID,
  contract: 'official_hydrological_risk_status_92_municipalities',
  status: 'BLOCKED_SOURCE_CONTRACT',
  execution: 'LIVE_PUBLIC_SOURCE_PROBE',
  operationalFreshnessValidation: 'BLOCKED_NOT_EVALUATED',
  appRiskReconciliation: 'NOT_IMPLEMENTED',
  p0PromotionPolicy: 'NOT_IMPLEMENTED',
  rawHtmlRetention: 'NONE',
};

try {
  const result = await probeCemadenRjHydrologicalRisk();
  const freshness = evaluateCemadenRjOperationalFreshness(result, { checkedAt: Date.now() });
  if (freshness.status !== 'PASS_CURRENT_AT_CHECK_TIME') {
    const error = new Error('cemaden_rj_operational_freshness_blocked');
    error.code = 'cemaden_rj_operational_freshness_blocked';
    throw error;
  }

  evidence.status = 'PASS_SOURCE_CONTRACT_AND_FRESHNESS';
  evidence.sourceHost = result.sourceHost;
  evidence.municipalityCount = result.municipalityCount;
  evidence.municipalCoverage = result.municipalCoverage;
  evidence.countsByRisk = result.countsByRisk;
  evidence.maxPriority = result.maxPriority;
  evidence.highestRisk = result.highestRisk;
  evidence.oldestObservedAt = result.oldestObservedAt;
  evidence.latestObservedAt = result.latestObservedAt;
  evidence.statusInventorySha256 = result.statusInventorySha256;
  evidence.riskPriorityValidation = result.riskPriorityValidation;
  evidence.timestampValidation = result.timestampValidation;
  evidence.operationalFreshnessValidation = freshness.status;
  evidence.freshnessCheckedAt = freshness.checkedAt;
  evidence.normalFreshness = freshness.normal;
  evidence.severeFreshness = freshness.severe;
  evidence.freshnessPayloadExposed = freshness.payloadExposed;
} catch (error) {
  evidence.errorCode = errorCode(error);
}

await mkdir('evidence/official-sources', { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

if (evidence.status !== 'PASS_SOURCE_CONTRACT_AND_FRESHNESS') {
  console.error(`CEMADEN_RJ_SOURCE_PROBE=BLOCKED:${evidence.errorCode}`);
  process.exitCode = 1;
} else {
  console.log(`CEMADEN_RJ_SOURCE_PROBE=PASS:municipalities=${evidence.municipalityCount}:maxPriority=${evidence.maxPriority}`);
}
