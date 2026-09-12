import { classifyRjSeaFacingMunicipality } from './rj-seafront-municipalities.mjs';

export const CHM_RJ_ZONE_CONTRACT = 'OFFICIAL_METAREA_V_SUBAREA_RJ_ZONE_CLASSIFICATION_NOT_MUNICIPAL_GEOFENCE';
export const CHM_RJ_MUNICIPALITY_PREFILTER_CONTRACT = 'CHM_METAREA_V_PLUS_IBGE_2024_SEAFRONT_PREFILTER_NOT_MUNICIPAL_GEOFENCE';
export const CHM_RJ_ALERT_ROUTING_CONTRACT = 'CHM_METAREA_V_RJ_REGIONAL_ROUTING_NOT_MUNICIPAL_GEOFENCE';

export const CHM_RJ_ZONE_KIND = Object.freeze({
  RJ_COASTAL: 'RJ_COASTAL_ZONE',
  RJ_OFFSHORE: 'RJ_OFFSHORE_ZONE',
  OUTSIDE_DIRECT_RJ: 'OUTSIDE_DIRECT_RJ_ZONE',
  BROAD_OCEANIC: 'BROAD_OCEANIC_NOT_RJ_GEOFENCED',
});

export const CHM_RJ_ALERT_ROUTE = Object.freeze({
  RJ_MARINE_REGIONAL: 'RJ_MARINE_REGIONAL',
  BROAD_OCEANIC_REVIEW: 'BROAD_OCEANIC_REVIEW_REQUIRED',
  NOT_DIRECT_RJ: 'NOT_DIRECT_RJ',
  UNROUTABLE_NO_EXPLICIT_AREA: 'UNROUTABLE_NO_EXPLICIT_AREA',
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

export function classifyChmWarningRjRouting(warning) {
  if (!warning || typeof warning !== 'object' || !Array.isArray(warning.areas)) {
    throw new ChmRjZoneError('chm_rj_routing_warning_invalid');
  }
  if (warning.areas.length > 8) {
    throw new ChmRjZoneError('chm_rj_routing_warning_areas_invalid');
  }

  const warningId = typeof warning.id === 'string' ? warning.id : null;
  if (warning.areas.length === 0) {
    return Object.freeze({
      warningId,
      route: CHM_RJ_ALERT_ROUTE.UNROUTABLE_NO_EXPLICIT_AREA,
      rjZoneCandidate: false,
      directRjAreas: Object.freeze([]),
      broadOceanicAreas: Object.freeze([]),
      canExposeRjMarineWarning: false,
      municipalityGeofenceValidated: false,
      canPromoteMunicipalityP0: false,
      contract: CHM_RJ_ALERT_ROUTING_CONTRACT,
    });
  }

  const summary = classifyChmWarningRjZones(warning);
  const directRjAreas = summary.classifications
    .filter((item) => item.kind === CHM_RJ_ZONE_KIND.RJ_COASTAL || item.kind === CHM_RJ_ZONE_KIND.RJ_OFFSHORE)
    .map((item) => item.area);
  const broadOceanicAreas = summary.classifications
    .filter((item) => item.kind === CHM_RJ_ZONE_KIND.BROAD_OCEANIC)
    .map((item) => item.area);

  const route = directRjAreas.length > 0
    ? CHM_RJ_ALERT_ROUTE.RJ_MARINE_REGIONAL
    : broadOceanicAreas.length > 0
      ? CHM_RJ_ALERT_ROUTE.BROAD_OCEANIC_REVIEW
      : CHM_RJ_ALERT_ROUTE.NOT_DIRECT_RJ;

  return Object.freeze({
    warningId,
    route,
    rjZoneCandidate: directRjAreas.length > 0,
    directRjAreas: Object.freeze(directRjAreas),
    broadOceanicAreas: Object.freeze(broadOceanicAreas),
    canExposeRjMarineWarning: route === CHM_RJ_ALERT_ROUTE.RJ_MARINE_REGIONAL,
    municipalityGeofenceValidated: false,
    canPromoteMunicipalityP0: false,
    contract: CHM_RJ_ALERT_ROUTING_CONTRACT,
  });
}

export function classifyChmRjMunicipalityCandidate(areaLabel, municipalityIbge) {
  const zone = classifyChmRjZone(areaLabel);
  const municipality = classifyRjSeaFacingMunicipality(municipalityIbge);
  const coastalZone = zone.kind === CHM_RJ_ZONE_KIND.RJ_COASTAL;
  const rjCoastalCatalogMatch = coastalZone && municipality.seaFacing;

  return Object.freeze({
    area: zone.area,
    kind: zone.kind,
    officialBoundary: zone.officialBoundary,
    municipalityName: municipality.name,
    municipalityIbge: municipality.ibge,
    ibgeSeaFacing: municipality.seaFacing,
    rjCoastalCatalogMatch,
    municipalityGeofenceValidated: false,
    canPromoteMunicipalityP0: false,
    contract: CHM_RJ_MUNICIPALITY_PREFILTER_CONTRACT,
  });
}
