import { createHash } from 'node:crypto';

import { fetchTextContract, SourceContractError } from './source-contract.mjs';
import {
  CHM_RJ_ALERT_ROUTING_CONTRACT,
  ChmRjZoneError,
  classifyChmWarningRjRouting,
} from './chm-rj-zone.mjs';

export const CHM_SOURCE_ID = 'chm-marine';
export const CHM_HOST = 'www.marinha.mil.br';
export const CHM_WARNINGS_URL = 'https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo';
export const CHM_TIDES_URL = 'https://www.marinha.mil.br/chm/dados-do-segnav-publicacoes/tabuas-das-mares';
export const CHM_MAX_WARNING_RECORDS = 64;
export const CHM_MAX_WARNING_AREAS = 8;
export const CHM_MAX_WARNING_VALIDITY_MS = 14 * 24 * 60 * 60 * 1000;
export const CHM_TEMPORAL_VALIDITY_CONTRACT = 'PARSED_ISSUED_AND_VALID_UNTIL_CHRONOLOGY';

const CHM_MONTH_BY_TOKEN = Object.freeze({
  JAN: 0,
  FEV: 1,
  MAR: 2,
  ABR: 3,
  MAI: 4,
  JUN: 5,
  JUL: 6,
  AGO: 7,
  SET: 8,
  OUT: 9,
  NOV: 10,
  DEZ: 11,
});

export class ChmSourceContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmSourceContractError';
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

function normalizeBoundedLabel(value, code, maxLength) {
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new ChmSourceContractError(code);
  }
  return normalized;
}

function parseClockParts(clock, code) {
  const match = /^(\d{2})(\d{2})Z$/.exec(clock || '');
  if (!match) throw new ChmSourceContractError(code);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new ChmSourceContractError(code);
  }
  return { hour, minute };
}

function canonicalUtcMs(year, month, day, hour, minute, code) {
  const ms = Date.UTC(year, month, day, hour, minute, 0, 0);
  const date = new Date(ms);
  if (date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month
      || date.getUTCDate() !== day
      || date.getUTCHours() !== hour
      || date.getUTCMinutes() !== minute) {
    throw new ChmSourceContractError(code);
  }
  return ms;
}

function parseIssuedAt({ dayToken, monthToken, yearToken, clock }) {
  const year = Number(yearToken);
  const day = Number(dayToken);
  const monthKey = String(monthToken)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const month = CHM_MONTH_BY_TOKEN[monthKey];
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(day) || month === undefined) {
    throw new ChmSourceContractError('chm_warning_issue_date_invalid');
  }
  const { hour, minute } = parseClockParts(clock, 'chm_warning_issue_clock_invalid');
  const ms = canonicalUtcMs(year, month, day, hour, minute, 'chm_warning_issue_date_invalid');
  return Object.freeze({ ms, iso: new Date(ms).toISOString(), year, month });
}

function resolveValidUntil({ issued, token }) {
  const match = /^(\d{2})(\d{2})(\d{2})Z$/.exec(token || '');
  if (!match) throw new ChmSourceContractError('chm_warning_valid_until_invalid');
  const day = Number(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new ChmSourceContractError('chm_warning_valid_until_invalid');
  }

  const candidates = [];
  for (const monthOffset of [0, 1]) {
    const absoluteMonth = issued.month + monthOffset;
    const year = issued.year + Math.floor(absoluteMonth / 12);
    const month = absoluteMonth % 12;
    try {
      const ms = canonicalUtcMs(year, month, day, hour, minute, 'chm_warning_valid_until_invalid');
      if (ms > issued.ms) candidates.push(ms);
    } catch (error) {
      if (!(error instanceof ChmSourceContractError)) throw error;
    }
  }

  if (candidates.length < 1) {
    throw new ChmSourceContractError('chm_warning_valid_until_not_after_issue');
  }
  const validUntilMs = Math.min(...candidates);
  const validityDurationMs = validUntilMs - issued.ms;
  if (validityDurationMs < 1 || validityDurationMs > CHM_MAX_WARNING_VALIDITY_MS) {
    throw new ChmSourceContractError('chm_warning_validity_window_invalid');
  }
  return Object.freeze({
    iso: new Date(validUntilMs).toISOString(),
    durationMs: validityDurationMs,
  });
}

