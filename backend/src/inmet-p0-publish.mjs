import { createHash } from 'node:crypto';

import { ClientInputError } from './core.mjs';
import { validateP0Alert } from './fcm.mjs';
import { evaluateInmetP0Policy, INMET_P0_POLICY_ID } from './inmet-p0-policy.mjs';
import { INMET_SOURCE_ID } from './inmet-source.mjs';

export const INMET_P0_BATCH_SCHEMA = 'inmet-p0-batch-v1';
export const INMET_P0_MAX_BATCH = 256;

export class InmetP0PublishError extends Error {
  constructor(code) {
    super(code);
    this.name = 'InmetP0PublishError';
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalAlert(alert, nowMillis) {
  let normalized;
  try {
    normalized = validateP0Alert(alert, nowMillis);
  } catch (error) {
    if (error instanceof ClientInputError) throw new InmetP0PublishError('inmet_p0_batch_alert_invalid');
    throw error;
  }
  const result = {
    id: normalized.id,
    authority: 'official',
    severity: 'P0',
    title: normalized.title,
    source: normalized.source,
    issuedAt: normalized.issuedAt,
    expiresAt: normalized.expiresAt,
  };
  if (normalized.cityName) {
    result.cityName = normalized.cityName;
    result.cityIbge = normalized.cityIbge;
  }
  return result;
}

function digestAlerts(alerts) {
  return sha256(JSON.stringify(alerts));
}

export function stageInmetP0Batch(snapshot, nowMillis = Date.now()) {
  if (!Number.isFinite(nowMillis)) throw new InmetP0PublishError('inmet_p0_stage_now_invalid');
  const policy = evaluateInmetP0Policy(snapshot, nowMillis);
  if (policy.policyId !== INMET_P0_POLICY_ID || policy.sourceId !== INMET_SOURCE_ID) {
    throw new InmetP0PublishError('inmet_p0_stage_policy_identity_invalid');
  }
  if (policy.candidates.length !== policy.candidateCount) {
    throw new InmetP0PublishError('inmet_p0_stage_candidate_count_invalid');
  }
  if (policy.candidateCount > INMET_P0_MAX_BATCH) {
    throw new InmetP0PublishError('inmet_p0_stage_batch_too_large');
  }

  const seen = new Set();
  const alerts = policy.candidates
    .map((candidate) => {
      if (!candidate || (candidate.scope !== 'STATEWIDE' && candidate.scope !== 'MUNICIPALITY')) {
        throw new InmetP0PublishError('inmet_p0_stage_candidate_invalid');
      }
      const alert = canonicalAlert(candidate.alert, nowMillis);
      if (seen.has(alert.id)) throw new InmetP0PublishError('inmet_p0_stage_duplicate_alert_id');
      seen.add(alert.id);
      return Object.freeze(alert);
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return Object.freeze({
    schema: INMET_P0_BATCH_SCHEMA,
    sourceId: INMET_SOURCE_ID,
    policyId: INMET_P0_POLICY_ID,
    evaluatedAt: policy.evaluatedAt,
    candidateCount: alerts.length,
    blockedCount: policy.blockedCount,
    ineligibleCount: policy.ineligibleCount,
    batchSha256: digestAlerts(alerts),
    alerts: Object.freeze(alerts),
    delivery: 'STAGED_NOT_PUBLISHED',
  });
}

function validateStagedBatch(batch, nowMillis) {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) {
    throw new InmetP0PublishError('inmet_p0_batch_invalid');
  }
  if (batch.schema !== INMET_P0_BATCH_SCHEMA || batch.sourceId !== INMET_SOURCE_ID || batch.policyId !== INMET_P0_POLICY_ID) {
    throw new InmetP0PublishError('inmet_p0_batch_identity_invalid');
  }
  if (!Array.isArray(batch.alerts) || batch.alerts.length !== batch.candidateCount || batch.alerts.length > INMET_P0_MAX_BATCH) {
    throw new InmetP0PublishError('inmet_p0_batch_count_invalid');
  }
  const seen = new Set();
  const canonical = batch.alerts.map((alert) => {
    const normalized = canonicalAlert(alert, nowMillis);
    if (seen.has(normalized.id)) throw new InmetP0PublishError('inmet_p0_batch_duplicate_alert_id');
    seen.add(normalized.id);
    return normalized;
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (digestAlerts(canonical) !== batch.batchSha256) {
    throw new InmetP0PublishError('inmet_p0_batch_digest_mismatch');
  }
  return canonical;
}

export async function publishStagedInmetP0Batch(batch, {
  sendAlert,
  nowMillis = Date.now(),
} = {}) {
  if (typeof sendAlert !== 'function') throw new InmetP0PublishError('inmet_p0_sender_missing');
  if (!Number.isFinite(nowMillis)) throw new InmetP0PublishError('inmet_p0_publish_now_invalid');
  const alerts = validateStagedBatch(batch, nowMillis);

  let duplicateCount = 0;
  let acceptedCount = 0;
  for (const alert of alerts) {
    let result;
    try {
      result = await sendAlert(alert);
    } catch {
      throw new InmetP0PublishError('inmet_p0_backend_publish_failed');
    }
    if (!result || result.accepted !== true) {
      throw new InmetP0PublishError('inmet_p0_backend_not_accepted');
    }
    acceptedCount += 1;
    if (result.duplicate === true) duplicateCount += 1;
  }

  return Object.freeze({
    schema: INMET_P0_BATCH_SCHEMA,
    batchSha256: batch.batchSha256,
    acceptedCount,
    duplicateCount,
    newlyAcceptedCount: acceptedCount - duplicateCount,
    delivery: 'BACKEND_P0_ENDPOINT_ACCEPTED',
  });
}

export function createInternalP0HttpSender({
  baseUrl,
  authorization,
  fetchImpl = globalThis.fetch,
} = {}) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new InmetP0PublishError('inmet_p0_backend_url_invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.hostname.length < 3) {
    throw new InmetP0PublishError('inmet_p0_backend_url_invalid');
  }
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ') || authorization.length < 27 || authorization.length > 16_384) {
    throw new InmetP0PublishError('inmet_p0_authorization_invalid');
  }
  if (typeof fetchImpl !== 'function') throw new InmetP0PublishError('inmet_p0_fetch_invalid');

  const endpoint = new URL('/v1/internal/p0', url.origin);
  return async (alert) => {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization,
          'content-type': 'application/json',
        },
        body: JSON.stringify(alert),
        redirect: 'error',
        signal: AbortSignal.timeout(7_000),
      });
    } catch {
      throw new InmetP0PublishError('inmet_p0_backend_unreachable');
    }
    if (response.status !== 202) throw new InmetP0PublishError('inmet_p0_backend_rejected');
    let text;
    try {
      text = await response.text();
    } catch {
      throw new InmetP0PublishError('inmet_p0_backend_response_invalid');
    }
    if (text.length > 4_096) throw new InmetP0PublishError('inmet_p0_backend_response_too_large');
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new InmetP0PublishError('inmet_p0_backend_response_invalid');
    }
    if (payload?.accepted !== true) throw new InmetP0PublishError('inmet_p0_backend_response_invalid');
    return Object.freeze({ accepted: true, duplicate: payload.duplicate === true });
  };
}
