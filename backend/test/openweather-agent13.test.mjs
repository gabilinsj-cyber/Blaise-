import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOpenWeatherAgent13, AGENT13_MAX_AGE_MS, AGENT13_CACHE_MS, AGENT13_DAILY_QUOTA_LIMIT,
} from '../src/openweather-agent13.mjs';

const START = Date.parse('2026-11-16T18:00:00.000Z');
const coords = { latitude: -22.9068, longitude: -43.1729 };
const payload = (ts, patch = {}) => ({
  lat: coords.latitude, lon: coords.longitude, data: [{
    dt: Math.trunc(ts / 1000), temp: 28.4, feels_like: 30.1, humidity: 70,
    wind_speed: 0, wind_gust: 4.0, pressure: 1012, clouds: 30, uvi: 6, ...patch,
  }],
});
const fakeResponse = obj => new Response(JSON.stringify(obj), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});
function agent({ now = () => START, record = payload(START - 60_000), reserveQuota, fetchImpl, apiKey = 'test-key-placeholder-123' } = {}) {
  return createOpenWeatherAgent13({
    apiKey,
    now,
    reserveQuota: reserveQuota || (async () => true),
    fetchImpl: fetchImpl || (async () => fakeResponse(record)),
  });
}

test('fail-closed before any request if shared quota reservation is missing', () => {
  assert.throws(() => createOpenWeatherAgent13({ apiKey: 'test-key-placeholder-123' }), /distributed_quota_required/);
});

test('current weather model is estimated E, has source and UTC observation, and keeps zero wind', async () => {
  let sent = 0, quota = 0;
  const subject = agent({
    reserveQuota: async options => {
      assert.equal(options.limit, AGENT13_DAILY_QUOTA_LIMIT);
      quota++;
      return true;
    },
    fetchImpl: async url => {
      sent++;
      assert.ok(url.startsWith('https://api.openweathermap.org/data/4.0/onecall/current?'));
      assert.ok(url.includes('units=metric'));
      assert.ok(url.includes('appid=test-key-placeholder-123'));
      return fakeResponse(payload(START - 2 * 60_000));
    },
  });
  const first = await subject.currentAt(coords);
  assert.equal(first.state, 'AVAILABLE');
  assert.equal(first.record.classification, 'E');
  assert.equal(first.record.data.temperatureC, 28.4);
  assert.equal(first.record.data.windKmh, 0);
  assert.equal(first.record.data.windGustKmh, 14.4);
  assert.equal(first.record.observedAt, '2026-11-16T17:58:00.000Z');
  const second = await subject.currentAt(coords);
  assert.equal(second.cached, true);
  assert.equal(sent, 1);
  assert.equal(quota, 1);
  assert.equal(AGENT13_CACHE_MS, 60_000);
});

test('twelve-minute measured-timestamp ceiling is enforced even if payload is freshly retrieved', async () => {
  assert.equal((await agent({ record: payload(START - AGENT13_MAX_AGE_MS) }).currentAt(coords)).state, 'AVAILABLE');
  const stale = await agent({ record: payload(START - AGENT13_MAX_AGE_MS - 1000) }).currentAt(coords);
  assert.deepEqual(stale, { state: 'UNAVAILABLE', reason: 'missing_or_stale_data' });
  const future = await agent({ record: payload(START + 1000) }).currentAt(coords);
  assert.deepEqual(future, { state: 'UNAVAILABLE', reason: 'missing_or_stale_data' });
});

test('quota denial never reaches provider and does not emit a key or an artificial weather value', async () => {
  let calls = 0;
  const result = await agent({
    reserveQuota: async () => false,
    fetchImpl: async () => { calls++; throw new Error('should_not_call'); },
  }).currentAt(coords);
  assert.equal(result.reason, 'quota_limit_or_unavailable');
  assert.equal(calls, 0);
  assert.ok(!JSON.stringify(result).includes('test-key'));
});

test('invalid location, invalid provider payload, and 401 fail closed', async () => {
  assert.equal((await agent().currentAt({ latitude: 90, longitude: -43 })).reason, 'coordinates_not_verified');
  assert.equal((await agent({ record: { data: [] } }).currentAt(coords)).reason, 'missing_or_stale_data');
  assert.equal((await agent({ fetchImpl: async () => new Response('{}', { status: 401 }) }).currentAt(coords)).reason, 'provider_unavailable');
});

test('concurrent same-coordinate fetches are deduplicated under one quota reservation', async () => {
  let quota = 0, requests = 0;
  const subject = agent({
    reserveQuota: async () => { quota++; return true; },
    fetchImpl: async () => { requests++; await Promise.resolve(); return fakeResponse(payload(START)); },
  });
  const [a, b] = await Promise.all([subject.currentAt(coords), subject.currentAt(coords)]);
  assert.equal(a.state, 'AVAILABLE');
  assert.equal(b.state, 'AVAILABLE');
  assert.equal(quota, 1);
  assert.equal(requests, 1);
});
