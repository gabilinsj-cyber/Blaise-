export const CHM_EXPLICIT_MARINE_SIGNAL_CONTRACT = 'CHM_EXPLICIT_WAVE_RANGE_AND_RESSACA_LABEL_NOT_MUNICIPAL_SEVERITY';
export const CHM_RESSACA_WAVE_THRESHOLD_METERS = 3.5;
export const CHM_MAX_EXPLICIT_WAVE_METERS = 30;

const DIRECTIONS = new Set([
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
]);

export class ChmMarineSignalError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmMarineSignalError';
    this.code = code;
  }
}

function hasOfficialRessacaLabel(warningType) {
  if (warningType === undefined || warningType === null) return false;
  if (typeof warningType !== 'string' || warningType.length < 3 || warningType.length > 96) {
    throw new ChmMarineSignalError('chm_marine_signal_warning_type_invalid');
  }
  return warningType
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .includes('RESSACA');
}

function emptySignal(warningType) {
  return Object.freeze({
    explicitWaveHeight: false,
    waveDirection: null,
    waveMinMeters: null,
    waveMaxMeters: null,
    waveThresholdMeters: CHM_RESSACA_WAVE_THRESHOLD_METERS,
    waveHeightThresholdExceeded: null,
    officialRessacaLabel: hasOfficialRessacaLabel(warningType),
    canPromoteMunicipalityP0: false,
    contract: CHM_EXPLICIT_MARINE_SIGNAL_CONTRACT,
  });
}

function parseMeters(token) {
  const normalized = String(token).replace(',', '.');
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new ChmMarineSignalError('chm_marine_signal_wave_height_invalid');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > CHM_MAX_EXPLICIT_WAVE_METERS) {
    throw new ChmMarineSignalError('chm_marine_signal_wave_height_invalid');
  }
  return value;
}

function buildExplicitSignal({ direction, minMeters, maxMeters, warningType }) {
  const normalizedDirection = String(direction).toUpperCase();
  if (!DIRECTIONS.has(normalizedDirection)) {
    throw new ChmMarineSignalError('chm_marine_signal_wave_direction_invalid');
  }
  if (!Number.isFinite(minMeters)
      || !Number.isFinite(maxMeters)
      || minMeters <= 0
      || maxMeters <= 0
      || minMeters > CHM_MAX_EXPLICIT_WAVE_METERS
      || maxMeters > CHM_MAX_EXPLICIT_WAVE_METERS
      || minMeters > maxMeters) {
    throw new ChmMarineSignalError('chm_marine_signal_wave_range_invalid');
  }

  return Object.freeze({
    explicitWaveHeight: true,
    waveDirection: normalizedDirection,
    waveMinMeters: minMeters,
    waveMaxMeters: maxMeters,
    waveThresholdMeters: CHM_RESSACA_WAVE_THRESHOLD_METERS,
    waveHeightThresholdExceeded: maxMeters > CHM_RESSACA_WAVE_THRESHOLD_METERS,
    officialRessacaLabel: hasOfficialRessacaLabel(warningType),
    canPromoteMunicipalityP0: false,
    contract: CHM_EXPLICIT_MARINE_SIGNAL_CONTRACT,
  });
}

export function parseChmMarineSignal(segment, warningType) {
  if (typeof segment !== 'string' || segment.length < 1 || segment.length > 64 * 1024) {
    throw new ChmMarineSignalError('chm_marine_signal_segment_invalid');
  }

  const markerPresent = /\bONDAS?\s+DE\b/iu.test(segment);
  const pattern = /\bONDAS?\s+DE\s+([NSEW]{1,3})\s+(\d{1,2}(?:[.,]\d{1,2})?)(?:\s*\/\s*(\d{1,2}(?:[.,]\d{1,2})?))?\s+METROS?\b/giu;
  const matches = [...segment.matchAll(pattern)];

  if (!markerPresent) return emptySignal(warningType);
  if (matches.length !== 1) {
    throw new ChmMarineSignalError('chm_marine_signal_wave_expression_ambiguous');
  }

  const minMeters = parseMeters(matches[0][2]);
  const maxMeters = matches[0][3] ? parseMeters(matches[0][3]) : minMeters;
  return buildExplicitSignal({
    direction: matches[0][1],
    minMeters,
    maxMeters,
    warningType,
  });
}

export function validateChmMarineSignal(signal, warningType) {
  if (signal === undefined || signal === null) return emptySignal(warningType);
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) {
    throw new ChmMarineSignalError('chm_marine_signal_invalid');
  }
  if (signal.contract !== CHM_EXPLICIT_MARINE_SIGNAL_CONTRACT
      || signal.waveThresholdMeters !== CHM_RESSACA_WAVE_THRESHOLD_METERS
      || signal.canPromoteMunicipalityP0 !== false
      || signal.officialRessacaLabel !== hasOfficialRessacaLabel(warningType)) {
    throw new ChmMarineSignalError('chm_marine_signal_contract_invalid');
  }

  if (signal.explicitWaveHeight === false) {
    if (signal.waveDirection !== null
        || signal.waveMinMeters !== null
        || signal.waveMaxMeters !== null
        || signal.waveHeightThresholdExceeded !== null) {
      throw new ChmMarineSignalError('chm_marine_signal_empty_shape_invalid');
    }
    return emptySignal(warningType);
  }

  if (signal.explicitWaveHeight !== true) {
    throw new ChmMarineSignalError('chm_marine_signal_explicit_flag_invalid');
  }
  const rebuilt = buildExplicitSignal({
    direction: signal.waveDirection,
    minMeters: signal.waveMinMeters,
    maxMeters: signal.waveMaxMeters,
    warningType,
  });
  if (signal.waveHeightThresholdExceeded !== rebuilt.waveHeightThresholdExceeded) {
    throw new ChmMarineSignalError('chm_marine_signal_threshold_semantics_invalid');
  }
  return rebuilt;
}

export function mergeChmMarineSignals(existing, candidate, warningType) {
  const left = validateChmMarineSignal(existing, warningType);
  const right = validateChmMarineSignal(candidate, warningType);

  if (left.explicitWaveHeight && right.explicitWaveHeight) {
    if (left.waveDirection !== right.waveDirection
        || left.waveMinMeters !== right.waveMinMeters
        || left.waveMaxMeters !== right.waveMaxMeters) {
      throw new ChmMarineSignalError('chm_marine_signal_duplicate_conflict');
    }
    return left;
  }
  if (left.explicitWaveHeight) return left;
  if (right.explicitWaveHeight) return right;
  return left;
}
