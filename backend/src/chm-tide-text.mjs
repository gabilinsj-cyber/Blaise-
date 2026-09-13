import { createHash } from 'node:crypto';

import {
  bindChmTideFusoToken,
  CHM_TIDE_CIVIL_CLOCK_BINDING,
  CHM_TIDE_FUSO_CONTRACT,
  CHM_TIDE_FUSO_SIGN_CONVENTION,
  CHM_TIDE_FUSO_TIME_BASIS,
} from './chm-tide-fuso.mjs';

export const CHM_TIDE_TEXT_SOURCE_ID = 'chm-marine';
export const CHM_TIDE_TEXT_CONTRACT = 'CHM_PDF_TEXT_TABLE_PARSER_LIVE_SOURCE_EXTRACTION_NOT_YET_EVIDENCED';
export const CHM_TIDE_TEXT_LAYOUT = 'PDFTOTEXT_LAYOUT_SYNTHETIC_CONTRACT_ONLY';
export const CHM_TIDE_FUSO_BINDING = 'PASS_DHN_SIGN_CONVENTION_BASE_OFFSET_BOUND_CIVIL_CLOCK_SEPARATE';
export const CHM_TIDE_TEXT_EXPECTED_PAGE_COUNT = 3;
export const CHM_TIDE_TEXT_MONTHS_PER_PAGE = 4;
export const CHM_TIDE_TEXT_MAX_BYTES = 1024 * 1024;
export const CHM_TIDE_TEXT_MAX_EVENTS_PER_DAY = 8;

const MONTHS = Object.freeze([
  Object.freeze({ name: 'JANEIRO', number: 1 }),
  Object.freeze({ name: 'FEVEREIRO', number: 2 }),
  Object.freeze({ name: 'MARCO', number: 3 }),
  Object.freeze({ name: 'ABRIL', number: 4 }),
  Object.freeze({ name: 'MAIO', number: 5 }),
  Object.freeze({ name: 'JUNHO', number: 6 }),
  Object.freeze({ name: 'JULHO', number: 7 }),
  Object.freeze({ name: 'AGOSTO', number: 8 }),
  Object.freeze({ name: 'SETEMBRO', number: 9 }),
  Object.freeze({ name: 'OUTUBRO', number: 10 }),
  Object.freeze({ name: 'NOVEMBRO', number: 11 }),
  Object.freeze({ name: 'DEZEMBRO', number: 12 }),
]);

export class ChmTideTextError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmTideTextError';
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function boundedInteger(value, min, max, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new ChmTideTextError(code);
  return parsed;
}

function validateStation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChmTideTextError('chm_tide_text_station_missing');
  }
  const stationNumber = boundedInteger(value.stationNumber, 1, 99, 'chm_tide_text_station_number_invalid');
  const name = String(value.name ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 3 || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new ChmTideTextError('chm_tide_text_station_name_invalid');
  }
  const pageStart = boundedInteger(value.pageStart, 1, 400, 'chm_tide_text_page_range_invalid');
  const pageEnd = boundedInteger(value.pageEnd, 1, 400, 'chm_tide_text_page_range_invalid');
  if (pageEnd - pageStart !== 2) throw new ChmTideTextError('chm_tide_text_page_range_invalid');
  return Object.freeze({ stationNumber, name, pageStart, pageEnd });
}

function validateSha256(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new ChmTideTextError('chm_tide_text_source_sha256_invalid');
  return normalized;
}

function normalizePages(text) {
  if (typeof text !== 'string') throw new ChmTideTextError('chm_tide_text_input_invalid');
  const byteLength = Buffer.byteLength(text, 'utf8');
  if (byteLength < 128) throw new ChmTideTextError('chm_tide_text_too_small');
  if (byteLength > CHM_TIDE_TEXT_MAX_BYTES) throw new ChmTideTextError('chm_tide_text_too_large');
  if (/\u0000/.test(text)) throw new ChmTideTextError('chm_tide_text_nul_invalid');

  const pages = text
    .replace(/\r\n?/g, '\n')
    .split('\f')
    .map((page) => page.trimEnd());
  if (pages.length !== CHM_TIDE_TEXT_EXPECTED_PAGE_COUNT || pages.some((page) => page.trim().length < 32)) {
    throw new ChmTideTextError('chm_tide_text_page_count_invalid');
  }
  return Object.freeze({ pages, byteLength });
}

