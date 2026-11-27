import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveGuardianAudit}
  from '../src/guardian-cloud-budget.mjs';

const DAY = 86400000;
const now = 10 * DAY;

function fakeDb(initial) {
  let data = initial;
  let queue = Promise.resolve();

  return {
    collection(name) {
      assert.equal(name, 'blaise_guardian_cloud_control');
      return {
        doc(id) {
          assert.equal(id, 'audit');
          return {id};
        }
      };
    },

    runTransaction(fn) {
      const task = queue.then(() => fn({
        get: async () => ({
          exists: data !== undefined,
          data: () => data
        }),
        set: (_, value) => { data = value; }
      }));

      queue = task.catch(() => {});
      return task;
    }
  };
}

const reserve = (db, time = now) =>
  reserveGuardianAudit({
    db, now: time, enabled: true
  });

test('Desligado por padrao', async () => {
  assert.equal(await reserveGuardianAudit(), false);
});

test('Autoriza primeira auditoria', async () => {
  assert.equal(await reserve(fakeDb()), true);
});

test('Bloqueia repeticao antes de 24h', async () => {
  const db = fakeDb();
  await reserve(db);
  assert.equal(await reserve(db, now + DAY - 1), false);
});

test('Autoriza nova auditoria apos 24h', async () => {
  const db = fakeDb();
  await reserve(db);
  assert.equal(await reserve(db, now + DAY), true);
});

test('Bloqueia registros invalidos ou futuros', async () => {
  for (const last of [null, -1, now + 1]) {
    await assert.rejects(reserve(fakeDb({
      lastReservedAtMs: last
    })), /guardian_corrupt_budget/);
  }
});

test('Impede reservas simultaneas duplicadas', async () => {
  const db = fakeDb();
  const results = await Promise.all(
    Array.from({length: 10}, () => reserve(db))
  );

  assert.equal(results.filter(Boolean).length, 1);
});

test('Bloqueia auditoria se transacao falhar', async () => {
  const db = fakeDb();
  db.runTransaction = async () => {
    throw Error('transaction_failure');
  };

  await assert.rejects(
    reserve(db), /transaction_failure/
  );
});
