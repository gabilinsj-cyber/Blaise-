import { createHash } from 'node:crypto';

export const CHM_TIDE_VALUE_SOURCE_ID = 'chm-marine';
export const CHM_TIDE_VALUE_CONTRACT = 'STRUCTURED_OFFICIAL_CHM_TIDE_VALUES_NORMALIZER_LIVE_EXTRACTION_BLOCKED';
export const CHM_TIDE_TIME_BASIS = 'LEGAL_LOCAL_TIME_FROM_CHM_TABLE_HEADER';
export const CHM_MAX_TIDE_EVENTS_PER_DAY = 8;
export const CHM_MAX_TIDE_EVENTS_PER_YEAR = 366 * CHM_MAX_TIDE_EVENTS_PER_DAY;
export const CHM_MIN_TIDE_HEIGHT_METERS = -10;
export const CHM_MAX_TIDE_HEIGHT_METERS = 20;

export class ChmTideValueError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmTideValueError';
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeName(value) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length < 3 || normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new ChmTideValueError('chm_tide_value_station_name_invalid');
  }
  return normalized;
}

function boundedInteger(value, min, max, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ChmTideValueError(code);
  }
  return parsed;
}

function validateStation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChmTideValueError('chm_tide_value_station_missing');
  }
  const stationNumber = boundedInteger(value.stationNumber, 1, 99, 'chm_tide_value_station_number_invalid');
  const name = normalizeName(value.name);
  const pageStart = boundedInteger(value.pageStart, 1, 400, 'chm_tide_value_page_range_invalid');
  const pageEnd = boundedInteger(value.pageEnd, 1, 400, 'chm_tide_value_page_range_invalid');
  if (pageEnd - pageStart !== 2) {
    throw new ChmTideValueError('chm_tide_value_page_range_invalid');
  }
  return Object.freeze({ stationNumber, name, pageStart, pageEnd });
}

function validateSha256(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new ChmTideValueError('chm_tide_value_source_sha256_invalid');
  }
  return normalized;
}

function parseCalendarYear(value) {
  return boundedInteger(value, 2020, 2100, 'chm_tide_value_calendar_year_invalid');
}

function parseUtcOffsetMinutes(value) {
  return boundedInteger(value, -720, 840, 'chm_tide_value_utc_offset_invalid');
}

function parseLocalDate(value, calendarYear) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) throw new ChmTideValueError('chm_tide_value_local_date_invalid');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year !== calendarYear) {
    throw new ChmTideValueError('chm_tide_value_date_year_mismatch');
  }
  const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const date = new Date(ms);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ChmTideValueError('chm_tide_value_local_date_invalid');
  }
  return Object.freeze({ value: `${match[1]}-${match[2]}-${match[3]}`, year, month, day });
}

function parseLocalTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) throw new ChmTideValueError('chm_tide_value_local_time_invalid');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new ChmTideValueError('chm_tide_value_local_time_invalid');
  }
  return Object.freeze({ value: `${match[1]}:${match[2]}`, hour, minute });
}

function parseHeightMeters(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)
      || parsed < CHM_MIN_TIDE_HEIGHT_METERS
      || parsed > CHM_MAX_TIDE_HEIGHT_METERS) {
    throw new ChmTideValueError('chm_tide_value_height_invalid');
  }
  return parsed;
}

function parsePhase(value) {
  if (value === null || value === undefined || value === '') return null;
  const token = String(value).trim().toUpperCase();
  if (token === 'PM' || token === 'HIGH') return 'HIGH';
  if (token === 'BM' || token === 'LOW') return 'LOW';
  throw new ChmTideValueError('chm_tide_value_phase_invalid');
}

function instantUtc(localDate, localTime, utcOffsetMinutes) {
  const localWallClockMs = Date.UTC(
    localDate.year,
    localDate.month - 1,
    localDate.day,
    localTime.hour,
    localTime.minute,
    0,
    0,
  );
  return new Date(localWallClockMs - (utcOffsetMinutes * 60_000)).toISOString();
}