function validateIdentity(text, station, calendarYear) {
  const folded = fold(text);
  if (!folded.includes(fold(station.name))) throw new ChmTideTextError('chm_tide_text_station_identity_missing');
  const yearMatches = [...folded.matchAll(/\b(20\d{2}|2100)\b/gu)].map((match) => Number(match[1]));
  if (!yearMatches.includes(calendarYear)) throw new ChmTideTextError('chm_tide_text_year_identity_missing');
}

function parseFusoRaw(text) {
  const matches = [...fold(text).matchAll(/\bFUSO\s*[:=]?\s*([+-]?\d{1,2})\b/gu)].map((match) => match[1]);
  if (matches.length < 1) throw new ChmTideTextError('chm_tide_text_fuso_missing');
  const unique = [...new Set(matches)];
  if (unique.length !== 1) throw new ChmTideTextError('chm_tide_text_fuso_ambiguous');
  return unique[0];
}

function findMonthHeader(page, pageIndex) {
  const expected = MONTHS.slice(
    pageIndex * CHM_TIDE_TEXT_MONTHS_PER_PAGE,
    (pageIndex + 1) * CHM_TIDE_TEXT_MONTHS_PER_PAGE,
  );
  const lines = page.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const names = [...fold(lines[index]).matchAll(/\b(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\b/gu)]
      .map((match) => match[1]);
    if (names.length === CHM_TIDE_TEXT_MONTHS_PER_PAGE) {
      const expectedNames = expected.map((month) => month.name);
      if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
        throw new ChmTideTextError('chm_tide_text_month_coverage_invalid');
      }
      return Object.freeze({ index, months: expected });
    }
  }
  throw new ChmTideTextError('chm_tide_text_month_header_missing');
}

function parseTime(value) {
  const match = /^(\d{2})(?::|H)?(\d{2})$/u.exec(String(value ?? '').trim().toUpperCase());
  if (!match) throw new ChmTideTextError('chm_tide_text_time_invalid');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new ChmTideTextError('chm_tide_text_time_invalid');
  return `${match[1]}:${match[2]}`;
}

function parseHeight(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!/^-?\d{1,2}(?:\.\d{1,2})?$/u.test(normalized)) throw new ChmTideTextError('chm_tide_text_height_invalid');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < -10 || parsed > 20) throw new ChmTideTextError('chm_tide_text_height_invalid');
  return parsed;
}

