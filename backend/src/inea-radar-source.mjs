import { createHash } from 'node:crypto';

import { fetchTextContract, SourceContractError } from './source-contract.mjs';

export const INEA_RADAR_SOURCE_ID = 'inea-radar-tool-gateway';
export const INEA_RADAR_HOST = 'alertadecheias.inea.rj.gov.br';
export const INEA_RADAR_TOOL_URL = 'https://alertadecheias.inea.rj.gov.br/radartool.php';
export const INEA_RADAR_CADENCE_MINUTES = 5;

const INEA_OFFICIAL_DOMAIN = 'inea.rj.gov.br';

export class IneaRadarContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IneaRadarContractError';
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

function iframeTags(html) {
  return [...String(html).matchAll(/<iframe\b[^>]*>/gi)].map((match) => match[0]);
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

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function extractIneaRadarViewerUrl(html) {
  const tags = iframeTags(html);
  if (tags.length < 1) throw new IneaRadarContractError('inea_radar_viewer_missing');
  if (tags.length > 4) throw new IneaRadarContractError('inea_radar_viewer_count_invalid');

  const official = [];
  for (const tag of tags) {
    const rawSrc = attributeValue(tag, 'src');
    if (!rawSrc) continue;

    let url;
    try {
      url = new URL(rawSrc, INEA_RADAR_TOOL_URL);
    } catch {
      continue;
    }

    if (url.protocol !== 'https:') continue;
    if (url.username || url.password) continue;
    if (url.port && url.port !== '443') continue;
    if (!isOfficialIneaHost(url.hostname)) continue;

    url.hash = '';
    official.push(url);
  }

  const unique = [...new Map(official.map((url) => [url.href, url])).values()];
  if (unique.length < 1) throw new IneaRadarContractError('inea_radar_viewer_url_invalid');
  if (unique.length > 1) throw new IneaRadarContractError('inea_radar_viewer_ambiguous');
  return unique[0];
}

export function validateIneaRadarToolHtml(html) {
  if (typeof html !== 'string' || html.length < 128) {
    throw new IneaRadarContractError('inea_radar_empty_html');
  }

  const text = foldText(html);
  if (!text.includes('sistema de alerta de cheias')) {
    throw new IneaRadarContractError('inea_radar_system_marker_missing');
  }
  if (!text.includes('ferramenta radar tool')) {
    throw new IneaRadarContractError('inea_radar_tool_marker_missing');
  }

  const tags = iframeTags(html);
  const viewerUrl = extractIneaRadarViewerUrl(html);
  const viewerUrlSha256 = sha256(viewerUrl.href);

  const canonical = JSON.stringify({
    sourceId: INEA_RADAR_SOURCE_ID,
    sourceHost: INEA_RADAR_HOST,
    sourceUrl: INEA_RADAR_TOOL_URL,
    radarCadenceMinutes: INEA_RADAR_CADENCE_MINUTES,
    iframeCount: tags.length,
    viewerHost: viewerUrl.hostname,
    viewerUrlSha256,
    viewerContract: 'OFFICIAL_HTTPS_IFRAME_RESOLVED',
    frameIngestion: 'NOT_IMPLEMENTED',
  });

  return Object.freeze({
    sourceId: INEA_RADAR_SOURCE_ID,
    sourceHost: INEA_RADAR_HOST,
    sourceUrl: INEA_RADAR_TOOL_URL,
    radarCadenceMinutes: INEA_RADAR_CADENCE_MINUTES,
    embeddedViewerDetected: true,
    iframeCount: tags.length,
    viewerHost: viewerUrl.hostname,
    viewerUrlSha256,
    viewerContract: 'OFFICIAL_HTTPS_IFRAME_RESOLVED',
    frameIngestion: 'NOT_IMPLEMENTED',
    gatewaySha256: sha256(canonical),
  });
}

export async function probeIneaRadarTool({ fetchImpl = globalThis.fetch } = {}) {
  let html;
  try {
    html = await fetchTextContract(INEA_RADAR_TOOL_URL, {
      allowedHosts: [INEA_RADAR_HOST],
      fetchImpl,
      timeoutMs: 8_000,
      maxBytes: 1536 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new IneaRadarContractError(`inea_radar_${error.code}`);
    }
    throw error;
  }
  return validateIneaRadarToolHtml(html);
}
