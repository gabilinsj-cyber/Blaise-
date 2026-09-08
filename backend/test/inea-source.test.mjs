import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INEA_ALERT_HOST,
  INEA_DISCOVERY_SOURCE_ID,
  INEA_DISCOVERY_URL,
  IneaSourceContractError,
  probeIneaHydrometDiscovery,
  validateIneaHydrometDiscoveryHtml,
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
