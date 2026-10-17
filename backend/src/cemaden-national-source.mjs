import { fetchJsonContract } from './source-contract.mjs';
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

export const CEMADEN_NATIONAL_TASK_ID = 'cemaden-national-open-alerts';
export const CEMADEN_NATIONAL_URL = 'https://painelalertas.cemaden.gov.br/wsAlertas2';
const cities = new Map(RJ_MUNICIPALITIES.map(c => [c.ibge, c.name]));
const fold = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const fail = () => { throw Object.assign(new Error('cemaden_national_contract_invalid'), { code: 'cemaden_national_contract_invalid' }); };
function text(value, max = 160) {
  if (typeof value !== 'string' || !value.length || value.length > max || /[<>\u0000-\u001f]/.test(value)) fail();
  return value;
}
export function validateCemadenNationalAlerts(value, { nowMillis = Date.now() } = {}) {
  if (!value || !Array.isArray(value.alertas) || value.alertas.length > 2048) fail();
  const m = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) UTC$/.exec(value.atualizado ?? '');
  if (!m) fail();
  const stamp = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  const epoch = Date.parse(stamp);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== stamp || epoch > nowMillis
      || nowMillis - epoch > 300_000) fail();
  const seen = new Set(), alerts = [];
  for (const row of value.alertas) {
    if (!Number.isSafeInteger(row.cod_alerta) || row.cod_alerta < 1 || row.cod_alerta > 1e9
        || !Number.isInteger(row.codibge) || !/^\d{7}$/.test(String(row.codibge))
        || ![0, 1].includes(row.status) || !['Moderado', 'Alto', 'Muito Alto'].includes(row.nivel)) fail();
    text(row.evento); text(row.uf, 2); text(row.municipio, 80);
    text(row.datahoracriacao, 40);
    const ibge = String(row.codibge), key = `${row.cod_alerta}:${ibge}`;
    if (seen.has(key)) fail(); seen.add(key);
    if (row.uf !== 'RJ' && !ibge.startsWith('33')) continue;
    if (row.uf !== 'RJ' || !cities.has(ibge) || fold(row.municipio) !== fold(cities.get(ibge))) fail();
    if (row.status === 1) alerts.push(Object.freeze({ id: key, ibge, municipality: cities.get(ibge),
      event: row.evento, officialLevel: row.nivel, openedAtRaw: row.datahoracriacao,
      // The source gives no timezone on individual records: preserve, never infer.
      updatedAtRaw: row.ult_atualizacao == null ? null : text(row.ult_atualizacao, 40) }));
  }
  if (alerts.length > 64) fail();
  return Object.freeze({ sourceId: CEMADEN_NATIONAL_TASK_ID, sourceUrl: CEMADEN_NATIONAL_URL,
    sourceUpdatedAt: stamp, alerts: Object.freeze(alerts), product: 'OFFICIAL_OPEN_ALERT_STATUS',
    absenceOfRiskProven: false, municipalRiskLevelProvided: false });
}
export async function probeCemadenNationalAlerts({ fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const body = await fetchJsonContract(CEMADEN_NATIONAL_URL, { fetchImpl,
    allowedHosts: ['painelalertas.cemaden.gov.br'], timeoutMs: 8_000, maxBytes: 2 * 1024 * 1024 });
  return validateCemadenNationalAlerts(body, { nowMillis: Number(now()) });
}
function epoch(value) {
  const n = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(n)) fail();
  return n;
}
export function createCemadenNationalCache({ now = () => Date.now() } = {}) {
  let entry = null, error = null, attemptedAt = null;
  return Object.freeze({
    recordSuccess(snapshot, { fetchedAt = now() } = {}) {
      if (snapshot.sourceId !== CEMADEN_NATIONAL_TASK_ID || snapshot.sourceUrl !== CEMADEN_NATIONAL_URL) fail();
      entry = { snapshot, fetchedAt: epoch(fetchedAt) }; error = null; attemptedAt = epoch(fetchedAt);
    },
    recordFailure(code, { attemptedAt: at = now() } = {}) { error = code; attemptedAt = epoch(at); },
    read() {
      const at = Number(now());
      const fresh = entry && at >= entry.fetchedAt && at - entry.fetchedAt <= 300_000
        && at >= Date.parse(entry.snapshot.sourceUpdatedAt) && at - Date.parse(entry.snapshot.sourceUpdatedAt) <= 300_000;
      return { sourceId: CEMADEN_NATIONAL_TASK_ID, state: fresh ? (error ? 'CURRENT_DEGRADED' : 'CURRENT') : entry ? 'STALE' : 'UNAVAILABLE',
        reason: fresh ? 'official_open_alert_inventory' : 'no_recent_official_open_alert_inventory',
        lastErrorCode: error, lastAttemptAt: attemptedAt == null ? null : new Date(attemptedAt).toISOString(),
        fetchedAt: entry ? new Date(entry.fetchedAt).toISOString() : null,
        observedAt: entry?.snapshot.sourceUpdatedAt ?? null,
        timestampMeaning: 'OPEN_ALERT_INVENTORY_UPDATE_NOT_SENSOR_OBSERVATION',
        snapshot: fresh ? entry.snapshot : null };
    },
  });
}
