import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoordinatedShutdown,
  createDrainingHandler,
  createGracefulShutdown,
  createOfficialSourceStatusHandler,
  createReadinessState,
} from '../src/runtime.mjs';

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await callback(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function delegate(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.url === '/healthz') {
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (req.url === '/readyz') {
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ready' }));
    return;
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ accepted: true }));
}

test('draining keeps liveness but removes readiness and rejects new work', async () => {
  const readiness = createReadinessState();
  const handler = createDrainingHandler(delegate, readiness);

  await withServer(handler, async (base) => {
    const initialReady = await fetch(`${base}/readyz`);
    assert.equal(initialReady.status, 200);

    readiness.startDraining();

    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const drainingReady = await fetch(`${base}/readyz`);
    assert.equal(drainingReady.status, 503);
    assert.deepEqual(await drainingReady.json(), { status: 'draining' });

    const rejected = await fetch(`${base}/v1/entitlements/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(rejected.status, 503);
    assert.equal(rejected.headers.get('retry-after'), '1');
    assert.deepEqual(await rejected.json(), { error: 'service_draining' });
    assert.equal(rejected.headers.get('cache-control'), 'no-store');
  });
});

test('official source status is OIDC-gated, payload-redacted and delegates other routes', async () => {
  let statusReads = 0;
  const sourceWorker = {
    status() {
      statusReads += 1;
      return Object.freeze({
        contract: 'OFFICIAL_SOURCE_FAIL_CLOSED_WORKER',
        enabled: true,
        started: true,
        mode: 'normal',
        payloadRetention: 'MEMORY_ONLY_IN_SOURCE_CACHE',
        statusPayloads: 'REDACTED',
        sources: Object.freeze([
          Object.freeze({
            sourceId: 'alerta-rio-rainfall',
            state: 'CURRENT',
            payloadExposed: false,
          }),
        ]),
      });
    },
  };
  const handler = createOfficialSourceStatusHandler(delegate, {
    sourceWorker,
    oidcVerifier: async (authorization) => authorization === 'Bearer ops-ok',
  });

  await withServer(handler, async (base) => {
    const denied = await fetch(`${base}/internal/official-sources`);
    assert.equal(denied.status, 401);
    assert.deepEqual(await denied.json(), { error: 'unauthorized' });
    assert.equal(statusReads, 0);

    const accepted = await fetch(`${base}/internal/official-sources`, {
      headers: { Authorization: 'Bearer ops-ok' },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.headers.get('cache-control'), 'no-store');
    const body = await accepted.json();
    assert.equal(body.contract, 'OFFICIAL_SOURCE_FAIL_CLOSED_WORKER');
    assert.equal(body.statusPayloads, 'REDACTED');
    assert.equal(body.sources[0].payloadExposed, false);
    assert.equal(statusReads, 1);
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes('rainfallMm'), false);
    assert.equal(serialized.includes('riverLevel'), false);

    const delegated = await fetch(`${base}/healthz`);
    assert.equal(delegated.status, 200);
    assert.deepEqual(await delegated.json(), { status: 'ok' });
  });
});

test('official source status stays hidden without observability OIDC and fails closed on provider errors', async () => {
  const hidden = createOfficialSourceStatusHandler(delegate, {
    sourceWorker: { status() { return { enabled: false }; } },
  });
  await withServer(hidden, async (base) => {
    const response = await fetch(`${base}/internal/official-sources`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'not_found' });
  });

  const failing = createOfficialSourceStatusHandler(delegate, {
    sourceWorker: { status() { throw new Error('boom'); } },
    oidcVerifier: async () => true,
  });
  await withServer(failing, async (base) => {
    const response = await fetch(`${base}/internal/official-sources`, {
      headers: { Authorization: 'Bearer ops-ok' },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'source_status_unavailable' });
  });
});

test('graceful shutdown is idempotent, drains first and closes idle connections', () => {
  const readiness = createReadinessState();
  let closeCallback = null;
  let idleCloses = 0;
  let forceCloses = 0;
  const outcomes = [];
  const server = {
    close(callback) {
      closeCallback = callback;
    },
    closeIdleConnections() {
      idleCloses += 1;
    },
    closeAllConnections() {
      forceCloses += 1;
    },
  };

  const shutdown = createGracefulShutdown(server, readiness, {
    graceMillis: 1_000,
    onFinished: (outcome) => outcomes.push(outcome),
  });

  assert.equal(shutdown(), true);
  assert.equal(readiness.isReady(), false);
  assert.equal(idleCloses, 1);
  assert.equal(shutdown(), false);
  assert.equal(typeof closeCallback, 'function');

  closeCallback();
  assert.deepEqual(outcomes, ['graceful']);
  assert.equal(forceCloses, 0);
});

test('coordinated shutdown stops source polling before server drain and is idempotent', () => {
  const order = [];
  const sourceWorker = {
    stop() {
      order.push('source-worker-stop');
      return true;
    },
  };
  const serverShutdown = () => {
    order.push('server-shutdown');
    return true;
  };

  const shutdown = createCoordinatedShutdown(serverShutdown, sourceWorker);
  assert.equal(shutdown(), true);
  assert.deepEqual(order, ['source-worker-stop', 'server-shutdown']);
  assert.equal(shutdown(), false);
  assert.deepEqual(order, ['source-worker-stop', 'server-shutdown']);
});

test('graceful shutdown configuration fails closed', () => {
  const readiness = createReadinessState();
  const server = { close() {} };
  assert.throws(
    () => createGracefulShutdown(server, readiness, { graceMillis: 99 }),
    /invalid_shutdown_grace/,
  );
  assert.throws(
    () => createDrainingHandler(null, readiness),
    /invalid_runtime_handler_configuration/,
  );
  assert.throws(
    () => createOfficialSourceStatusHandler(null, { sourceWorker: { status() {} } }),
    /invalid_source_status_delegate/,
  );
  assert.throws(
    () => createOfficialSourceStatusHandler(delegate, { sourceWorker: null }),
    /invalid_source_status_worker/,
  );
  assert.throws(
    () => createOfficialSourceStatusHandler(delegate, {
      sourceWorker: { status() {} },
      oidcVerifier: 'bad',
    }),
    /invalid_source_status_oidc_verifier/,
  );
  assert.throws(
    () => createCoordinatedShutdown(null, { stop() {} }),
    /invalid_server_shutdown/,
  );
  assert.throws(
    () => createCoordinatedShutdown(() => {}, null),
    /invalid_source_worker/,
  );
});
