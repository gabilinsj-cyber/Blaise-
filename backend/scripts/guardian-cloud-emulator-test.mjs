import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';

if (process.env.FIRESTORE_EMULATOR_HOST !==
    '127.0.0.1:8787') {
  throw Error('GUARDIAN: EMULADOR OBRIGATORIO');
}

const {Firestore} =
  await import('@google-cloud/firestore');

const {buildGuardianFirestorePrecondition} =
  await import('../src/guardian-cloud-sdk.mjs');

const db = new Firestore({
  projectId: 'demo-guardian-clean',
  host: '127.0.0.1:8787',
  ssl: false
});

const DAY = 86400000;
const now = Date.now();

const collection =
  'blaise_rj_openweather_current_cache';

const id = randomBytes(32).toString('hex');
const ref = db.collection(collection).doc(id);

async function snapshot() {
  const doc = await ref.get();
  assert.equal(doc.exists, true);

  return {
    ...doc.data(),
    collection,
    id,
    updateTime: doc.updateTime
  };
}

try {
  await ref.create({
    sourceId: 'OPENWEATHER_ONECALL4_CURRENT',
    expiresAtMs: now - 2 * DAY
  });

  const before = await snapshot();

  const condition =
    buildGuardianFirestorePrecondition(
      before, before, now
    );

  assert.ok(condition);

  await ref.update({
    expiresAtMs: now + DAY
  });

  await assert.rejects(
    ref.delete(condition),
    error => Number(error.code) === 9
  );

  assert.equal((await ref.get()).exists, true);

  console.log('PROTECAO ATOMICA: APROVADA');

  await ref.update({
    expiresAtMs: now - 2 * DAY
  });

  const current = await snapshot();

  const valid =
    buildGuardianFirestorePrecondition(
      current, current, now
    );

  assert.ok(valid);

  await ref.delete(valid);

  assert.equal((await ref.get()).exists, false);

  console.log('EXCLUSAO CONDICIONAL: APROVADA');
  console.log('GUARDIAN_EMULATOR=PASS');

} finally {
  await db.terminate();
}
