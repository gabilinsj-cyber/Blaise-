import { createHash } from 'node:crypto';
import { fetchJsonContract, SourceContractError } from './source-contract.mjs';

export const DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID = 'defesa-civil-rio-map-assets';
export const DEFESA_CIVIL_RIO_ASSETS_HOST = 'pgeo3.rio.rj.gov.br';
export const DEFESA_CIVIL_RIO_SERVICE_ITEM_ID = '89bec83021764d0e9c723f30d390908c';
export const DEFESA_CIVIL_RIO_MAX_FEATURES = 2_000;

const SERVICE_ROOT = 'https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Defesa_Civil/Defesa_Civil/FeatureServer';
const RIO_BOUNDS = Object.freeze({ minLon: -44.0, maxLon: -42.5, minLat: -23.3, maxLat: -22.5 });

function queryUrl(layerId, outFields) {
  const url = new URL(`${SERVICE_ROOT}/${layerId}/query`);
  url.search = new URLSearchParams({
    where: '1=1',
    outFields,
    returnGeometry: 'true',
    outSR: '4326',
    orderByFields: 'objectid',
    f: 'json',
  }).toString();
  return url.toString();
}

export const DEFESA_CIVIL_RIO_SIRENS_URL = queryUrl(
  0,
  'objectid,cod_sirene,sirene,favela,nome_favela,referencia,pluviometro,globalid',
);
export const DEFESA_CIVIL_RIO_SUPPORT_POINTS_URL = queryUrl(
  1,
  'objectid,cod_papoio,pontos_apo,favela,nome_favela,ref_cia,end_rco,pto_ppal,globalid',
);

export class DefesaCivilRioAssetsError extends Error {
  constructor(code) {
    super(code);
    this.name = 'DefesaCivilRioAssetsError';
    this.code = code;
  }
}

function requiredInteger(value, code) {
  if (!Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new DefesaCivilRioAssetsError(code);
  }
  return value;
}

function requiredText(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new DefesaCivilRioAssetsError(code);
  }
  return text;
}

function optionalText(value, maxLength, code) {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new DefesaCivilRioAssetsError(code);
  }
  return text;
}

function globalId(value, code) {
  const text = requiredText(value, 38, code);
  if (!/^\{?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\}?$/i.test(text)) {
    throw new DefesaCivilRioAssetsError(code);
  }
  return text.toLowerCase();
}

function pointGeometry(geometry, code) {
  const longitude = geometry?.x;
  const latitude = geometry?.y;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new DefesaCivilRioAssetsError(code);
  }
  if (
    longitude < RIO_BOUNDS.minLon || longitude > RIO_BOUNDS.maxLon
    || latitude < RIO_BOUNDS.minLat || latitude > RIO_BOUNDS.maxLat
  ) {
    throw new DefesaCivilRioAssetsError('defesa_civil_rio_geometry_outside_expected_bounds');
  }
  return Object.freeze({ longitude, latitude });
}

function validateEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || payload.error) {
    throw new DefesaCivilRioAssetsError('defesa_civil_rio_arcgis_error');
  }
  if (payload.exceededTransferLimit === true) {
    throw new DefesaCivilRioAssetsError('defesa_civil_rio_transfer_limit_exceeded');
  }
  if (payload.geometryType !== 'esriGeometryPoint') {
    throw new DefesaCivilRioAssetsError('defesa_civil_rio_geometry_type_drift');
  }
  const wkid = payload.spatialReference?.latestWkid ?? payload.spatialReference?.wkid;
  if (wkid !== 4326) {
    throw new DefesaCivilRioAssetsError('defesa_civil_rio_spatial_reference_drift');
  }
  if (!Array.isArray(payload.features) || payload.features.length < 1) {
    throw new DefesaCivilRioAssetsError('defesa_civil_rio_features_missing');
  }
  if (payload.features.length > DEFESA_CIVIL_RIO_MAX_FEATURES) {
    throw new DefesaCivilRioAssetsError('defesa_civil_rio_feature_count_exceeded');
  }
  return payload.features;
}

function commonFeature(feature) {
  const attributes = feature?.attributes;
  if (!attributes || typeof attributes !== 'object') {
    throw new DefesaCivilRioAssetsError('defesa_civil_rio_invalid_feature');
  }
  return {
    objectId: requiredInteger(attributes.objectid, 'defesa_civil_rio_invalid_object_id'),
    globalId: globalId(attributes.globalid, 'defesa_civil_rio_invalid_global_id'),
    geometry: pointGeometry(feature.geometry, 'defesa_civil_rio_invalid_geometry'),
  };
}

