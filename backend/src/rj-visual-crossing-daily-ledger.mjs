import {VC_DAILY_CEILING}
from './rj-visual-crossing-daily-budget.mjs';

import {VC_BUDGET_COLLECTION, VC_TRIAL_ID}
from './rj-visual-crossing-free-budget.mjs';

export const VC_DAILY_LEDGER =
  'blaise_rj_visual_crossing_daily_ledger_v1';

export function createVisualCrossingDailyLedger({
  db, clock = () => Date.now()
} = {}) {
  if (!db?.runTransaction || !db?.collection)
    throw Error('FIRESTORE_REQUIRED');

  async function reserve({
    confirmedDay,
    externalUsed,
    utcResetVerified = false,
    operatorApproved = false,
    costVerified = false
  } = {}) {
    const now = clock();

    if (!Number.isSafeInteger(now) || now < 0)
      return {approved: false};

    const day = new Date(now).toISOString().slice(0, 10);

    if (confirmedDay !== day ||
        utcResetVerified !== true ||
        operatorApproved !== true ||
        costVerified !== true ||
        !Number.isSafeInteger(externalUsed) ||
        externalUsed < 0 ||
        externalUsed > VC_DAILY_CEILING)
      return {approved: false};

    const ref = db.collection(VC_DAILY_LEDGER).doc(day);

    const trial = db.collection(VC_BUDGET_COLLECTION)
      .doc(VC_TRIAL_ID);

    return db.runTransaction(async tx => {
      const [snap, legacy] = await Promise.all([
        tx.get(ref), tx.get(trial)
      ]);

      const old = snap.exists ? snap.data() : null;
      const prior = old?.reserved ?? 0;
      const baseline = old?.externalBaseline ?? 0;

      if (!Number.isSafeInteger(prior) || prior < 0 ||
          !Number.isSafeInteger(baseline) || baseline < 0 ||
          (old && old.dayUtc !== day))
        return {approved: false};

      const historic = legacy.exists
        ? legacy.data() : null;

      if (historic && (
          historic.calls !== 1 ||
          historic.recordsReserved !== 1 ||
          !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(historic.dayUtc)
      )) return {approved: false};

      const trialUsed = historic?.dayUtc === day ? 1 : 0;

      const externalBaseline = Math.max(
        baseline, externalUsed
      );

      const total =
        prior + externalBaseline + trialUsed + 1;

      if (total > VC_DAILY_CEILING)
        return {
          approved: false,
          reason: 'DAILY_LIMIT'
        };

      tx.set(ref, {
        dayUtc: day,
        reserved: prior + 1,
        externalBaseline,
        paidAllowed: false,
        publicationEnabled: false
      });

      return {
        approved: true,
        reserved: prior + 1,
        remaining: VC_DAILY_CEILING - total
      };
    });
  }

  return Object.freeze({
    reserve,
    automaticCollection: false,
    publicationEnabled: false
  });
}
