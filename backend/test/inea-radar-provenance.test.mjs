import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INEA_MONITORING_PAGE_HOST,
  INEA_MONITORING_PAGE_URL,
  INEA_OFFICIAL_RADAR_CADENCE_MINUTES,
  INEA_PUBLIC_RADAR_HOST,
  INEA_PUBLIC_RADAR_URL,
  INEA_RADAR_PROVENANCE_SOURCE_ID,
  IneaRadarProvenanceError,
  probeIneaRadarOfficialProvenance,
  validateIneaRadarOfficialProvenanceHtml,
} from '../src/inea-radar-provenance.mjs';

function fixture({
  heading = 'Monitoramento Hidrometeorológico',
  radarText = 'Além da rede de radares meteorológicos, o Inea monitora espacialmente a chuva em todo o território estadual.',
  cadenceText = 'A cada cinco minutos, uma nova representação é gerada a partir dos dados dos radares meteorológicos e inserida em uma animação.',
  links = '<a href="https://alertadecheias.inea.rj.gov.br/radar.php">Acessar radar</a>',
} = {}) {
  return `<!doctype html><html lang="pt-BR"><body>
    <header><h1>${heading}</h1></header>
    <main>
      <p>${radarText}</p>
      <p>${cadenceText}</p>
      <p>Os dados hidrometeorológicos apoiam o monitoramento de chuvas e níveis dos rios do Estado do Rio de Janeiro.</p>
      <p>Esta página oficial reúne informações operacionais, dados e boletins da Sala de Situação do Inea.</p>
      <p>${cadenceText}</p>
      ${links}
    </main>
    <footer>INEA - Instituto Estadual do Ambiente - monitoramento público oficial.</footer>
  </body></html>`;
}

test('validates the official INEA monitoring-page provenance for radar and five-minute cadence', () => {
  const result = validateIneaRadarOfficialProvenanceHtml(fixture());
  assert.equal(result.sourceId, INEA_RADAR_PROVENANCE_SOURCE_ID);
  assert.equal(result.contract, 'OFFICIAL_INEA_RADAR_PROVENANCE_VALIDATED');
  assert.equal(result.monitoringPageHost, INEA_MONITORING_PAGE_HOST);
  assert.equal(result.publicRadarHost, INEA_PUBLIC_RADAR_HOST);
  assert.equal(result.cadenceMinutes, INEA_OFFICIAL_RADAR_CADENCE_MINUTES);
  assert.match(result.publicRadarUrlSha256, /^[a-f0-9]{64}$/);
  assert.match(result.provenanceSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.rawPublicRadarUrl, 'REDACTED');
  assert.equal(result.radarIdentityValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameTimestampValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameFreshnessValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.liveRadarFrameIngestion, 'NOT_IMPLEMENTED');
  assert.doesNotMatch(JSON.stringify(result), /radar\.php/);
});

test('accepts duplicate references to the same canonical official radar URL', () => {
  const links = [
    '<a href="https://alertadecheias.inea.rj.gov.br/radar.php">Radar 1</a>',
    '<a href="https://alertadecheias.inea.rj.gov.br/radar.php#animation">Radar 2</a>',
  ].join('');
  const result = validateIneaRadarOfficialProvenanceHtml(fixture({ links }));
  assert.equal(result.contract, 'OFFICIAL_INEA_RADAR_PROVENANCE_VALIDATED');
});

test('fails closed when the official monitoring or radar markers drift', () => {
  assert.throws(
    () => validateIneaRadarOfficialProvenanceHtml(fixture({ heading: 'Dados Ambientais' })),
    (error) => error instanceof IneaRadarProvenanceError
      && error.code === 'inea_radar_provenance_monitoring_marker_missing',
  );
  assert.throws(
    () => validateIneaRadarOfficialProvenanceHtml(fixture({ radarText: 'Informações meteorológicas gerais.' })),
    (error) => error instanceof IneaRadarProvenanceError
      && error.code === 'inea_radar_provenance_radar_marker_missing',
  );
});

test('fails closed when the five-minute cadence marker disappears', () => {
  assert.throws(
    () => validateIneaRadarOfficialProvenanceHtml(fixture({ cadenceText: 'As imagens são atualizadas periodicamente.' })),
    (error) => error instanceof IneaRadarProvenanceError
      && error.code === 'inea_radar_provenance_cadence_marker_missing',
  );
});

test('fails closed when the canonical public radar link is missing, external, HTTP or spoofed', () => {
  for (const links of [
    '<a href="https://alertadecheias.inea.rj.gov.br/radarx.php">Outro produto</a>',
    '<a href="https://example.com/radar.php">Externo</a>',
    '<a href="http://alertadecheias.inea.rj.gov.br/radar.php">HTTP</a>',
    '<a href="https://alertadecheias.inea.rj.gov.br.example.com/radar.php">Spoof</a>',
  ]) {
    assert.throws(
      () => validateIneaRadarOfficialProvenanceHtml(fixture({ links })),
      (error) => error instanceof IneaRadarProvenanceError
        && error.code === 'inea_radar_provenance_canonical_link_missing',
    );
  }
});

test('probes only the pinned official monitoring page with bounded no-redirect transport', async () => {
  const observed = [];
  const result = await probeIneaRadarOfficialProvenance({
    fetchImpl: async (url, options) => {
      observed.push({
        href: String(url),
        redirect: options.redirect,
        accept: options.headers.accept,
      });
      return new Response(fixture(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  assert.equal(result.contract, 'OFFICIAL_INEA_RADAR_PROVENANCE_VALIDATED');
  assert.deepEqual(observed, [{
    href: INEA_MONITORING_PAGE_URL,
    redirect: 'manual',
    accept: 'text/html,application/xhtml+xml;q=0.9',
  }]);
  assert.equal(INEA_PUBLIC_RADAR_URL, 'https://alertadecheias.inea.rj.gov.br/radar.php');
});

test('maps provenance transport rejection to a stable fail-closed error', async () => {
  await assert.rejects(
    () => probeIneaRadarOfficialProvenance({
      fetchImpl: async () => new Response('redirect', {
        status: 302,
        headers: { location: 'https://example.com/' },
      }),
    }),
    (error) => error instanceof IneaRadarProvenanceError
      && error.code === 'inea_radar_provenance_source_redirect_rejected',
  );
});
