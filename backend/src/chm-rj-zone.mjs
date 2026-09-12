export const CHM_RJ_ZONE_CONTRACT = 'OFFICIAL_METAREA_V_SUBAREA_RJ_ZONE_CLASSIFICATION_NOT_MUNICIPAL_GEOFENCE';

export const CHM_RJ_ZONE_KIND = Object.freeze({
  RJ_COASTAL: 'RJ_COASTAL_ZONE',
  RJ_OFFSHORE: 'RJ_OFFSHORE_ZONE',
  OUTSIDE_DIRECT_RJ: 'OUTSIDE_DIRECT_RJ_ZONE',
  BROAD_OCEANIC: 'BROAD_OCEANIC_NOT_RJ_GEOFENCED',
});

const AREA_RULES = Object.freeze({
  ALFA: Object.freeze({
    kind: CHM_RJ_ZONE_KIND.OUTSIDE_DIRECT_RJ,
    officialBoundary: 'CHUI_TO_LAGUNA',
    rjZoneCandidate: false,
  }),
  BRAVO: Object.freeze({
    kind: CHM_RJ_ZONE_KIND.RJ_OFFSHORE,
    officialBoundary: 'LAGUNA_TO_ARRAIAL_DO_CABO_OCEANIC',
    rjZoneCandidate: true,
  }),
  CHARLIE: Object.freeze({
    kind: CHM_RJ_ZONE_KIND.RJ_COASTAL,
    officialBoundary: 'LAGUNA_TO_ARRAIAL_DO_CABO_COASTAL',
    rjZoneCandidate: true,
  }),
  DELTA: Object.freeze({
    kind: CHM_RJ_ZONE_KIND.RJ_COASTAL,
    officialBoundary: 'ARRAIAL_DO_CABO_TO_CARAVELAS',
    rjZoneCandidate: true,
  }),
  ECHO: Object.freeze({
    kind: CHM_RJ_ZONE_KIND.OUTSIDE_DIRECT_RJ,
    officialBoundary: 'CARAVELAS_TO_SALVADOR',
    rjZoneCandidate: false,
  }),
  FOXTROT: Object.freeze({
    kind: CHM_RJ_ZONE_KIND.OUTSIDE_DIRECT_RJ,
    officialBoundary: 'SALVADOR_TO_NATAL',
    rjZoneCandidate: false,
  }),
  GOLF: Object.freeze({
    kind: CHM_RJ_ZONE_KIND.OUTSIDE_DIRECT_RJ,
    officialBoundary: 'NATAL_TO_SAO_LUIS',
    rjZoneCandidate: false,
  }),
  HOTEL: Object.freeze({
    kind: CHM_RJ_ZONE_KIND.OUTSIDE_DIRECT_RJ,
    officialBoundary: 'SAO_LUIS_TO_OIAPOQUE',
    rjZoneCandidate: false,
  }),
  'SUL OCEANICA': Object.freeze({
    kind: CHM_RJ_ZONE_KIND.BROAD_OCEANIC,
    officialBoundary: 'SOUTH_OCEANIC_AREA',
    rjZoneCandidate: false,
  }),
  'NORTE OCEANICA': Object.freeze({
    kind: CHM_RJ_ZONE_KIND.BROAD_OCEANIC,
    officialBoundary: 'NORTH_OCEANIC_AREA',
    rjZoneCandidate: false,
  }),
});

export class ChmRjZoneError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmRjZoneError';
    this.code = code;
  }
}

function normalizeAreaLabel(value) {
  if (typeof value !== 'string') throw new ChmRjZoneError('chm_rj_zone_area_invalid');
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!normalized || normalized.length > 48 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new ChmRjZoneError('chm_rj_zone_area_invalid');
  }
  return normalized;
}

export function classifyChmRjZone(areaLabel) {
  const normalizedArea = normalizeAreaLabel(areaLabel);
  const rule = AREA_RULES[normalizedArea];
  if (!rule) throw new ChmRjZoneError('chm_rj_zone_unknown_area');

  return Object.freeze({
    area: normalizedArea,
    kind: rule.kind,
    officialBoundary: rule.officialBoundary,
    rjZoneCandidate: rule.rjZoneCandidate,
    municipalityGeofenceValidated: false,
    canPromoteMunicipalityP0: false,
    contract: CHM_RJ_ZONE_CONTRACT,
  });
}

export function classifyChmWarningRjZones(warning) {
  if (!warning || typeof warning !== 'object' || !Array.isArray(warning.areas)) {
    throw new ChmRjZoneError('chm_rj_zone_warning_invalid');
  }
  if (warning.areas.length < 1 || warning.areas.length > 8) {
    throw new ChmRjZoneError('chm_rj_zone_warning_areas_invalid');
  }

  const classifications = warning.areas.map(classifyChmRjZone);
  const candidate = classifications.some((item) => item.rjZoneCandidate);
  return Object.freeze({
    warningId: typeof warning.id === 'string' ? warning.id : null,
    classifications: Object.freeze(classifications),
    rjZoneCandidate: candidate,
    municipalityGeofenceValidated: false,
    canPromoteMunicipalityP0: false,
    contract: CHM_RJ_ZONE_CONTRACT,
  });
}
