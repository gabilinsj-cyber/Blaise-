import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import {
  INEA_RADAR_CADENCE_MINUTES,
  INEA_RADAR_HOST,
  INEA_RADAR_SOURCE_ID,
  INEA_RADAR_TOOL_URL,
  IneaRadarContractError,
  probeIneaRadarTool,
  validateIneaRadarToolHtml,
} from '../src/inea-radar-source.mjs';

function fixture({ title = 'Sistema de Alerta de Cheias', tool = 'Ferramenta Radar Tool', iframe = '<iframe src="viewer.html"></iframe>' } = {}) {
  return `<!doctype html><html lang="pt-BR"><body>
    <header><h1>${title}</h1></header>
    <main><h2>${tool}</h2><p>Monitoramento oficial.</p>${iframe}</main>
    <footer>INEA - Instituto Estadual do Ambiente</footer>
  </body></html>`;
}

test('accepts the bounded official INEA radar gateway contract', () => {
  const result = validateIneaRadarToolHtml(fixture());
  assert.equal(result.sourceId, INEA_RADAR_SOURCE_ID);
  assert.equal(result.sourceHost, INEA_RADAR_HOST);
  assert.equal(result.sourceUrl, INEA_RADAR_TOOL_URL);
  assert.equal(result.radarCadenceMinutes, INEA_RADAR_CADENCE_MINUTES);
  assert.equal(result.embeddedViewerDetected, true);
  assert.equal(result.iframeCount, 1);
  assert.equal(result.frameIngestion, 'NOT_IMPLEMENTED');
  assert.match(result.gatewaySha256, /^[a-f0-9]{64}$/);
});

test('fails closed when the radar identity marker drifts', () => {
  assert.throws(
    () => validateIneaRadarToolHtml(fixture({ tool: 'Visualizador Meteorológico' })),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_tool_marker_missing',
  );
});

test('fails closed when the embedded viewer is missing', () => {
  assert.throws(
    () => validateIneaRadarToolHtml(fixture({ iframe: '<div>viewer unavailable</div>' })),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_viewer_missing',
  );
});

test('radar probe fetches only the pinned official INEA Radar Tool URL', async () => {
  let observedUrl = null;
  const result = await probeIneaRadarTool({
    fetchImpl: async (url) => {
      observedUrl = String(url);
      return new Response(fixture(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  assert.equal(observedUrl, INEA_RADAR_TOOL_URL);
  assert.equal(result.sourceId, INEA_RADAR_SOURCE_ID);
});

test('maps transport rejection to a stable INEA radar error code', async () => {
  await assert.rejects(
    () => probeIneaRadarTool({
      fetchImpl: async () => new Response('redirect', {
        status: 302,
        headers: { location: 'https://example.com/' },
      }),
    }),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_source_redirect_rejected',
  );
});

test('manual radar workflow stays fail-closed and credential-free', () => {
  const workflow = readFileSync('../.github/workflows/inea-radar-probe.yml', 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /execute_live_probe:/);
  assert.match(workflow, /default:\s*false/);
  assert.doesNotMatch(workflow, /^\s{2}(?:push|pull_request|schedule):/m);
  assert.doesNotMatch(workflow, /id-token:\s*write|service_account|workload_identity_provider/);
  assert.match(workflow, /NOT_RUN_EXPLICIT_APPROVAL_REQUIRED/);
  assert.match(workflow, /liveRadarFrameIngestion/);
  assert.match(workflow, /NOT_IMPLEMENTED/);
});

test('radar probe script parses under the pinned Node runtime', () => {
  const result = spawnSync(process.execPath, ['--check', 'scripts/probe-inea-radar.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
