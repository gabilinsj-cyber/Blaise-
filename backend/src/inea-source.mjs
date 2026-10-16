import { createHash } from 'node:crypto';

import { assertPublicHttpsUrl, fetchTextContract, SourceContractError } from './source-contract.mjs';

export const INEA_DISCOVERY_SOURCE_ID = 'inea-hydromet-discovery';
export const INEA_STATION_SOURCE_ID = 'inea-hydromet-station';
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
      .replace(/<(?:br|\/p|\/div|\/td|\/th|\/tr|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function foldText(html) {
  return plainText(html)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
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

function assertIneaStationUrl(rawUrl) {
  let url;
  try {
    url = assertPublicHttpsUrl(rawUrl, [INEA_ALERT_HOST]);
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new IneaSourceContractError(`inea_station_${error.code}`);
    }
    throw error;
  }
  if (url.search || url.hash) throw new IneaSourceContractError('inea_station_query_or_fragment_forbidden');
  const match = url.pathname.match(/^\/alertadecheias\/(\d{8,20})\.html$/);
  if (!match) throw new IneaSourceContractError('inea_station_path_rejected');
  return { url, stationId: match[1] };
}

function parseNullableNumber(raw, { code, max }) {
  const normalized = String(raw).trim();
  if (/^(?:dado\s+nulo|nd|n\/a|--|-)$/i.test(normalized)) return null;
  const value = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new IneaSourceContractError(code);
  }
  return value;
}

function extractNullableNumber(text, pattern, { code, max, requiredLabel = true }) {
  const match = text.match(pattern);
  if (!match) {
    if (requiredLabel) throw new IneaSourceContractError(code);
    return null;
  }
  return parseNullableNumber(match[1], { code, max });
}

function validateDate(raw) {
  const match = String(raw).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) throw new IneaSourceContractError('inea_station_invalid_date');
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new IneaSourceContractError('inea_station_invalid_date');
  }
  return raw;
}

function validateTime(raw) {
  const match = String(raw).match(/^(\d{2}):(\d{2})$/);
  if (!match) throw new IneaSourceContractError('inea_station_invalid_time');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new IneaSourceContractError('inea_station_invalid_time');
  return raw;
}

