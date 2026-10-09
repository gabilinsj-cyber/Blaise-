export function createRequestLimiter({ limit = 60, windowMs = 60000, maxEntries = 10000 } = {}) {
  for (const value of [limit, windowMs, maxEntries]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError('invalid_limiter_config');
  }
  const records = new Map();
  return function check(key, now = Date.now()) {
    if (typeof key !== 'string' || !key || !Number.isFinite(now)) {
      return { allowed: false, retryAfter: 60 };
    }
    let record = records.get(key);
    if (record && now >= record.resetAt) {
      records.delete(key);
      record = undefined;
    }
    if (!record) {
      if (records.size >= maxEntries) {
        for (const [id, entry] of records) {
          if (now >= entry.resetAt) records.delete(id);
        }
      }
      if (records.size >= maxEntries) return { allowed: false, retryAfter: 60 };
      record = { count: 0, resetAt: now + windowMs };
    }
    record.count++;
    records.delete(key);
    records.set(key, record);
    if (record.count > limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((record.resetAt - now) / 1000)) };
    }
    return { allowed: true, retryAfter: 0 };
  };
}

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