function normalizePrediction(value, { calendarYear, station, utcOffsetMinutes }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChmTideValueError('chm_tide_value_prediction_invalid');
  }
  const localDate = parseLocalDate(value.localDate, calendarYear);
  const localTime = parseLocalTime(value.localTime);
  const sourcePage = boundedInteger(value.sourcePage, station.pageStart, station.pageEnd, 'chm_tide_value_source_page_invalid');
  const heightMeters = parseHeightMeters(value.heightMeters);
  const phase = parsePhase(value.phase);
  return Object.freeze({
    localDate: localDate.value,
    localTime: localTime.value,
    instantUtc: instantUtc(localDate, localTime, utcOffsetMinutes),
    heightMeters,
    phase,
    phaseSource: phase ? 'EXPLICIT_SOURCE_TOKEN' : 'NOT_PROVIDED_NO_INFERENCE',
    sourcePage,
  });
}

export function normalizeChmTideValues(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ChmTideValueError('chm_tide_value_input_invalid');
  }

  const station = validateStation(input.station);
  const calendarYear = parseCalendarYear(input.calendarYear);
  const sourceArtifactSha256 = validateSha256(input.sourceArtifactSha256);
  const utcOffsetMinutes = parseUtcOffsetMinutes(input.utcOffsetMinutes);
  if (input.timeBasis !== CHM_TIDE_TIME_BASIS) {
    throw new ChmTideValueError('chm_tide_value_time_basis_invalid');
  }
  if (!Array.isArray(input.predictions) || input.predictions.length < 1 || input.predictions.length > CHM_MAX_TIDE_EVENTS_PER_YEAR) {
    throw new ChmTideValueError('chm_tide_value_prediction_count_invalid');
  }

  const perDay = new Map();
  const normalized = input.predictions.map((prediction) => {
    const result = normalizePrediction(prediction, { calendarYear, station, utcOffsetMinutes });
    const count = (perDay.get(result.localDate) ?? 0) + 1;
    if (count > CHM_MAX_TIDE_EVENTS_PER_DAY) {
      throw new ChmTideValueError('chm_tide_value_daily_count_invalid');
    }
    perDay.set(result.localDate, count);
    return result;
  });

  normalized.sort((left, right) => {
    const leftKey = `${left.localDate}T${left.localTime}`;
    const rightKey = `${right.localDate}T${right.localTime}`;
    return leftKey.localeCompare(rightKey);
  });

  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (previous.localDate === current.localDate && previous.localTime === current.localTime) {
      throw new ChmTideValueError('chm_tide_value_duplicate_local_time');
    }
  }

  const canonicalStation = {
    stationNumber: station.stationNumber,
    name: station.name,
    pageStart: station.pageStart,
    pageEnd: station.pageEnd,
  };
  const canonicalPredictions = normalized.map((prediction) => ({
    localDate: prediction.localDate,
    localTime: prediction.localTime,
    heightMeters: prediction.heightMeters,
    phase: prediction.phase,
    sourcePage: prediction.sourcePage,
  }));
  const canonical = {
    sourceId: CHM_TIDE_VALUE_SOURCE_ID,
    calendarYear,
    station: canonicalStation,
    timeBasis: CHM_TIDE_TIME_BASIS,
    utcOffsetMinutes,
    sourceArtifactSha256,
    predictions: canonicalPredictions,
  };

  return Object.freeze({
    sourceId: CHM_TIDE_VALUE_SOURCE_ID,
    calendarYear,
    station: Object.freeze(canonicalStation),
    timeBasis: CHM_TIDE_TIME_BASIS,
    utcOffsetMinutes,
    sourceArtifactSha256,
    predictionCount: normalized.length,
    firstLocalDate: normalized[0].localDate,
    lastLocalDate: normalized[normalized.length - 1].localDate,
    predictions: Object.freeze(normalized),
    tideValueSha256: sha256(JSON.stringify(canonical)),
    rawSourceTextRetention: 'NONE',
    phaseDerivation: 'EXPLICIT_ONLY_NO_INFERENCE',
    liveSourceExtraction: 'BLOCKED_OFFICIAL_PDF_VALUE_EXTRACTION_NOT_EVIDENCED',
    contract: CHM_TIDE_VALUE_CONTRACT,
  });
}
