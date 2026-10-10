// INMET public data availability probe — NO forecast/radar claims or cached personal data.
// This probe does not gate builds on transient official station outages.
import { mkdir, writeFile } from 'node:fs/promises';

const endpoint = 'https://apitempo.inmet.gov.br';
const checkedAt = new Date();
const result = {
  source: 'INMET',
  sourceHost: 'apitempo.inmet.gov.br',
  checkedAt: checkedAt.toISOString(),
  state: 'UNAVAILABLE',
  liveReadings: 'NOT_CONFIRMED',
  radar: 'NOT_TESTED_NOT_IMPLEMENTED',
  personalData: 'NONE',
};
async function getJson(path) {
  const url = new URL(path, endpoint);
  if (url.protocol !== 'https:' || url.hostname !== 'apitempo.inmet.gov.br') throw Error('HOST_UNTRUSTED');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8_000), headers: { Accept: 'application/json' } });
  if (response.status !== 200) throw Error('HTTP_' + response.status);
  if (!(response.headers.get('content-type') || '').includes('json')) throw Error('CONTENT_TYPE_INVALID');
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > 2 * 1024 * 1024) throw Error('SOURCE_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function number(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max && n !== 9999 ? n : null;
}
function time(row) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.DT_MEDICAO || '')) return null;
  const hhmm = String(row.HR_MEDICAO || '').padStart(4, '0');
  if (!/^\d{4}$/.test(hhmm)) return null;
  const iso = row.DT_MEDICAO + 'T' + hhmm.slice(0, 2) + ':' + hhmm.slice(2) + ':00Z';
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 19) === iso.slice(0, 19) ? ms : null;
}

try {
  const catalog = await getJson('/estacoes/T');
  if (!Array.isArray(catalog)) throw Error('CATALOG_INVALID');
  const stations = catalog.filter(s => s.SG_ESTADO === 'RJ'
    && s.CD_SITUACAO === 'Operante'
    && /^RIO DE JANEIRO([ -]|$)/i.test(s.DC_NOME || '')
    && /^[A-Z][0-9]{3}$/.test(s.CD_ESTACAO || ''));
  const ordered = [...stations].sort((a, b) =>
    (a.CD_ESTACAO === 'A652' ? -1 : b.CD_ESTACAO === 'A652' ? 1 : a.CD_ESTACAO.localeCompare(b.CD_ESTACAO))
  ).slice(0, 4);
  if (!ordered.length) throw Error('RIO_STATION_NOT_FOUND');
  result.triedStations = [];
  let hasValidResponse = false;
  const d = checkedAt.toISOString().slice(0, 10);
  const yesterday = new Date(checkedAt.getTime() - 86_400_000).toISOString().slice(0, 10);
  for (const station of ordered) {
    const path = '/estacao/' + yesterday + '/' + d + '/' + station.CD_ESTACAO;
    let readings;
    try {
      readings = await getJson(path);
      if (!Array.isArray(readings) || readings.length > 500) throw Error('ROWS_INVALID');
    } catch (e) {
      result.triedStations.push({
        stationCode: station.CD_ESTACAO,
        state: 'UNAVAILABLE',
        reason: e instanceof Error && /^[A-Z_0-9]+$/.test(e.message)
          ? e.message : 'SOURCE_NETWORK_UNAVAILABLE',
      });
      continue;
    }
    hasValidResponse = true;
    const recent = readings.filter(row => {
      const at = time(row);
      return at !== null && checkedAt.getTime() - at >= 0 && checkedAt.getTime() - at <= 86_400_000;
    });
    const checks = [
      ['temperatureC', 'TEM_INS', -30, 60],
      ['rainfallMmHour', 'CHUVA', 0, 400],
      ['windMps', 'VEN_VEL', 0, 100],
    ];
    const variables = Object.fromEntries(checks.map(([label, field, min, max]) => {
      const valid = recent.filter(row => number(row[field], min, max) !== null);
      const unique = new Set(valid.map(time));
      const fresh = [...unique].some(ms => checkedAt.getTime() - ms <= 7_200_000);
      return [label, { available: fresh && unique.size >= 2,
        validPointCount: unique.size,
        newestObservedAt: unique.size ? new Date(Math.max(...unique)).toISOString() : null }];
    }));
    const available = Object.values(variables).some(x => x.available);
    result.triedStations.push({ stationCode: station.CD_ESTACAO, state: available ? 'AVAILABLE' : 'STALE_OR_INSUFFICIENT' });
    if (available) {
      result.state = 'AVAILABLE';
      result.liveReadings = 'FRESH_STATION_DATA_CONFIRMED';
      result.stationCode = station.CD_ESTACAO;
      result.stationName = station.DC_NOME;
      result.endpoint = endpoint + path;
      result.variables = variables;
      break;
    }
  }
  if (result.state !== 'AVAILABLE') {
    result.state = hasValidResponse ? 'STALE_OR_INSUFFICIENT' : 'UNAVAILABLE';
    result.liveReadings = 'NOT_CONFIRMED';
  }
} catch (e) {
  result.state = 'UNAVAILABLE';
  result.failureCode = e instanceof Error && /^[A-Z_0-9]+$/.test(e.message) ? e.message : 'SOURCE_NETWORK_UNAVAILABLE';
}
const dir = 'evidence/rj-interface-review';
await mkdir(dir, { recursive: true });
await writeFile(dir + '/inmet-live-source.json', JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
console.log('INMET_LIVE_SOURCE_STATE=' + result.state);
console.log('INMET_RJ_STATION=' + (result.stationCode || 'UNAVAILABLE'));
console.log('INMET_RADAR=NOT_IMPLEMENTED');
