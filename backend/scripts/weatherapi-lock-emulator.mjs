import assert from 'node:assert/strict';

if(process.env.FIRESTORE_EMULATOR_HOST !==
   '127.0.0.1:8787')
  throw Error('EMULADOR OBRIGATORIO');

const {Firestore} =
  await import('@google-cloud/firestore');

const {createWeatherApiMinuteLock} =
  await import('../src/rj-weatherapi-minute-lock.mjs');

const config = {
  projectId:'demo-blaise-wa-lock',
  databaseId:'(default)'
};

const db = new Firestore(config);
const db2 = new Firestore(config);

const now = Date.UTC(2026,11,1,12,0);

try {

  const a=createWeatherApiMinuteLock({db});
  const b=createWeatherApiMinuteLock({db:db2});

  const results=await Promise.all([
    a.claim(now),
    b.claim(now)
  ]);

  assert.equal(
    results.filter(x=>x===true).length,1
  );

  assert.equal(
    results.filter(x=>x===false).length,1
  );

  console.log('CONCORRENCIA: OK');

  const restarted=createWeatherApiMinuteLock({
    db:db2
  });

  assert.equal(await restarted.claim(now),false);
  console.log('PERSISTENCIA: OK');

  assert.equal(await a.claim(now-60000),false);
  console.log('MINUTO ANTIGO: BLOQUEADO');

  assert.equal(await b.claim(now+60000),true);
  console.log('PROXIMO MINUTO: AUTORIZADO');

  console.log('=== EMULADOR APROVADO ===');

} finally {
  await Promise.all([
    db.terminate(),
    db2.terminate()
  ]);
}
