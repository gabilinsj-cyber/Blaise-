import { createHash } from 'node:crypto';

import { CHM_HOST, CHM_SOURCE_ID } from './chm-source.mjs';
import { fetchTextContract, SourceContractError } from './source-contract.mjs';

export const CHM_FORECAST_24H_URL = 'https://www.marinha.mil.br/chm/dados-do-smm-meteoromarinha/previsao-24-horas';
export const CHM_RJ_PREREQUISITE_AREAS = Object.freeze(['BRAVO', 'CHARLIE', 'DELTA']);
export const CHM_AREA_DEFINITION_CONTRACT = 'OFFICIAL_METAREA_V_BOUNDARY_LABELS_ONLY';

const EXPECTED = Object.freeze({
  BRAVO: Object.freeze({
    from: 'LAGUNA',
    to: 'ARRAIAL DO CABO',
    zone: 'OCEANICA',
  }),
  CHARLIE: Object.freeze({
    from: 'LAGUNA',
    to: 'ARRAIAL DO CABO',
    zone: 'COSTEIRA',
  }),
  DELTA: Object.freeze({
    from: 'ARRAIAL DO CABO',
    to: 'CARAVELAS',
    zone: null,
  }),
});

export class ChmAreaDefinitionError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmAreaDefinitionError';
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

function fold(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalZone(raw) {
  if (!raw) return null;
  const folded = fold(raw);
  if (folded === 'OCEANICA') return 'OCEANICA';
  if (folded === 'COSTEIRA') return 'COSTEIRA';
  throw new ChmAreaDefinitionError('chm_area_definition_zone_invalid');
}

function extractDefinitions(text) {
  const normalized = fold(text);
  const pattern = /AREA\s+(BRAVO|CHARLIE|DELTA)\s*\(\s*DE\s+([A-Z ]{2,48}?)\s+ATE\s+([A-Z ]{2,48}?)(?:\s+[–-]\s+(OCEANICA|COSTEIRA))?\s*\)/g;
  const byArea = new Map();

  for (const match of normalized.matchAll(pattern)) {
    const area = match[1];
    const definition = Object.freeze({
      area,
      from: fold(match[2]),
      to: fold(match[3]),
      zone: canonicalZone(match[4]),
    });
    const existing = byArea.get(area);
    if (existing) {
      if (existing.from !== definition.from
          || existing.to !== definition.to
          || existing.zone !== definition.zone) {
        throw new ChmAreaDefinitionError('chm_area_definition_duplicate_conflict');
      }
    } else {
      byArea.set(area, definition);
    }
  }

  return byArea;
}

export function validateChmAreaDefinitionsHtml(html) {
  if (typeof html !== 'string' || html.length < 256) {
    throw new ChmAreaDefinitionError('chm_area_definition_empty_html');
  }
  const text = plainText(html);
  const folded = fold(text);
  if (!folded.includes('CENTRO DE HIDROGRAFIA DA MARINHA')) {
    throw new ChmAreaDefinitionError('chm_area_definition_identity_missing');
  }
  if (!folded.includes('METAREA V')) {
    throw new ChmAreaDefinitionError('chm_area_definition_metarea_missing');
  }
  if (!folded.includes('PREVISAO DO TEMPO VALIDA')) {
    throw new ChmAreaDefinitionError('chm_area_definition_forecast_marker_missing');
  }

  const byArea = extractDefinitions(text);
  const definitions = [];
  for (const area of CHM_RJ_PREREQUISITE_AREAS) {
    const definition = byArea.get(area);
    if (!definition) throw new ChmAreaDefinitionError(`chm_area_definition_${area.toLowerCase()}_missing`);
    const expected = EXPECTED[area];
    if (definition.from !== expected.from
        || definition.to !== expected.to
        || definition.zone !== expected.zone) {
      throw new ChmAreaDefinitionError(`chm_area_definition_${area.toLowerCase()}_drift`);
    }
    definitions.push(definition);
  }

  const canonical = definitions.map(({ area, from, to, zone }) => ({ area, from, to, zone }));
  return Object.freeze({
    sourceId: CHM_SOURCE_ID,
    sourceHost: CHM_HOST,
    sourceUrl: CHM_FORECAST_24H_URL,
    metarea: 'V',
    contract: CHM_AREA_DEFINITION_CONTRACT,
    areas: Object.freeze(definitions),
    areaDefinitionSha256: sha256(JSON.stringify(canonical)),
    municipalityGeofenceValidation: 'NOT_IMPLEMENTED',
    rjApplicability: 'UNRESOLVED_WITHOUT_GEOSPATIAL_MAPPING',
    p0Eligibility: 'BLOCKED_UNTIL_RJ_GEOFENCE_PROVEN',
  });
}

export async function probeChmAreaDefinitions({ fetchImpl = globalThis.fetch } = {}) {
  try {
    const html = await fetchTextContract(CHM_FORECAST_24H_URL, {
      allowedHosts: [CHM_HOST],
      fetchImpl,
      timeoutMs: 8_000,
      maxBytes: 1024 * 1024,
    });
    return validateChmAreaDefinitionsHtml(html);
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new ChmAreaDefinitionError(`chm_area_definition_${error.code}`);
    }
    throw error;
  }
}
