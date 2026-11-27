import {reserveGuardianAudit}
  from './guardian-cloud-budget.mjs';

import {auditGuardianCloud}
  from './guardian-cloud-audit.mjs';

export async function runGuardianCloud({
  db,
  now,
  enabled = false,
  quotaApproved = false
} = {}) {

  const blocked = mode => ({
    mode,
    queries: 0,
    candidates: [],
    deleted: 0
  });

  if (enabled !== true)
    return blocked('DISABLED');

  if (quotaApproved !== true)
    return blocked('QUOTA_NOT_APPROVED');

  const reserved = await reserveGuardianAudit({
    db, now, enabled: true
  });

  if (reserved !== true)
    return blocked('DAILY_LIMIT');

  return auditGuardianCloud({
    db, now, enabled: true
  });
}
