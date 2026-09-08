import { TextDecoder } from 'node:util';

export class SourceContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SourceContractError';
    this.code = code;
  }
}

export function assertPublicHttpsUrl(rawUrl, allowedHosts) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    throw new SourceContractError('source_invalid_url');
  }

  const hosts = new Set([...allowedHosts].map((host) => String(host).toLowerCase()));
  if (url.protocol !== 'https:') throw new SourceContractError('source_https_required');
  if (url.username || url.password) throw new SourceContractError('source_credentials_forbidden');
  if (url.port && url.port !== '443') throw new SourceContractError('source_nonstandard_port_forbidden');
  if (!hosts.has(url.hostname.toLowerCase())) throw new SourceContractError('source_host_not_allowed');
  return url;
}

async function readBoundedBytes(response, maxBytes, signal) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new SourceContractError('source_body_too_large');
  }
  if (!response.body) throw new SourceContractError('source_empty_body');

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw new SourceContractError('source_timeout');
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new SourceContractError('source_body_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total < 1) throw new SourceContractError('source_empty_body');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function validateFetchOptions({ allowedHosts, fetchImpl, timeoutMs, maxBytes }) {
  if (!allowedHosts || typeof allowedHosts[Symbol.iterator] !== 'function') {
    throw new SourceContractError('source_allowlist_required');
  }
  if (typeof fetchImpl !== 'function') throw new SourceContractError('source_fetch_unavailable');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 30_000) {
    throw new SourceContractError('source_invalid_timeout');
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 64 || maxBytes > 2 * 1024 * 1024) {
    throw new SourceContractError('source_invalid_body_limit');
  }
}

async function fetchContractBody(rawUrl, {
  allowedHosts,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5_000,
  maxBytes = 256 * 1024,
  accept,
  acceptsContentType,
} = {}) {
  validateFetchOptions({ allowedHosts, fetchImpl, timeoutMs, maxBytes });
  if (typeof acceptsContentType !== 'function') {
    throw new SourceContractError('source_content_type_policy_required');
  }
  const url = assertPublicHttpsUrl(rawUrl, allowedHosts);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept },
    });
  } catch {
    clearTimeout(timeout);
    if (controller.signal.aborted) throw new SourceContractError('source_timeout');
    throw new SourceContractError('source_network_error');
  }

  try {
    if (response.status >= 300 && response.status < 400) {
      throw new SourceContractError('source_redirect_rejected');
    }
    if (!response.ok) throw new SourceContractError('source_http_error');

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!acceptsContentType(contentType)) {
      throw new SourceContractError('source_content_type_rejected');
    }

    try {
      const bytes = await readBoundedBytes(response, maxBytes, controller.signal);
      return Object.freeze({ bytes, contentType });
    } catch (error) {
      if (error instanceof SourceContractError) throw error;
      if (controller.signal.aborted) throw new SourceContractError('source_timeout');
      throw new SourceContractError('source_read_error');
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchContractText(rawUrl, {
  allowedHosts,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5_000,
  maxBytes = 256 * 1024,
  accept,
  acceptsContentType,
} = {}) {
  const { bytes } = await fetchContractBody(rawUrl, {
    allowedHosts,
    fetchImpl,
    timeoutMs,
    maxBytes,
    accept,
    acceptsContentType,
  });
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new SourceContractError('source_read_error');
  }
}

export async function fetchTextContract(rawUrl, options = {}) {
  return fetchContractText(rawUrl, {
    ...options,
    accept: 'text/html,application/xhtml+xml;q=0.9',
    acceptsContentType: (contentType) => (
      contentType.includes('text/html') || contentType.includes('application/xhtml+xml')
    ),
  });
}

export async function fetchJsonContract(rawUrl, options = {}) {
  const text = await fetchContractText(rawUrl, {
    ...options,
    accept: 'application/json',
    acceptsContentType: (contentType) => (
      contentType.includes('application/json') || contentType.includes('+json')
    ),
  });

  try {
    return JSON.parse(text);
  } catch {
    throw new SourceContractError('source_invalid_json');
  }
}

export async function fetchBinaryContract(rawUrl, {
  allowedContentTypes,
  accept,
  ...options
} = {}) {
  if (!Array.isArray(allowedContentTypes) || allowedContentTypes.length < 1) {
    throw new SourceContractError('source_content_type_allowlist_required');
  }
  const accepted = [...new Set(allowedContentTypes.map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
  if (accepted.length < 1) throw new SourceContractError('source_content_type_allowlist_required');

  const result = await fetchContractBody(rawUrl, {
    ...options,
    accept: accept || accepted.join(','),
    acceptsContentType: (contentType) => {
      const mime = contentType.split(';', 1)[0].trim();
      return accepted.includes(mime);
    },
  });

  return Object.freeze({
    bytes: result.bytes,
    contentType: result.contentType.split(';', 1)[0].trim(),
  });
}
