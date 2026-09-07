import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALERTA_RIO_EXPECTED_ACTIVE_STATIONS,
  ALERTA_RIO_HOST,
  ALERTA_RIO_LIVE_HOST,
  ALERTA_RIO_LIVE_URL,
  ALERTA_RIO_STATIONS_QUERY_URL,
  probeAlertaRioLiveRainfall,
  probeAlertaRioStationCatalog,
  validateAlertaRioLiveRainfallHtml,
  validateAlertaRioStationCatalog,
} from '../src/alerta-rio-source.mjs';
import { fetchJsonContract, fetchTextContract } from '../src/source-contract.mjs';

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

function htmlResponse(html, init = {}) {
  return new Response(html, {
    status: init.status ?? 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...(init.headers || {}) },
  });
}

function liveHtml(count = ALERTA_RIO_EXPECTED_ACTIVE_STATIONS, mutate = () => {}) {
  const rows = Array.from({ length: count }, (_, index) => {
    const row = {
      code: index + 1,
      name: `Estação ${String(index + 1).padStart(2, '0')}`,
      zone: index % 2 === 0 ? 'Zona Sul' : 'Baía de Guanabara',
      timestamp: '07/09/2026 - 14:05:00',
      values: Array.from({ length: 14 }, () => '0,0'),
    };
    if (index === 0) row.values[4] = '0,4';
    mutate(row, index);
    const cells = [row.code, row.name, row.zone, row.timestamp, ...row.values]
      .map((value) => `<td>${value}</td>`)
      .join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<!doctype html><html><body><h1>Dados Pluviométricos</h1><span>TX - 15</span><table><tbody>${rows}</tbody></table></body></html>`;
}

test('Alerta Rio query is pinned to the official HTTPS host and minimum fields', () => {
  const url = new URL(ALERTA_RIO_STATIONS_QUERY_URL);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, ALERTA_RIO_HOST);
  assert.equal(url.searchParams.get('outFields'), 'cod,est');
  assert.equal(url.searchParams.get('returnGeometry'), 'false');
  assert.equal(url.searchParams.get('f'), 'json');
});

test('Alerta Rio live rainfall endpoint is pinned to the official HTTPS host', () => {
  const url = new URL(ALERTA_RIO_LIVE_URL);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, ALERTA_RIO_LIVE_HOST);
  assert.equal(url.pathname, '/estacoes/');
});

test('valid 33-station Alerta Rio catalog passes with deterministic digest', () => {
  const first = validateAlertaRioStationCatalog(stationPayload());
  const second = validateAlertaRioStationCatalog(stationPayload());
  assert.equal(first.stationCount, 33);
  assert.match(first.catalogSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.catalogSha256, second.catalogSha256);
});

test('valid live rainfall snapshot passes with bounded normalized values and deterministic digest', () => {
  const first = validateAlertaRioLiveRainfallHtml(liveHtml());
  const second = validateAlertaRioLiveRainfallHtml(liveHtml());
  assert.equal(first.stationCount, 33);
  assert.equal(first.stations[0].rain1hMm, 0.4);
  assert.equal(first.stations[0].observedAt, '2026-09-07T17:05:00.000Z');
  assert.match(first.snapshotSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.snapshotSha256, second.snapshotSha256);
  assert.equal(first.oldestObservedAt, '2026-09-07T17:05:00.000Z');
  assert.equal(first.freshestObservedAt, '2026-09-07T17:05:00.000Z');
});

test('station catalog probe adapter accepts a valid mocked official response', async () => {
  const result = await probeAlertaRioStationCatalog({
    fetchImpl: async (url, options) => {
      assert.equal(url.hostname, ALERTA_RIO_HOST);
      assert.equal(options.redirect, 'manual');
      return jsonResponse(stationPayload());
    },
  });
  assert.equal(result.stationCount, 33);
});

test('live rainfall probe adapter accepts a valid mocked official response', async () => {
  const result = await probeAlertaRioLiveRainfall({
    fetchImpl: async (url, options) => {
      assert.equal(url.hostname, ALERTA_RIO_LIVE_HOST);
      assert.equal(options.redirect, 'manual');
      assert.match(options.headers.accept, /text\/html/);
      return htmlResponse(liveHtml());
    },
  });
  assert.equal(result.stationCount, 33);
  assert.equal(result.stations[0].rain1hMm, 0.4);
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

test('live rainfall station count drift fails closed', () => {
  assert.throws(
    () => validateAlertaRioLiveRainfallHtml(liveHtml(32)),
    (error) => error.code === 'alerta_rio_live_station_count_drift',
  );
});

test('live rainfall duplicate station code fails closed', () => {
  assert.throws(
    () => validateAlertaRioLiveRainfallHtml(liveHtml(33, (row, index) => {
      if (index === 1) row.code = 1;
    })),
    (error) => error.code === 'alerta_rio_live_duplicate_station_code',
  );
});

test('live rainfall malformed numeric value fails closed', () => {
  assert.throws(
    () => validateAlertaRioLiveRainfallHtml(liveHtml(33, (row, index) => {
      if (index === 0) row.values[0] = 'indisponível';
    })),
    (error) => error.code === 'alerta_rio_live_invalid_rain_value',
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

test('HTTP JSON source contract rejects redirects and non-JSON responses', async () => {
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

test('HTTP HTML source contract rejects redirects and non-HTML responses', async () => {
  await assert.rejects(
    fetchTextContract(ALERTA_RIO_LIVE_URL, {
      allowedHosts: [ALERTA_RIO_LIVE_HOST],
      fetchImpl: async () => new Response('', { status: 302, headers: { location: 'https://example.com' } }),
    }),
    (error) => error.code === 'source_redirect_rejected',
  );

  await assert.rejects(
    fetchTextContract(ALERTA_RIO_LIVE_URL, {
      allowedHosts: [ALERTA_RIO_LIVE_HOST],
      fetchImpl: async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    }),
    (error) => error.code === 'source_content_type_rejected',
  );
});

test('HTTP source contracts enforce bounded response bodies', async () => {
  await assert.rejects(
    fetchJsonContract(ALERTA_RIO_STATIONS_QUERY_URL, {
      allowedHosts: [ALERTA_RIO_HOST],
      maxBytes: 64,
      fetchImpl: async () => jsonResponse({ data: 'x'.repeat(256) }),
    }),
    (error) => error.code === 'source_body_too_large',
  );

  await assert.rejects(
    fetchTextContract(ALERTA_RIO_LIVE_URL, {
      allowedHosts: [ALERTA_RIO_LIVE_HOST],
      maxBytes: 64,
      fetchImpl: async () => htmlResponse(`<html>${'x'.repeat(256)}</html>`),
    }),
    (error) => error.code === 'source_body_too_large',
  );
});
