const COUNTERS = Object.freeze([
  'requests_total',
  'client_error_total',
  'server_error_total',
  'auth_rejected_total',
  'verify_active_total',
  'verify_denied_total',
  'verify_busy_total',
  'rtdn_success_total',
  'rtdn_duplicate_total',
  'rtdn_busy_total',
  'p0_publish_success_total',
  'p0_duplicate_total',
  'p0_rejected_total',
  'p0_busy_total',
  'google_play_retry_total',
  'fcm_retry_total',
]);

const ALLOWED_COUNTERS = new Set(COUNTERS);

export function createOperationalMetrics({ startedAtMillis = Date.now() } = {}) {
  if (!Number.isFinite(startedAtMillis) || startedAtMillis < 0) {
    throw new Error('invalid_metrics_start_time');
  }

  const counters = Object.fromEntries(COUNTERS.map((name) => [name, 0]));

  return {
    increment(name, amount = 1) {
      if (!ALLOWED_COUNTERS.has(name)) throw new Error('unknown_metric');
      if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
        throw new Error('invalid_metric_increment');
      }
      counters[name] += amount;
    },

    snapshot({
      nowMillis = Date.now(),
      verifyGate = null,
      rtdnGate = null,
      p0Gate = null,
      rtdnReplayGuard = null,
      p0ReplayGuard = null,
    } = {}) {
      const safeNow = Number.isFinite(nowMillis) ? Math.max(nowMillis, startedAtMillis) : startedAtMillis;
      return Object.freeze({
        schemaVersion: 1,
        uptimeSeconds: Math.floor((safeNow - startedAtMillis) / 1000),
        counters: Object.freeze({ ...counters }),
        concurrency: Object.freeze({
          verify: gateSnapshot(verifyGate),
          rtdn: gateSnapshot(rtdnGate),
          p0: gateSnapshot(p0Gate),
        }),
        replay: Object.freeze({
          rtdnEntries: replaySize(rtdnReplayGuard),
          p0Entries: replaySize(p0ReplayGuard),
        }),
      });
    },
  };
}

function gateSnapshot(gate) {
  if (!gate || typeof gate.snapshot !== 'function') return null;
  const value = gate.snapshot();
  return Object.freeze({
    active: boundedInteger(value?.active),
    peak: boundedInteger(value?.peak),
    rejected: boundedInteger(value?.rejected),
    maxConcurrent: boundedInteger(value?.maxConcurrent),
  });
}

function replaySize(guard) {
  const value = Number(guard?.size ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function boundedInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}
