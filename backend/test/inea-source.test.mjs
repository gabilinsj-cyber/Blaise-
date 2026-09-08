import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INEA_ALERT_HOST,
  INEA_DISCOVERY_SOURCE_ID,
  INEA_DISCOVERY_URL,
  INEA_STATION_SOURCE_ID,
  IneaSourceContractError,
  probeIneaHydrometDiscovery,
  probeIneaStationSnapshot,
  validateIneaHydrometDiscoveryHtml,
  validateIneaStationSnapshotHtml,
} from '../src/inea-source.mjs';

function fixture({ radarHref = 'https://alertadecheias.inea.rj.gov.br/radar.php', dataHref = 'https://alertadecheias.inea.rj.gov.br/dados.php', radarCadence = 'A cada cinco minutos' } = {}) {
  return `<!doctype html>
  <html lang="pt-BR"><body>
    <h3>Monitoramento Hidrometeorológico</h3>
    <p>O Inea faz o monitoramento por meio de uma rede de pouco mais de 100 estações automáticas dotadas de sensores que produzem registros a cada 15 minutos.</p>
    <p>Além da rede de estações hidrometeorológicas, o Inea conta com uma rede de radares meteorológicos.</p>
    <p>${radarCadence}, uma nova representação é gerada a partir dos dados dos radares meteorológicos.</p>
    <a href="${dataHref}">dados em tempo real</a>
    <a href="${radarHref}">radar</a>
  </body></html>`;
}

function stationFixture({ rain15 = '0.4', rain1h = '1.2', rain4h = '2.8', rain24h = '12.4', rain96h = '18.6', level = '2.00', overflow = '5', percent = '40', stationName = 'Santo Antônio de Pádua' } = {}) {
  return `<!doctype html><html lang="pt-BR"><body>
    <main>
      <section><span>Data</span><strong>08/09/2026</strong></section>
      <section><span>Chuva Acumulada Últimos 15 min</span><strong>${rain15}</strong></section>
      <section><span>Chuva Acumulada Última 1h</span><strong>${rain1h}</strong></section>
      <section><span>Chuva Acumulada Últimas 4h</span><strong>${rain4h}</strong></section>
      <section><span>Chuva Acumulada Últimas 24h</span><strong>${rain24h}</strong></section>
      <section><span>Chuva Acumulada Últimas 96h</span><strong>${rain96h}</strong></section>
      <section><span>Hora</span><strong>00:00</strong></section>
      <section><span>Nível as: 00:00</span><strong>${level}</strong></section>
      <section><span>Cota de transbordamento</span><strong>${overflow} m</strong></section>
      <section><span>Porcentagem sobre a cota.</span><strong>${percent}%</strong></section>
      <h2>Dados dos Ultimos 10 Dias: ${stationName}</h2>
      <a>Exportar para Excel</a><a>Exportar para XML</a>
      <table><tr><th>Data e Hora</th><th>Chuva ( mm )</th><th>Nível do rio ( m )</th></tr>
      <tr><td>08/09/2026 00:00</td><td>${rain15}</td><td>${level}</td></tr></table>
    </main>
  </body></html>`;
}

const stationUrl = 'https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html';

test('accepts official INEA discovery contract and exposes only bounded metadata', () => {
  const result = validateIneaHydrometDiscoveryHtml(fixture());
  assert.equal(result.sourceId, INEA_DISCOVERY_SOURCE_ID);
  assert.equal(result.alertHost, INEA_ALERT_HOST);
  assert.equal(result.telemetryCadenceMinutes, 15);
  assert.equal(result.radarCadenceMinutes, 5);
  assert.equal(result.dataPageUrl, 'https://alertadecheias.inea.rj.gov.br/dados.php');
  assert.equal(result.radarPageUrl, 'https://alertadecheias.inea.rj.gov.br/radar.php');
  assert.match(result.discoverySha256, /^[a-f0-9]{64}$/);
});

