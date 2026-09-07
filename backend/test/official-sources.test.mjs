import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALERTA_RIO_EXPECTED_ACTIVE_STATIONS,
  ALERTA_RIO_HOST,
  ALERTA_RIO_STATIONS_QUERY_URL,
  probeAlertaRioStationCatalog,
  validateAlertaRioStationCatalog,
} from '../src/alerta-rio-source.mjs';
import { fetchJsonContract } from '../src/source-contract.mjs';

function stationPayload(count = ALERTA_RIO_EXPECTED_ACTIVE_STATIONS) {
  return {
    features: Array.from({ length: count }, (_, index) => ({
      attributes: { cod: index + 1, est: `Estacao ${String(index + 1).padStart(2, '0')}` },
    })),
  };
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

test('Alerta Rio query is pinned to the official HTTPS host and minimum fields', () => {
  const url = new URL(ALERTA_RIO_STATIONS_QUERY_URL);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, ALERTA_RIO_HOST);
  assert.equal(url.searchParams.get('outFields'), 'cod,est');
  assert.equal(url.searchParams.get('returnGeometry'), 'false');
  assert.equal(url.searchParams.get('f'), 'json');
});

test('valid 33-station Alerta Rio catalog passes with deterministic digest', () => {
  const first = validateAlertaRioStationCatalog(stationPayload());
  const second = validateAlertaRioStationCatalog(stationPayload());
  assert.equal(first.stationCount, 33);
  assert.match(first.catalogSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.catalogSha256, second.catalogSha256);
});

test('live probe adapter accepts a valid mocked official response', async () => {
  const result = await probeAlertaRioStationCatalog({
    fetchImpl: async (url, options) => {
      assert.equal(url.hostname, ALERTA_RIO_HOST);
      assert.equal(options.redirect, 'manual');
      return jsonResponse(stationPayload());
    },
  });
  assert.equal(result.stationCount, 33);
});

test('station count drift fails closed', () => {
  assert.throws(
    () => validateAlertaRioStationCatalog(stationPayload(32)),
    (error) => error.code === 'alerta_rio_station_count_drift',
  );
});

test('duplicate station code fails closed', () => {
  const payload = stationPayload();
  payload.features[1].attributes.cod = payload.features[0].attributes.cod;
  assert.throws(
    () => validateAlertaRioStationCatalog(payload),
    (error) => error.code === 'alerta_rio_duplicate_station_code',
  );
});

test('HTTP source contract rejects non-HTTPS and unapproved hosts before fetch', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return jsonResponse({});
  };
  await assert.rejects(
    fetchJsonContract('http://pgeo3.rio.rj.gov.br/data', { allowedHosts: [ALERTA_RIO_HOST], fetchImpl }),
    (error) => error.code === 'source_https_required',
  );
  await assert.rejects(
    fetchJsonContract('https://example.com/data', { allowedHosts: [ALERTA_RIO_HOST], fetchImpl }),
    (error) => error.code === 'source_host_not_allowed',
  );
  assert.equal(called, false);
});

test('HTTP source contract rejects redirects and non-JSON responses', async () => {
  await assert.rejects(
    fetchJsonContract(ALERTA_RIO_STATIONS_QUERY_URL, {
      allowedHosts: [ALERTA_RIO_HOST],
      fetchImpl: async () => new Response('', { status: 302, headers: { location: 'https://example.com' } }),
    }),
    (error) => error.code === 'source_redirect_rejected',
  );

  await assert.rejects(
    fetchJsonContract(ALERTA_RIO_STATIONS_QUERY_URL, {
      allowedHosts: [ALERTA_RIO_HOST],
      fetchImpl: async () => new Response('not-json', { status: 200, headers: { 'content-type': 'text/plain' } }),
    }),
    (error) => error.code === 'source_content_type_rejected',
  );
});

test('HTTP source contract enforces bounded response bodies', async () => {
  await assert.rejects(
    fetchJsonContract(ALERTA_RIO_STATIONS_QUERY_URL, {
      allowedHosts: [ALERTA_RIO_HOST],
      maxBytes: 64,
      fetchImpl: async () => jsonResponse({ data: 'x'.repeat(256) }),
    }),
    (error) => error.code === 'source_body_too_large',
  );
});
