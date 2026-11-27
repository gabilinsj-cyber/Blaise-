import assert from 'node:assert/strict';

if (process.env.FIRESTORE_EMULATOR_HOST !==
    '127.0.0.1:8787') {
  throw Error('EMULADOR OBRIGATORIO');
}

const {Firestore} =
  await import('@google-cloud/firestore');

const {createVisualCrossingDailyLedger, VC_DAILY_LEDGER} =
  await import('../src/rj-visual-crossing-daily-ledger.mjs');

const {VC_BUDGET_COLLECTION, VC_TRIAL_ID} =
  await import('../src/rj-visual-crossing-free-budget.mjs');

const config = {
  projectId: 'demo-blaise-vc',
  databaseId: '(default)'
};

const db = new Firestore(config);
const db2 = new Firestore(config);

const day = '2026-11-27';
const clock = () => Date.parse(day + 'T12:00:00Z');

try {
  const a = createVisualCrossingDailyLedger({db, clock});
  const b = createVisualCrossingDailyLedger({
    db: db2, clock
  });

  const trial = db.collection(VC_BUDGET_COLLECTION)
    .doc(VC_TRIAL_ID);

  const historical = {
    calls: 1,
    recordsReserved: 1,
    dayUtc: day
  };

  await trial.create(historical);

  const options = {
    confirmedDay: day,
    externalUsed: 898,
    utcResetVerified: true,
    operatorApproved: true,
    costVerified: true
  };

  assert.equal(
    (await a.reserve({})).approved, false
  );

  console.log('BLOQUEIO SEM AUTORIZACAO: OK');

  const results = await Promise.all([
    a.reserve(options),
    b.reserve(options)
  ]);

  assert.equal(
    results.filter(r => r.approved).length, 1
  );

  console.log('RESERVAS SIMULTANEAS: OK');

  const ref = db.collection(VC_DAILY_LEDGER)
    .doc(day);

  const snapshot = await ref.get();

  assert.equal(snapshot.data().reserved, 1);
  assert.equal(
    snapshot.data().externalBaseline, 898
  );

  assert.equal(
    (await a.reserve(options)).approved, false
  );

  console.log('TETO DE 900 REGISTROS: OK');

  assert.deepEqual(
    (await trial.get()).data(), historical
  );

  console.log('CONTADOR EXPERIMENTAL PRESERVADO');
  console.log('PUBLICACAO: DESATIVADA');
  console.log('CHAMADAS METEOROLOGICAS: ZERO');
  console.log('EMULADOR: APROVADO');

} finally {
  await Promise.all([
    db.terminate(),
    db2.terminate()
  ]);
}
