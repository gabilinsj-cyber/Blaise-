import { createHash } from 'node:crypto';
import { fetchJsonContract, SourceContractError } from './source-contract.mjs';

export const ALERTA_RIO_SOURCE_ID = 'alerta-rio-stations';
export const ALERTA_RIO_HOST = 'pgeo3.rio.rj.gov.br';
export const ALERTA_RIO_EXPECTED_ACTIVE_STATIONS = 33;

const queryUrl = new URL('https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geotecnia/Estacoes_AlertaRio/FeatureServer/0/query');
queryUrl.search = new URLSearchParams({
  where: '1=1',
  outFields: 'cod,est',
  returnGeometry: 'false',
  orderByFields: 'cod',
  f: 'json',
}).toString();
export const ALERTA_RIO_STATIONS_QUERY_URL = queryUrl.toString();

export class OfficialSourceContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'OfficialSourceContractError';
    this.code = code;
  }
}

function normalizeStation(feature) {
  const attributes = feature?.attributes;
  if (!attributes || typeof attributes !== 'object') {
    throw new OfficialSourceContractError('alerta_rio_invalid_feature');
  }

  const code = attributes.cod;
  const name = typeof attributes.est === 'string' ? attributes.est.trim() : '';
  if (!Number.isInteger(code) || code < 0 || code > 32_767) {
    throw new OfficialSourceContractError('alerta_rio_invalid_station_code');
  }
  if (!name || name.length > 50) {
    throw new OfficialSourceContractError('alerta_rio_invalid_station_name');
  }
  return Object.freeze({ code, name });
}

export function validateAlertaRioStationCatalog(payload) {
  if (!payload || typeof payload !== 'object' || payload.error) {
    throw new OfficialSourceContractError('alerta_rio_arcgis_error');
  }
  if (!Array.isArray(payload.features)) {
    throw new OfficialSourceContractError('alerta_rio_features_missing');
  }

  const stations = payload.features.map(normalizeStation).sort((a, b) => a.code - b.code);
  if (stations.length !== ALERTA_RIO_EXPECTED_ACTIVE_STATIONS) {
    throw new OfficialSourceContractError('alerta_rio_station_count_drift');
  }

  const codes = new Set();
  const names = new Set();
  for (const station of stations) {
    const foldedName = station.name.toLocaleLowerCase('pt-BR');
    if (codes.has(station.code)) throw new OfficialSourceContractError('alerta_rio_duplicate_station_code');
    if (names.has(foldedName)) throw new OfficialSourceContractError('alerta_rio_duplicate_station_name');
    codes.add(station.code);
    names.add(foldedName);
  }

  const canonical = JSON.stringify(stations);
  return Object.freeze({
    sourceId: ALERTA_RIO_SOURCE_ID,
    sourceHost: ALERTA_RIO_HOST,
    stationCount: stations.length,
    catalogSha256: createHash('sha256').update(canonical).digest('hex'),
    stations: Object.freeze(stations),
  });
}

export async function probeAlertaRioStationCatalog({ fetchImpl = globalThis.fetch } = {}) {
  let payload;
  try {
    payload = await fetchJsonContract(ALERTA_RIO_STATIONS_QUERY_URL, {
      allowedHosts: [ALERTA_RIO_HOST],
      fetchImpl,
      timeoutMs: 5_000,
      maxBytes: 128 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new OfficialSourceContractError(`alerta_rio_${error.code}`);
    }
    throw error;
  }
  return validateAlertaRioStationCatalog(payload);
}