function mergeDuplicateWarning(existing, candidate) {
  if (existing.warningType !== candidate.warningType
      || existing.issuedZuluClock !== candidate.issuedZuluClock
      || existing.issuedAt !== candidate.issuedAt
      || existing.validUntil !== candidate.validUntil
      || existing.validityDurationMs !== candidate.validityDurationMs) {
    throw new ChmSourceContractError('chm_warning_duplicate_conflict');
  }

  const areas = [...existing.areas];
  for (const area of candidate.areas) {
    if (!areas.includes(area)) areas.push(area);
  }
  if (areas.length > CHM_MAX_WARNING_AREAS) {
    throw new ChmSourceContractError('chm_warning_area_count_invalid');
  }

  return Object.freeze({
    ...existing,
    area: areas[0] ?? null,
    areas: Object.freeze(areas),
  });
}

function withRjRouting(record) {
  try {
    return Object.freeze({
      ...record,
      rjRouting: classifyChmWarningRjRouting(record),
    });
  } catch (error) {
    if (error instanceof ChmRjZoneError) {
      throw new ChmSourceContractError(`chm_warning_rj_routing_${error.code}`);
    }
    throw error;
  }
}

export function validateChmWarningsHtml(html) {
  if (typeof html !== 'string' || html.length < 256) {
    throw new ChmSourceContractError('chm_warnings_empty_html');
  }

  const text = plainText(html);
  const folded = foldText(html);
  if (!folded.includes('avisos de mau tempo')) {
    throw new ChmSourceContractError('chm_warnings_title_missing');
  }
  if (!folded.includes('metarea v')) {
    throw new ChmSourceContractError('chm_metarea_v_marker_missing');
  }
  if (!folded.includes('centro de hidrografia da marinha')) {
    throw new ChmSourceContractError('chm_identity_marker_missing');
  }

  const headerPattern = /(?:ÁREA\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,48})\s+)?AVISO\s+NR\s+(\d{1,4})\/(\d{4})/giu;
  const headers = [...text.matchAll(headerPattern)];
  const recordsById = new Map();
  let duplicateRenderCount = 0;

  for (let index = 0; index < headers.length; index += 1) {
    const match = headers[index];
    const start = match.index;
    const end = index + 1 < headers.length ? headers[index + 1].index : text.length;
    const segment = text.slice(start, end);

    const warningNumber = Number(match[2]);
    const year = Number(match[3]);
    if (!Number.isInteger(warningNumber) || warningNumber < 1 || warningNumber > 9999) {
      throw new ChmSourceContractError('chm_warning_number_invalid');
    }
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      throw new ChmSourceContractError('chm_warning_year_invalid');
    }
    const id = `${warningNumber}/${year}`;

    const area = match[1]
      ? normalizeBoundedLabel(match[1], 'chm_warning_area_invalid', 48)
      : null;
    const areas = Object.freeze(area ? [area] : []);

    const typeMatch = segment.match(/(AVISO\s+DE\s+.{3,96}?)\s+EMITIDO\s+[ÀA]S\s+(\d{4}Z)/iu);
    if (!typeMatch) throw new ChmSourceContractError('chm_warning_core_metadata_missing');
    const warningType = normalizeBoundedLabel(typeMatch[1], 'chm_warning_type_invalid', 96);
    const issuedZuluClock = typeMatch[2].toUpperCase();
    parseClockParts(issuedZuluClock, 'chm_warning_issue_clock_invalid');

    const issuedMatch = segment.match(/EMITIDO\s+[ÀA]S\s+(\d{4}Z)(?:\s*-\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,12}\s*-\s*)?\s*(\d{2})\/([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3})\/(\d{4})/iu);
    if (!issuedMatch) throw new ChmSourceContractError('chm_warning_issue_date_missing');
    if (issuedMatch[1].toUpperCase() !== issuedZuluClock) {
      throw new ChmSourceContractError('chm_warning_issue_clock_conflict');
    }
    const issued = parseIssuedAt({
      dayToken: issuedMatch[2],
      monthToken: issuedMatch[3],
      yearToken: issuedMatch[4],
      clock: issuedZuluClock,
    });
    if (issued.year !== year) {
      throw new ChmSourceContractError('chm_warning_issue_year_mismatch');
    }

    const validMatch = segment.match(/V[ÁA]LIDO\s+AT[ÉE]\s+(\d{6}Z)/iu);
    if (!validMatch) throw new ChmSourceContractError('chm_warning_valid_until_missing');
    const validity = resolveValidUntil({ issued, token: validMatch[1].toUpperCase() });

    const candidate = Object.freeze({
      id,
      warningNumber,
      year,
      area,
      areas,
      warningType,
      issuedZuluClock,
      issuedAt: issued.iso,
      validUntil: validity.iso,
      validityDurationMs: validity.durationMs,
    });
    const existing = recordsById.get(id);
    if (existing) {
      recordsById.set(id, mergeDuplicateWarning(existing, candidate));
      duplicateRenderCount += 1;
    } else {
      recordsById.set(id, candidate);
    }
    if (recordsById.size > CHM_MAX_WARNING_RECORDS) {
      throw new ChmSourceContractError('chm_warning_count_invalid');
    }
  }

  const records = [...recordsById.values()].map(withRjRouting);
  const noWarningMarker = /\bNIL\b/i.test(text) || folded.includes('nao ha avisos');
  if (records.length < 1 && !noWarningMarker) {
    throw new ChmSourceContractError('chm_warning_inventory_missing');
  }

  const canonicalRecords = records.map((record) => ({
    id: record.id,
    area: record.area,
    areas: record.areas,
    warningType: record.warningType,
    issuedZuluClock: record.issuedZuluClock,
    issuedAt: record.issuedAt,
    validUntil: record.validUntil,
    validityDurationMs: record.validityDurationMs,
    rjRouting: record.rjRouting,
  }));

  return Object.freeze({
    sourceId: CHM_SOURCE_ID,
    sourceHost: CHM_HOST,
    sourceUrl: CHM_WARNINGS_URL,
    metarea: 'V',
    activeWarningCount: records.length,
    duplicateRenderCount,
    noWarningMarker: records.length === 0 && noWarningMarker,
    warnings: Object.freeze(records),
    warningInventorySha256: sha256(JSON.stringify(canonicalRecords)),
    rawWarningTextRetention: 'NONE',
    temporalValidityValidation: CHM_TEMPORAL_VALIDITY_CONTRACT,
    rjZoneRoutingValidation: CHM_RJ_ALERT_ROUTING_CONTRACT,
    rjCoastGeofenceValidation: 'NOT_IMPLEMENTED',
  });
}

