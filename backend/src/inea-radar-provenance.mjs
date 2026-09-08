import { createHash } from 'node:crypto';

import { fetchTextContract, SourceContractError } from './source-contract.mjs';

export const INEA_RADAR_PROVENANCE_SOURCE_ID = 'inea-radar-official-monitoring-page';
export const INEA_MONITORING_PAGE_HOST = 'www.inea.rj.gov.br';
export const INEA_MONITORING_PAGE_URL = 'https://www.inea.rj.gov.br/ar-agua-e-solo/monitoramento-hidrometeorologico/';
export const INEA_PUBLIC_RADAR_HOST = 'alertadecheias.inea.rj.gov.br';
export const INEA_PUBLIC_RADAR_URL = 'https://alertadecheias.inea.rj.gov.br/radar.php';
export const INEA_OFFICIAL_RADAR_CADENCE_MINUTES = 5;

const INEA_OFFICIAL_DOMAIN = 'inea.rj.gov.br';

export class IneaRadarProvenanceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IneaRadarProvenanceError';
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

function anchorTags(html) {
  return [...String(html).matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
}

function attributeValue(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = String(tag).match(pattern);
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? '').trim() : '';
}

function isOfficialIneaHost(hostname) {
  const host = String(hostname).toLowerCase().replace(/\.$/, '');
  return host === INEA_OFFICIAL_DOMAIN || host.endsWith(`.${INEA_OFFICIAL_DOMAIN}`);
}

function resolveOfficialIneaUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  let url;
  try {
    url = new URL(rawUrl, baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '443') return null;
  if (!isOfficialIneaHost(url.hostname)) return null;
  url.hash = '';
  return url;
}

function canonicalRadarLinks(html) {
  const expected = new URL(INEA_PUBLIC_RADAR_URL);
  const links = [];
  for (const tag of anchorTags(html)) {
    const url = resolveOfficialIneaUrl(attributeValue(tag, 'href'), INEA_MONITORING_PAGE_URL);
    if (!url) continue;
    if (
      url.hostname === expected.hostname
      && url.pathname === expected.pathname
      && url.search === ''
    ) {
      links.push(url.href);
    }
  }
  return [...new Set(links)].sort();
}

export function validateIneaRadarOfficialProvenanceHtml(html) {
  if (typeof html !== 'string' || html.length < 256) {
    throw new IneaRadarProvenanceError('inea_radar_provenance_empty_html');
  }

  const text = foldText(html);
  if (!text.includes('monitoramento hidrometeorologico')) {
    throw new IneaRadarProvenanceError('inea_radar_provenance_monitoring_marker_missing');
  }
  if (!text.includes('rede de radares meteorologicos')) {
    throw new IneaRadarProvenanceError('inea_radar_provenance_radar_marker_missing');
  }
  if (!text.includes('a cada cinco minutos')) {
    throw new IneaRadarProvenanceError('inea_radar_provenance_cadence_marker_missing');
  }

  const links = canonicalRadarLinks(html);
  if (links.length < 1) {
    throw new IneaRadarProvenanceError('inea_radar_provenance_canonical_link_missing');
  }
  if (links.length > 1) {
    throw new IneaRadarProvenanceError('inea_radar_provenance_canonical_link_ambiguous');
  }

  const canonical = JSON.stringify({
    sourceId: INEA_RADAR_PROVENANCE_SOURCE_ID,
    monitoringPageHost: INEA_MONITORING_PAGE_HOST,
    publicRadarHost: INEA_PUBLIC_RADAR_HOST,
    publicRadarUrlSha256: sha256(INEA_PUBLIC_RADAR_URL),
    cadenceMinutes: INEA_OFFICIAL_RADAR_CADENCE_MINUTES,
  });

  return Object.freeze({
    sourceId: INEA_RADAR_PROVENANCE_SOURCE_ID,
    contract: 'OFFICIAL_INEA_RADAR_PROVENANCE_VALIDATED',
    monitoringPageHost: INEA_MONITORING_PAGE_HOST,
    publicRadarHost: INEA_PUBLIC_RADAR_HOST,
    publicRadarUrlSha256: sha256(INEA_PUBLIC_RADAR_URL),
    rawPublicRadarUrl: 'REDACTED',
    cadenceMinutes: INEA_OFFICIAL_RADAR_CADENCE_MINUTES,
    provenanceSha256: sha256(canonical),
    radarIdentityValidation: 'NOT_IMPLEMENTED',
    frameTimestampValidation: 'NOT_IMPLEMENTED',
    frameFreshnessValidation: 'NOT_IMPLEMENTED',
    liveRadarFrameIngestion: 'NOT_IMPLEMENTED',
  });
}

export async function probeIneaRadarOfficialProvenance({ fetchImpl = globalThis.fetch } = {}) {
  let html;
  try {
    html = await fetchTextContract(INEA_MONITORING_PAGE_URL, {
      allowedHosts: [INEA_MONITORING_PAGE_HOST],
      fetchImpl,
      timeoutMs: 8_000,
      maxBytes: 1536 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new IneaRadarProvenanceError(`inea_radar_provenance_${error.code}`);
    }
    throw error;
  }
  return validateIneaRadarOfficialProvenanceHtml(html);
}
