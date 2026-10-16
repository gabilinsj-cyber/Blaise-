import {
  createInternalP0HttpSender,
  publishStagedInmetP0Batch,
} from './inmet-p0-publish.mjs';

const SERVICE_ACCOUNT = /^[a-z0-9][a-z0-9._-]{2,120}@[a-z0-9-]{3,120}\.iam\.gserviceaccount\.com$/;

export class InmetP0RuntimeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'InmetP0RuntimeError';
    this.code = code;
  }
}

function normalizeRootHttpsUrl(value, code) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    throw new InmetP0RuntimeError(code);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || (url.pathname !== '/' && url.pathname !== '')) {
    throw new InmetP0RuntimeError(code);
  }
  return `${url.origin}/`;
}

function extractAuthorization(headers) {
  let value = null;
  if (headers && typeof headers.get === 'function') value = headers.get('authorization');
  if (!value && headers && typeof headers === 'object') {
    value = headers.authorization ?? headers.Authorization ?? null;
  }
  if (typeof value !== 'string' || !value.startsWith('Bearer ') || value.length < 27 || value.length > 16_384) {
    throw new InmetP0RuntimeError('inmet_p0_runtime_oidc_header_invalid');
  }
  return value;
}

export function validateInmetP0RuntimeConfig({ baseUrl, audience, serviceAccount } = {}) {
  const normalizedBaseUrl = normalizeRootHttpsUrl(baseUrl, 'inmet_p0_runtime_backend_url_invalid');
  const normalizedAudience = normalizeRootHttpsUrl(audience, 'inmet_p0_runtime_audience_invalid');
  if (normalizedAudience !== normalizedBaseUrl) {
    throw new InmetP0RuntimeError('inmet_p0_runtime_audience_backend_mismatch');
  }
  const normalizedServiceAccount = String(serviceAccount ?? '').trim().toLowerCase();
  if (!SERVICE_ACCOUNT.test(normalizedServiceAccount)) {
    throw new InmetP0RuntimeError('inmet_p0_runtime_service_account_invalid');
  }
  return Object.freeze({
    baseUrl: normalizedBaseUrl,
    audience: normalizedAudience.slice(0, -1),
    serviceAccount: normalizedServiceAccount,
  });
}

async function createDefaultAuthorizationProvider(audience) {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth();
  let client;
  try {
    client = await auth.getIdTokenClient(audience);
  } catch {
    throw new InmetP0RuntimeError('inmet_p0_runtime_oidc_client_unavailable');
  }
  if (!client || typeof client.getRequestHeaders !== 'function') {
    throw new InmetP0RuntimeError('inmet_p0_runtime_oidc_client_invalid');
  }
  return async () => {
    let headers;
    try {
      headers = await client.getRequestHeaders();
    } catch {
      throw new InmetP0RuntimeError('inmet_p0_runtime_oidc_token_unavailable');
    }
    return extractAuthorization(headers);
  };
}

export async function createInmetP0RuntimePublisher({
  baseUrl,
  audience,
  serviceAccount,
  fetchImpl = globalThis.fetch,
  authorizationProvider = null,
} = {}) {
  const config = validateInmetP0RuntimeConfig({ baseUrl, audience, serviceAccount });
  if (typeof fetchImpl !== 'function') {
    throw new InmetP0RuntimeError('inmet_p0_runtime_fetch_invalid');
  }
  const getAuthorization = authorizationProvider
    ?? await createDefaultAuthorizationProvider(config.audience);
  if (typeof getAuthorization !== 'function') {
    throw new InmetP0RuntimeError('inmet_p0_runtime_authorization_provider_invalid');
  }

  return async (batch, { nowMillis = Date.now() } = {}) => publishStagedInmetP0Batch(batch, {
    nowMillis,
    sendAlert: async (alert) => {
      const authorization = await getAuthorization();
      const send = createInternalP0HttpSender({
        baseUrl: config.baseUrl,
        authorization,
        fetchImpl,
      });
      return send(alert);
    },
  });
}