test('fails closed when official radar cadence marker drifts', () => {
  assert.throws(
    () => validateIneaHydrometDiscoveryHtml(fixture({ radarCadence: 'Atualização periódica' })),
    (error) => error instanceof IneaSourceContractError && error.code === 'inea_radar_cadence_marker_missing',
  );
});

test('rejects insecure legacy alert links even when host matches', () => {
  assert.throws(
    () => validateIneaHydrometDiscoveryHtml(fixture({ radarHref: 'http://alertadecheias.inea.rj.gov.br/radar.php' })),
    (error) => error instanceof IneaSourceContractError && error.code === 'inea_alert_source_https_required',
  );
});

test('probe uses only the pinned official INEA discovery URL', async () => {
  let observedUrl = null;
  const result = await probeIneaHydrometDiscovery({
    fetchImpl: async (url) => {
      observedUrl = String(url);
      return new Response(fixture(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  assert.equal(observedUrl, INEA_DISCOVERY_URL);
  assert.equal(result.sourceId, INEA_DISCOVERY_SOURCE_ID);
});

test('normalizes a bounded live INEA hydromet station snapshot', () => {
  const result = validateIneaStationSnapshotHtml(stationFixture(), { stationUrl });
  assert.equal(result.sourceId, INEA_STATION_SOURCE_ID);
  assert.equal(result.sourceHost, INEA_ALERT_HOST);
  assert.equal(result.stationId, '21304212020');
  assert.equal(result.stationName, 'Santo Antônio de Pádua');
  assert.equal(result.observedDate, '08/09/2026');
  assert.equal(result.observedTime, '00:00');
  assert.equal(result.timezone, 'America/Sao_Paulo');
  assert.equal(result.telemetryCadenceMinutes, 15);
  assert.deepEqual(result.rainfall, {
    last15mMm: 0.4,
    last1hMm: 1.2,
    last4hMm: 2.8,
    last24hMm: 12.4,
    last96hMm: 18.6,
  });
  assert.equal(result.riverLevelM, 2);
  assert.equal(result.overflowLevelM, 5);
  assert.equal(result.overflowPercent, 40);
  assert.equal(result.missingValueCount, 0);
  assert.match(result.snapshotSha256, /^[a-f0-9]{64}$/);
});

test('preserves non-latest missing values as null but never fabricates zero', () => {
  const result = validateIneaStationSnapshotHtml(stationFixture({ rain1h: 'Dado Nulo', level: 'Dado Nulo' }), { stationUrl });
  assert.equal(result.rainfall.last1hMm, null);
  assert.equal(result.riverLevelM, null);
  assert.equal(result.rainfall.last15mMm, 0.4);
  assert.equal(result.missingValueCount, 2);
});

test('fails closed when the latest 15-minute rainfall is unavailable', () => {
  assert.throws(
    () => validateIneaStationSnapshotHtml(stationFixture({ rain15: 'Dado Nulo' }), { stationUrl }),
    (error) => error instanceof IneaSourceContractError && error.code === 'inea_station_latest_rainfall_missing',
  );
});

test('rejects station URLs outside the exact official station-page path contract', () => {
  assert.throws(
    () => validateIneaStationSnapshotHtml(stationFixture(), { stationUrl: 'https://alertadecheias.inea.rj.gov.br/mapa.php' }),
    (error) => error instanceof IneaSourceContractError && error.code === 'inea_station_path_rejected',
  );
  assert.throws(
    () => validateIneaStationSnapshotHtml(stationFixture(), { stationUrl: 'http://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html' }),
    (error) => error instanceof IneaSourceContractError && error.code === 'inea_station_source_https_required',
  );
});

test('station probe fetches only the exact validated station URL', async () => {
  let observedUrl = null;
  const result = await probeIneaStationSnapshot({
    stationUrl,
    fetchImpl: async (url) => {
      observedUrl = String(url);
      return new Response(stationFixture(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  assert.equal(observedUrl, stationUrl);
  assert.equal(result.stationId, '21304212020');
});
