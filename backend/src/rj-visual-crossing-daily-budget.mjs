export const VC_DAILY_CEILING = 900;

export function planVisualCrossingDaily({
  municipalities = 92,
  rounds = 9,
  costPerQuery = 1,
  previouslyUsed = 0
} = {}) {
  const values = [
    municipalities, rounds,
    costPerQuery, previouslyUsed
  ];

  if (!values.every(Number.isSafeInteger) ||
      municipalities < 1 ||
      municipalities > 92 ||
      rounds < 1 ||
      costPerQuery < 1 ||
      previouslyUsed < 0) {
    throw Error('INVALID_DAILY_PLAN');
  }

  const requested =
    municipalities * rounds * costPerQuery;

  const total = requested + previouslyUsed;

  return Object.freeze({
    municipalities,
    requested,
    total,
    ceiling: VC_DAILY_CEILING,
    approved: total <= VC_DAILY_CEILING,
    automaticCollection: false,
    providerContacted: false,
    publicationEnabled: false
  });
}
