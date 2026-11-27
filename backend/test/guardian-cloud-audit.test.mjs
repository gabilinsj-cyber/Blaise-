import test from 'node:test';
import assert from 'node:assert/strict';
import {auditGuardianCloud}
  from '../src/guardian-cloud-audit.mjs';

const DAY = 86400000;
const now = 10 * DAY;

const allowed = [
  'blaise_rj_openweather_current_cache',
  'blaise_rj_openweather_temp_fallback_cache'
];

function fakeDb(count = 1, fail = false,
  version = {seconds: 100, nanoseconds: 123}) {
  const calls = [];

  const db = {
    collection(name) {
      calls.push(name);
      assert.ok(allowed.includes(name));

      return {
        where(field, op, value) {
          assert.equal(field, 'expiresAtMs');
          assert.equal(op, '<=');
          assert.equal(value, now - DAY);
          return this;
        },
        orderBy(field) {
          assert.equal(field, 'expiresAtMs');
          return this;
        },
        limit(n) {
          assert.equal(n, 10);
          return this;
        },
        select(...fields) {
          assert.deepEqual(fields, [
            'sourceId', 'expiresAtMs'
          ]);
          return this;
        },
        async get() {
          if (fail) throw Error('fake_failure');

          return {
            docs: Array.from(
              {length: count}, (_, i) => ({
                id: i.toString(16).padStart(64, '0'),
                updateTime: version,
                data: () => ({
                  sourceId: 'OPENWEATHER_ONECALL4_CURRENT',
                  expiresAtMs: now - 2 * DAY
                })
              })
            )
          };
        }
      };
    }
  };

  return {db, calls};
}

test('Desligado por padrao: zero consultas', async () => {
  const {db, calls} = fakeDb();
  const r = await auditGuardianCloud({db, now});

  assert.equal(r.mode, 'DISABLED');
  assert.equal(r.queries, 0);
  assert.equal(calls.length, 0);
  assert.equal(r.deleted, 0);
});

test('Consulta somente colecoes autorizadas', async () => {
  const {db, calls} = fakeDb();
  const r = await auditGuardianCloud({
    db, now, enabled: true
  });

  assert.deepEqual(calls, allowed);
  assert.equal(r.queries, 2);
  assert.equal(r.mode, 'DRY_RUN');
});

test('Respeita limite de 20 documentos', async () => {
  const {db} = fakeDb(10);
  const r = await auditGuardianCloud({
    db, now, enabled: true
  });

  assert.equal(r.inspected, 20);
  assert.ok(r.candidates.length <= 20);
  assert.equal(r.deleted, 0);
});

test('Bloqueia retorno acima do limite', async () => {
  const {db} = fakeDb(11);

  await assert.rejects(
    auditGuardianCloud({db, now, enabled: true}),
    /guardian_query_limit/
  );
});

test('Interrompe auditoria em caso de falha', async () => {
  const {db, calls} = fakeDb(1, true);

  await assert.rejects(
    auditGuardianCloud({db, now, enabled: true}),
    /fake_failure/
  );

  assert.equal(calls.length, 1);
});

test('Bloqueia relogio invalido sem consultar', async () => {
  const {db, calls} = fakeDb();

  await assert.rejects(
    auditGuardianCloud({
      db, now: NaN, enabled: true
    }),
    /guardian_invalid_audit/
  );

  assert.equal(calls.length, 0);
});

test('Preserva versao exata do documento', async () => {
  const {db} = fakeDb();

  const r = await auditGuardianCloud({
    db, now, enabled: true
  });

  assert.equal(r.candidates.length, 1);

  assert.deepEqual(r.candidates[0].updateTime, {
    seconds: 100, nanoseconds: 123
  });
});

test('Bloqueia documento sem versao', async () => {
  const {db} = fakeDb(1, false, null);

  const r = await auditGuardianCloud({
    db, now, enabled: true
  });

  assert.equal(r.candidates.length, 0);
  assert.equal(r.deleted, 0);
});

test('Bloqueia versao invalida', async () => {
  const {db} = fakeDb(1, false, {
    seconds: 100,
    nanoseconds: 1000000000
  });

  const r = await auditGuardianCloud({
    db, now, enabled: true
  });

  assert.equal(r.candidates.length, 0);
  assert.equal(r.deleted, 0);
});
