import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createOfficialSourceScheduler,
  OfficialSourceSchedulerError,
  officialSourceRefreshIntervalMs,
} from '../src/official-source-scheduler.mjs';
import {
  OFFICIAL_SOURCE_NORMAL_REFRESH_MS,
  OFFICIAL_SOURCE_SEVERE_REFRESH_MS,
} from '../src/official-source-cache.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('scheduler cadence is identical to the official cache cadence', () => {
  assert.equal(officialSourceRefreshIntervalMs('normal'), OFFICIAL_SOURCE_NORMAL_REFRESH_MS);
  assert.equal(officialSourceRefreshIntervalMs('severe'), OFFICIAL_SOURCE_SEVERE_REFRESH_MS);
  assert.throws(
    () => officialSourceRefreshIntervalMs('other'),
    (error) => error instanceof OfficialSourceSchedulerError
      && error.code === 'official_source_scheduler_invalid_mode',
  );
});

test('scheduler rejects duplicate tasks and invalid concurrency', () => {
  const task = { id: 'alerta-rio', run: async () => {} };
  assert.throws(
    () => createOfficialSourceScheduler({ tasks: [task, task], autoSchedule: false }),
    (error) => error.code === 'official_source_scheduler_duplicate_task_id',
  );
  assert.throws(
    () => createOfficialSourceScheduler({ tasks: [task], maxConcurrency: 0, autoSchedule: false }),
    (error) => error.code === 'official_source_scheduler_invalid_concurrency',
  );
});

test('switching to severe mode pulls the next refresh forward to one minute', () => {
  let nowMs = Date.parse('2026-09-10T15:00:00.000Z');
  const scheduler = createOfficialSourceScheduler({
    tasks: [{ id: 'inmet', run: async () => {} }],
    now: () => nowMs,
    autoSchedule: false,
  });

  scheduler.start({ immediate: false });
  const normalDue = scheduler.snapshot().tasks[0].nextDueAt;
  assert.equal(
    normalDue,
    new Date(nowMs + OFFICIAL_SOURCE_NORMAL_REFRESH_MS).toISOString(),
  );

  nowMs += 5_000;
  scheduler.setMode('severe');
  const severe = scheduler.snapshot();
  assert.equal(severe.mode, 'severe');
  assert.equal(severe.refreshIntervalMs, OFFICIAL_SOURCE_SEVERE_REFRESH_MS);
  assert.equal(
    severe.tasks[0].nextDueAt,
    new Date(nowMs + OFFICIAL_SOURCE_SEVERE_REFRESH_MS).toISOString(),
  );
});

test('scheduler bounds concurrency and forbids overlap for a running task', async () => {
  const first = deferred();
  const calls = [];
  const scheduler = createOfficialSourceScheduler({
    tasks: [
      {
        id: 'a-source',
        run: async () => {
          calls.push('a-start');
          await first.promise;
          calls.push('a-end');
        },
      },
      {
        id: 'b-source',
        run: async () => {
          calls.push('b');
        },
      },
    ],
    now: () => 0,
    maxConcurrency: 1,
    autoSchedule: false,
  });

  scheduler.start({ immediate: true });
  const firstTick = scheduler.tick();
  await Promise.resolve();

  let snapshot = scheduler.snapshot();
  assert.equal(snapshot.activeCount, 1);
  assert.deepEqual(calls, ['a-start']);
  assert.deepEqual(await scheduler.tick(), []);

  first.resolve();
  assert.deepEqual(await firstTick, ['a-source']);
  snapshot = scheduler.snapshot();
  assert.equal(snapshot.tasks.find((task) => task.taskId === 'a-source').runCount, 1);

  assert.deepEqual(await scheduler.tick(), ['b-source']);
  assert.deepEqual(calls, ['a-start', 'a-end', 'b']);
});

test('task failure is contained, sanitized and retried on the normal cadence', async () => {
  const events = [];
  const scheduler = createOfficialSourceScheduler({
    tasks: [{
      id: 'chm',
      run: async () => {
        const error = new Error('sensitive upstream detail');
        error.code = 'source_timeout';
        throw error;
      },
    }],
    now: () => 0,
    autoSchedule: false,
    onEvent: (event) => events.push(event),
  });

  scheduler.start({ immediate: true });
  assert.deepEqual(await scheduler.tick(), ['chm']);

  const state = scheduler.snapshot();
  const task = state.tasks[0];
  assert.equal(task.lastOutcome, 'FAILURE');
  assert.equal(task.lastErrorCode, 'source_timeout');
  assert.equal(task.nextDueAt, new Date(OFFICIAL_SOURCE_NORMAL_REFRESH_MS).toISOString());
  assert.equal(state.payloadRetention, 'NONE');
  assert.equal(state.queuePolicy, 'STATIC_TASK_SET_NO_UNBOUNDED_QUEUE');

  const finish = events.find((event) => event.type === 'task_finished');
  assert.equal(finish.errorCode, 'source_timeout');
  assert.equal(JSON.stringify(events).includes('sensitive upstream detail'), false);
});

test('stopped scheduler never starts new work', async () => {
  let calls = 0;
  const scheduler = createOfficialSourceScheduler({
    tasks: [{ id: 'inea', run: async () => { calls += 1; } }],
    now: () => 0,
    autoSchedule: false,
  });

  assert.equal(scheduler.start({ immediate: true }), true);
  assert.equal(scheduler.stop(), true);
  assert.deepEqual(await scheduler.tick(), []);
  assert.equal(calls, 0);
  assert.equal(scheduler.snapshot().started, false);
});
