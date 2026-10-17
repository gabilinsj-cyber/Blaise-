import { fetchTextContract } from './source-contract.mjs';
import { ALERTA_RIO_LIVE_URL, ALERTA_RIO_LIVE_HOST, validateAlertaRioMeteorologyHtml } from './alerta-rio-source.mjs';

export const ALERTA_RIO_METEOROLOGY_TASK = 'alerta-rio-meteorology';
const MAX_AGE = 300_000;
const error = code => Object.assign(new Error(code), { code });

export async function probeAlertaRioMeteorology({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const html = await fetchTextContract(ALERTA_RIO_LIVE_URL, {
    allowedHosts: [ALERTA_RIO_LIVE_HOST], fetchImpl, timeoutMs: 25_000, maxBytes: 1024 * 1024,
  });
  if (/Request Rejected/i.test(html)) throw error('alerta_rio_access_rejected');
  const at = now();
  const parsed = validateAlertaRioMeteorologyHtml(html, { now: new Date(at), maxAgeMs: MAX_AGE });
  if (parsed.stations.length > 50) throw error('alerta_rio_station_limit');
  const stations = parsed.stations.filter(s => s.freshness === 'recent' &&
    [s.temperatureC, s.relativeHumidityPercent, s.pressureHpa, s.windSpeedKmh].some(Number.isFinite));
  if (!stations.length) throw error('alerta_rio_meteorology_no_current_measurements');
  return Object.freeze({ ...parsed, kind: 'OFFICIAL_STATION_OBSERVATIONS',
    scope: 'RIO_CAPITAL_STATIONS_NOT_MUNICIPAL_MEAN', municipalityIbge: '3304557',
    mayIssueWarning: false, weightedMean: null, qualityWeightsVerified: false,
    excludedStationCount: parsed.stations.length - stations.length,
    stations: Object.freeze(stations),
  });
}

export function createAlertaRioMeteorologyCache({ now = Date.now } = {}) {
  let snapshot = null, reason = 'not_collected';
  return {
    recordSuccess(value) { snapshot = value; reason = null; },
    recordFailure(code) { snapshot = null; reason = code; },
    read() {
      const at = now(), fetched = Date.parse(snapshot?.fetchedAt);
      const fresh = Number.isFinite(fetched) && at >= fetched && at - fetched <= MAX_AGE;
      const stations = fresh ? snapshot.stations.filter(s => {
        const observed = Date.parse(s.observedAt);
        return Number.isFinite(observed) && at >= observed && at - observed <= MAX_AGE;
      }) : [];
      return { sourceId: ALERTA_RIO_METEOROLOGY_TASK,
        state: stations.length ? 'CURRENT_STATION_OBSERVATIONS' : 'UNAVAILABLE',
        reason: stations.length ? null : reason ?? 'observation_age_exceeded',
        fetchedAt: snapshot?.fetchedAt ?? null,
        snapshot: stations.length ? { ...snapshot, stations,
          excludedStationCount: snapshot.excludedStationCount + snapshot.stations.length - stations.length } : null,
      };
    },
  };
}
