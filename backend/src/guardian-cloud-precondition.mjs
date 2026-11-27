import {checkGuardianSnapshot}
  from './guardian-cloud-clean.mjs';

export function prepareGuardianPrecondition(
  candidate, current, now
) {
  if (!candidate || !current) return null;

  const before = {
    ...candidate,
    sourceId: 'OPENWEATHER_ONECALL4_CURRENT'
  };

  if (!checkGuardianSnapshot(before, current, now))
    return null;

  return Object.freeze({
    mode: 'DRY_RUN',
    collection: before.collection,
    id: before.id,
    lastUpdateTime: Object.freeze({
      seconds: before.updateTime.seconds,
      nanoseconds: before.updateTime.nanoseconds
    }),
    deleted: 0
  });
}
