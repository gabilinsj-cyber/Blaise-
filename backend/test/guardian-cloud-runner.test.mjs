import test from 'node:test';
import assert from 'node:assert/strict';
import {runGuardianCloud}
  from '../src/guardian-cloud-runner.mjs';

const DAY = 86400000;
const now = 10 * DAY;

function fakeDb() {
  let data;
  let queue = Promise.resolve();
  const state = {
    reservations: 0,
    queries: 0,
    fail: false
  };

  const db = {
    collection(name) {
      if (name === 'blaise_guardian_cloud_control')
        return {doc: () => ({})};

      return {
        where() { return this; },
        orderBy() { return this; },
        limit() { return this; },
        select() { return this; },
        async get() {
          state.queries++;
          if (state.fail)
            throw Error('audit_failure');
          return {docs: []};
        }
      };
    },
    runTransaction(fn) {
      const task = queue.then(() => fn({
        get: async () => ({
          exists: data !== undefined,
          data: () => data
        }),
        set: (_, value) => {
          data = value;
          state.reservations++;
        }
      }));

      queue = task.catch(() => {});
      return task;
    }
  };

  return {db, state};
}

const run = db => runGuardianCloud({
  db, now, enabled: true,
  quotaApproved: true
});

test('Desligado sem acessar banco', async () => {
  const r = await runGuardianCloud();
  assert.equal(r.mode, 'DISABLED');
});

test('Bloqueia franquia nao autorizada', async () => {
  const r = await runGuardianCloud({
    enabled: true, now
  });
  assert.equal(r.mode, 'QUOTA_NOT_APPROVED');
});

test('Reserva antes da auditoria', async () => {
  const {db, state} = fakeDb();
  const r = await run(db);

  assert.equal(state.reservations, 1);
  assert.equal(state.queries, 2);
  assert.equal(r.mode, 'DRY_RUN');
  assert.equal(r.deleted, 0);
});

test('Bloqueia segunda auditoria', async () => {
  const {db, state} = fakeDb();

  await run(db);
  const r = await run(db);

  assert.equal(r.mode, 'DAILY_LIMIT');
  assert.equal(state.queries, 2);
});

test('Bloqueia auditorias simultaneas', async () => {
  const {db, state} = fakeDb();

  await Promise.all(
    Array.from({length: 10}, () => run(db))
  );

  assert.equal(state.reservations, 1);
  assert.equal(state.queries, 2);
});

test('Falha na reserva impede consultas', async () => {
  const {db, state} = fakeDb();

  db.runTransaction = async () => {
    throw Error('reservation_failure');
  };

  await assert.rejects(
    run(db), /reservation_failure/
  );

  assert.equal(state.queries, 0);
});

test('Falha na auditoria nao libera nova reserva', async () => {
  const {db, state} = fakeDb();
  state.fail = true;

  await assert.rejects(run(db), /audit_failure/);

  const r = await run(db);

  assert.equal(r.mode, 'DAILY_LIMIT');
  assert.equal(state.reservations, 1);
  assert.equal(state.queries, 1);
});
