import { createHmac, randomBytes } from 'node:crypto';

// Blaise Shield RJ: only a bounded HMAC fingerprint of repeatedly denied
// purchase tokens is kept in RAM. No token, address or customer ID is stored.
export function createDeniedTokenShield({
  maxDenied = 8,
  windowMillis = 60_000,
  maxEntries = 4_096,
  secret = randomBytes(32),
} = {}) {
  if (!Number.isSafeInteger(maxDenied) || maxDenied < 1 ||
      !Number.isSafeInteger(windowMillis) || windowMillis < 1_000 ||
      !Number.isSafeInteger(maxEntries) || maxEntries < 1 ||
      !Buffer.isBuffer(secret) || secret.length < 32) {
    throw new Error('invalid_blaise_shield_configuration');
  }

  const denied = new Map();
  const fingerprint = (token) => createHmac('sha256', secret).update(token, 'utf8').digest('hex');
  const prune = (nowMillis) => {
    for (const [key, record] of denied) {
      if (record.expiresAt <= nowMillis) denied.delete(key);
    }
  };

  return Object.freeze({
    allows(token, nowMillis = Date.now()) {
      prune(nowMillis);
      const record = denied.get(fingerprint(token));
      return !record || record.count < maxDenied;
    },

    recordDenied(token, nowMillis = Date.now()) {
      prune(nowMillis);
      const key = fingerprint(token);
      const previous = denied.get(key);
      if (previous) {
        previous.count = Math.min(previous.count + 1, maxDenied);
        return;
      }
      while (denied.size >= maxEntries) {
        const oldest = denied.keys().next().value;
        if (oldest === undefined) break;
        denied.delete(oldest);
      }
      denied.set(key, { count: 1, expiresAt: nowMillis + windowMillis });
    },

    get size() {
      return denied.size;
    },
  });
}
