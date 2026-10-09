import { createHash, timingSafeEqual } from 'node:crypto';

// Must match PlayAccountBindingPolicy.kt exactly.
// Only use a UID authenticated by the server; never trust a UID sent in JSON.
const SCOPE = 'blaise-v6-rj:google-play:account:v1:';
const UID_POLICY = /^[A-Za-z0-9._~:-]{1,128}$/;
const HEX_SHA256 = /^[0-9a-f]{64}$/;

export function obfuscatedPlayAccountId(authenticatedUid) {
  if (typeof authenticatedUid !== 'string' || !UID_POLICY.test(authenticatedUid)) return null;
  return createHash('sha256').update(SCOPE, 'utf8').update(authenticatedUid, 'utf8').digest('hex');
}

// This is a matching primitive, NOT authentication or entitlement verification.
// Caller must separately verify the Firebase ID token, Google Play purchase
// state/expiry, and enforce this check for EVERY premium route.
export function matchesVerifiedPlayOwner(subscriptionV2, authenticatedUid) {
  const expected = obfuscatedPlayAccountId(authenticatedUid);
  const actual = subscriptionV2?.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (!expected || typeof actual !== 'string' || !HEX_SHA256.test(actual)) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
