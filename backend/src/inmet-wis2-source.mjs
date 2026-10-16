import { fetchXmlContract, fetchBinaryContract } from './source-contract.mjs';
import { validateInmetCapFeedXml, InmetSourceContractError } from './inmet-source.mjs';

export const INMET_WIS2_URL = 'https://wis2bra.inmet.gov.br/data/';
export const INMET_WIS2_HOST = 'wis2bra.inmet.gov.br';
const fail = code => { throw new InmetSourceContractError(`inmet_wis2_${code}`); };

// UTC today and yesterday cover the app's maximum 12-hour active lifetime.
// An archive window is positive evidence only, never proof of withdrawal.
export function parseWis2Listing(xml, prefix) {
  if (typeof xml !== 'string' || /<!DOCTYPE|<!ENTITY/i.test(xml)
      || !/<ListBucketResult\b/.test(xml) || !/<\/ListBucketResult>\s*$/.test(xml)
      || !/<IsTruncated>false<\/IsTruncated>/.test(xml)) fail('listing_incomplete');
  const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]);
  if (keys.length > 128 || new Set(keys).size !== keys.length) fail('listing_limit');
  for (const key of keys) {
    if (!key.startsWith(prefix) || !/^\d{4}-\d{2}-\d{2}\/wis\/urn:wmo:md:br-inmet:alerts\/INMET-[A-Z]+-\d+_\d{8}\.xml$/.test(key)) {
      fail('key_untrusted');
    }
  }
  return keys;
}
export async function probeInmetWis2Warnings({ fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const at = Number(now());
  if (!Number.isFinite(at)) fail('clock_invalid');
  const keys = [];
  for (const offset of [0, 1]) {
    const date = new Date(at - offset * 86_400_000).toISOString().slice(0, 10);
    const prefix = `${date}/wis/urn:wmo:md:br-inmet:alerts/`;
    const url = new URL(INMET_WIS2_URL);
    url.searchParams.set('prefix', prefix); url.searchParams.set('max-keys', '128');
    const xml = await fetchXmlContract(url.href, {
      allowedHosts: [INMET_WIS2_HOST], fetchImpl, timeoutMs: 10_000, maxBytes: 256 * 1024,
    });
    keys.push(...parseWis2Listing(xml, prefix));
  }
  if (!keys.length || keys.length > 128) fail('archive_empty_or_limit');
  const documents = new Array(keys.length);
  let cursor = 0, bytes = 0, failed = false;
  const deadline = Date.now() + 60_000;
  const outcomes = await Promise.allSettled(Array.from({ length: Math.min(6, keys.length) }, async () => {
    while (!failed && cursor < keys.length) {
      const i = cursor++;
      try {
        if (Date.now() > deadline) fail('deadline');
        const artifact = await fetchBinaryContract(INMET_WIS2_URL + keys[i].split('/').map(encodeURIComponent).join('/'), {
          allowedHosts: [INMET_WIS2_HOST], fetchImpl, timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024,
          allowedContentTypes: ['application/octet-stream', 'application/xml', 'text/xml', 'application/cap+xml'],
        });
        const xml = new TextDecoder('utf-8', { fatal: true }).decode(artifact.bytes);
        if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail('xml_untrusted');
        bytes += Buffer.byteLength(xml);
        if (bytes > 16 * 1024 * 1024) fail('aggregate_limit');
        // Validate every document independently before assembling its inventory.
        validateInmetCapFeedXml(xml);
        documents[i] = xml.replace(/<\?xml[^?]*\?>/gi, '');
      } catch (e) { failed = true; throw e; }
    }
  }));
  const rejected = outcomes.find(r => r.status === 'rejected');
  if (rejected) throw rejected.reason;
  const snapshot = validateInmetCapFeedXml(`<feed>${documents.join('')}</feed>`);
  return Object.freeze({ ...snapshot, sourceHost: INMET_WIS2_HOST, sourceUrl: INMET_WIS2_URL,
    feedShape: 'WIS2_ARCHIVE_WINDOW_CAP', inventoryComplete: false,
    archiveWindow: 'UTC_TODAY_AND_YESTERDAY', archiveDocumentCount: documents.length });
}
