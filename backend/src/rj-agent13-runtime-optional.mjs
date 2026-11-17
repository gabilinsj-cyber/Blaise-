/**
 * Optional, fail-closed runtime binding for the recovered Agente 13.
 *
 * No outbound provider call, job, local fallback, or Firestore write occurs
 * during initialization. The operator must explicitly approve the subscription,
 * enable the agent and enable a shared Firestore quota/cache in production.
 *
 * The caller must inject a server-side database factory, not a Firebase mobile
 * SDK. No credential, URL with appid, or user location is logged or exposed.
 */
import { createRjOpenWeatherAgent13Service } from './rj-openweather-agent13-service.mjs';

export const AGENT13_RUNTIME_DISABLED = 'DISABLED';
const unavailable = reason => Object.freeze({
  status: 'UNAVAILABLE',
  reason,
  weather: null,
  officialObservation: false,
  officialAlert: false,
});

export async function initializeOptionalAgent13Runtime({
  env = {},
  createDatabase = null,
  clock = () => Date.now(),
  fetchImpl = globalThis.fetch,
} = {}) {
  const disabled = Object.freeze({
    state: AGENT13_RUNTIME_DISABLED,
    configured: false,
    automaticSchedulingEnabled: false,
    publishedToAndroid: false,
    collect: async () => unavailable('AGENT13_NOT_ENABLED'),
    temperatureContingencyConfigured: false,
    collectTemperatureContingency: async () => unavailable('THERMAL_CONTINGENCY_DISABLED'),
  });

  if (env?.BLAISE_OPENWEATHER_AGENT13_ENABLED !== 'true') return disabled;
  if (env.BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED !== 'true' ||
      env.BLAISE_AGENT13_FIRESTORE_ENABLED !== 'true') {
    return Object.freeze({
      ...disabled,
      state: 'APPROVAL_OR_SHARED_STORE_REQUIRED',
    });
  }
  if (!/^[a-f0-9]{32}$/i.test(env.BLAISE_OPENWEATHER_API_KEY || '')) {
    return Object.freeze({
      ...disabled,
      state: 'SERVER_SECRET_REQUIRED',
    });
  }
  const projectId = env.BLAISE_AGENT13_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || '';
  if (typeof projectId !== 'string' ||
      !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) {
    return Object.freeze({
      ...disabled,
      state: 'PROJECT_NOT_CONFIGURED',
    });
  }
  if (typeof createDatabase !== 'function') {
    return Object.freeze({
      ...disabled,
      state: 'DATABASE_FACTORY_REQUIRED',
    });
  }
  try {
    const database = await createDatabase({ projectId });
    const service = createRjOpenWeatherAgent13Service({
      env,
      database,
      clock,
      fetchImpl,
    });
    if (!service.configured) {
      return Object.freeze({
        ...disabled,
        state: 'SHARED_STORE_UNAVAILABLE',
      });
    }
    return Object.freeze({
      state: 'READY_FOR_EXPLICIT_CALL',
      configured: true,
      automaticSchedulingEnabled: false,
      publishedToAndroid: false,
      collect: async ({ target, now } = {}) =>
        service.collect({ target, now }),
      temperatureContingencyConfigured: service.temperatureContingencyConfigured,
      // This method has no public HTTP route and will only run after
      // independent authoritative three-source auditing is integrated.
      collectTemperatureContingency: async ({municipalityIbge,prioritySources}={}) =>
        service.collectTemperatureContingency({municipalityIbge,prioritySources}),
    });
  } catch {
    // Never log Firestore errors (potentially containing internal details).
    return Object.freeze({
      ...disabled,
      state: 'DATABASE_INITIALIZATION_FAILED',
    });
  }
}
