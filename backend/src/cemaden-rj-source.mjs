import { createHash } from 'node:crypto';

import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';
import { fetchTextContract, SourceContractError } from './source-contract.mjs';

export const CEMADEN_RJ_SOURCE_ID = 'cemaden-rj-hydrological-risk';
export const CEMADEN_RJ_HOST = 'painelcemadenrj.defesacivil.rj.gov.br';
export const CEMADEN_RJ_HYDRO_URL = 'https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/municipio/?action=hidro';
export const CEMADEN_RJ_EXPECTED_MUNICIPALITIES = 92;

const RISK_TO_PRIORITY = Object.freeze({
  'MUITO BAIXO': 1,
  BAIXO: 2,
  MODERADO: 3,
  ALTO: 4,
  'MUITO ALTO': 5,
});

const ALLOWED_REDECS = new Set([
  'CAPITAL',
  'METROPOLITANA',
  'BAIXADA FLUMINENSE',
  'COSTA VERDE',
  'BAIXADA LITORÂNEA',
  'NORTE',
  'NOROESTE',
  'SERRANA I',
  'SERRANA II',
  'SUL I',
  'SUL II',
]);

const NAMED_HTML_ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  Aacute: 'Á', aacute: 'á', Acirc: 'Â', acirc: 'â', Atilde: 'Ã', atilde: 'ã',
  Agrave: 'À', agrave: 'à', Ccedil: 'Ç', ccedil: 'ç', Eacute: 'É', eacute: 'é',
  Ecirc: 'Ê', ecirc: 'ê', Iacute: 'Í', iacute: 'í', Oacute: 'Ó', oacute: 'ó',
  Ocirc: 'Ô', ocirc: 'ô', Otilde: 'Õ', otilde: 'õ', Uacute: 'Ú', uacute: 'ú',
});

const CANONICAL_BY_FOLDED_NAME = new Map(RJ_MUNICIPALITIES.map((city) => [fold(city.name), city]));

if (RJ_MUNICIPALITIES.length !== CEMADEN_RJ_EXPECTED_MUNICIPALITIES || CANONICAL_BY_FOLDED_NAME.size !== CEMADEN_RJ_EXPECTED_MUNICIPALITIES) {
  throw new Error('invalid_cemaden_rj_canonical_catalog');
}

export class CemadenRjSourceContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CemadenRjSourceContractError';
    this.code = code;
  }
}

function fold(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function decodeHtml(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (match, raw) => {
      const point = Number.parseInt(raw, 16);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    })
    .replace(/&#(\d+);/g, (match, raw) => {
      const point = Number(raw);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    })
    .replace(/&([A-Za-z]+);/g, (match, name) => NAMED_HTML_ENTITIES[name] ?? match);
}

