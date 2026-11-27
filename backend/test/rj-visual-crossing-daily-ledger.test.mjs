import test from 'node:test';
import assert from 'node:assert/strict';

import {createVisualCrossingDailyLedger}
from '../src/rj-visual-crossing-daily-ledger.mjs';

const day = '2026-11-27';

const approved = {
  confirmedDay: day,
  externalUsed: 0,
  rollingWindowConfirmed: true,
  operatorApproved: true,
  costVerified: true
};

function setup() {
  const data = new Map();
  let queue = Promise.resolve();

  const db = {
    collection: name => ({
      doc: id => name + '/' + id
    }),

    runTransaction(fn) {
      const next = queue.then(() => fn({
        get: async key => ({
          exists: data.has(key),
          data: () => data.get(key)
        }),
        set: (key, value) => data.set(key, value)
      }));

      queue = next.catch(() => {});
      return next;
    }
  };

  const ledger = createVisualCrossingDailyLedger({
    db,
    clock: () => Date.parse(day + 'T12:00:00Z')
  });

  return {ledger, data};
}

test('reserva autorizada', async () => {
  const {ledger} = setup();
  const r = await ledger.reserve(approved);
  assert.equal(r.approved, true);
  assert.equal(r.remaining, 899);
});

test('bloqueia sem autorizacao', async () => {
  const {ledger, data} = setup();
  assert.equal((await ledger.reserve({})).approved, false);
  assert.equal(data.size, 0);
});

test('bloqueia consumo externo elevado', async () => {
  const {ledger} = setup();
  const r = await ledger.reserve({
    ...approved, externalUsed: 900
  });
  assert.equal(r.approved, false);
});

test('protege reservas simultaneas', async () => {
  const {ledger} = setup();

  const results = await Promise.all(
    Array.from({length: 10}, () =>
      ledger.reserve({
        ...approved, externalUsed: 895
      })
    )
  );

  assert.equal(
    results.filter(r => r.approved).length, 5
  );
});

test('bloqueia dia nao confirmado', async () => {
  const {ledger} = setup();
  const r = await ledger.reserve({
    ...approved, confirmedDay: '2026-11-26'
  });
  assert.equal(r.approved, false);
});

test('preserva contador experimental', async () => {
  const {ledger, data} = setup();

  data.set(
    'blaise_rj_visual_crossing_free_trial_budget_v1/' +
    'staging_one_rio_20261119',
    {calls: 1, recordsReserved: 1, dayUtc: day}
  );

  const r = await ledger.reserve(approved);
  assert.equal(r.remaining, 898);
});

test('mantem publicacao e coleta desligadas', () => {
  const {ledger} = setup();
  assert.equal(ledger.automaticCollection, false);
  assert.equal(ledger.publicationEnabled, false);
});


test('protege franquia na mudanca de dia', async () => {
  const {ledger, data} = setup();

  data.set(
    'blaise_rj_visual_crossing_daily_ledger_v1/2026-11-26',
    {
      dayUtc: '2026-11-26',
      reserved: 899,
      externalBaseline: 0
    }
  );

  const first = await ledger.reserve(approved);
  assert.equal(first.approved, true);
  assert.equal(first.remaining, 0);

  const second = await ledger.reserve(approved);
  assert.equal(second.approved, false);
});

test('protege reserva experimental do dia anterior', async () => {
  const {ledger, data} = setup();

  data.set(
    'blaise_rj_visual_crossing_free_trial_budget_v1/' +
    'staging_one_rio_20261119',
    {calls: 1, recordsReserved: 1, dayUtc: '2026-11-26'}
  );

  const r = await ledger.reserve(approved);
  assert.equal(r.approved, true);
  assert.equal(r.remaining, 898);
});

test('bloqueia contador anterior corrompido', async () => {
  const {ledger, data} = setup();

  data.set(
    'blaise_rj_visual_crossing_daily_ledger_v1/2026-11-26',
    {
      dayUtc: '2026-11-26',
      reserved: -1,
      externalBaseline: 0
    }
  );

  assert.equal(
    (await ledger.reserve(approved)).approved,
    false
  );
});
