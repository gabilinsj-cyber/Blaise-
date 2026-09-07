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

async function readBoundedBody(response, maxBytes, signal) {
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

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function fetchJsonContract(rawUrl, {
  allowedHosts,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5_000,
  maxBytes = 256 * 1024,
} = {}) {
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

  const url = assertPublicHttpsUrl(rawUrl, allowedHosts);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: 'application/json' },
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
    if (!contentType.includes('application/json') && !contentType.includes('+json')) {
      throw new SourceContractError('source_content_type_rejected');
    }

    let text;
    try {
      text = await readBoundedBody(response, maxBytes, controller.signal);
    } catch (error) {
      if (error instanceof SourceContractError) throw error;
      if (controller.signal.aborted) throw new SourceContractError('source_timeout');
      throw new SourceContractError('source_read_error');
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new SourceContractError('source_invalid_json');
    }
  } finally {
    clearTimeout(timeout);
  }
}
