import { fetchJsonContract } from './source-contract.mjs';

export const REDEMET_TASK_ID = 'redemet-rj-metar';
export const REDEMET_PUBLIC_URL = 'https://redemet.decea.mil.br/';
const HOST = 'api-redemet.decea.mil.br';
export const REDEMET_MAX_AGE_MS = 3_600_000;
export const REDEMET_RJ_STATIONS = Object.freeze({
  SBGL: Object.freeze({ ibge: '3304557', name: 'Galeão', municipality: 'Rio de Janeiro' }),
  SBRJ: Object.freeze({ ibge: '3304557', name: 'Santos Dumont', municipality: 'Rio de Janeiro' }),
});
const fail = code => { throw Object.assign(new Error(`redemet_${code}`), { code: `redemet_${code}` }); };
const number = (v, min, max) => Number.isFinite(v) && v >= min && v <= max ? v : null;
const temperature = text => text == null ? null : number(Number(text.replace(/^M/, '-')), -80, 60);
const rounded = v => v == null ? null : Math.round(v * 100) / 100;
export function parseRedemetMetar(row, { nowMillis = Date.now() } = {}) {
  const station = REDEMET_RJ_STATIONS[row?.id_localidade];
  if (!station) fail('station_outside_validated_catalog');
  if (typeof row.mens !== 'string' || row.mens.length > 2048 || /[<>\u0000-\u001f]/.test(row.mens)) fail('metar_invalid');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.validade_inicial ?? '')) fail('timestamp_invalid');
  const stamp = row.validade_inicial.replace(' ', 'T') + '.000Z';
  const at = Date.parse(stamp);
  if (!Number.isFinite(at) || new Date(at).toISOString() !== stamp) fail('timestamp_invalid');
  const header = /^(METAR|SPECI) (?:COR )?([A-Z]{4}) (\d{2})(\d{2})(\d{2})Z\b/.exec(row.mens);
  if (!header || header[2] !== row.id_localidade || Number(header[3]) !== new Date(at).getUTCDate()
      || Number(header[4]) !== new Date(at).getUTCHours() || Number(header[5]) !== new Date(at).getUTCMinutes()) fail('station_or_timestamp_mismatch');
  if (!Number.isFinite(nowMillis) || at > nowMillis || nowMillis - at > REDEMET_MAX_AGE_MS) fail('observation_not_current');
  const body = row.mens.slice(header[0].length).replace(/=\s*$/, '').trim().split(/\s+(?:RMK|TEMPO|BECMG|NOSIG)\b/, 1)[0];
  if (/\bNIL\b/.test(body)) fail('nil_report');
  const temp = /(?:^| )(M?\d{2})\/(M?\d{2}|\/\/)(?= |$)/.exec(body);
  const wind = /(?:^| )(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)(?= |$)/.exec(body);
  const qnh = /(?:^| )Q(\d{4})(?= |$)/.exec(body);
  const direction = wind && wind[1] !== 'VRB' ? number(Number(wind[1]), 0, 360) : null;
  const factor = wind?.[4] === 'MPS' ? 3.6 : 1.852;
  const speed = wind && (wind[1] === 'VRB' || direction !== null) ? number(Number(wind[2]) * factor, 0, 400) : null;
  const gust = wind?.[3] && speed !== null ? number(Number(wind[3]) * factor, speed, 500) : null;
  let visibility = null;
  if (/\bCAVOK\b/.test(body)) visibility = { meters: 10000, qualifier: 'AT_LEAST' };
  else if (wind) {
    const afterWind = body.slice(wind.index + wind[0].length).trim().replace(/^\d{3}V\d{3} /, '');
    const vis = /^(\d{4})(?= |$)/.exec(afterWind);
    if (vis && vis[1] !== '0000') visibility = vis[1] === '9999'
      ? { meters: 10000, qualifier: 'AT_LEAST' } : { meters: Number(vis[1]), qualifier: 'REPORTED' };
  }
  const airTemperatureC = temperature(temp?.[1]);
  const dewPointC = temp?.[2] !== '//' ? temperature(temp?.[2]) : null;
  if (dewPointC !== null && airTemperatureC !== null && dewPointC > airTemperatureC) fail('dew_point_invalid');
  const qnhHpa = qnh ? number(Number(qnh[1]), 850, 1100) : null;
  if (airTemperatureC === null && speed === null && qnhHpa === null && visibility === null) fail('no_supported_measurements');
  return Object.freeze({ stationId: row.id_localidade, stationName: station.name, ibge: station.ibge,
    reportType: header[1], timeBasis: 'HOURLY_BULLETIN_OR_EVENT_SPECI_WITH_ORIGINAL_TIME',
    municipality: station.municipality, observedAt: stamp, sourceUrl: REDEMET_PUBLIC_URL,
    scope: 'AERODROME_POINT_NOT_MUNICIPAL_MEAN', sourceId: REDEMET_TASK_ID,
    airTemperatureC, dewPointC, windSpeedKmh: rounded(speed), gustKmh: rounded(gust),
    windDirectionDegrees: direction, windVariableDirection: wind ? wind[1] === 'VRB' : null, qnhHpa, visibility,
    providesRainfallAccumulation: false, providesHydrologicalRisk: false, providesMarineMeasurement: false });
}
export async function probeRedemetRjMetar({ fetchImpl = globalThis.fetch, apiKey = '', usageApproved = false, now = () => Date.now() } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) fail('missing_api_key');
  if (usageApproved !== true) fail('usage_not_approved');
  if (apiKey.length > 1024 || /[\u0000-\u0020]/.test(apiKey)) fail('invalid_configuration');
  const url = new URL(`https://${HOST}/mensagens/metar/SBGL,SBRJ`);
  url.searchParams.set('page_tam', '150');
  // Credential travels in the header only, never a URL query.
  const authenticatedFetch = (target, options) => {
    if (new URL(target).hostname !== HOST) fail('credential_host_mismatch');
    return fetchImpl(target, { ...options, headers: { ...options.headers, 'X-Api-Key': apiKey } });
  };
  let result;
  try { result = await fetchJsonContract(url.href, { fetchImpl: authenticatedFetch, allowedHosts: [HOST], timeoutMs: 8_000, maxBytes: 512 * 1024 }); }
  catch { fail('request_failed'); } // Never expose URL, key, upstream message or exception.
  const page = result?.data;
  if (result?.status !== true || !page || !Array.isArray(page.data) || page.data.length > 150
      || page.next_page_url != null || page.last_page !== 1 || page.current_page !== 1
      || page.total !== page.data.length) fail('inventory_invalid');
  const checkedAt = Number(now());
  const observations = new Map();
  let excludedRecordCount = 0;
  for (const row of page.data) {
    let observation;
    try { observation = parseRedemetMetar(row, { nowMillis: checkedAt }); }
    catch (e) {
      if (e.code === 'redemet_observation_not_current' || e.code === 'redemet_nil_report') { excludedRecordCount++; continue; }
      throw e;
    }
    const old = observations.get(observation.stationId);
    if (!old || observation.observedAt >= old.observedAt) observations.set(observation.stationId, observation);
  }
  if (!observations.size) fail('no_current_observation');
  return Object.freeze({ sourceId: REDEMET_TASK_ID, sourceUrl: REDEMET_PUBLIC_URL,
    observations: Object.freeze([...observations.values()]), excludedRecordCount,
    fetchedAt: new Date(checkedAt).toISOString(), automaticAlertAuthorized: false });
}
export function createRedemetCache({ now = () => Date.now() } = {}) {
  let snapshot = null, lastErrorCode = null;
  return Object.freeze({
    recordSuccess(value) { snapshot = value; lastErrorCode = null; },
    recordFailure(code) { lastErrorCode = code; },
    read() {
      const at = Number(now()), fetched = Date.parse(snapshot?.fetchedAt);
      const observations = snapshot?.observations?.filter(o => {
        const stamp = Date.parse(o.observedAt);
        return stamp <= at && at - stamp <= REDEMET_MAX_AGE_MS;
      }) ?? [];
      const current = fetched <= at && at - fetched <= 300_000 && observations.length > 0;
      return { sourceId: REDEMET_TASK_ID, state: current ? (lastErrorCode || observations.some(o => at - Date.parse(o.observedAt) > 300_000) ? 'CURRENT_DEGRADED' : 'CURRENT') : snapshot ? 'STALE' : 'UNAVAILABLE',
        reason: current ? 'hourly_bulletin_original_observation_time_preserved' : lastErrorCode ?? 'no_current_aerodrome_observation',
        lastErrorCode, fetchedAt: snapshot?.fetchedAt ?? null,
        snapshot: current ? { ...snapshot, observations } : null };
    },
  });
}
