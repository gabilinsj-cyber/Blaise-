import { createHash } from 'node:crypto';

import { fetchTextContract, SourceContractError } from './source-contract.mjs';

export const INEA_RADAR_INVENTORY_SOURCE_ID = 'inea-radar-official-inventory';
export const INEA_RADAR_INVENTORY_HOST = 'www.inea.rj.gov.br';
export const INEA_RADAR_INVENTORY_URL = 'https://www.inea.rj.gov.br/ar-agua-e-solo/seguranca-hidrica/inundacoes/';
export const INEA_RADAR_INVENTORY_CONTRACT = 'OFFICIAL_INEA_RADAR_INVENTORY_VALIDATED';
export const INEA_RADAR_INVENTORY_IDENTITIES = Object.freeze(['guaratiba', 'macae']);

export class IneaRadarInventoryError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IneaRadarInventoryError';
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
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

function foldText(html) {
  return decodeEntities(
    String(html)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function validateIneaRadarOfficialInventoryHtml(html) {
  if (typeof html !== 'string' || html.length < 256) {
    throw new IneaRadarInventoryError('inea_radar_inventory_empty_html');
  }

  const text = foldText(html);
  if (!text.includes('sistema de alerta de cheias')) {
    throw new IneaRadarInventoryError('inea_radar_inventory_system_marker_missing');
  }
  if (!text.includes('dois radares meteorologicos')) {
    throw new IneaRadarInventoryError('inea_radar_inventory_count_marker_missing');
  }
  if (!text.includes('guaratiba')) {
    throw new IneaRadarInventoryError('inea_radar_inventory_guaratiba_marker_missing');
  }
  if (!text.includes('macae')) {
    throw new IneaRadarInventoryError('inea_radar_inventory_macae_marker_missing');
  }

  const sourceUrlSha256 = sha256(INEA_RADAR_INVENTORY_URL);
  const canonical = JSON.stringify({
    sourceId: INEA_RADAR_INVENTORY_SOURCE_ID,
    sourceHost: INEA_RADAR_INVENTORY_HOST,
    sourceUrlSha256,
    identities: INEA_RADAR_INVENTORY_IDENTITIES,
    identityCount: INEA_RADAR_INVENTORY_IDENTITIES.length,
    contract: INEA_RADAR_INVENTORY_CONTRACT,
  });

  return Object.freeze({
    sourceId: INEA_RADAR_INVENTORY_SOURCE_ID,
    contract: INEA_RADAR_INVENTORY_CONTRACT,
    sourceHost: INEA_RADAR_INVENTORY_HOST,
    sourceUrlSha256,
    rawSourceUrl: 'REDACTED',
    identities: INEA_RADAR_INVENTORY_IDENTITIES,
    identityCount: INEA_RADAR_INVENTORY_IDENTITIES.length,
    inventorySha256: sha256(canonical),
    sameCandidateIdentityBinding: 'NOT_IMPLEMENTED',
  });
}

export async function probeIneaRadarOfficialInventory({ fetchImpl = globalThis.fetch } = {}) {
  let html;
  try {
    html = await fetchTextContract(INEA_RADAR_INVENTORY_URL, {
      allowedHosts: [INEA_RADAR_INVENTORY_HOST],
      fetchImpl,
      timeoutMs: 8_000,
      maxBytes: 1536 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new IneaRadarInventoryError(`inea_radar_inventory_${error.code}`);
    }
    throw error;
  }
  return validateIneaRadarOfficialInventoryHtml(html);
}
