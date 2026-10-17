import { createOfficialSourceScheduler } from './official-source-scheduler.mjs';
import { reviewRjMarineSample } from './rj-marine-freshness-gate.mjs';

// Adapters are injected, never inferred from a web map or a test fixture.
// Their implementations must use documented, authorized product endpoints.
export function createRjMarineMonitor({
  noaaReader, copernicusReader, now = () => Date.now(),
  setTimer = setTimeout, clearTimer = clearTimeout,
  productRefreshMs = 3_600_000, enabled = false,
} = {}) {
  if (typeof noaaReader !== 'function' || typeof copernicusReader !== 'function')
    throw new TypeError('marine_readers_required');
  if (!Number.isInteger(productRefreshMs) || productRefreshMs < 60_000)
    throw new RangeError('marine_refresh_interval_invalid');
  const records = new Map();
  const readers = [['NOAA', noaaReader], ['COPERNICUS_MARINE', copernicusReader]];
  let stopped = false;
  const tasks = readers.map(([sourceId, reader]) => ({
    id: sourceId.toLowerCase().replaceAll('_', '-'),
    run: async () => {
      const previous = records.get(sourceId);
      const nowMs = now();
      if (previous && nowMs - previous.lastAttemptMs < productRefreshMs) {
        const last = previous.sample;
        records.set(sourceId, { ...previous, review: last ? reviewRjMarineSample(last, { nowMs }) : previous.review });
        return;
      }
      records.set(sourceId, { lastAttemptMs: nowMs, review: { status: 'UNAVAILABLE', live: false }, sample: null });
      try {
        const sample = await reader();
        if (!sample || sample.sourceId !== sourceId) throw new Error('marine_source_identity_mismatch');
        const review = reviewRjMarineSample(sample, { nowMs: now() });
        records.set(sourceId, { lastAttemptMs: nowMs, review, sample });
      } catch {
        records.set(sourceId, { lastAttemptMs: nowMs, review: { status: 'UNAVAILABLE', live: false }, sample: null });
      }
    },
  }));
  const scheduler = createOfficialSourceScheduler({
    tasks, now, setTimer, clearTimer, maxConcurrency: 2,
    refreshIntervalsMs: { normal: 60_000, severe: 60_000 },
    cadenceMode: 'fixed_start',
  });
  return Object.freeze({
    start() { if (!enabled || stopped) return false; return scheduler.start(); },
    stop() { stopped = true; return scheduler.stop(); },
    async tick() { if (!enabled || stopped) return []; return scheduler.tick(); },
    status() {
      return Object.freeze(Object.fromEntries(readers.map(([id]) => {
        const r = records.get(id);
        return [id, Object.freeze({
          status: r?.review?.status ?? 'NOT_CHECKED',
          lastAttemptUtc: r ? new Date(r.lastAttemptMs).toISOString() : null,
          // This module never asserts deployed/live status.
          productionLiveVerified: false,
        })];
      })));
    },
  });
}