export function validateChmTidesHtml(html) {
  if (typeof html !== 'string' || html.length < 256) {
    throw new ChmSourceContractError('chm_tides_empty_html');
  }

  const folded = foldText(html);
  if (!folded.includes('tabuas das mares')) {
    throw new ChmSourceContractError('chm_tides_title_missing');
  }
  if (!folded.includes('pagina de dados de mare')) {
    throw new ChmSourceContractError('chm_tide_data_page_marker_missing');
  }
  if (!folded.includes('centro de hidrografia da marinha')) {
    throw new ChmSourceContractError('chm_identity_marker_missing');
  }

  const yearMatch = folded.match(/tabuas das mares para\s+(\d{4})/i);
  if (!yearMatch) throw new ChmSourceContractError('chm_tide_year_missing');
  const calendarYear = Number(yearMatch[1]);
  if (!Number.isInteger(calendarYear) || calendarYear < 2020 || calendarYear > 2100) {
    throw new ChmSourceContractError('chm_tide_year_invalid');
  }

  const canonical = JSON.stringify({
    sourceId: CHM_SOURCE_ID,
    sourceHost: CHM_HOST,
    sourceUrl: CHM_TIDES_URL,
    calendarYear,
    contract: 'OFFICIAL_CHM_TIDE_PUBLICATION_DISCOVERED',
  });

  return Object.freeze({
    sourceId: CHM_SOURCE_ID,
    sourceHost: CHM_HOST,
    sourceUrl: CHM_TIDES_URL,
    calendarYear,
    tidePublicationSha256: sha256(canonical),
    tideValueIngestion: 'NOT_IMPLEMENTED',
    portSelectionValidation: 'NOT_IMPLEMENTED',
  });
}

async function fetchChmHtml(url, prefix, fetchImpl) {
  try {
    return await fetchTextContract(url, {
      allowedHosts: [CHM_HOST],
      fetchImpl,
      timeoutMs: 8_000,
      maxBytes: 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new ChmSourceContractError(`${prefix}_${error.code}`);
    }
    throw error;
  }
}

export async function probeChmWarnings({ fetchImpl = globalThis.fetch } = {}) {
  const html = await fetchChmHtml(CHM_WARNINGS_URL, 'chm_warnings', fetchImpl);
  return validateChmWarningsHtml(html);
}

export async function probeChmTides({ fetchImpl = globalThis.fetch } = {}) {
  const html = await fetchChmHtml(CHM_TIDES_URL, 'chm_tides', fetchImpl);
  return validateChmTidesHtml(html);
}
