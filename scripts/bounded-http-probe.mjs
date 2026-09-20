import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const [rawUrl, rawCount, rawConcurrency] = process.argv.slice(2);
const count = Number.parseInt(rawCount ?? '', 10);
const concurrency = Number.parseInt(rawConcurrency ?? '', 10);

assert.ok(rawUrl, 'url required');
const url = new URL(rawUrl);
assert.equal(url.protocol, 'https:', 'https required');
assert.ok(url.pathname.endsWith('/healthz') || url.pathname.endsWith('/readyz'), 'only healthz/readyz allowed');
assert.equal(url.username, '', 'userinfo forbidden');
assert.equal(url.password, '', 'userinfo forbidden');
assert.equal(url.search, '', 'query forbidden');
assert.equal(url.hash, '', 'fragment forbidden');
assert.ok(Number.isInteger(count) && count >= 1 && count <= 500, 'request count must be 1..500');
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 32, 'concurrency must be 1..32');

const latencies = [];
let cursor = 0;
let ok = 0;
const started = performance.now();

async function one() {
  const t0 = performance.now();
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: 'application/json', 'User-Agent': 'blaise-scale-readiness/1.0' },
  });
  latencies.push(performance.now() - t0);
  if (response.status !== 200) throw new Error(`unexpected_status_${response.status}`);
  await response.arrayBuffer();
  ok += 1;
}

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= count) return;
    await one();
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
const elapsed = performance.now() - started;
assert.equal(ok, count);
latencies.sort((a, b) => a - b);
const percentile = (p) => Math.round(latencies[Math.min(latencies.length - 1, Math.ceil((p / 100) * latencies.length) - 1)]);
const rps = elapsed > 0 ? (count * 1000) / elapsed : count;

console.log([
  'BOUNDED_HTTP_PROBE=PASS',
  `requests=${count}`,
  `concurrency=${concurrency}`,
  `elapsed_ms=${Math.round(elapsed)}`,
  `rps=${rps.toFixed(2)}`,
  `p50_ms=${percentile(50)}`,
  `p95_ms=${percentile(95)}`,
  `p99_ms=${percentile(99)}`,
  'writes=0',
  'redirects=forbidden',
].join(' '));
