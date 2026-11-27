const DAY = 86400000;

export async function reserveGuardianAudit({
  db, now, enabled = false
} = {}) {

  if (enabled !== true) return false;

  if (!db ||
      typeof db.runTransaction !== 'function' ||
      !Number.isSafeInteger(now) || now < DAY) {
    throw Error('guardian_invalid_budget');
  }

  const ref = db
    .collection('blaise_guardian_cloud_control')
    .doc('audit');

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);

    if (snap.exists) {
      const last = snap.data()?.lastReservedAtMs;

      if (!Number.isSafeInteger(last) ||
          last < DAY || last > now) {
        throw Error('guardian_corrupt_budget');
      }

      if (now - last < DAY) return false;
    }

    tx.set(ref, {
      lastReservedAtMs: now
    });

    return true;
  }, {maxAttempts: 1});
}
