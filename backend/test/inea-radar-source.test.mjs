import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import {
  INEA_RADAR_CADENCE_MINUTES,
  INEA_RADAR_HOST,
  INEA_RADAR_MAX_BINARY_CANDIDATES,
  INEA_RADAR_MAX_FRAME_BYTES,
  INEA_RADAR_MAX_MEDIA_CANDIDATES,
  INEA_RADAR_SOURCE_ID,
  INEA_RADAR_TOOL_URL,
  IneaRadarContractError,
  discoverIneaRadarMediaCandidates,
  extractIneaRadarViewerUrl,
  probeIneaRadarTool,
  validateIneaRadarImageBinary,
  validateIneaRadarMediaBinaries,
  validateIneaRadarToolHtml,
} from '../src/inea-radar-source.mjs';

function fixture({
  title = 'Sistema de Alerta de Cheias',
  tool = 'Ferramenta Radar Tool',
  iframe = '<iframe src="viewer.html"></iframe>',
} = {}) {
  return `<!doctype html><html lang="pt-BR"><body>
    <header><h1>${title}</h1></header>
    <main><h2>${tool}</h2><p>Monitoramento oficial do radar meteorológico e dados operacionais do INEA.</p>${iframe}</main>
    <footer>INEA - Instituto Estadual do Ambiente</footer>
  </body></html>`;
}

function viewerFixture({ media = '' } = {}) {
  const defaultMedia = [
    '<img src="frames/guaratiba-20260908-1230.png" alt="Radar Guaratiba">',
    '<img data-src="https://alertadecheias.inea.rj.gov.br/frames/macae-20260908-1235.jpg?cache=1" alt="Radar Macaé">',
    '<img src="https://example.com/external.png" alt="external">',
  ].join('');
  return `<!doctype html><html><body><main>${media || defaultMedia}</main><footer>INEA radar viewer</footer></body></html>`;
}

function pngFixtureBytes() {
  return Uint8Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6cSIAAAAASUVORK5CYII=',
    'base64',
  ));
}

test('accepts the bounded official INEA radar gateway and resolves the embedded viewer', () => {
  const result = validateIneaRadarToolHtml(fixture());
  assert.equal(result.sourceId, INEA_RADAR_SOURCE_ID);
  assert.equal(result.sourceHost, INEA_RADAR_HOST);
  assert.equal(result.sourceUrl, INEA_RADAR_TOOL_URL);
  assert.equal(result.radarCadenceMinutes, INEA_RADAR_CADENCE_MINUTES);
  assert.equal(result.embeddedViewerDetected, true);
  assert.equal(result.iframeCount, 1);
  assert.equal(result.viewerHost, INEA_RADAR_HOST);
  assert.equal(result.viewerContract, 'OFFICIAL_HTTPS_IFRAME_RESOLVED');
  assert.match(result.viewerUrlSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.mediaCandidateDiscovery, 'NOT_PROBED');
  assert.equal(result.frameBinaryValidation, 'NOT_PROBED');
  assert.equal(result.radarIdentityValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameIngestion, 'NOT_IMPLEMENTED');
  assert.match(result.gatewaySha256, /^[a-f0-9]{64}$/);
  assert.equal('viewerUrl' in result, false);
});

test('resolves only HTTPS viewer URLs under the official INEA domain', () => {
  const viewer = extractIneaRadarViewerUrl(fixture({
    iframe: '<iframe src="https://radar.inea.rj.gov.br/app/viewer?layer=chuva#map"></iframe>',
  }));
  assert.equal(viewer.hostname, 'radar.inea.rj.gov.br');
  assert.equal(viewer.protocol, 'https:');
  assert.equal(viewer.hash, '');
  assert.equal(viewer.search, '?layer=chuva');
});

test('discovers only bounded official HTTPS image candidates and redacts raw URLs', () => {
  const result = discoverIneaRadarMediaCandidates(
    viewerFixture(),
    'https://alertadecheias.inea.rj.gov.br/viewer.html',
  );
  assert.equal(result.contract, 'OFFICIAL_HTTPS_RADAR_MEDIA_CANDIDATES_DISCOVERED');
  assert.equal(result.viewerHost, INEA_RADAR_HOST);
  assert.equal(result.mediaCandidateCount, 2);
  assert.deepEqual(result.mediaCandidateHosts, [INEA_RADAR_HOST]);
  assert.match(result.mediaCandidateSetSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.rawMediaUrls, 'REDACTED');
  assert.equal(result.frameBinaryValidation, 'NOT_PROBED');
  assert.equal(result.radarIdentityValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameTimestampValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameFreshnessValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameIngestion, 'NOT_IMPLEMENTED');
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /guaratiba-20260908|macae-20260908|cache=1/);
});

