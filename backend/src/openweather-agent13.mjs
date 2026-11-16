/**
 * OpenWeather One Call 4.0 current conditions, server-only.
 * The provider's current conditions are classified E (estimated/model-assisted),
 * not direct station observation. No alert is generated from this feed.
 * Every network request MUST reserve one call in a shared, atomic daily quota
 * store before contacting OpenWeather. A local in-memory counter is unsafe when
 * Cloud Run has multiple replicas.
 */
export const AGENT13_API_BASE = 'https://api.openweathermap.org/data/4.0/onecall/current';
export const AGENT13_MAX_AGE_MS = 12 * 60_000;
export const AGENT13_CACHE_MS = 60_000;
export const AGENT13_DAILY_QUOTA_LIMIT = 900;
const MAX_RESPONSE_BYTES = 256 * 1024;

function bound(value, low, high) {
  return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high ? value : null;
}

function parseRecord(payload, nowMillis) {
  if (!payload || !Array.isArray(payload.data) || payload.data.length !== 1) return null;
  const current = payload.data[0];
  const dt = current?.dt;
  if (!Number.isSafeInteger(dt) || dt < 0) return null;
  const observedAtMs = dt * 1000;
  if (observedAtMs > nowMillis || nowMillis - observedAtMs > AGENT13_MAX_AGE_MS) return null;
  const data = Object.freeze({
    temperatureC: bound(current.temp, -30, 60),
    feelsLikeC: bound(current.feels_like, -40, 70),
    humidityPct: bound(current.humidity, 0, 100),
    windKmh: bound(current.wind_speed, 0, 110)?.valueOf() * 3.6 || null,
    windGustKmh: bound(current.wind_gust, 0, 150)?.valueOf() * 3.6 || null,
    pressureHpa: bound(current.pressure, 850, 1100),
    cloudPct: bound(current.clouds, 0, 100),
    uvIndex: bound(current.uvi, 0, 25),
    rainLastHourMm: bound(current.rain?.['1h'], 0, 2000),
  });
  if (Object.values(data).every(value => value === null)) return null;
  return Object.freeze({
    provider: 'OpenWeather',
    product: 'One Call 4.0 / current',
    classification: 'E',
    coverage: 'POINT_MODEL_ESTIMATE_NOT_STATION',
    observedAt: new Date(observedAtMs).toISOString(),
    checkedAt: new Date(nowMillis).toISOString(),
    sourceUrl: 'https://openweathermap.org/api/one-call-4',
    data,
  });
}

/**
 * In-memory cache is a latency optimization only; reserveQuota must be atomic
 * across all backend replicas and must apply the exact same 900/day limit.
 */
export function createOpenWeatherAgent13({
  apiKey,
  reserveQuota,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  cacheMillis = AGENT13_CACHE_MS,
} = {}) {
  if (typeof apiKey !== 'string' || apiKey.trim().length < 12 || /[\r\n]/.test(apiKey)) {
    throw new Error('agent13_api_key_missing');
  }
  if (typeof reserveQuota !== 'function') {
    throw new Error('agent13_distributed_quota_required');
  }
  if (typeof fetchImpl !== 'function' || typeof now !== 'function' ||
      !Number.isInteger(cacheMillis) || cacheMillis < 60_000 || cacheMillis > 120_000) {
    throw new Error('agent13_invalid_config');
  }
  const cache = new Map();
  const pending = new Map();
  const apiKeyValue = apiKey.trim();

  async function currentAt({ latitude, longitude } = {}) {
    const lat = bound(latitude, -25, -19);
    const lon = bound(longitude, -46, -39);
    if (lat === null || lon === null) return Object.freeze({ state: 'UNAVAILABLE', reason: 'coordinates_not_verified' });
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const start = Number(now());
    if (!Number.isFinite(start)) return Object.freeze({ state: 'UNAVAILABLE', reason: 'clock_invalid' });
    const cached = cache.get(key);
    if (cached && start - cached.cachedAt < cacheMillis) {
      const age = start - Date.parse(cached.record.observedAt);
      if (age >= 0 && age <= AGENT13_MAX_AGE_MS) {
        return Object.freeze({ state: 'AVAILABLE', record: cached.record, cached: true });
      }
    }
    if (pending.has(key)) return pending.get(key);
    const job = (async () => {
      let allowed;
      try {
        allowed = await reserveQuota({ provider: 'OPENWEATHER_ONE_CALL_4', limit: AGENT13_DAILY_QUOTA_LIMIT });
      } catch {
        return Object.freeze({ state: 'UNAVAILABLE', reason: 'quota_reservation_failed' });
      }
      if (allowed !== true) return Object.freeze({ state: 'UNAVAILABLE', reason: 'quota_limit_or_unavailable' });
      try {
        const url = new URL(AGENT13_API_BASE);
        url.searchParams.set('lat', String(lat));
        url.searchParams.set('lon', String(lon));
        url.searchParams.set('units', 'metric');
        url.searchParams.set('lang', 'pt_br');
        url.searchParams.set('appid', apiKeyValue);
        const response = await fetchImpl(url.toString(), {
          method: 'GET',
          headers: { accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(7000),
        });
        if (!response || response.status !== 200 || !response.body) {
          return Object.freeze({ state: 'UNAVAILABLE', reason: 'provider_unavailable' });
        }
        const chunks = [];
        let bytes = 0;
        for await (const chunk of response.body) {
          bytes += chunk.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) return Object.freeze({ state: 'UNAVAILABLE', reason: 'payload_too_large' });
          chunks.push(Buffer.from(chunk));
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const checked = Number(now());
        const record = parseRecord(payload, checked);
        if (!record) return Object.freeze({ state: 'UNAVAILABLE', reason: 'missing_or_stale_data' });
        cache.set(key, { record, cachedAt: checked });
        if (cache.size > 256) cache.delete(cache.keys().next().value);
        return Object.freeze({ state: 'AVAILABLE', record, cached: false });
      } catch {
        return Object.freeze({ state: 'UNAVAILABLE', reason: 'provider_unavailable' });
      }
    })();
    pending.set(key, job);
    try { return await job; }
    finally { pending.delete(key); }
  }
  return Object.freeze({ currentAt });
}
