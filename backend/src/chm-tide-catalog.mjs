import { createHash } from 'node:crypto';

import { fetchTextContract, SourceContractError } from './source-contract.mjs';

export const CHM_TIDE_CATALOG_SOURCE_ID = 'chm-marine';
export const CHM_TIDE_CATALOG_HOST = 'www.marinha.mil.br';
export const CHM_RJ_TIDE_CATALOG_URL = 'https://www.marinha.mil.br/chm/tabuas-de-mare-6';
export const CHM_RJ_TIDE_CATALOG_CONTRACT = 'OFFICIAL_CHM_RJ_TIDE_STATION_CATALOG_NO_TIDE_VALUES';
export const CHM_EXPECTED_RJ_TIDE_STATION_COUNT = 7;

export class ChmTideCatalogError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmTideCatalogError';
    this.code = code;
  }
}

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (match, raw) => {
      const point = Number.parseInt(raw, 16);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    })
    .replace(/&#(\d+);/g, (match, raw) => {
      const point = Number(raw);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    });
}

function plainText(html) {
  return decodeEntities(
    String(html)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/td|\/th|\/tr)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function foldText(value) {
  return plainText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeStationName(value) {
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length < 3 || normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new ChmTideCatalogError('chm_rj_tide_station_name_invalid');
  }
  return normalized;
}

function parseBoundedInteger(value, min, max, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ChmTideCatalogError(code);
  }
  return parsed;
}

function parseCoordinate(value, min, max, code) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ChmTideCatalogError(code);
  }
  return parsed;
}

export function validateChmRjTideCatalogHtml(html) {
  if (typeof html !== 'string' || html.length < 256) {
    throw new ChmTideCatalogError('chm_rj_tide_catalog_empty_html');
  }

  const text = plainText(html);
  const folded = foldText(html);
  if (!folded.includes('centro de hidrografia da marinha')) {
    throw new ChmTideCatalogError('chm_rj_tide_catalog_identity_missing');
  }
  if (!folded.includes('rio de janeiro')) {
    throw new ChmTideCatalogError('chm_rj_tide_catalog_state_missing');
  }

  const yearMatch = folded.match(/tabuas de mare(?:s)?\s+(\d{4})/u);
  if (!yearMatch) {
    throw new ChmTideCatalogError('chm_rj_tide_catalog_year_missing');
  }
  const calendarYear = parseBoundedInteger(
    yearMatch[1],
    2020,
    2100,
    'chm_rj_tide_catalog_year_invalid',
  );

  const rowPattern = /(?:^|\s)(\d{1,2})\s*-\s*(.{3,120}?)\s+-\s*(\d{2,3})\s*-\s*(\d{2,3})\s+POINT\s*\(\s*(-?\d{1,3}(?:\.\d+)?)\s+(-?\d{1,2}(?:\.\d+)?)\s*\)\s+Rio de Janeiro\b/giu;
  const stations = [];

  for (const match of text.matchAll(rowPattern)) {
    const stationNumber = parseBoundedInteger(match[1], 1, 99, 'chm_rj_tide_station_number_invalid');
    const name = normalizeStationName(match[2]);
    const pageStart = parseBoundedInteger(match[3], 1, 400, 'chm_rj_tide_page_range_invalid');
    const pageEnd = parseBoundedInteger(match[4], 1, 400, 'chm_rj_tide_page_range_invalid');
    if (pageEnd - pageStart !== 2) {
      throw new ChmTideCatalogError('chm_rj_tide_page_range_invalid');
    }

    const longitude = parseCoordinate(match[5], -45.5, -39.5, 'chm_rj_tide_longitude_invalid');
    const latitude = parseCoordinate(match[6], -24.0, -21.0, 'chm_rj_tide_latitude_invalid');

    stations.push(Object.freeze({
      stationNumber,
      name,
      pageStart,
      pageEnd,
      longitude,
      latitude,
    }));
  }

  if (stations.length !== CHM_EXPECTED_RJ_TIDE_STATION_COUNT) {
    throw new ChmTideCatalogError('chm_rj_tide_station_count_invalid');
  }

  const stationNumbers = new Set();
  const names = new Set();
  const pageStarts = new Set();
  for (const station of stations) {
    const foldedName = station.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleUpperCase('pt-BR');
    if (stationNumbers.has(station.stationNumber)) {
      throw new ChmTideCatalogError('chm_rj_tide_station_number_duplicate');
    }
    if (names.has(foldedName)) {
      throw new ChmTideCatalogError('chm_rj_tide_station_name_duplicate');
    }
    if (pageStarts.has(station.pageStart)) {
      throw new ChmTideCatalogError('chm_rj_tide_page_range_duplicate');
    }
    stationNumbers.add(station.stationNumber);
    names.add(foldedName);
    pageStarts.add(station.pageStart);
  }

  const canonicalStations = [...stations]
    .sort((left, right) => left.stationNumber - right.stationNumber)
    .map((station) => ({
      stationNumber: station.stationNumber,
      name: station.name,
      pageStart: station.pageStart,
      pageEnd: station.pageEnd,
      longitude: station.longitude,
      latitude: station.latitude,
    }));

  return Object.freeze({
    sourceId: CHM_TIDE_CATALOG_SOURCE_ID,
    sourceHost: CHM_TIDE_CATALOG_HOST,
    sourceUrl: CHM_RJ_TIDE_CATALOG_URL,
    calendarYear,
    rjStationCount: canonicalStations.length,
    stations: Object.freeze(canonicalStations.map((station) => Object.freeze(station))),
    stationCatalogSha256: sha256(JSON.stringify(canonicalStations)),
    portSelectionValidation: 'PASS_OFFICIAL_RJ_TIDE_STATION_CATALOG',
    tideValueIngestion: 'NOT_IMPLEMENTED',
    rawCatalogTextRetention: 'NONE',
    contract: CHM_RJ_TIDE_CATALOG_CONTRACT,
  });
}

export async function probeChmRjTideCatalog({ fetchImpl = globalThis.fetch } = {}) {
  try {
    const html = await fetchTextContract(CHM_RJ_TIDE_CATALOG_URL, {
      allowedHosts: [CHM_TIDE_CATALOG_HOST],
      fetchImpl,
      timeoutMs: 8_000,
      maxBytes: 1024 * 1024,
    });
    return validateChmRjTideCatalogHtml(html);
  } catch (error) {
    if (error instanceof ChmTideCatalogError) throw error;
    if (error instanceof SourceContractError) {
      throw new ChmTideCatalogError(`chm_rj_tide_catalog_${error.code}`);
    }
    throw error;
  }
}