export function validateIneaStationSnapshotHtml(html, { stationUrl } = {}) {
  if (typeof html !== 'string' || html.length < 256) {
    throw new IneaSourceContractError('inea_station_empty_html');
  }
  const { url, stationId } = assertIneaStationUrl(stationUrl);
  const text = plainText(html);
  const folded = foldText(html);

  if (!folded.includes('dados dos ultimos 10 dias')) {
    throw new IneaSourceContractError('inea_station_history_marker_missing');
  }
  if (!folded.includes('chuva acumulada ultimos 15 min')) {
    throw new IneaSourceContractError('inea_station_rainfall_marker_missing');
  }

  const stationNameMatch = text.match(/Dados\s+dos\s+[ÚU]ltimos\s+10\s+Dias:\s*(.{2,120}?)(?=\s+Exportar\s+para|\s+Data\s+e\s+Hora|$)/i);
  if (!stationNameMatch) throw new IneaSourceContractError('inea_station_name_missing');
  const stationName = stationNameMatch[1].trim();
  if (!stationName || /[\u0000-\u001f\u007f]/.test(stationName)) {
    throw new IneaSourceContractError('inea_station_name_invalid');
  }

  const dateMatch = text.match(/\bData\s+(\d{2}\/\d{2}\/\d{4})\b/i);
  const timeMatch = text.match(/\bHora\s+(\d{2}:\d{2})\b/i);
  if (!dateMatch) throw new IneaSourceContractError('inea_station_date_missing');
  if (!timeMatch) throw new IneaSourceContractError('inea_station_time_missing');
  const observedDate = validateDate(dateMatch[1]);
  const observedTime = validateTime(timeMatch[1]);

  const token = '([0-9]+(?:[.,][0-9]+)?|Dado\\s+Nulo|ND|N\\/A|--|-)';
  const rainfall15mMm = extractNullableNumber(
    text,
    new RegExp(`Chuva\\s+Acumulada\\s+[ÚU]ltimos\\s+15\\s*min\\s+${token}`, 'i'),
    { code: 'inea_station_invalid_rain15m', max: 500 },
  );
  if (rainfall15mMm === null) throw new IneaSourceContractError('inea_station_latest_rainfall_missing');

  const rainfall1hMm = extractNullableNumber(
    text,
    new RegExp(`Chuva\\s+Acumulada\\s+[ÚU]ltima\\s+1h\\s+${token}`, 'i'),
    { code: 'inea_station_invalid_rain1h', max: 1_000 },
  );
  const rainfall4hMm = extractNullableNumber(
    text,
    new RegExp(`Chuva\\s+Acumulada\\s+[ÚU]ltimas\\s+4h\\s+${token}`, 'i'),
    { code: 'inea_station_invalid_rain4h', max: 2_000 },
  );
  const rainfall24hMm = extractNullableNumber(
    text,
    new RegExp(`Chuva\\s+Acumulada\\s+[ÚU]ltimas\\s+24h\\s+${token}`, 'i'),
    { code: 'inea_station_invalid_rain24h', max: 5_000 },
  );
  const rainfall96hMm = extractNullableNumber(
    text,
    new RegExp(`Chuva\\s+Acumulada\\s+[ÚU]ltimas\\s+96h\\s+${token}`, 'i'),
    { code: 'inea_station_invalid_rain96h', max: 10_000 },
  );

  const riverLevelM = extractNullableNumber(
    text,
    new RegExp(`N[íi]vel\\s+as:\\s*\\d{2}:\\d{2}\\s+${token}`, 'i'),
    { code: 'inea_station_invalid_river_level', max: 100, requiredLabel: false },
  );
  const overflowLevelM = extractNullableNumber(
    text,
    /Cota\s+de\s+transbordamento\s+([0-9]+(?:[.,][0-9]+)?)\s*m\b/i,
    { code: 'inea_station_invalid_overflow_level', max: 100, requiredLabel: false },
  );
  const overflowPercent = extractNullableNumber(
    text,
    /Porcentagem\s+sobre\s+a\s+cota\.?\s+([0-9]+(?:[.,][0-9]+)?)\s*%/i,
    { code: 'inea_station_invalid_overflow_percent', max: 5_000, requiredLabel: false },
  );

  const rainfall = Object.freeze({
    last15mMm: rainfall15mMm,
    last1hMm: rainfall1hMm,
    last4hMm: rainfall4hMm,
    last24hMm: rainfall24hMm,
    last96hMm: rainfall96hMm,
  });
  const missingValueCount = Object.values(rainfall).filter((value) => value === null).length
    + [riverLevelM, overflowLevelM, overflowPercent].filter((value) => value === null).length;

  const canonical = JSON.stringify({
    sourceId: INEA_STATION_SOURCE_ID,
    sourceHost: INEA_ALERT_HOST,
    stationId,
    stationName,
    observedDate,
    observedTime,
    timezone: 'America/Sao_Paulo',
    rainfall,
    riverLevelM,
    overflowLevelM,
    overflowPercent,
  });

  return Object.freeze({
    sourceId: INEA_STATION_SOURCE_ID,
    sourceHost: INEA_ALERT_HOST,
    sourceUrl: url.toString(),
    stationId,
    stationName,
    observedDate,
    observedTime,
    timezone: 'America/Sao_Paulo',
    telemetryCadenceMinutes: INEA_TELEMETRY_CADENCE_MINUTES,
    rainfall,
    riverLevelM,
    overflowLevelM,
    overflowPercent,
    missingValueCount,
    snapshotSha256: createHash('sha256').update(canonical).digest('hex'),
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

export async function probeIneaStationSnapshot({ stationUrl, fetchImpl = globalThis.fetch } = {}) {
  const { url } = assertIneaStationUrl(stationUrl);
  let html;
  try {
    html = await fetchTextContract(url.toString(), {
      allowedHosts: [INEA_ALERT_HOST],
      fetchImpl,
      timeoutMs: 8_000,
      maxBytes: 1536 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new IneaSourceContractError(`inea_station_${error.code}`);
    }
    throw error;
  }
  return validateIneaStationSnapshotHtml(html, { stationUrl: url.toString() });
}