function cellText(value) {
  return decodeHtml(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOfficialLocalTimestamp(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(String(value).trim());
  if (!match) throw new CemadenRjSourceContractError('cemaden_timestamp_invalid');
  const [, dd, mm, yyyy, hh, min, sec] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const hour = Number(hh);
  const minute = Number(min);
  const second = Number(sec);
  if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    throw new CemadenRjSourceContractError('cemaden_timestamp_invalid');
  }
  const dateOnly = new Date(Date.UTC(year, month - 1, day));
  if (dateOnly.getUTCFullYear() !== year || dateOnly.getUTCMonth() !== month - 1 || dateOnly.getUTCDate() !== day) {
    throw new CemadenRjSourceContractError('cemaden_timestamp_invalid');
  }
  const parsed = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}-03:00`);
  if (Number.isNaN(parsed.getTime())) throw new CemadenRjSourceContractError('cemaden_timestamp_invalid');
  return parsed.toISOString();
}

function normalizeRisk(value) {
  return String(value).replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function validateCemadenRjHydrologicalHtml(html) {
  if (typeof html !== 'string' || html.length < 512) {
    throw new CemadenRjSourceContractError('cemaden_page_empty_html');
  }

  const pageText = fold(cellText(html));
  if (!pageText.includes('risco hidrologico') || !pageText.includes('status atual dos municipios')) {
    throw new CemadenRjSourceContractError('cemaden_page_markers_missing');
  }

  const records = [];
  const seenIbge = new Set();
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const cells = [...rowMatch[1].matchAll(cellPattern)].map((match) => cellText(match[1]));
    if (cells.length < 1) continue;

    const municipality = CANONICAL_BY_FOLDED_NAME.get(fold(cells[0]));
    const looksLikeRiskRow = cells.length >= 3 && (Object.hasOwn(RISK_TO_PRIORITY, normalizeRisk(cells[2])) || /^[1-5]$/.test(cells.at(-1) ?? ''));

    if (!municipality) {
      if (looksLikeRiskRow) throw new CemadenRjSourceContractError('cemaden_unknown_municipality');
      continue;
    }
    if (cells.length !== 6) throw new CemadenRjSourceContractError('cemaden_column_count_invalid');
    if (seenIbge.has(municipality.ibge)) throw new CemadenRjSourceContractError('cemaden_duplicate_municipality');

    const redec = normalizeRisk(cells[1]);
    if (!ALLOWED_REDECS.has(redec)) throw new CemadenRjSourceContractError('cemaden_redec_invalid');

    const risk = normalizeRisk(cells[2]);
    const expectedPriority = RISK_TO_PRIORITY[risk];
    if (!expectedPriority) throw new CemadenRjSourceContractError('cemaden_risk_invalid');

    if (!/^[1-5]$/.test(cells[5])) throw new CemadenRjSourceContractError('cemaden_priority_invalid');
    const priority = Number(cells[5]);
    if (priority !== expectedPriority) throw new CemadenRjSourceContractError('cemaden_risk_priority_mismatch');

    const observedAt = parseOfficialLocalTimestamp(cells[3]);
    seenIbge.add(municipality.ibge);
    records.push(Object.freeze({
      municipality: municipality.name,
      ibge: municipality.ibge,
      redec,
      risk,
      priority,
      observedAt,
    }));
  }

  if (records.length !== CEMADEN_RJ_EXPECTED_MUNICIPALITIES || seenIbge.size !== CEMADEN_RJ_EXPECTED_MUNICIPALITIES) {
    throw new CemadenRjSourceContractError('cemaden_municipality_count_invalid');
  }

  records.sort((a, b) => a.ibge.localeCompare(b.ibge));
  for (const city of RJ_MUNICIPALITIES) {
    if (!seenIbge.has(city.ibge)) throw new CemadenRjSourceContractError('cemaden_canonical_coverage_incomplete');
  }

  const countsByRisk = Object.fromEntries(Object.keys(RISK_TO_PRIORITY).map((risk) => [risk, 0]));
  let oldestMs = Number.POSITIVE_INFINITY;
  let latestMs = Number.NEGATIVE_INFINITY;
  let maxPriority = 1;
  for (const record of records) {
    countsByRisk[record.risk] += 1;
    const observedMs = Date.parse(record.observedAt);
    oldestMs = Math.min(oldestMs, observedMs);
    latestMs = Math.max(latestMs, observedMs);
    maxPriority = Math.max(maxPriority, record.priority);
  }

  const canonical = records.map((record) => ({
    ibge: record.ibge,
    municipality: record.municipality,
    redec: record.redec,
    risk: record.risk,
    priority: record.priority,
    observedAt: record.observedAt,
  }));

  return Object.freeze({
    sourceId: CEMADEN_RJ_SOURCE_ID,
    sourceHost: CEMADEN_RJ_HOST,
    sourceUrl: CEMADEN_RJ_HYDRO_URL,
    municipalityCount: records.length,
    municipalCoverage: '92_OF_92_CANONICAL_RJ',
    records: Object.freeze(records),
    countsByRisk: Object.freeze(countsByRisk),
    maxPriority,
    highestRisk: Object.entries(RISK_TO_PRIORITY).find(([, priority]) => priority === maxPriority)?.[0] ?? null,
    oldestObservedAt: new Date(oldestMs).toISOString(),
    latestObservedAt: new Date(latestMs).toISOString(),
    statusInventorySha256: sha256(JSON.stringify(canonical)),
    riskPriorityValidation: 'EXACT_1_TO_5_OFFICIAL_PAIRING',
    timestampValidation: 'OFFICIAL_DD_MM_YYYY_HH_MM_SS_AS_RJ_UTC_MINUS_03',
    operationalFreshnessValidation: 'NOT_YET_PROVEN',
    p0PromotionPolicy: 'NOT_IMPLEMENTED',
    rawHtmlRetention: 'NONE',
  });
}

export async function probeCemadenRjHydrologicalRisk({ fetchImpl = globalThis.fetch } = {}) {
  let html;
  try {
    html = await fetchTextContract(CEMADEN_RJ_HYDRO_URL, {
      allowedHosts: [CEMADEN_RJ_HOST],
      fetchImpl,
      timeoutMs: 8_000,
      maxBytes: 2 * 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new CemadenRjSourceContractError(`cemaden_${error.code}`);
    }
    throw error;
  }
  return validateCemadenRjHydrologicalHtml(html);
}
