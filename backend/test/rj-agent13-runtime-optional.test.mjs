import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeOptionalAgent13Runtime } from '../src/rj-agent13-runtime-optional.mjs';

const NOW = Date.parse('2026-11-17T03:00:00.000Z');
const key = 'a'.repeat(32); // synthetic fixture only
const env = {
  BLAISE_OPENWEATHER_AGENT13_ENABLED: 'true',
  BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED: 'true',
  BLAISE_AGENT13_FIRESTORE_ENABLED: 'true',
  BLAISE_AGENT13_PROJECT_ID: 'blaise-test-project',
  BLAISE_OPENWEATHER_API_KEY: key,
};
const target = { ibge: '3304557', latitude: -22.91, longitude: -43.22 };

function fakeDatabase() {
  const documents = new Map();
  let queue = Promise.resolve();
  const ref = location => ({
    location,
    async get() {
      return { exists: documents.has(location), data: () => structuredClone(documents.get(location)) };
    },
    async set(value) {
      documents.set(location, structuredClone(value));
    },
  });
  return {
    collection(name) {
      return { doc(id) { return ref(name + '/' + id); } };
    },
    async runTransaction(handler) {
      const work = async () => {
        const updates = [];
        const transaction = {
          get: async reference => reference.get(),
          set(reference, value) { updates.push([reference.location, structuredClone(value)]); },
        };
        const result = await handler(transaction);
        for (const [id, value] of updates) documents.set(id, value);
        return result;
      };
      const task = queue.then(work, work);
      queue = task.then(() => {}, () => {});
      return task;
    },
  };
}

test('agent disabled by default never loads database or contacts provider', async () => {
  let dbCalls = 0, networkCalls = 0;
  const agent = await initializeOptionalAgent13Runtime({
    env: {},
    createDatabase: async () => { dbCalls++; throw new Error('should not load'); },
    fetchImpl: async () => { networkCalls++; throw new Error('should not fetch'); },
  });
  assert.equal(agent.state, 'DISABLED');
  assert.equal(agent.configured, false);
  assert.equal((await agent.collect({ target })).status, 'UNAVAILABLE');
  assert.equal(dbCalls, 0);
  assert.equal(networkCalls, 0);
});

test('three production gates, secret and project must be explicit', async () => {
  let databaseCalled = 0;
  const createDatabase = async () => { databaseCalled++; return fakeDatabase(); };
  const cases = [
    [{ ...env, BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED: 'false' }, 'APPROVAL_OR_SHARED_STORE_REQUIRED'],
    [{ ...env, BLAISE_AGENT13_FIRESTORE_ENABLED: 'false' }, 'APPROVAL_OR_SHARED_STORE_REQUIRED'],
    [{ ...env, BLAISE_OPENWEATHER_API_KEY: '' }, 'SERVER_SECRET_REQUIRED'],
    [{ ...env, BLAISE_AGENT13_PROJECT_ID: '' }, 'PROJECT_NOT_CONFIGURED'],
  ];
  for (const [vars, state] of cases) {
    const result = await initializeOptionalAgent13Runtime({ env: vars, createDatabase });
    assert.equal(result.state, state);
    assert.equal(result.configured, false);
  }
  assert.equal(databaseCalled, 0);
});

test('missing Firestore server module or denied IAM fails closed without leaking errors', async () => {
  const result = await initializeOptionalAgent13Runtime({
    env,
    createDatabase: async () => { throw new Error('internal token and permissions'); },
  });
  assert.equal(result.state, 'DATABASE_INITIALIZATION_FAILED');
  assert.equal(result.configured, false);
  assert.equal(JSON.stringify(result).includes('token'), false);
});

test('configured runtime has no automatic polling and explicitly collects modeled data only', async () => {
  let calls = 0, dbCalls = 0;
  const data = {
    lat: target.latitude, lon: target.longitude,
    data: [{
      dt: Math.floor((NOW - 60_000) / 1000), temp: 26.3,
      feels_like: 27.9, humidity: 68, wind_speed: 0,
    }],
  };
  const agent = await initializeOptionalAgent13Runtime({
    env,
    clock: () => NOW,
    createDatabase: async ({ projectId }) => {
      assert.equal(projectId, 'blaise-test-project');
      dbCalls++;
      return fakeDatabase();
    },
    fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(agent.state, 'READY_FOR_EXPLICIT_CALL');
  assert.equal(agent.configured, true);
  assert.equal(agent.automaticSchedulingEnabled, false);
  assert.equal(agent.publishedToAndroid, false);
  assert.equal(dbCalls, 1);
  assert.equal(calls, 0, 'initialization must never fetch provider data');
  const response = await agent.collect({ target, now: NOW });
  assert.equal(response.status, 'CURRENT_ESTIMATE_AVAILABLE');
  assert.equal(response.weather.officialObservation, false);
  assert.equal(response.weather.values.windKmh, 0);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(response).includes(key), false);
});
