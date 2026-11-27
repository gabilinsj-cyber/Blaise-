import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from '@google-cloud/firestore';

import {buildGuardianFirestorePrecondition}
  from '../src/guardian-cloud-sdk.mjs';

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

test('Gera Timestamp oficial do Firestore', () => {
  const r = buildGuardianFirestorePrecondition(
    candidate, current, now
  );

  assert.ok(r.lastUpdateTime instanceof Timestamp);
  assert.equal(r.lastUpdateTime.seconds, 100);
  assert.equal(r.lastUpdateTime.nanoseconds, 123000);
});

test('Bloqueia documento atualizado', () => {
  const r = buildGuardianFirestorePrecondition(
    candidate, {
      ...current,
      updateTime: {
        seconds: 101,
        nanoseconds: 0
      }
    }, now
  );

  assert.equal(r, null);
});

test('Bloqueia colecao protegida', () => {
  const r = buildGuardianFirestorePrecondition(
    {...candidate, collection: 'backups'},
    {...current, collection: 'backups'},
    now
  );

  assert.equal(r, null);
});
