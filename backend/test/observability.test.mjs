import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationalMetrics } from '../src/observability.mjs';
import { createConcurrencyGate } from '../src/resilience.mjs';
import { createRtdnReplayGuard } from '../src/server.mjs';

test('operational metrics expose only fixed counters and bounded runtime state', async () => {
  const metrics = createOperationalMetrics({ startedAtMillis: 1_000 });
  const verifyGate = createConcurrencyGate({ maxConcurrent: 2 });
  const rtdnGate = createConcurrencyGate({ maxConcurrent: 1 });
  const p0Gate = createConcurrencyGate({ maxConcurrent: 1 });
  const rtdnReplayGuard = createRtdnReplayGuard();
  const p0ReplayGuard = createRtdnReplayGuard();

  metrics.increment('requests_total', 3);
  metrics.increment('verify_active_total');
  rtdnReplayGuard.mark('message-1', 1_000);
  p0ReplayGuard.mark('alert-1', 1_000);
  await verifyGate.run(async () => {});

  const snapshot = metrics.snapshot({
    nowMillis: 6_000,
    verifyGate,
    rtdnGate,
    p0Gate,
    rtdnReplayGuard,
    p0ReplayGuard,
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.uptimeSeconds, 5);
  assert.equal(snapshot.counters.requests_total, 3);
  assert.equal(snapshot.counters.verify_active_total, 1);
  assert.equal(snapshot.concurrency.verify.maxConcurrent, 2);
  assert.equal(snapshot.replay.rtdnEntries, 1);
  assert.equal(snapshot.replay.p0Entries, 1);
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes('purchaseToken'), false);
  assert.equal(serialized.includes('userId'), false);
  assert.equal(serialized.includes('cityName'), false);
});

test('operational metrics reject arbitrary names and invalid increments', () => {
  const metrics = createOperationalMetrics();
  assert.throws(() => metrics.increment('purchase_token'), /unknown_metric/);
  assert.throws(() => metrics.increment('requests_total', 0), /invalid_metric_increment/);
  assert.throws(() => metrics.increment('requests_total', 1.5), /invalid_metric_increment/);
});
