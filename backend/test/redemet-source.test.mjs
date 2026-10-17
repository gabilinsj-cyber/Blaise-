import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRedemetMetar, probeRedemetRjMetar, createRedemetCache } from '../src/redemet-source.mjs';
import { buildRjPublicStatusSnapshot } from '../src/rj-public-status-http.mjs';
import { createOfficialSourceWorker } from '../src/official-source-worker.mjs';
import { rjSourceRouting } from '../src/rj-phenomenon-source-policy.mjs';
const now = Date.parse('2026-10-15T20:02:00Z');
const row = (mens = 'METAR SBGL 152000Z 31015G27KT 9999 FEW015 26/22 Q1012=') => ({
  id_localidade: 'SBGL', validade_inicial: '2026-10-15 20:00:00', mens,
  recebimento: '2026-10-15 20:01:59',
});
const payload = rows => ({ status: true, data: { data: rows, current_page: 1,
  last_page: 1, next_page_url: null, total: rows.length } });
const response = rows => new Response(JSON.stringify(payload(rows)), { headers: { 'content-type': 'application/json' } });
test('REDEMET converts KT exactly, labels QNH and does not invent municipal, marine or rain measurements', () => {
  const o = parseRedemetMetar(row(), { nowMillis: now });
  assert.equal(o.airTemperatureC, 26); assert.equal(o.dewPointC, 22);
  assert.equal(o.windSpeedKmh, 27.78); assert.equal(o.gustKmh, 50);
  assert.equal(o.qnhHpa, 1012); assert.equal(o.observedAt, '2026-10-15T20:00:00.000Z');
  assert.deepEqual(o.visibility, { meters: 10000, qualifier: 'AT_LEAST' });
  assert.equal(o.scope, 'AERODROME_POINT_NOT_MUNICIPAL_MEAN');
  assert.equal(o.providesRainfallAccumulation, false);
  assert.equal(o.providesHydrologicalRisk, false);
  assert.equal(o.providesMarineMeasurement, false);
});
test('REDEMET missing gust stays unknown; VRB, negative temperature and forecast trend remain separate', () => {
  const o = parseRedemetMetar(row('METAR SBGL 152000Z VRB02KT CAVOK M03/M05 Q0999 TEMPO 09030G50KT 31/22='), { nowMillis: now });
  assert.equal(o.airTemperatureC, -3); assert.equal(o.dewPointC, -5);
  assert.equal(o.windSpeedKmh, 3.7); assert.equal(o.gustKmh, null);
  assert.equal(o.windDirectionDegrees, null); assert.equal(o.windVariableDirection, true);
});
for (const [title, value, at] of [
  ['wrong airport', { ...row(), id_localidade: 'SBBR' }, now],
  ['airport/message mismatch', row('METAR SBRJ 152000Z 13010KT CAVOK 26/22 Q1012='), now],
  ['message/time mismatch', row('METAR SBGL 151900Z 13010KT CAVOK 26/22 Q1012='), now],
  ['stale report despite new receipt', row(), now + 3_600_001],
  ['future report', row(), now - 180_000],
  ['NIL report', row('METAR SBGL 152000Z NIL='), now],
  ['forecast replacing observation', row('TAF SBGL 152000Z 13010KT CAVOK 26/22 Q1012='), now],
]) test(`REDEMET rejects ${title}`, () => assert.throws(() => parseRedemetMetar(value, { nowMillis: at })));
test('REDEMET credential and usage gates perform no unauthorized request', async () => {
  let requests = 0;
  const fetchImpl = () => { requests++; throw new Error('must not call'); };
  await assert.rejects(probeRedemetRjMetar({ fetchImpl }), e => e.code === 'redemet_missing_api_key');
  await assert.rejects(probeRedemetRjMetar({ fetchImpl, apiKey: 'test-key' }), e => e.code === 'redemet_usage_not_approved');
  assert.equal(requests, 0);
});
test('REDEMET response excludes key, drops old rows, rejects pagination and sanitizes transport exceptions', async () => {
  const opts = { apiKey: 'test-private-key', usageApproved: true, now: () => now };
  const result = await probeRedemetRjMetar({ ...opts, fetchImpl: async (url, options) => {
    assert.equal(new URL(url).hostname, 'api-redemet.decea.mil.br');
    assert.equal(new URL(url).searchParams.has('api_key'), false);
    assert.equal(options.headers['X-Api-Key'], opts.apiKey);
    assert.equal(options.redirect, 'manual');
    return response([row()]);
  }});
  assert.equal(result.observations.length, 1);
  assert.equal(JSON.stringify(result).includes(opts.apiKey), false);
  await assert.rejects(probeRedemetRjMetar({ ...opts, fetchImpl: async () => { throw new Error(opts.apiKey); } }), e =>
    e.code === 'redemet_request_failed' && !String(e).includes(opts.apiKey));
  await assert.rejects(probeRedemetRjMetar({ ...opts, fetchImpl: async () => new Response(JSON.stringify({ ...payload([row()]),
    data: { ...payload([row()]).data, next_page_url: 'https://evil.test/?api_key=secret' } }),
    { headers: { 'content-type': 'application/json' } }) }), e => e.code === 'redemet_inventory_invalid');
});
test('REDEMET failure does not renew cached observation; stale points disappear', () => {
  let at = now;
  const cache = createRedemetCache({ now: () => at });
  cache.recordSuccess({ fetchedAt: new Date(now).toISOString(), observations: [parseRedemetMetar(row(), { nowMillis: now })] });
  cache.recordFailure('redemet_request_failed');
  assert.equal(cache.read().state, 'CURRENT_DEGRADED');
  at += 300_001;
  assert.equal(cache.read().snapshot, null);
});
test('REDEMET reaches municipal interface payload without creating a CEMADEN risk or INMET warning', async () => {
  const worker = createOfficialSourceWorker({ config: { enabled: true, initialMode: 'normal', redemetEnabled: true,
    redemetUsageApproved: true, redemetApiKey: 'test-private-key' }, now: () => now, autoSchedule: false,
    probeAlertaRio: async () => { throw new Error('fixture_offline'); },
    probeRedemet: args => probeRedemetRjMetar({ ...args, fetchImpl: async () => response([row()]) }) });
  worker.start(); await worker.tick();
  const s = buildRjPublicStatusSnapshot(worker, { nowMillis: now });
  assert.equal(s.aerodromeObservations.observations[0].stationId, 'SBGL');
  assert.ok(s.municipalities.every(city => city.risk === null));
  assert.deepEqual(s.warnings, []);
  assert.equal(JSON.stringify(s).includes('test-private-key'), false);
  worker.stop();
});
test('source routing admits REDEMET only for supported point variables and separates SiMCosta ocean products', () => {
  const route = (phenomenon, ibge = '3304557') => rjSourceRouting({ ibge, phenomenon }).sources.map(s => s.id);
  assert.ok(route('TEMPERATURA').includes('REDEMET_METAR'));
  assert.equal(route('TEMPERATURA', '3303302').includes('REDEMET_METAR'), false);
  for (const p of ['RISCO_HIDROLOGICO', 'CHUVA_ACUMULADA', 'ONDAS', 'TSUNAMI']) assert.equal(route(p).includes('REDEMET_METAR'), false);
  assert.ok(rjSourceRouting({ phenomenon: 'ONDAS', region: 'LITORAL' }).sources.some(s => s.id === 'SIMCOSTA_BUOY'));
  assert.equal(route('TSUNAMI').includes('SIMCOSTA_BUOY'), false);
});

test('hourly bulletin remains dated and degraded after five minutes, never renews via fetch',()=>{
 let at=now+1_800_000; const o=parseRedemetMetar(row(),{nowMillis:at});
 assert.equal(o.observedAt,'2026-10-15T20:00:00.000Z');
 const cache=createRedemetCache({now:()=>at});
 cache.recordSuccess({fetchedAt:new Date(at).toISOString(),observations:[o]});
 assert.equal(cache.read().state,'CURRENT_DEGRADED');
 at=Date.parse(o.observedAt)+3_600_001;
 cache.recordSuccess({fetchedAt:new Date(at).toISOString(),observations:[o]});
 assert.equal(cache.read().snapshot,null);
});
