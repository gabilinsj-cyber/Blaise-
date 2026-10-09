// Firebase subscriber identity verification — Blaise V6 RJ only.
// Public Google Secure Token certificates; no ID tokens or UIDs logged.
import { OAuth2Client } from 'google-auth-library';
import { obfuscatedPlayAccountId } from './subscription-account-binding-rj.mjs';

export const FIREBASE_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const HEADER = /^Bearer ([A-Za-z0-9_.-]{1,12000})$/;
const FIREBASE_PROJECT = /^[a-z][a-z0-9-]{4,62}$/;
const MAX_CERT_BODY_BYTES = 24_576;

function safeHeader(token) {
  const first = token.split('.')[0];
  if (!first || first.length > 1_024 || !/^[A-Za-z0-9_-]+$/.test(first)) return null;
  try {
    const h = JSON.parse(Buffer.from(first, 'base64url').toString('utf8'));
    if (h?.alg !== 'RS256' || typeof h.kid !== 'string' ||
        h.kid.length < 1 || h.kid.length > 256 ||
        !/^[A-Za-z0-9._-]+$/.test(h.kid)) return null;
    return h;
  } catch { return null; }
}

export function verifiedSubscriberUid(payload, projectId, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!payload || typeof payload !== 'object' || payload.aud !== projectId ||
      payload.iss !== `https://securetoken.google.com/${projectId}` ||
      payload.email_verified !== true ||
      payload.firebase?.sign_in_provider === 'anonymous' ||
      payload.firebase?.sign_in_provider === 'custom' ||
      !Number.isSafeInteger(payload.iat) || payload.iat > nowSeconds ||
      !Number.isSafeInteger(payload.exp) || payload.exp <= nowSeconds ||
      payload.exp - payload.iat > 3_600 ||
      !Number.isSafeInteger(payload.auth_time) || payload.auth_time < 1 ||
      payload.auth_time > nowSeconds ||
      payload.auth_time > payload.iat) return null;
  const uid = payload.sub;
  return obfuscatedPlayAccountId(uid) ? uid : null;
}

export function createFirebaseSubscriberVerifier({
  projectId,
  fetchImpl = fetch,
  oauth = new OAuth2Client(),
  now = () => Date.now(),
} = {}) {
  if (typeof projectId !== 'string' || !FIREBASE_PROJECT.test(projectId) ||
      typeof fetchImpl !== 'function' ||
      typeof oauth?.verifySignedJwtWithCertsAsync !== 'function') {
    throw new Error('invalid_firebase_subscriber_verifier');
  }
  let cache = null;
  let inflight = null;

  async function certificates() {
    const current = now();
    if (cache && cache.validUntil > current) return cache.keys;
    if (!inflight) {
      inflight = (async () => {
        const response = await fetchImpl(FIREBASE_CERT_URL, {
          method: 'GET', redirect: 'error',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(3_000),
        });
        if (!response.ok || !String(response.headers.get('content-type') || '').includes('application/json')) {
          throw new Error('firebase_public_keys_unavailable');
        }
        const body = await response.text();
        if (Buffer.byteLength(body, 'utf8') > MAX_CERT_BODY_BYTES) throw new Error('firebase_public_keys_oversized');
        const keys = JSON.parse(body);
        if (!keys || typeof keys !== 'object' || Array.isArray(keys) ||
            Object.keys(keys).length < 1 || Object.keys(keys).length > 24 ||
            !Object.entries(keys).every(([kid, value]) =>
              /^[A-Za-z0-9._-]{1,256}$/.test(kid) &&
              typeof value === 'string' && value.includes('BEGIN CERTIFICATE') &&
              value.length < 4_096)) {
          throw new Error('firebase_public_keys_invalid');
        }
        const match = /(?:^|[, ]+)max-age=(\d+)(?:[, ]+|$)/.exec(response.headers.get('cache-control') || '');
        const ageSeconds = match ? Number(match[1]) : 300;
        const cacheSeconds = Math.max(30, Math.min(1_800, ageSeconds));
        cache = { keys, validUntil: now() + cacheSeconds * 1_000 };
        return keys;
      })().finally(() => { inflight = null; });
    }
    return inflight;
  }

  return async (authorization) => {
    const match = typeof authorization === 'string' ? HEADER.exec(authorization) : null;
    const token = match?.[1];
    if (!token || token.split('.').length !== 3) return null;
    const header = safeHeader(token);
    if (!header) return null;
    try {
      const certs = await certificates();
      if (!Object.hasOwn(certs, header.kid)) return null;
      const ticket = await oauth.verifySignedJwtWithCertsAsync(
        token, certs, projectId, [`https://securetoken.google.com/${projectId}`], 3_600,
      );
      return verifiedSubscriberUid(ticket?.getPayload?.(), projectId, Math.floor(now() / 1_000));
    } catch {
      return null;
    }
  };
}

// Used at the entry of EVERY premium endpoint, never on public alerts.
export async function requireSubscriberUid(req, config, subscriberVerifier) {
  if (config?.requireSubscriberIdentity !== true) return null;
  if (typeof subscriberVerifier !== 'function') return null;
  try {
    const uid = await subscriberVerifier(req?.headers?.authorization);
    return obfuscatedPlayAccountId(uid) ? uid : null;
  } catch {
    return null;
  }
}
