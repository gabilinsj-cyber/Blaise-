import { createHash } from 'node:crypto';

import { fetchTextContract, SourceContractError } from './source-contract.mjs';

export const CHM_SOURCE_ID = 'chm-marine';
export const CHM_HOST = 'www.marinha.mil.br';
export const CHM_WARNINGS_URL = 'https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo';
export const CHM_TIDES_URL = 'https://www.marinha.mil.br/chm/dados-do-segnav-publicacoes/tabuas-das-mares';
export const CHM_MAX_WARNING_RECORDS = 64;

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

function mergeDuplicateWarning(existing, candidate) {
  if (existing.warningType !== candidate.warningType
      || existing.issuedZuluClock !== candidate.issuedZuluClock) {
    throw new ChmSourceContractError('chm_warning_duplicate_conflict');
  }
  if (existing.area && candidate.area && existing.area !== candidate.area) {
    throw new ChmSourceContractError('chm_warning_duplicate_area_conflict');
  }
  return Object.freeze({
    ...existing,
    area: existing.area ?? candidate.area,
  });
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

  const recordsById = new Map();
  let duplicateRenderCount = 0;
  const pattern = /(?:ÁREA\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,48})\s+)?AVISO\s+NR\s+(\d{1,4})\/(\d{4})\s+(AVISO\s+DE\s+.{3,96}?)\s+EMITIDO\s+[ÀA]S\s+(\d{4}Z)/giu;
  for (const match of text.matchAll(pattern)) {
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
    const warningType = normalizeBoundedLabel(match[4], 'chm_warning_type_invalid', 96);
    const issuedZuluClock = match[5].toUpperCase();
    if (!/^(?:[01]\d|2[0-3])[0-5]\dZ$/.test(issuedZuluClock)) {
      throw new ChmSourceContractError('chm_warning_issue_clock_invalid');
    }

    const candidate = Object.freeze({
      id,
      warningNumber,
      year,
      area,
      warningType,
      issuedZuluClock,
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

  const records = [...recordsById.values()];
  const noWarningMarker = /\bNIL\b/i.test(text) || folded.includes('nao ha avisos');
  if (records.length < 1 && !noWarningMarker) {
    throw new ChmSourceContractError('chm_warning_inventory_missing');
  }

  const canonicalRecords = records.map((record) => ({
    id: record.id,
    area: record.area,
    warningType: record.warningType,
    issuedZuluClock: record.issuedZuluClock,
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
    temporalValidityValidation: 'NOT_IMPLEMENTED',
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
