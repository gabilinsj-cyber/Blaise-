import assert from 'node:assert/strict';
import test from 'node:test';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import { buildStatewideDashboardSnapshot, STATEWIDE_SOURCE_RESPONSIBILITIES } from '../src/statewide-dashboard.mjs';
import { INMET_SOURCE_ID, INMET_CAP_RSS_URL } from '../src/inmet-source.mjs';
const now = Date.parse('2026-10-08T10:00:00Z');
const stamp = new Date(now - 60_000).toISOString();
function worker({ observedAt = stamp, fetchedAt = stamp, unresolved = false, enabled = true } = {}) {
  const hydro = { sourceId: 'cemaden-rj-hydrological-risk', state: 'CURRENT', fetchedAt, snapshot: {
    sourceId: 'cemaden-rj-hydrological-risk', records: RJ_MUNICIPALITIES.map(city => ({ ...city, municipality: city.name,
      priority: city.ibge === '3305802' ? 4 : 1, risk: city.ibge === '3305802' ? 'ALTO' : 'MUITO BAIXO', observedAt, redec: 'Fixture region' })),
  } };
  const cap = { sourceId: INMET_SOURCE_ID, state: 'CURRENT', fetchedAt, snapshot: { sourceId: INMET_SOURCE_ID,
    sourceUrl: INMET_CAP_RSS_URL, rjWarnings: [{ identifier: 'fixture-warning', msgType: 'Alert', status: 'Actual',
      sent: stamp, onset: stamp, expires: new Date(now + 3600_000).toISOString(), event: 'Fixture storm', severity: 'Severe',
      rjMunicipalityIbges: unresolved ? [] : ['3305802'] }] } };
  return { status: () => ({ enabled, started: true, sources: [hydro, cap] }),
    readSource: id => { if (id === hydro.sourceId) return hydro; if (id === cap.sourceId) return cap; throw new Error('not configured'); } };
}
test('all 92 canonical municipalities have separate risks and exact warning assignment', () => {
  const result = buildStatewideDashboardSnapshot(worker(), { nowMillis: now });
  assert.equal(result.municipalities.length, 92);
  assert.equal(new Set(result.municipalities.map(city => city.ibge)).size, 92);
  assert.equal(result.municipalities.find(city => city.ibge === '3305802').hydrologicalRisk.level, 4);
  assert.deepEqual(result.municipalities.find(city => city.ibge === '3305802').warningIds, ['fixture-warning']);
  assert.deepEqual(result.municipalities.find(city => city.ibge === '3303302').warningIds, []);
  assert.equal(result.municipalities.find(city => city.ibge === '3305802').seaFacing, false);
});
test('recent download never renews expired observation; expired fetch blocks all payloads', () => {
  const old = new Date(now - 1800_001).toISOString();
  const observed = buildStatewideDashboardSnapshot(worker({ observedAt: old }), { nowMillis: now });
  assert.ok(observed.municipalities.every(city => city.hydrologicalRisk.level === null));
  const stale = buildStatewideDashboardSnapshot(worker({ fetchedAt: old }), { nowMillis: now });
  assert.ok(stale.municipalities.every(city => city.hydrologicalRisk.level === null));
  assert.deepEqual(stale.warnings, []);
});
test('unresolved statewide CAP is retained but never spread across municipalities', () => {
  const result = buildStatewideDashboardSnapshot(worker({ unresolved: true }), { nowMillis: now });
  assert.equal(result.warnings.length, 1);
  assert.ok(result.municipalities.every(city => city.warningCoverage === 'PARTIAL_UNRESOLVED_AREAS' && !city.warningIds.length));
});
test('inactive worker and unconnected products never claim operational coverage', () => {
  const result = buildStatewideDashboardSnapshot(worker({ enabled: false }), { nowMillis: now });
  assert.equal(result.workerActive, false);
  assert.ok(result.municipalities.every(city => city.hydrologicalRisk.level === null));
  assert.ok(result.sources.every(source => source.connectedProduct === null));
  assert.equal(STATEWIDE_SOURCE_RESPONSIBILITIES.some(source => source.id.includes('inea')), false);
  const current = buildStatewideDashboardSnapshot(worker(), { nowMillis: now });
  assert.equal(current.sources.find(source => source.id === 'inmet').connectedProduct, 'avisos');
  assert.equal(current.sources.find(source => source.id === 'ww3').connectedProduct, null);
});
