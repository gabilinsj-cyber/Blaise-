import test from 'node:test';
import assert from 'node:assert/strict';

import geo from '../src/rj-ibge-92-points.json'
with {type:'json'};

import {collectVisualCrossingDaily}
from '../src/rj-visual-crossing-daily-collector.mjs';

const now = Date.parse('2026-11-27T13:00:00Z');

function setup(ibge = '3304557') {
  const point = geo.points.find(
    p => String(p.ibge) === ibge
  );

  const count = {reserve:0, fetch:0, save:0};

  const body = {
    latitude: point.lat,
    longitude: point.lon,
    queryCost: 1,
    currentConditions: {
      datetimeEpoch: now / 1000 - 300,
      temp: 25.5,
      feelslike: 26.1,
      humidity: 70,
      windspeed: 12,
      precip: 0.02
    }
  };

  const options = {
    ibge,
    apiKey: 'SYNTHETIC_TEST_KEY',
    clock: () => now,

    approval: {
      enabled: true,
      freePlanConfirmed: true,
      paidAllowed: false,
      autoTopupDisabled: true,
      exclusiveAccountUseConfirmed: true,
      operatorApproved: true,
      costVerified: true,
      rollingWindowConfirmed: true,
      confirmedDay: '2026-11-27',
      externalUsed: 0
    },

    ledger: {
      async reserve() {
        count.reserve++;
        return {approved:true};
      }
    },

    cache: {
      async save() {
        count.save++;
        return {saved:true};
      }
    },

    fetchImpl: async url => {
      count.fetch++;
      assert.equal(count.reserve, 1);
      assert.equal(
        new URL(url).searchParams.get('include'),
        'current'
      );

      return {
        status:200,
        text:async () => JSON.stringify(body)
      };
    }
  };

  return {options,count,body};
}

test('coleta simulada nos 92 municipios', async () => {
  assert.equal(geo.points.length, 92);

  for (const p of geo.points) {
    const {options,count} = setup(String(p.ibge));
    const r = await collectVisualCrossingDaily(options);

    assert.equal(r.status,'PRIVATE_CACHE_SAVED');
    assert.equal(count.save,1);
    assert.equal(r.publicationEnabled,false);
  }
});

test('bloqueia sem autorizacao', async () => {
  const {options,count} = setup();
  options.approval.enabled = false;
  await collectVisualCrossingDaily(options);
  assert.equal(count.fetch,0);
  assert.equal(count.reserve,0);
});

test('bloqueia quando franquia esgotada', async () => {
  const {options,count} = setup();
  options.ledger.reserve = async () => ({
    approved:false
  });

  await collectVisualCrossingDaily(options);
  assert.equal(count.fetch,0);
});

test('bloqueia custo inesperado', async () => {
  const {options,count,body} = setup();
  body.queryCost = 2;

  const r = await collectVisualCrossingDaily(options);

  assert.equal(r.status,'UNEXPECTED_COST_STOP');
  assert.equal(count.save,0);
});

test('rejeita dados vencidos', async () => {
  const {options,count,body} = setup();
  body.currentConditions.datetimeEpoch -= 3600;

  const r = await collectVisualCrossingDaily(options);

  assert.equal(r.status,'INVALID_OR_EXPIRED_DATA');
  assert.equal(count.save,0);
});

test('bloqueia falha de reserva', async () => {
  const {options,count} = setup();

  options.ledger.reserve = async () => {
    throw Error('simulated failure');
  };

  await collectVisualCrossingDaily(options);
  assert.equal(count.fetch,0);
});

test('sem transporte real por padrao', async () => {
  const {options,count} = setup();
  delete options.fetchImpl;

  const r = await collectVisualCrossingDaily(options);
  assert.equal(r.status,'BLOCKED');
  assert.equal(count.reserve,0);
});

test('bloqueia mudanca de dia', async () => {
  const {options,count} = setup();
  options.clock = () => now + 86400000;

  const r = await collectVisualCrossingDaily(options);

  assert.equal(r.status,'DAY_CHANGED_OR_RESET_NEAR');
  assert.equal(count.fetch,0);
});
