import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

const cities = new Set(
  RJ_MUNICIPALITIES.map(m => String(m.ibge))
);

const DAY = 86400000;
const MAX_CANDIDATES = 20;

const allowed = new Set([
  'blaise_rj_openweather_current_cache',
  'blaise_rj_openweather_temp_fallback_cache'
]);

export function planGuardianCleanup(records, now) {
  if (!Array.isArray(records) ||
      !Number.isSafeInteger(now) || now < DAY) {
    throw Error('guardian_invalid_input');
  }

  const candidates = [];
  const seen = new Set();


  for (const r of records) {
    if (!r || !allowed.has(r.collection)) continue;

    if (r.sourceId !==
        'OPENWEATHER_ONECALL4_CURRENT') continue;

    if (!Number.isSafeInteger(r.expiresAtMs) ||
        r.expiresAtMs <= 0) continue;

    if (r.expiresAtMs > now - DAY) continue;


    if (typeof r.id !== 'string') continue;

    if (r.collection ===
        'blaise_rj_openweather_current_cache') {
      if (!/^[a-f0-9]{64}$/.test(r.id)) continue;
    } else {
      if (!cities.has(r.id)) continue;
    }

    const key = r.collection + '/' + r.id;

    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      collection: r.collection,
      id: r.id,
      expiresAtMs: r.expiresAtMs
    });

    if (candidates.length >= MAX_CANDIDATES) break;
  }

  return {
    mode: 'DRY_RUN',
    candidates,
    deleted: 0
  };
}

export function checkGuardianSnapshot(before, current, now) {
  if (!before || !current) return false;

  const a = planGuardianCleanup([before], now);
  const b = planGuardianCleanup([current], now);

  if (a.candidates.length !== 1 ||
      b.candidates.length !== 1) return false;

  if (before.collection !== current.collection ||
      before.id !== current.id ||
      before.expiresAtMs !== current.expiresAtMs)
    return false;

  const valid = v =>
    v && Number.isSafeInteger(v.seconds) &&
    v.seconds >= 0 &&
    Number.isInteger(v.nanoseconds) &&
    v.nanoseconds >= 0 &&
    v.nanoseconds < 1000000000;

  const x = before.updateTime;
  const y = current.updateTime;

  if (!valid(x) || !valid(y)) return false;

  return x.seconds === y.seconds &&
         x.nanoseconds === y.nanoseconds;
}
