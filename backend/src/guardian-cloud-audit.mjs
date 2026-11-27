import {planGuardianCleanup, checkGuardianSnapshot}
  from './guardian-cloud-clean.mjs';

const DAY = 86400000;

const collections = Object.freeze([
  'blaise_rj_openweather_current_cache',
  'blaise_rj_openweather_temp_fallback_cache'
]);

export async function auditGuardianCloud({
  db,
  now,
  enabled = false
} = {}) {

  if (enabled !== true) {
    return {
      mode: 'DISABLED',
      queries: 0,
      candidates: [],
      deleted: 0
    };
  }

  if (!db || typeof db.collection !== 'function' ||
      !Number.isSafeInteger(now) || now < DAY) {
    throw Error('guardian_invalid_audit');
  }

  const records = [];

  for (const collection of collections) {
    const snapshot = await db.collection(collection)
      .where('expiresAtMs', '<=', now - DAY)
      .orderBy('expiresAtMs')
      .limit(10)
      .select('sourceId', 'expiresAtMs')
      .get();

    if (!Array.isArray(snapshot.docs) ||
        snapshot.docs.length > 10) {
      throw Error('guardian_query_limit');
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();

      records.push({
        collection,
        id: doc.id,
        updateTime: doc.updateTime,
        sourceId: data?.sourceId,
        expiresAtMs: data?.expiresAtMs
      });
    }
  }

  const eligible = records.filter(
    r => checkGuardianSnapshot(r, r, now)
  );

  const plan = planGuardianCleanup(eligible, now);

  const candidates = plan.candidates.map(c => {
    const record = eligible.find(r =>
      r.collection === c.collection &&
      r.id === c.id
    );

    return {
      ...c,
      updateTime: {
        seconds: record.updateTime.seconds,
        nanoseconds: record.updateTime.nanoseconds
      }
    };
  });

  return {
    ...plan,
    candidates,
    queries: 2,
    inspected: records.length
  };
}
