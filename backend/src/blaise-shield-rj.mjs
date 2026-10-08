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