test('validates an image binary envelope and content type without retaining bytes', () => {
  const bytes = pngFixtureBytes();
  const result = validateIneaRadarImageBinary(bytes, 'image/png');
  assert.equal(result.imageType, 'png');
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.byteLength, bytes.byteLength);
  assert.match(result.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal('bytes' in result, false);
});

test('rejects HTML masquerading as an image and MIME/signature mismatch', () => {
  assert.throws(
    () => validateIneaRadarImageBinary(Uint8Array.from(Buffer.from('<html>not radar</html>')), 'image/png'),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_binary_signature_invalid',
  );
  assert.throws(
    () => validateIneaRadarImageBinary(pngFixtureBytes(), 'image/jpeg'),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_binary_content_type_mismatch',
  );
});

test('rejects truncated PNG binary envelopes', () => {
  const bytes = pngFixtureBytes().slice(0, -12);
  assert.throws(
    () => validateIneaRadarImageBinary(bytes, 'image/png'),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_binary_signature_invalid',
  );
});

test('fetches and validates all bounded official binary candidates with sanitized evidence', async () => {
  const observed = [];
  const candidates = [
    'https://alertadecheias.inea.rj.gov.br/frames/a.png',
    'https://radar.inea.rj.gov.br/frames/b.jpg?cache=1',
  ];
  const result = await validateIneaRadarMediaBinaries(candidates, {
    fetchImpl: async (url, options) => {
      observed.push({ href: String(url), redirect: options.redirect, accept: options.headers.accept });
      return new Response(pngFixtureBytes(), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    },
  });
  assert.equal(result.contract, 'OFFICIAL_IMAGE_BINARY_ENVELOPES_VALIDATED');
  assert.equal(result.validatedCandidateCount, 2);
  assert.deepEqual(result.imageTypes, ['png']);
  assert.equal(result.totalValidatedBytes, pngFixtureBytes().byteLength * 2);
  assert.equal(result.duplicateContentCount, 1);
  assert.match(result.binarySetSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.rawMediaUrls, 'REDACTED');
  assert.equal(result.binaryContentRetention, 'NONE');
  assert.equal(result.radarIdentityValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameTimestampValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameFreshnessValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameIngestion, 'NOT_IMPLEMENTED');
  assert.equal(observed.length, 2);
  assert.ok(observed.every((request) => request.redirect === 'manual'));
  assert.ok(observed.every((request) => request.accept.includes('image/png')));
  assert.doesNotMatch(JSON.stringify(result), /frames\/a|frames\/b|cache=1/i);
});

test('fails closed when binary validation fanout exceeds its stricter bound', async () => {
  const candidates = Array.from(
    { length: INEA_RADAR_MAX_BINARY_CANDIDATES + 1 },
    (_, index) => `https://${INEA_RADAR_HOST}/frames/${index}.png`,
  );
  await assert.rejects(
    () => validateIneaRadarMediaBinaries(candidates, { fetchImpl: async () => { throw new Error('must not fetch'); } }),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_binary_candidate_count_invalid',
  );
});

test('fails closed on binary redirects, wrong content type and oversized declarations', async () => {
  const candidate = [`https://${INEA_RADAR_HOST}/frames/a.png`];
  await assert.rejects(
    () => validateIneaRadarMediaBinaries(candidate, {
      fetchImpl: async () => new Response('redirect', { status: 302, headers: { location: 'https://example.com/' } }),
    }),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_binary_source_redirect_rejected',
  );
  await assert.rejects(
    () => validateIneaRadarMediaBinaries(candidate, {
      fetchImpl: async () => new Response('<html>wrong</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    }),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_binary_source_content_type_rejected',
  );
  await assert.rejects(
    () => validateIneaRadarMediaBinaries(candidate, {
      fetchImpl: async () => new Response(pngFixtureBytes(), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(INEA_RADAR_MAX_FRAME_BYTES + 1),
        },
      }),
    }),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_binary_source_body_too_large',
  );
});

test('fails closed when the viewer exposes no official image candidate', () => {
  assert.throws(
    () => discoverIneaRadarMediaCandidates(
      viewerFixture({ media: '<img src="https://example.com/frame.png"><script>const x = 1;</script>' }),
      'https://alertadecheias.inea.rj.gov.br/viewer.html',
    ),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_media_candidate_missing',
  );
});

test('fails closed when media candidate count exceeds the defensive bound', () => {
  const media = Array.from(
    { length: INEA_RADAR_MAX_MEDIA_CANDIDATES + 1 },
    (_, index) => `<img src="frames/frame-${String(index).padStart(3, '0')}.png">`,
  ).join('');
  assert.throws(
    () => discoverIneaRadarMediaCandidates(
      viewerFixture({ media }),
      'https://alertadecheias.inea.rj.gov.br/viewer.html',
    ),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_media_candidate_count_invalid',
  );
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

test('fails closed on external or non-HTTPS iframe destinations', () => {
  for (const iframe of [
    '<iframe src="https://example.com/viewer"></iframe>',
    '<iframe src="http://alertadecheias.inea.rj.gov.br/viewer"></iframe>',
    '<iframe src="javascript:alert(1)"></iframe>',
  ]) {
    assert.throws(
      () => extractIneaRadarViewerUrl(fixture({ iframe })),
      (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_viewer_url_invalid',
    );
  }
});

test('fails closed when multiple official viewer URLs are ambiguous', () => {
  assert.throws(
    () => extractIneaRadarViewerUrl(fixture({
      iframe: '<iframe src="viewer-a.html"></iframe><iframe src="viewer-b.html"></iframe>',
    })),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_viewer_ambiguous',
  );
});

test('viewer query details stay out of the public contract result', () => {
  const result = validateIneaRadarToolHtml(fixture({
    iframe: '<iframe src="viewer.html?token=do-not-expose"></iframe>',
  }));
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /do-not-expose/);
  assert.doesNotMatch(serialized, /viewer\.html/);
});

test('radar probe fetches gateway, viewer and bounded binaries without claiming frame semantics', async () => {
  const observed = [];
  const result = await probeIneaRadarTool({
    fetchImpl: async (url) => {
      const href = String(url);
      observed.push(href);
      if (href === INEA_RADAR_TOOL_URL) {
        return new Response(fixture(), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (href === 'https://alertadecheias.inea.rj.gov.br/viewer.html') {
        return new Response(viewerFixture(), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      return new Response(pngFixtureBytes(), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    },
  });
  assert.deepEqual(observed, [
    INEA_RADAR_TOOL_URL,
    'https://alertadecheias.inea.rj.gov.br/viewer.html',
    'https://alertadecheias.inea.rj.gov.br/frames/guaratiba-20260908-1230.png',
    'https://alertadecheias.inea.rj.gov.br/frames/macae-20260908-1235.jpg?cache=1',
  ]);
  assert.equal(result.sourceId, INEA_RADAR_SOURCE_ID);
  assert.equal(result.viewerContract, 'OFFICIAL_HTTPS_IFRAME_RESOLVED');
  assert.equal(result.mediaCandidateDiscovery, 'OFFICIAL_HTTPS_RADAR_MEDIA_CANDIDATES_DISCOVERED');
  assert.equal(result.mediaCandidateCount, 2);
  assert.equal(result.frameBinaryValidation, 'OFFICIAL_IMAGE_BINARY_ENVELOPES_VALIDATED');
  assert.equal(result.binaryValidatedCandidateCount, 2);
  assert.equal(result.binaryContentRetention, 'NONE');
  assert.equal(result.radarIdentityValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameTimestampValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameFreshnessValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.frameIngestion, 'NOT_IMPLEMENTED');
});

test('maps gateway transport rejection to a stable INEA radar error code', async () => {
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

test('maps viewer transport rejection to a stable INEA radar error code', async () => {
  let request = 0;
  await assert.rejects(
    () => probeIneaRadarTool({
      fetchImpl: async () => {
        request += 1;
        if (request === 1) {
          return new Response(fixture(), {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
        return new Response('redirect', {
          status: 302,
          headers: { location: 'https://example.com/' },
        });
      },
    }),
    (error) => error instanceof IneaRadarContractError && error.code === 'inea_radar_viewer_source_redirect_rejected',
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
  assert.match(workflow, /embeddedViewerResolution/);
  assert.match(workflow, /mediaCandidateDiscovery/);
  assert.match(workflow, /frameBinaryValidation/);
  assert.match(workflow, /radarIdentityValidation/);
  assert.match(workflow, /frameTimestampValidation/);
  assert.match(workflow, /frameFreshnessValidation/);
  assert.match(workflow, /liveRadarFrameIngestion/);
  assert.match(workflow, /NOT_IMPLEMENTED/);
});

test('radar source and probe script parse under the pinned Node runtime', () => {
  for (const file of ['src/inea-radar-source.mjs', 'scripts/probe-inea-radar.mjs']) {
    const result = spawnSync(process.execPath, ['--check', file], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
