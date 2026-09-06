import { ClientInputError } from './core.mjs';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
export const DEFAULT_P0_TOPIC = 'blaise-rj-p0';
const MAX_EVENT_SECONDS = 24 * 60 * 60;
const FUTURE_SKEW_MILLIS = 5 * 60 * 1000;

export function buildP0TopicMessage(alert, config, nowMillis = Date.now()) {
  if (!config?.firebaseProjectId) throw new Error('fcm_not_configured');
  const normalized = validateP0Alert(alert, nowMillis);
  const topic = (config.fcmP0Topic || DEFAULT_P0_TOPIC).trim();
  if (!/^[A-Za-z0-9-_.~%]{1,900}$/.test(topic)) throw new Error('invalid_fcm_topic');

  const ttlSeconds = Math.max(
    1,
    Math.min(MAX_EVENT_SECONDS, Math.ceil((normalized.expiresMillis - nowMillis) / 1000)),
  );
  const data = {
    schemaVersion: '1',
    eventType: 'p0_official_alert',
    authority: 'official',
    severity: 'P0',
    alertId: normalized.id,
    title: normalized.title,
    source: normalized.source,
    issuedAt: normalized.issuedAt,
    expiresAt: normalized.expiresAt,
  };
  if (normalized.cityName) {
    data.cityName = normalized.cityName;
    data.cityIbge = normalized.cityIbge;
  }

  return {
    message: {
      topic,
      android: {
        priority: 'high',
        ttl: `${ttlSeconds}s`,
      },
      data,
    },
  };
}

export async function createFcmGateway(config) {
  if (!config?.firebaseProjectId) throw new Error('fcm_not_configured');
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: [FCM_SCOPE] });
  let clientPromise;
  const authClient = () => (clientPromise ??= auth.getClient());
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.firebaseProjectId)}/messages:send`;

  return {
    async publishOfficialP0(alert) {
      const client = await authClient();
      const body = buildP0TopicMessage(alert, config);
      try {
        const response = await client.request({
          url: endpoint,
          method: 'POST',
          data: body,
          timeout: 7_000,
        });
        return typeof response.data?.name === 'string' ? response.data.name : 'accepted';
      } catch {
        throw new Error('fcm_publish_failed');
      }
    },
  };
}

function validateP0Alert(alert, nowMillis) {
  if (!alert || typeof alert !== 'object' || Array.isArray(alert)) {
    throw new ClientInputError('invalid_p0_alert');
  }
  if (alert.authority !== 'official' || alert.severity !== 'P0') {
    throw new ClientInputError('p0_not_official');
  }

  const id = boundedString(alert.id, 256, 'invalid_p0_id');
  const title = boundedString(alert.title, 180, 'invalid_p0_title');
  const source = boundedString(alert.source, 120, 'invalid_p0_source');
  const issuedAt = boundedString(alert.issuedAt, 64, 'invalid_p0_issued_at');
  const expiresAt = boundedString(alert.expiresAt, 64, 'invalid_p0_expires_at');
  const issuedMillis = Date.parse(issuedAt);
  const expiresMillis = Date.parse(expiresAt);
  if (!Number.isFinite(issuedMillis) || !Number.isFinite(expiresMillis)) {
    throw new ClientInputError('invalid_p0_time');
  }
  if (issuedMillis > nowMillis + FUTURE_SKEW_MILLIS) throw new ClientInputError('p0_future_issued_at');
  if (expiresMillis <= nowMillis || expiresMillis <= issuedMillis) throw new ClientInputError('p0_expired');
  if (expiresMillis - issuedMillis > MAX_EVENT_SECONDS * 1000) throw new ClientInputError('p0_validity_too_long');

  let cityName = '';
  let cityIbge = '';
  if (alert.cityName != null || alert.cityIbge != null) {
    cityName = boundedString(alert.cityName, 120, 'invalid_p0_city_name');
    cityIbge = String(alert.cityIbge || '').trim();
    if (!/^33\d{5}$/.test(cityIbge)) throw new ClientInputError('invalid_p0_city_ibge');
  }

  return { id, title, source, issuedAt, expiresAt, issuedMillis, expiresMillis, cityName, cityIbge };
}

function boundedString(value, max, errorCode) {
  if (typeof value !== 'string') throw new ClientInputError(errorCode);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new ClientInputError(errorCode);
  return trimmed;
}
