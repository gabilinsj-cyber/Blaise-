import test from 'node:test';
import assert from 'node:assert/strict';

import {prepareGuardianPrecondition}
  from '../src/guardian-cloud-precondition.mjs';

const DAY = 86400000;
const now = 10 * DAY;

const candidate = {
  collection: 'blaise_rj_openweather_current_cache',
  id: 'a'.repeat(64),
  expiresAtMs: now - 2 * DAY,
  updateTime: {
    seconds: 100,
    nanoseconds: 123000
  }
};

const current = {
  ...candidate,
  sourceId: 'OPENWEATHER_ONECALL4_CURRENT'
};

const prepare = doc =>
  prepareGuardianPrecondition(candidate, doc, now);

test('Prepara condicao de versao exata', () => {
  const r = prepare(current);
  assert.deepEqual(
    r.lastUpdateTime, candidate.updateTime
  );
  assert.equal(r.mode, 'DRY_RUN');
  assert.equal(r.deleted, 0);
});

test('Protege alteracao de nanossegundos', () => {
  assert.equal(prepare({
    ...current,
    updateTime: {
      seconds: 100,
      nanoseconds: 124000
    }
  }), null);
});

test('Protege cache renovado', () => {
  assert.equal(prepare({
    ...current,
    expiresAtMs: now + DAY
  }), null);
});

test('Bloqueia fonte diferente', () => {
  assert.equal(prepare({
    ...current,
    sourceId: 'DESCONHECIDA'
  }), null);
});

test('Bloqueia documento inexistente', () => {
  assert.equal(prepare(null), null);
});

test('Protege colecoes essenciais', () => {
  for (const collection of [
    'backups',
    'credentials',
    'scientific_memory',
    'blaise_rj_openweather_daily_quota',
    'blaise_guardian_cloud_control'
  ]) {
    assert.equal(
      prepareGuardianPrecondition(
        {...candidate, collection},
        {...current, collection},
        now
      ), null
    );
  }
});
