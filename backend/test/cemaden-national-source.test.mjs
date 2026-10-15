import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCemadenNationalAlerts, createCemadenNationalCache } from '../src/cemaden-national-source.mjs';
const now = Date.parse('2026-10-15T19:00:00Z');
const row = { cod_alerta: 123, codibge: 3304557, uf: 'RJ', municipio: 'RIO DE JANEIRO',
  evento: 'Risco Hidrológico - Alto', nivel: 'Alto', status: 1,
  datahoracriacao: '2026-10-15 15:00:00', ult_atualizacao: '2026-10-15 15:30:00' };
const payload = () => ({ atualizado: '15-10-2026 18:59:00 UTC', alertas: [row] });
test('national CEMADEN preserves official open status and raw unzoned opening without creating risk score', () => {
  const s = validateCemadenNationalAlerts(payload(), { nowMillis: now });
  assert.equal(s.alerts[0].ibge, '3304557');
  assert.equal(s.alerts[0].openedAtRaw, row.datahoracriacao);
  assert.equal(s.municipalRiskLevelProvided, false);
  assert.equal(s.absenceOfRiskProven, false);
  assert.equal(s.alerts[0].level, undefined);
});
for (const [name, change] of [
  ['municipality swap', p => { p.alertas = [{ ...row, municipio: 'NITERÓI' }]; }],
  ['UF mismatch', p => { p.alertas = [{ ...row, uf: 'SP' }]; }],
  ['stale inventory', p => { p.atualizado = '15-10-2026 18:00:00 UTC'; }],
  ['future inventory', p => { p.atualizado = '15-10-2026 20:00:00 UTC'; }],
  ['invalid calendar', p => { p.atualizado = '31-02-2026 19:00:00 UTC'; }],
  ['HTML injection', p => { p.alertas = [{ ...row, evento: '<script>x</script>' }]; }],
]) test(`national CEMADEN rejects ${name}`, () => {
  const p = payload(); change(p);
  assert.throws(() => validateCemadenNationalAlerts(p, { nowMillis: now }));
});
test('no RJ alerts is not zero municipal risk; old cache cannot become live after failure', () => {
  let at = now;
  const s = validateCemadenNationalAlerts({ ...payload(), alertas: [] }, { nowMillis: now });
  assert.deepEqual(s.alerts, []); assert.equal(s.absenceOfRiskProven, false);
  const cache = createCemadenNationalCache({ now: () => at });
  cache.recordSuccess(s);
  cache.recordFailure('source_network_error');
  assert.equal(cache.read().state, 'CURRENT_DEGRADED');
  at += 300_001;
  assert.equal(cache.read().state, 'STALE'); assert.equal(cache.read().snapshot, null);
});
