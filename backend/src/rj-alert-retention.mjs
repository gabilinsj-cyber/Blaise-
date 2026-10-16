export const RJ_ALERT_MAX_WITHOUT_UPDATE_MS = 12 * 60 * 60_000;
export const RJ_ALERT_HISTORY_MS = 12 * 60 * 60_000;

// Local presentation lifetime, not a cancellation by the official issuer.
export function rjAlertActiveUntil(issuedAt, expiresAt) {
  const issued = Date.parse(issuedAt), expires = Date.parse(expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) return null;
  return Math.min(expires, issued + RJ_ALERT_MAX_WITHOUT_UPDATE_MS);
}
export function rjAlertIsActive(issuedAt, expiresAt, nowMillis) {
  const until = rjAlertActiveUntil(issuedAt, expiresAt);
  return until !== null && Number.isFinite(nowMillis) && Date.parse(issuedAt) <= nowMillis && nowMillis < until;
}
export function rjAlertRetainHistory(issuedAt, expiresAt, nowMillis) {
  const until = rjAlertActiveUntil(issuedAt, expiresAt);
  return until !== null && Number.isFinite(nowMillis) && Date.parse(issuedAt) <= nowMillis && nowMillis < until + RJ_ALERT_HISTORY_MS;
}
