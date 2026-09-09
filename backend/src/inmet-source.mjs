import { createHash } from 'node:crypto';

import { findRjMunicipality } from './rio-municipalities.mjs';
import { fetchXmlContract, SourceContractError } from './source-contract.mjs';

export const INMET_SOURCE_ID = 'inmet-cap-warnings';
export const INMET_HOST = 'apiprevmet3.inmet.gov.br';
export const INMET_CAP_RSS_URL = 'https://apiprevmet3.inmet.gov.br/avisos/rss';
export const INMET_MAX_WARNING_RECORDS = 128;

const CAP_SEVERITIES = new Set(['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown']);
const CAP_URGENCIES = new Set(['Immediate', 'Expected', 'Future', 'Past', 'Unknown']);
const CAP_CERTAINTIES = new Set(['Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown']);
const CAP_MESSAGE_TYPES = new Set(['Alert', 'Update']);

export class InmetSourceContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'InmetSourceContractError';
    this.code = code;
  }
}

function decodeXml(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (match, raw) => {
      const point = Number.parseInt(raw, 16);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    })
    .replace(/&#(\d+);/g, (match, raw) => {
      const point = Number(raw);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    });
}

function tagPattern(tag, flags = 'i') {
  const escaped = String(tag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}\\s*>`, flags);
}

function tagBlocks(xml, tag) {
  return [...String(xml).matchAll(tagPattern(tag, 'gi'))].map((match) => match[1]);
}

function tagText(xml, tag) {
  const match = tagPattern(tag).exec(String(xml));
  if (!match) return null;
  return decodeXml(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function requiredText(xml, tag, code, maxLength = 4096) {
  const value = tagText(xml, tag);
  if (!value || value.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new InmetSourceContractError(code);
  }
  return value;
}

function parseCapDate(value, code) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new InmetSourceContractError(code);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new InmetSourceContractError(code);
  return parsed.toISOString();
}

function fold(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function normalizeRjScopeFromAreas(areaBlocks) {
  const municipalityIbges = new Set();
  let hasStateGeocode = false;
  let hasAreaDescription = false;

  for (const areaBlock of areaBlocks) {
    for (const geocode of tagBlocks(areaBlock, 'geocode')) {
      for (const valueBlock of tagBlocks(geocode, 'value')) {
        const value = decodeXml(valueBlock).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        for (const match of value.matchAll(/\b33\d{5}\b/g)) {
          const ibge = match[0];
          if (!findRjMunicipality(ibge)) {
            throw new InmetSourceContractError('inmet_rj_municipality_ibge_untrusted');
          }
          municipalityIbges.add(ibge);
        }
        if (/(?:^|[\s,;])BR-RJ(?:$|[\s,;])/i.test(value)) hasStateGeocode = true;
      }
    }
    const areaDesc = tagText(areaBlock, 'areaDesc');
    if (areaDesc && fold(areaDesc).includes('rio de janeiro')) hasAreaDescription = true;
  }

  const rjMunicipalityIbges = Object.freeze([...municipalityIbges].sort());
  if (rjMunicipalityIbges.length > 0) {
    return Object.freeze({ rjMatchMethod: 'CAP_GEOCODE_IBGE_33', rjMunicipalityIbges });
  }
  if (hasStateGeocode) {
    return Object.freeze({ rjMatchMethod: 'CAP_GEOCODE_BR_RJ', rjMunicipalityIbges });
  }
  if (hasAreaDescription) {
    return Object.freeze({ rjMatchMethod: 'CAP_AREA_DESC_RIO_DE_JANEIRO', rjMunicipalityIbges });
  }
  return Object.freeze({ rjMatchMethod: null, rjMunicipalityIbges });
}

function normalizeAreaDescriptions(areaBlocks) {
  return Object.freeze(areaBlocks.map((areaBlock) => requiredText(
    areaBlock,
    'areaDesc',
    'inmet_area_desc_missing',
    16_384,
  )));
}

function normalizeRecord(block) {
  const infoBlocks = tagBlocks(block, 'info');
  const info = infoBlocks[0] ?? block;
  const areaBlocks = tagBlocks(info, 'area');
  if (areaBlocks.length < 1 || areaBlocks.length > 64) {
    throw new InmetSourceContractError('inmet_area_count_invalid');
  }

  const identifier = requiredText(block, 'identifier', 'inmet_identifier_missing', 256);
  const sender = requiredText(block, 'sender', 'inmet_sender_missing', 256);
  if (!/@inmet\.gov\.br$/i.test(sender)) throw new InmetSourceContractError('inmet_sender_untrusted');
  if (!identifier.startsWith('urn:oid:2.49.0.0.76.0.')) {
    throw new InmetSourceContractError('inmet_identifier_untrusted');
  }

  const status = requiredText(block, 'status', 'inmet_status_missing', 32);
  if (status !== 'Actual') throw new InmetSourceContractError('inmet_status_not_actual');
  const msgType = requiredText(block, 'msgType', 'inmet_msg_type_missing', 32);
  if (!CAP_MESSAGE_TYPES.has(msgType)) throw new InmetSourceContractError('inmet_msg_type_invalid');

  const sent = parseCapDate(requiredText(block, 'sent', 'inmet_sent_missing', 64), 'inmet_sent_invalid');
  const event = requiredText(info, 'event', 'inmet_event_missing', 160);
  const urgency = requiredText(info, 'urgency', 'inmet_urgency_missing', 32);
  if (!CAP_URGENCIES.has(urgency)) throw new InmetSourceContractError('inmet_urgency_invalid');
  const severity = requiredText(info, 'severity', 'inmet_severity_missing', 32);
  if (!CAP_SEVERITIES.has(severity)) throw new InmetSourceContractError('inmet_severity_invalid');
  const certainty = requiredText(info, 'certainty', 'inmet_certainty_missing', 32);
  if (!CAP_CERTAINTIES.has(certainty)) throw new InmetSourceContractError('inmet_certainty_invalid');
  const onset = parseCapDate(requiredText(info, 'onset', 'inmet_onset_missing', 64), 'inmet_onset_invalid');
  const expires = parseCapDate(requiredText(info, 'expires', 'inmet_expires_missing', 64), 'inmet_expires_invalid');

  const onsetMs = Date.parse(onset);
  const expiresMs = Date.parse(expires);
  if (expiresMs <= onsetMs) throw new InmetSourceContractError('inmet_temporal_order_invalid');
  if (expiresMs - onsetMs > 7 * 24 * 60 * 60 * 1000) {
    throw new InmetSourceContractError('inmet_temporal_window_too_large');
  }

  const areaDescriptions = normalizeAreaDescriptions(areaBlocks);
  const { rjMatchMethod, rjMunicipalityIbges } = normalizeRjScopeFromAreas(areaBlocks);

  return Object.freeze({
    identifier,
    sender,
    sent,
    status,
    msgType,
    event,
    urgency,
    severity,
    certainty,
    onset,
    expires,
    areaCount: areaBlocks.length,
    areaDescriptions,
    affectsRioDeJaneiro: Boolean(rjMatchMethod),
    rjMatchMethod,
    rjMunicipalityIbges,
  });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function validateInmetCapFeedXml(xml) {
  if (typeof xml !== 'string' || xml.length < 128) {
    throw new InmetSourceContractError('inmet_feed_empty_xml');
  }

  let blocks = tagBlocks(xml, 'alert');
  let feedShape = 'CAP_ALERT';
  if (blocks.length < 1) {
    blocks = tagBlocks(xml, 'item');
    feedShape = 'RSS_ITEM';
  }
  if (blocks.length < 1) {
    blocks = tagBlocks(xml, 'entry');
    feedShape = 'ATOM_ENTRY';
  }
  if (blocks.length < 1) throw new InmetSourceContractError('inmet_feed_records_missing');
  if (blocks.length > INMET_MAX_WARNING_RECORDS) {
    throw new InmetSourceContractError('inmet_feed_record_count_invalid');
  }

  const records = blocks.map(normalizeRecord);
  const identifiers = new Set();
  for (const record of records) {
    if (identifiers.has(record.identifier)) throw new InmetSourceContractError('inmet_duplicate_identifier');
    identifiers.add(record.identifier);
  }

  records.sort((a, b) => a.sent.localeCompare(b.sent) || a.identifier.localeCompare(b.identifier));
  const rjWarnings = records.filter((record) => record.affectsRioDeJaneiro);
  const canonical = records.map((record) => ({
    identifier: record.identifier,
    sent: record.sent,
    event: record.event,
    urgency: record.urgency,
    severity: record.severity,
    certainty: record.certainty,
    onset: record.onset,
    expires: record.expires,
    areaDescriptions: record.areaDescriptions,
    rjMatchMethod: record.rjMatchMethod,
    rjMunicipalityIbges: record.rjMunicipalityIbges,
  }));

  return Object.freeze({
    sourceId: INMET_SOURCE_ID,
    sourceHost: INMET_HOST,
    sourceUrl: INMET_CAP_RSS_URL,
    feedShape,
    activeWarningCount: records.length,
    rjWarningCount: rjWarnings.length,
    warnings: Object.freeze(records),
    rjWarnings: Object.freeze(rjWarnings),
    warningInventorySha256: sha256(JSON.stringify(canonical)),
    identityValidation: 'INMET_SENDER_DOMAIN+OFFICIAL_OID_PREFIX',
    temporalValidityValidation: 'BOUNDED_CAP_ONSET_EXPIRES_MAX_7D',
    rjGeofenceValidation: 'CAP_CANONICAL_IBGE33_OR_BR_RJ_OR_AREA_DESC',
    polygonRetention: 'NONE',
    rawFeedRetention: 'NONE',
  });
}

export async function probeInmetCapWarnings({ fetchImpl = globalThis.fetch } = {}) {
  let xml;
  try {
    xml = await fetchXmlContract(INMET_CAP_RSS_URL, {
      allowedHosts: [INMET_HOST],
      fetchImpl,
      timeoutMs: 8_000,
      maxBytes: 2 * 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof SourceContractError) {
      throw new InmetSourceContractError(`inmet_${error.code}`);
    }
    throw error;
  }
  return validateInmetCapFeedXml(xml);
}
