import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoordinatedShutdown,
  createDrainingHandler,
  createGracefulShutdown,
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
    () => createCoordinatedShutdown(null, { stop() {} }),
    /invalid_server_shutdown/,
  );
  assert.throws(
    () => createCoordinatedShutdown(() => {}, null),
    /invalid_source_worker/,
  );
});
