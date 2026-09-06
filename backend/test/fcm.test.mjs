import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildP0TopicMessage, DEFAULT_P0_TOPIC } from '../src/fcm.mjs';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';

const config = { firebaseProjectId: 'blaise-test' };
const nowMillis = Date.parse('2026-09-06T03:00:00Z');

function alert() {
  return {
    authority: 'official',
    severity: 'P0',
    id: 'official-123',
    title: 'Alerta oficial imediato',
    source: 'Defesa Civil RJ',
    issuedAt: '2026-09-06T02:55:00Z',
    expiresAt: '2026-09-06T04:00:00Z',
  };
}

test('builds high-priority data-only P0 topic message with bounded TTL', () => {
  const body = buildP0TopicMessage(alert(), config, nowMillis);
  assert.equal(body.message.topic, DEFAULT_P0_TOPIC);
  assert.equal(body.message.android.priority, 'high');
  assert.equal(body.message.android.ttl, '3600s');
  assert.equal(body.message.data.severity, 'P0');
  assert.equal(body.message.data.authority, 'official');
  assert.equal('notification' in body.message, false);
});

test('includes optional RJ city fields without adding user identifiers', () => {
  const body = buildP0TopicMessage(
    { ...alert(), cityName: 'Niterói', cityIbge: '3303302' },
    config,
    nowMillis,
  );
  assert.equal(body.message.data.cityName, 'Niterói');
  assert.equal(body.message.data.cityIbge, '3303302');
  assert.equal('purchaseToken' in body.message.data, false);
  assert.equal('userId' in body.message.data, false);
});

test('rejects noncanonical or mismatched RJ municipality fields fail-closed', () => {
  assert.throws(
    () => buildP0TopicMessage({ ...alert(), cityName: 'Niterói', cityIbge: '3399999' }, config, nowMillis),
    /invalid_p0_city_ibge/,
  );
  assert.throws(
    () => buildP0TopicMessage({ ...alert(), cityName: 'Niterói', cityIbge: '3304557' }, config, nowMillis),
    /invalid_p0_city_pair/,
  );
  assert.throws(
    () => buildP0TopicMessage({ ...alert(), cityName: 'Niterói' }, config, nowMillis),
  );
});

test('backend RJ municipality catalog stays exactly aligned with Android canonical 92 list', () => {
  const kotlin = readFileSync(
    new URL('../../app/src/main/java/br/com/blaise/rj/cities/RioMunicipalities.kt', import.meta.url),
    'utf8',
  );
  const androidCatalog = [...kotlin.matchAll(/City\("([^"]+)",\s*(\d+)\)/g)]
    .map((match) => ({ name: match[1], ibge: match[2] }));
  assert.equal(androidCatalog.length, 92);
  assert.deepEqual(RJ_MUNICIPALITIES, androidCatalog);
});

test('rejects nonofficial, non-P0, expired and overlong events', () => {
  assert.throws(() => buildP0TopicMessage({ ...alert(), authority: 'unverified' }, config, nowMillis));
  assert.throws(() => buildP0TopicMessage({ ...alert(), severity: 'RED' }, config, nowMillis));
  assert.throws(() => buildP0TopicMessage({ ...alert(), expiresAt: '2026-09-06T02:59:59Z' }, config, nowMillis));
  assert.throws(() => buildP0TopicMessage({ ...alert(), expiresAt: '2026-09-07T02:55:01Z' }, config, nowMillis));
});
