import { createHash } from 'node:crypto';

import { assertPublicHttpsUrl, fetchTextContract, SourceContractError } from './source-contract.mjs';

export const INEA_DISCOVERY_SOURCE_ID = 'inea-hydromet-discovery';
export const INEA_DISCOVERY_HOST = 'www.inea.rj.gov.br';
export const INEA_ALERT_HOST = 'alertadecheias.inea.rj.gov.br';
export const INEA_DISCOVERY_URL = 'https://www.inea.rj.gov.br/ar-agua-e-solo/monitoramento-hidrometeorologico/';
export const INEA_TELEMETRY_CADENCE_MINUTES = 15;
export const INEA_RADAR_CADENCE_MINUTES = 5;

export class IneaSourceContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IneaSourceContractError';
    this.code = code;
  }
}

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
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
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectOfficialLinks(html) {
  const links = [];
  for (const match of String(html).matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const href = decodeEntities(match[1]).trim();
    if (!href) continue;
    let url;
    try {
      url = new URL(href, INEA_DISCOVERY_URL);
    } catch {
      continue;
    }
    if (url.hostname.toLowerCase() !== INEA_ALERT_HOST) continue;
    try {
      assertPublicHttpsUrl(url.toString(), [INEA_ALERT_HOST]);
    } catch (error) {
      if (error instanceof SourceContractError) {
        throw new IneaSourceContractError(`inea_alert_${error.code}`);
      }
      throw error;
    }
    links.push(url);
  }
  return links;
}

export function validateIneaHydrometDiscoveryHtml(html) {
  if (typeof html !== 'string' || html.length < 256) {
    throw new IneaSourceContractError('inea_discovery_empty_html');
  }

  const text = foldText(html);
  const requiredMarkers = [
    ['monitoramento hidrometeorologico', 'inea_discovery_title_missing'],
    ['pouco mais de 100 estacoes automaticas', 'inea_station_network_marker_missing'],
    ['registros a cada 15 minutos', 'inea_telemetry_cadence_marker_missing'],
    ['rede de radares meteorologicos', 'inea_radar_network_marker_missing'],
    ['a cada cinco minutos', 'inea_radar_cadence_marker_missing'],
  ];
  for (const [marker, errorCode] of requiredMarkers) {
    if (!text.includes(marker)) throw new IneaSourceContractError(errorCode);
  }

  const links = collectOfficialLinks(html);
  const dataPage = links.find((url) => url.pathname.toLowerCase().endsWith('/dados.php'));
  const radarPage = links.find((url) => url.pathname.toLowerCase().endsWith('/radar.php'));
  if (!dataPage) throw new IneaSourceContractError('inea_data_link_missing');
  if (!radarPage) throw new IneaSourceContractError('inea_radar_link_missing');

  const canonical = JSON.stringify({
    sourceId: INEA_DISCOVERY_SOURCE_ID,
    sourceHost: INEA_DISCOVERY_HOST,
    alertHost: INEA_ALERT_HOST,
    telemetryCadenceMinutes: INEA_TELEMETRY_CADENCE_MINUTES,
    radarCadenceMinutes: INEA_RADAR_CADENCE_MINUTES,
    dataPageUrl: dataPage.toString(),
    radarPageUrl: radarPage.toString(),
  });

  return Object.freeze({
    sourceId: INEA_DISCOVERY_SOURCE_ID,
    sourceHost: INEA_DISCOVERY_HOST,
    alertHost: INEA_ALERT_HOST,
    telemetryCadenceMinutes: INEA_TELEMETRY_CADENCE_MINUTES,
    radarCadenceMinutes: INEA_RADAR_CADENCE_MINUTES,
    dataPageUrl: dataPage.toString(),
    radarPageUrl: radarPage.toString(),
    discoverySha256: createHash('sha256').update(canonical).digest('hex'),
  });
}

export async function probeIneaHydrometDiscovery({ fetchImpl = globalThis.fetch } = {}) {
  let html;
  try {
    html = await fetchTextContract(INEA_DISCOVERY_URL, {
      allowedHosts: [INEA_DISCOVERY_HOST],
      fetchImpl,
      timeoutMs: 7_000,
      maxBytes: 768 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new IneaSourceContractError(`inea_discovery_${error.code}`);
    }
    throw error;
  }
  return validateIneaHydrometDiscoveryHtml(html);
}
