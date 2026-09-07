import { createHash } from 'node:crypto';
import { fetchJsonContract, fetchTextContract, SourceContractError } from './source-contract.mjs';

export const ALERTA_RIO_SOURCE_ID = 'alerta-rio-stations';
export const ALERTA_RIO_HOST = 'pgeo3.rio.rj.gov.br';
export const ALERTA_RIO_EXPECTED_ACTIVE_STATIONS = 33;
export const ALERTA_RIO_LIVE_SOURCE_ID = 'alerta-rio-rainfall-live';
export const ALERTA_RIO_LIVE_HOST = 'websempre.rio.rj.gov.br';
export const ALERTA_RIO_LIVE_URL = 'https://websempre.rio.rj.gov.br/estacoes/';

const queryUrl = new URL('https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geotecnia/Estacoes_AlertaRio/FeatureServer/0/query');
queryUrl.search = new URLSearchParams({
  where: '1=1',
  outFields: 'cod,est',
  returnGeometry: 'false',
  orderByFields: 'cod',
  f: 'json',
}).toString();
export const ALERTA_RIO_STATIONS_QUERY_URL = queryUrl.toString();

const LIVE_RAIN_KEYS = Object.freeze([
  'rain5mMm',
  'rain10mMm',
  'rain15mMm',
  'rain30mMm',
  'rain1hMm',
  'rain2hMm',
  'rain3hMm',
  'rain4hMm',
  'rain6hMm',
  'rain12hMm',
  'rain24hMm',
  'rain96hMm',
  'rainMonthMm',
  'tx15Mm',
]);

const HTML_ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', Aacute: 'Á', eacute: 'é', Eacute: 'É', iacute: 'í', Iacute: 'Í',
  oacute: 'ó', Oacute: 'Ó', uacute: 'ú', Uacute: 'Ú', agrave: 'à', Agrave: 'À',
  acirc: 'â', Acirc: 'Â', ecirc: 'ê', Ecirc: 'Ê', ocirc: 'ô', Ocirc: 'Ô',
  atilde: 'ã', Atilde: 'Ã', otilde: 'õ', Otilde: 'Õ', ccedil: 'ç', Ccedil: 'Ç',
  deg: '°', ordm: 'º', ndash: '–', mdash: '—',
});

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

function decodeHtmlText(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const point = Number.parseInt(entity.slice(2), 16);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    if (entity.startsWith('#')) {
      const point = Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return HTML_ENTITIES[entity] ?? match;
  });
}

function cellText(value) {
  return decodeHtmlText(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

function extractCells(rowHtml) {
  return [...String(rowHtml).matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((match) => cellText(match[1]));
}

function parseObservedAt(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new OfficialSourceContractError('alerta_rio_live_invalid_timestamp');
  const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, secondRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    throw new OfficialSourceContractError('alerta_rio_live_invalid_timestamp');
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) throw new OfficialSourceContractError('alerta_rio_live_invalid_timestamp');
  const isoLocal = `${yearRaw}-${monthRaw}-${dayRaw}T${hourRaw}:${minuteRaw}:${secondRaw}-03:00`;
  const observedAt = new Date(isoLocal);
  if (Number.isNaN(observedAt.getTime())) throw new OfficialSourceContractError('alerta_rio_live_invalid_timestamp');
  return observedAt.toISOString();
}

function parseRainMm(value) {
  const trimmed = String(value).trim();
  if (trimmed.toUpperCase() === 'ND') return null;

  let normalized;
  if (/^\d{1,3}(?:\.\d{3})*,\d+$/.test(trimmed) || /^\d+,\d+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    normalized = trimmed;
  } else {
    throw new OfficialSourceContractError('alerta_rio_live_invalid_rain_value');
  }
  const valueMm = Number(normalized);
  if (!Number.isFinite(valueMm) || valueMm < 0 || valueMm > 20_000) {
    throw new OfficialSourceContractError('alerta_rio_live_invalid_rain_value');
  }
  return valueMm;
}

function parseLiveStationRow(cells) {
  if (cells.length !== 18) throw new OfficialSourceContractError('alerta_rio_live_invalid_column_count');
  const code = Number(cells[0]);
  const name = cells[1];
  const zone = cells[2];
  if (!Number.isInteger(code) || code < 1 || code > 32_767) {
    throw new OfficialSourceContractError('alerta_rio_live_invalid_station_code');
  }
  if (!name || name.length > 80) throw new OfficialSourceContractError('alerta_rio_live_invalid_station_name');
  if (!zone || zone.length > 80) throw new OfficialSourceContractError('alerta_rio_live_invalid_zone');

  const station = {
    code,
    name,
    zone,
    observedAt: parseObservedAt(cells[3]),
  };
  for (let index = 0; index < LIVE_RAIN_KEYS.length; index += 1) {
    station[LIVE_RAIN_KEYS[index]] = parseRainMm(cells[index + 4]);
  }
  return Object.freeze(station);
}

export function validateAlertaRioLiveRainfallHtml(html) {
  if (typeof html !== 'string' || html.length < 128) {
    throw new OfficialSourceContractError('alerta_rio_live_empty_html');
  }

  const pageText = cellText(html).toLocaleLowerCase('pt-BR');
  if (!pageText.includes('dados pluviométricos') || !pageText.includes('tx - 15')) {
    throw new OfficialSourceContractError('alerta_rio_live_contract_marker_missing');
  }

  const stations = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = extractCells(rowMatch[1]);
    if (cells.length !== 18 || !/^\d+$/.test(cells[0] || '')) continue;
    if (!/^\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}:\d{2}:\d{2}$/.test(cells[3] || '')) continue;
    stations.push(parseLiveStationRow(cells));
  }

  stations.sort((a, b) => a.code - b.code);
  if (stations.length !== ALERTA_RIO_EXPECTED_ACTIVE_STATIONS) {
    throw new OfficialSourceContractError('alerta_rio_live_station_count_drift');
  }

  const codes = new Set();
  const names = new Set();
  for (const station of stations) {
    const foldedName = station.name.toLocaleLowerCase('pt-BR');
    if (codes.has(station.code)) throw new OfficialSourceContractError('alerta_rio_live_duplicate_station_code');
    if (names.has(foldedName)) throw new OfficialSourceContractError('alerta_rio_live_duplicate_station_name');
    codes.add(station.code);
    names.add(foldedName);
  }

  const observed = stations.map((station) => station.observedAt).sort();
  const missingValueCount = stations.reduce(
    (total, station) => total + LIVE_RAIN_KEYS.filter((key) => station[key] === null).length,
    0,
  );
  const canonical = JSON.stringify(stations);
  return Object.freeze({
    sourceId: ALERTA_RIO_LIVE_SOURCE_ID,
    sourceHost: ALERTA_RIO_LIVE_HOST,
    stationCount: stations.length,
    missingValueCount,
    oldestObservedAt: observed[0],
    freshestObservedAt: observed.at(-1),
    snapshotSha256: createHash('sha256').update(canonical).digest('hex'),
    stations: Object.freeze(stations),
  });
}

export async function probeAlertaRioLiveRainfall({ fetchImpl = globalThis.fetch } = {}) {
  let html;
  try {
    html = await fetchTextContract(ALERTA_RIO_LIVE_URL, {
      allowedHosts: [ALERTA_RIO_LIVE_HOST],
      fetchImpl,
      timeoutMs: 7_000,
      maxBytes: 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new OfficialSourceContractError(`alerta_rio_live_${error.code}`);
    }
    throw error;
  }
  return validateAlertaRioLiveRainfallHtml(html);
}