function parseCell(cell, previousDay, { calendarYear, month, sourcePage }) {
  const normalized = String(cell ?? '').trim();
  if (!normalized) return Object.freeze({ prediction: null, day: previousDay });
  const match = /^(?:(\d{1,2})\s+)?(?:(PM|BM)\s+)?(\d{2}(?::|H)?\d{2})\s+(-?\d{1,2}(?:[.,]\d{1,2})?)$/iu.exec(normalized);
  if (!match) throw new ChmTideTextError('chm_tide_text_cell_invalid');
  const day = match[1] ? boundedInteger(match[1], 1, 31, 'chm_tide_text_day_invalid') : previousDay;
  if (!day) throw new ChmTideTextError('chm_tide_text_day_context_missing');

  const dateMs = Date.UTC(calendarYear, month.number - 1, day);
  const date = new Date(dateMs);
  if (date.getUTCFullYear() !== calendarYear || date.getUTCMonth() !== month.number - 1 || date.getUTCDate() !== day) {
    throw new ChmTideTextError('chm_tide_text_day_invalid');
  }

  const localDate = `${calendarYear}-${String(month.number).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const phase = match[2] ? match[2].toUpperCase() : null;
  return Object.freeze({
    day,
    prediction: Object.freeze({
      localDate,
      localTime: parseTime(match[3]),
      heightMeters: parseHeight(match[4]),
      phase,
      sourcePage,
    }),
  });
}

function parsePage(page, pageIndex, station, calendarYear) {
  const header = findMonthHeader(page, pageIndex);
  const lines = page.split('\n').slice(header.index + 1);
  const previousDays = [null, null, null, null];
  const predictions = [];
  const countsByMonth = new Map(header.months.map((month) => [month.number, 0]));
  const sourcePage = station.pageStart + pageIndex;

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.trim().split(/\s{2,}/u);
    if (cells.length !== CHM_TIDE_TEXT_MONTHS_PER_PAGE) continue;
    let parsedAny = false;
    for (let column = 0; column < cells.length; column += 1) {
      const parsed = parseCell(cells[column], previousDays[column], {
        calendarYear,
        month: header.months[column],
        sourcePage,
      });
      previousDays[column] = parsed.day;
      if (parsed.prediction) {
        parsedAny = true;
        predictions.push(parsed.prediction);
        countsByMonth.set(header.months[column].number, countsByMonth.get(header.months[column].number) + 1);
      }
    }
    if (!parsedAny) continue;
  }

  if ([...countsByMonth.values()].some((count) => count < 1)) {
    throw new ChmTideTextError('chm_tide_text_month_without_predictions');
  }
  return Object.freeze(predictions);
}

export function parseChmTidePdfLayoutText(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ChmTideTextError('chm_tide_text_input_invalid');
  const station = validateStation(input.station);
  const calendarYear = boundedInteger(input.calendarYear, 2020, 2100, 'chm_tide_text_calendar_year_invalid');
  const sourceArtifactSha256 = validateSha256(input.sourceArtifactSha256);
  const { pages, byteLength } = normalizePages(input.text);
  validateIdentity(input.text, station, calendarYear);
  const fusoRawToken = parseFusoRaw(input.text);
  const fuso = bindChmTideFusoToken(fusoRawToken);

  const predictions = pages.flatMap((page, pageIndex) => parsePage(page, pageIndex, station, calendarYear));
  if (predictions.length < 12 || predictions.length > 366 * CHM_TIDE_TEXT_MAX_EVENTS_PER_DAY) {
    throw new ChmTideTextError('chm_tide_text_prediction_count_invalid');
  }

  predictions.sort((left, right) => `${left.localDate}T${left.localTime}`.localeCompare(`${right.localDate}T${right.localTime}`));
  const perDay = new Map();
  const seen = new Set();
  for (const prediction of predictions) {
    const key = `${prediction.localDate}T${prediction.localTime}`;
    if (seen.has(key)) throw new ChmTideTextError('chm_tide_text_duplicate_local_time');
    seen.add(key);
    const count = (perDay.get(prediction.localDate) ?? 0) + 1;
    if (count > CHM_TIDE_TEXT_MAX_EVENTS_PER_DAY) throw new ChmTideTextError('chm_tide_text_daily_count_invalid');
    perDay.set(prediction.localDate, count);
  }

  const canonicalFuso = {
    rawToken: fuso.rawToken,
    zoneHoursWest: fuso.zoneHoursWest,
    baseUtcOffsetMinutes: fuso.baseUtcOffsetMinutes,
    signConvention: fuso.signConvention,
    timeBasis: fuso.timeBasis,
  };
  const canonical = {
    sourceId: CHM_TIDE_TEXT_SOURCE_ID,
    calendarYear,
    station,
    sourceArtifactSha256,
    fuso: canonicalFuso,
    predictions,
  };

  return Object.freeze({
    sourceId: CHM_TIDE_TEXT_SOURCE_ID,
    calendarYear,
    station,
    sourceArtifactSha256,
    extractedTextSha256: sha256(Buffer.from(input.text, 'utf8')),
    extractedTextByteLength: byteLength,
    pageCount: pages.length,
    fusoRawToken: fuso.rawToken,
    fusoZoneHoursWest: fuso.zoneHoursWest,
    fusoSignConvention: CHM_TIDE_FUSO_SIGN_CONVENTION,
    fusoTimeBasis: CHM_TIDE_FUSO_TIME_BASIS,
    fusoContract: CHM_TIDE_FUSO_CONTRACT,
    fusoSemanticsBinding: CHM_TIDE_FUSO_BINDING,
    baseUtcOffsetMinutes: fuso.baseUtcOffsetMinutes,
    civilClockAdjustmentMinutes: null,
    civilClockBinding: CHM_TIDE_CIVIL_CLOCK_BINDING,
    utcOffsetMinutes: null,
    predictionCount: predictions.length,
    predictions: Object.freeze(predictions),
    parsedValueSha256: sha256(JSON.stringify(canonical)),
    rawTextRetention: 'NONE',
    extractionLayout: CHM_TIDE_TEXT_LAYOUT,
    liveSourceExtraction: 'BLOCKED_OFFICIAL_2026_PDF_LAYOUT_NOT_YET_EVIDENCED',
    contract: CHM_TIDE_TEXT_CONTRACT,
  });
}
