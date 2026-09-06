import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ServiceBusyError,
  createConcurrencyGate,
  isTransientGoogleError,
  retryTransient,
} from '../src/resilience.mjs';

test('classifies only bounded transient Google/network failures as retryable', () => {
  assert.equal(isTransientGoogleError({ response: { status: 429 } }), true);
  assert.equal(isTransientGoogleError({ response: { status: 503 } }), true);
  assert.equal(isTransientGoogleError({ code: 'ETIMEDOUT' }), true);
  assert.equal(isTransientGoogleError({ response: { status: 401 } }), false);
  assert.equal(isTransientGoogleError({ response: { status: 404 } }), false);
  assert.equal(isTransientGoogleError(new Error('unknown')), false);
});

test('retries transient failures with bounded attempts and succeeds', async () => {
  let calls = 0;
  const delays = [];
  const result = await retryTransient(
    async () => {
      calls += 1;
      if (calls < 3) {
        const error = new Error('temporary');
        error.response = { status: 503 };
        throw error;
      }
      return 'ok';
    },
    {
      maxAttempts: 3,
      baseDelayMillis: 10,
      maxDelayMillis: 20,
      sleep: async (millis) => delays.push(millis),
    },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

test('does not retry permanent authentication or client errors', async () => {
  let calls = 0;
  await assert.rejects(
    retryTransient(
      async () => {
        calls += 1;
        const error = new Error('unauthorized');
        error.response = { status: 401 };
        throw error;
      },
      { sleep: async () => {} },
    ),
    /unauthorized/,
  );
  assert.equal(calls, 1);
});

test('concurrency gate rejects overload without unbounded queueing and recovers', async () => {
  const gate = createConcurrencyGate({ maxConcurrent: 2 });
  let release;
  const blocker = new Promise((resolve) => { release = resolve; });

  const first = gate.run(async () => blocker);
  const second = gate.run(async () => blocker);
  await assert.rejects(gate.run(async () => 'third'), ServiceBusyError);
  assert.deepEqual(gate.snapshot(), { active: 2, peak: 2, rejected: 1, maxConcurrent: 2 });

  release();
  await Promise.all([first, second]);
  assert.equal(await gate.run(async () => 'recovered'), 'recovered');
  assert.deepEqual(gate.snapshot(), { active: 0, peak: 2, rejected: 1, maxConcurrent: 2 });
});
