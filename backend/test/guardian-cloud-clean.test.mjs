import test from 'node:test';
import assert from 'node:assert/strict';
import {planGuardianCleanup} from '../src/guardian-cloud-clean.mjs';

const DAY = 86400000;
const now = 10 * DAY;

const record = {
  collection: 'blaise_rj_openweather_current_cache',
  sourceId: 'OPENWEATHER_ONECALL4_CURRENT',
  id: 'a'.repeat(64),
  expiresAtMs: now - 2 * DAY
};

test('Identifica cache vencido autorizado', () => {
  const r = planGuardianCleanup([record], now);
  assert.equal(r.candidates.length, 1);
  assert.equal(r.deleted, 0);
});

test('Preserva cache valido', () => {
  const r = planGuardianCleanup([
    {...record, expiresAtMs: now + DAY}
  ], now);
  assert.equal(r.candidates.length, 0);
});

test('Preserva margem de seguranca de 24h', () => {
  const r = planGuardianCleanup([
    {...record, expiresAtMs: now - DAY + 1}
  ], now);
  assert.equal(r.candidates.length, 0);
});

test('Protege franquias e dados essenciais', () => {
  const collections = [
    'blaise_rj_openweather_daily_quota',
    'blaise_rj_openweather_temp_fallback_cooldown',
    'blaise_rj_weatherapi_free_monthly_ledger',
    'blaise_rj_weatherapi_city_cooldown',
    'backups',
    'scientific_memory',
    'credentials'
  ];

  const r = planGuardianCleanup(
    collections.map(collection => ({
      ...record, collection
    })), now
  );

  assert.equal(r.candidates.length, 0);
  assert.equal(r.deleted, 0);
});

test('Rejeita fontes e datas invalidas', () => {
  const r = planGuardianCleanup([
    {...record, sourceId: 'DESCONHECIDA'},
    {...record, expiresAtMs: null},
    {...record, expiresAtMs: -1},
    {...record, expiresAtMs: '123'}
  ], now);
  assert.equal(r.candidates.length, 0);
});

test('Limita a 20 candidatos sem excluir', () => {
  const records = Array.from(
    {length: 50}, (_, i) => ({
      ...record,
      id: i.toString(16).padStart(64, '0')
    })
  );

  const r = planGuardianCleanup(records, now);

  assert.equal(r.candidates.length, 20);
  assert.equal(r.mode, 'DRY_RUN');
  assert.equal(r.deleted, 0);
});

test('Bloqueia identificadores invalidos', () => {
  const r = planGuardianCleanup([
    {...record, id: '../backup'},
    {...record, id: ''},
    {...record, id: null},
    {...record, id: 'x'.repeat(64)}
  ], now);
  assert.equal(r.candidates.length, 0);
});

test('Impede candidatos duplicados', () => {
  const r = planGuardianCleanup(
    [record, record, {...record}], now
  );
  assert.equal(r.candidates.length, 1);
});

test('Valida municipios oficiais do RJ', () => {
  const collection =
    'blaise_rj_openweather_temp_fallback_cache';

  const r = planGuardianCleanup([
    {...record, collection, id: '3303302'},
    {...record, collection, id: '3550308'},
    {...record, collection, id: '9999999'}
  ], now);

  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].id, '3303302');
});

test('Bloqueia relogio invalido', () => {
  for (const invalid of [NaN, -1, null, Infinity]) {
    assert.throws(
      () => planGuardianCleanup([record], invalid)
    );
  }
});

import {checkGuardianSnapshot} from '../src/guardian-cloud-clean.mjs';

const snapshot = {
  ...record,
  updateTime: {seconds: 100, nanoseconds: 0}
};

test('Confirma documento vencido sem alteracao', () => {
  assert.equal(
    checkGuardianSnapshot(snapshot, snapshot, now),
    true
  );
});

test('Protege documento renovado', () => {
  assert.equal(checkGuardianSnapshot(snapshot, {
    ...snapshot, expiresAtMs: now + DAY
  }, now), false);
});

test('Bloqueia atualizacao simultanea', () => {
  assert.equal(checkGuardianSnapshot(snapshot, {
    ...snapshot,
    updateTime: {seconds: 101, nanoseconds: 0}
  }, now), false);
});

test('Bloqueia versao ausente ou invalida', () => {
  assert.equal(checkGuardianSnapshot(snapshot, {
    ...snapshot, updateTime: null
  }, now), false);
});

test('Bloqueia troca de documento ou colecao', () => {
  assert.equal(checkGuardianSnapshot(snapshot, {
    ...snapshot, id: 'b'.repeat(64)
  }, now), false);

  assert.equal(checkGuardianSnapshot(snapshot, {
    ...snapshot, collection: 'backups'
  }, now), false);
});