function assertUnique(items, key, code) {
  const seen = new Set();
  for (const item of items) {
    const value = item[key];
    if (seen.has(value)) throw new DefesaCivilRioAssetsError(code);
    seen.add(value);
  }
}

function digest(items) {
  return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

export function validateDefesaCivilRioSirens(payload) {
  const sirens = validateEnvelope(payload).map((feature) => {
    const common = commonFeature(feature);
    const attributes = feature.attributes;
    const rainGaugeRaw = attributes.pluviometro;
    if (rainGaugeRaw != null && rainGaugeRaw !== 0 && rainGaugeRaw !== 1) {
      throw new DefesaCivilRioAssetsError('defesa_civil_rio_invalid_rain_gauge_flag');
    }
    return Object.freeze({
      ...common,
      sirenCode: requiredInteger(attributes.cod_sirene, 'defesa_civil_rio_invalid_siren_code'),
      name: requiredText(attributes.sirene, 254, 'defesa_civil_rio_invalid_siren_name'),
      community: optionalText(attributes.nome_favela ?? attributes.favela, 254, 'defesa_civil_rio_invalid_community'),
      reference: optionalText(attributes.referencia, 254, 'defesa_civil_rio_invalid_reference'),
      hasRainGauge: rainGaugeRaw == null ? null : rainGaugeRaw === 1,
    });
  }).sort((a, b) => a.objectId - b.objectId);

  assertUnique(sirens, 'objectId', 'defesa_civil_rio_duplicate_siren_object_id');
  assertUnique(sirens, 'globalId', 'defesa_civil_rio_duplicate_siren_global_id');
  assertUnique(sirens, 'sirenCode', 'defesa_civil_rio_duplicate_siren_code');
  return Object.freeze({ count: sirens.length, sha256: digest(sirens), items: Object.freeze(sirens) });
}

export function validateDefesaCivilRioSupportPoints(payload) {
  const supportPoints = validateEnvelope(payload).map((feature) => {
    const common = commonFeature(feature);
    const attributes = feature.attributes;
    return Object.freeze({
      ...common,
      supportCode: requiredInteger(attributes.cod_papoio, 'defesa_civil_rio_invalid_support_code'),
      name: requiredText(attributes.pontos_apo, 100, 'defesa_civil_rio_invalid_support_name'),
      community: optionalText(attributes.nome_favela ?? attributes.favela, 254, 'defesa_civil_rio_invalid_community'),
      reference: optionalText(attributes.ref_cia, 254, 'defesa_civil_rio_invalid_support_reference'),
      address: optionalText(attributes.end_rco, 254, 'defesa_civil_rio_invalid_support_address'),
      mainPoint: optionalText(attributes.pto_ppal, 254, 'defesa_civil_rio_invalid_support_main_point'),
    });
  }).sort((a, b) => a.objectId - b.objectId);

  assertUnique(supportPoints, 'objectId', 'defesa_civil_rio_duplicate_support_object_id');
  assertUnique(supportPoints, 'globalId', 'defesa_civil_rio_duplicate_support_global_id');
  assertUnique(supportPoints, 'supportCode', 'defesa_civil_rio_duplicate_support_code');
  return Object.freeze({ count: supportPoints.length, sha256: digest(supportPoints), items: Object.freeze(supportPoints) });
}

async function fetchLayer(url, validator, fetchImpl) {
  let payload;
  try {
    payload = await fetchJsonContract(url, {
      allowedHosts: [DEFESA_CIVIL_RIO_ASSETS_HOST],
      fetchImpl,
      timeoutMs: 7_000,
      maxBytes: 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new DefesaCivilRioAssetsError(`defesa_civil_rio_${error.code}`);
    }
    throw error;
  }
  return validator(payload);
}

export async function probeDefesaCivilRioMapAssets({ fetchImpl = globalThis.fetch } = {}) {
  const [sirens, supportPoints] = await Promise.all([
    fetchLayer(DEFESA_CIVIL_RIO_SIRENS_URL, validateDefesaCivilRioSirens, fetchImpl),
    fetchLayer(DEFESA_CIVIL_RIO_SUPPORT_POINTS_URL, validateDefesaCivilRioSupportPoints, fetchImpl),
  ]);

  return Object.freeze({
    sourceId: DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID,
    sourceHost: DEFESA_CIVIL_RIO_ASSETS_HOST,
    serviceItemId: DEFESA_CIVIL_RIO_SERVICE_ITEM_ID,
    spatialReference: 4326,
    sirens,
    supportPoints,
  });
}
