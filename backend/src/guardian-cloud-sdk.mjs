import {Timestamp} from '@google-cloud/firestore';

import {prepareGuardianPrecondition}
  from './guardian-cloud-precondition.mjs';

export function buildGuardianFirestorePrecondition(
  candidate, current, now
) {
  const plan = prepareGuardianPrecondition(
    candidate, current, now
  );

  if (!plan) return null;

  const {seconds, nanoseconds} =
    plan.lastUpdateTime;

  return Object.freeze({
    lastUpdateTime: new Timestamp(
      seconds, nanoseconds
    )
  });
}
