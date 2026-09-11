import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createFcmGateway } from './fcm.mjs';
import { createOperationalMetrics } from './observability.mjs';
import {
  createOfficialSourceWorker,
  loadOfficialSourceWorkerConfig,
} from './official-source-worker.mjs';
import {
  createGooglePlayGateway,
  createHttpHandler,
  createRtdnReplayGuard,
  createServiceOidcVerifier,
  loadConfig,
} from './server.mjs';

const DEFAULT_SHUTDOWN_GRACE_MILLIS = 8_000;

export function createReadinessState() {
  let draining = false;
  return Object.freeze({
    isReady() {
      return !draining;
    },
    startDraining() {
      draining = true;
    },
  });
}

export function createDrainingHandler(delegate, readiness) {
  if (typeof delegate !== 'function' || !readiness || typeof readiness.isReady !== 'function') {
    throw new Error('invalid_runtime_handler_configuration');
  }

  return async (req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      return delegate(req, res);
    }

    if (req.method === 'GET' && req.url === '/readyz') {
      if (readiness.isReady()) return delegate(req, res);
      sendRuntimeJson(res, 503, { status: 'draining' });
      return;
    }

    if (!readiness.isReady()) {
      res.setHeader('Retry-After', '1');
      sendRuntimeJson(res, 503, { error: 'service_draining' });
      return;
    }

    return delegate(req, res);
  };
}

export function createOfficialSourceStatusHandler(
  delegate,
  {
    sourceWorker,
    oidcVerifier = null,
  } = {},
) {
  if (typeof delegate !== 'function') throw new Error('invalid_source_status_delegate');
  if (!sourceWorker || typeof sourceWorker.status !== 'function') {
    throw new Error('invalid_source_status_worker');
  }
  if (oidcVerifier !== null && typeof oidcVerifier !== 'function') {
    throw new Error('invalid_source_status_oidc_verifier');
  }

  return async (req, res) => {
    if (req.method !== 'GET' || req.url !== '/internal/official-sources') {
      return delegate(req, res);
    }

    if (!oidcVerifier) {
      sendRuntimeJson(res, 404, { error: 'not_found' });
      return;
    }

    if (!(await oidcVerifier(req.headers.authorization))) {
      sendRuntimeJson(res, 401, { error: 'unauthorized' });
      return;
    }

    try {
      const status = sourceWorker.status();
      if (!status || typeof status !== 'object' || Array.isArray(status)) {
        throw new Error('invalid_source_status_snapshot');
      }
      sendRuntimeJson(res, 200, status);
    } catch {
      sendRuntimeJson(res, 503, { error: 'source_status_unavailable' });
    }
  };
}

export function createGracefulShutdown(
  server,
  readiness,
  {
    graceMillis = DEFAULT_SHUTDOWN_GRACE_MILLIS,
    onFinished = () => {},
  } = {},
) {
  if (!server || typeof server.close !== 'function') throw new Error('invalid_shutdown_server');
  if (!readiness || typeof readiness.startDraining !== 'function') throw new Error('invalid_shutdown_readiness');
  if (!Number.isInteger(graceMillis) || graceMillis < 100 || graceMillis > 30_000) {
    throw new Error('invalid_shutdown_grace');
  }
  if (typeof onFinished !== 'function') throw new Error('invalid_shutdown_callback');

  let started = false;
  let finished = false;
  let forceTimer = null;

  const finish = (outcome) => {
    if (finished) return;
    finished = true;
    if (forceTimer) clearTimeout(forceTimer);
    onFinished(outcome);
  };

  return () => {
    if (started) return false;
    started = true;
    readiness.startDraining();

    forceTimer = setTimeout(() => {
      try {
        server.closeAllConnections?.();
      } finally {
        finish('forced');
      }
    }, graceMillis);
    forceTimer.unref?.();

    try {
      server.close((error) => finish(error ? 'error' : 'graceful'));
      server.closeIdleConnections?.();
    } catch {
      finish('error');
    }
    return true;
  };
}

export function createCoordinatedShutdown(serverShutdown, sourceWorker) {
  if (typeof serverShutdown !== 'function') throw new Error('invalid_server_shutdown');
  if (!sourceWorker || typeof sourceWorker.stop !== 'function') throw new Error('invalid_source_worker');
  let started = false;
  return () => {
    if (started) return false;
    started = true;
    sourceWorker.stop();
    serverShutdown();
    return true;
  };
}

function setRuntimeHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function sendRuntimeJson(res, statusCode, body) {
  setRuntimeHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function main() {
  const config = loadConfig();
  const sourceWorkerConfig = loadOfficialSourceWorkerConfig(process.env);
  const metrics = createOperationalMetrics();
  const gateway = await createGooglePlayGateway(config, {
    onRetry: () => metrics.increment('google_play_retry_total'),
  });
  const oidcVerifier = await createServiceOidcVerifier(config.pubsubAudience, config.pubsubServiceAccount);
  const p0OidcVerifier = await createServiceOidcVerifier(config.p0Audience, config.p0ServiceAccount);
  const metricsOidcVerifier = await createServiceOidcVerifier(
    config.observabilityAudience,
    config.observabilityServiceAccount,
  );
  const fcmGateway = config.firebaseProjectId
    ? await createFcmGateway(config, { onRetry: () => metrics.increment('fcm_retry_total') })
    : null;
  const replayGuard = createRtdnReplayGuard();
  const p0ReplayGuard = createRtdnReplayGuard();
  const readiness = createReadinessState();
  const sourceWorker = createOfficialSourceWorker({ config: sourceWorkerConfig });
  const coreHandler = createHttpHandler({
    config,
    gateway,
    oidcVerifier,
    fcmGateway,
    p0OidcVerifier,
    metricsOidcVerifier,
    metrics,
    replayGuard,
    p0ReplayGuard,
  });
  const operationalHandler = createOfficialSourceStatusHandler(coreHandler, {
    sourceWorker,
    oidcVerifier: metricsOidcVerifier,
  });
  const server = http.createServer(createDrainingHandler(operationalHandler, readiness));
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 5_000;

  if (sourceWorker.start()) {
    console.log(`blaise_official_source_worker_enabled:${sourceWorkerConfig.initialMode}`);
  } else {
    console.log('blaise_official_source_worker_disabled');
  }

  const serverShutdown = createGracefulShutdown(server, readiness, {
    onFinished: (outcome) => {
      console.log(`blaise_entitlement_backend_shutdown:${outcome}`);
      if (outcome !== 'graceful') process.exitCode = 1;
    },
  });
  const shutdown = createCoordinatedShutdown(serverShutdown, sourceWorker);
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`blaise_entitlement_backend_listening:${config.port}`);
  });
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch(() => {
    console.error('startup_failed');
    process.exitCode = 1;
  });
}
