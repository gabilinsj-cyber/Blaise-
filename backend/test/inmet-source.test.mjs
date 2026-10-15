import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INMET_CAP_RSS_URL,
  INMET_HOST,
  INMET_SOURCE_ID,
  InmetSourceContractError,
  probeInmetCapWarnings,
  validateInmetCapFeedXml,
} from '../src/inmet-source.mjs';

function alertXml({
  identifier = 'urn:oid:2.49.0.0.76.0.2026.28224.1',
  sender = 'info.aviso@inmet.gov.br',
  sent = '2026-09-09T14:55:00-03:00',
  status = 'Actual',
  msgType = 'Alert',
  event = 'Tempestade',
  urgency = 'Expected',
  severity = 'Moderate',
  onset = '2026-09-09T15:00:00-03:00',
  expires = '2026-09-10T10:00:00-03:00',
  areaDesc = 'Sul/Sudoeste de Minas, Vale do Paraíba Paulista, Sul Fluminense e Rio de Janeiro',
  geocode = '<geocode><valueName>IBGE</valueName><value>3304557 3304904</value></geocode>',
} = {}) {
  return `<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
    <identifier>${identifier}</identifier>
    <sender>${sender}</sender>
    <sent>${sent}</sent>
    <status>${status}</status>
    <msgType>${msgType}</msgType>
    <scope>Public</scope>
    <info>
      <language>pt-BR</language>
      <category>Met</category>
      <event>${event}</event>
      <urgency>${urgency}</urgency>
      <severity>${severity}</severity>
      <certainty>Likely</certainty>
      <onset>${onset}</onset>
      <expires>${expires}</expires>
      <headline>Aviso meteorológico oficial</headline>
      <area>
        <areaDesc>${areaDesc}</areaDesc>
        ${geocode}
        <polygon>-22.9,-43.2 -23.0,-43.1 -22.8,-43.0</polygon>
      </area>
    </info>
  </alert>`;
}

function feedXml(records) {
  return `<?xml version="1.0" encoding="UTF-8"?><feed>${records.join('\n')}</feed>`;
}

test('normalizes bounded INMET CAP warnings and filters Rio de Janeiro by IBGE geocode', () => {
  const xml = feedXml([
    alertXml(),
    alertXml({
      identifier: 'urn:oid:2.49.0.0.76.0.2026.28225.1',
      sent: '2026-09-09T15:00:00-03:00',
      onset: '2026-09-09T16:00:00-03:00',
      expires: '2026-09-10T12:00:00-03:00',
      event: 'Baixa Umidade',
      areaDesc: 'Centro Goiano',
      geocode: '<geocode><valueName>IBGE</valueName><value>5208707</value></geocode>',
    }),
  ]);

  const result = validateInmetCapFeedXml(xml);
  assert.equal(result.sourceId, INMET_SOURCE_ID);
  assert.equal(result.sourceHost, INMET_HOST);
  assert.equal(result.sourceUrl, INMET_CAP_RSS_URL);
  assert.equal(result.activeWarningCount, 2);
  assert.equal(result.rjWarningCount, 1);
  assert.equal(result.rjWarnings[0].event, 'Tempestade');
  assert.equal(result.rjWarnings[0].rjMatchMethod, 'CAP_GEOCODE_IBGE_33');
  assert.equal(result.temporalValidityValidation, 'BOUNDED_CAP_ONSET_EXPIRES_MAX_7D');
  assert.equal(result.polygonRetention, 'NONE');
  assert.equal(result.rawFeedRetention, 'NONE');
  assert.match(result.warningInventorySha256, /^[a-f0-9]{64}$/);
});

test('supports namespace-prefixed RSS item CAP fields', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <cap:identifier>urn:oid:2.49.0.0.76.0.2026.28226.1</cap:identifier>
    <cap:sender>info.aviso@inmet.gov.br</cap:sender>
    <cap:sent>2026-09-09T15:05:00-03:00</cap:sent>
    <cap:status>Actual</cap:status>
    <cap:msgType>Update</cap:msgType>
    <cap:event>Chuvas Intensas</cap:event>
    <cap:urgency>Immediate</cap:urgency>
    <cap:severity>Severe</cap:severity>
    <cap:certainty>Likely</cap:certainty>
    <cap:onset>2026-09-09T15:00:00-03:00</cap:onset>
    <cap:expires>2026-09-10T03:00:00-03:00</cap:expires>
    <cap:area><cap:areaDesc>Estado do Rio de Janeiro</cap:areaDesc></cap:area>
  </item></channel></rss>`;
  const result = validateInmetCapFeedXml(xml);
  assert.equal(result.feedShape, 'RSS_ITEM');
  assert.equal(result.rjWarningCount, 1);
  assert.equal(result.rjWarnings[0].rjMatchMethod, 'CAP_AREA_DESC_RIO_DE_JANEIRO');
});

test('fails closed on non-INMET sender identity', () => {
  assert.throws(
    () => validateInmetCapFeedXml(feedXml([alertXml({ sender: 'alerts@example.org' })])),
    (error) => error instanceof InmetSourceContractError && error.code === 'inmet_sender_untrusted',
  );
});

test('fails closed on non-actual CAP status', () => {
  assert.throws(
    () => validateInmetCapFeedXml(feedXml([alertXml({ status: 'Test' })])),
    (error) => error instanceof InmetSourceContractError && error.code === 'inmet_status_not_actual',
  );
});

test('fails closed when CAP temporal window exceeds seven days', () => {
  assert.throws(
    () => validateInmetCapFeedXml(feedXml([alertXml({
      onset: '2026-09-09T15:00:00-03:00',
      expires: '2026-09-20T15:00:00-03:00',
    })])),
    (error) => error instanceof InmetSourceContractError && error.code === 'inmet_temporal_window_too_large',
  );
});

test('probe fetches only the pinned official INMET CAP RSS endpoint', async () => {
  let observedUrl = null;
  const result = await probeInmetCapWarnings({
    fetchImpl: async (url) => {
      observedUrl = String(url);
      return new Response(feedXml([alertXml()]), {
        status: 200,
        headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
      });
    },
  });
  assert.equal(observedUrl, INMET_CAP_RSS_URL);
  assert.equal(result.rjWarningCount, 1);
});

test('probe rejects HTML instead of silently parsing a portal fallback', async () => {
  await assert.rejects(
    () => probeInmetCapWarnings({
      fetchImpl: async () => new Response('<html><body>fallback</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    }),
    (error) => error instanceof InmetSourceContractError && error.code === 'inmet_source_content_type_rejected',
  );
});
test('RSS index resolves official CAP links before validating areas', async () => {
  const calls = [];
  const link = `${INMET_CAP_RSS_URL}/55976`;
  const result = await probeInmetCapWarnings({fetchImpl: async url => {
    calls.push(String(url));
    return new Response(String(url) === INMET_CAP_RSS_URL
      ? `<rss><channel><title>Avisos oficiais para teste de contrato</title><item><link>${link}</link><description>Index only, no CAP areas</description></item></channel></rss>`
      : alertXml(), {headers: {'content-type': 'application/xml'}});
  }});
  assert.deepEqual(calls, [INMET_CAP_RSS_URL, link]);
  assert.equal(result.feedShape, 'RSS_INDEX_RESOLVED_CAP');
  assert.equal(result.rjWarningCount, 1);
});

test('RSS cannot redirect CAP retrieval to an arbitrary host', async () => {
  let calls = 0;
  await assert.rejects(() => probeInmetCapWarnings({fetchImpl: async () => {
    calls++;
    return new Response('<rss><channel><title>Avisos oficiais para teste de contrato</title><item><link>https://example.com/avisos/rss/123</link><description>Index only, no CAP areas</description></item></channel></rss>', {headers: {'content-type': 'application/xml'}});
  }}), error => error.code === 'inmet_cap_link_untrusted');
  assert.equal(calls, 1);
});

test('CAP cancellation removes referenced warning and never becomes an active alert', () => {
  const original = 'urn:oid:2.49.0.0.76.0.2026.28224.1';
  const cancel = alertXml({identifier: original.replace('.1', '.2'), msgType:'Cancel'}).replace('<scope>Public</scope>', `<scope>Public</scope><references>info.aviso@inmet.gov.br,${original},2026-09-09T14:55:00-03:00</references>`);
  const result = validateInmetCapFeedXml(feedXml([alertXml(), cancel]));
  assert.equal(result.activeWarningCount, 0);
  assert.equal(result.cancellations.length, 1);
  assert.throws(() => validateInmetCapFeedXml(feedXml([alertXml({msgType:'Cancel'})])), e => e.code === 'inmet_cancel_references_missing');
});

for (const failure of ['http500', 'network']) {
  test(`CAP retrieval retries a transient ${failure} once`, async () => {
    let attempts = 0;
    const link = `${INMET_CAP_RSS_URL}/56050`;
    const result = await probeInmetCapWarnings({ fetchImpl: async url => {
      if (String(url) === INMET_CAP_RSS_URL) return new Response(
        `<rss><channel><item><link>${link}</link></item></channel></rss>`,
        { headers: { 'content-type': 'application/xml' } });
      if (++attempts === 1) {
        if (failure === 'network') throw new TypeError('connection reset');
        return new Response('upstream failure', { status: 500 });
      }
      return new Response(alertXml(), { headers: { 'content-type': 'application/xml' } });
    }});
    assert.equal(attempts, 2);
    assert.equal(result.rjWarningCount, 1);
  });
}

for (const status of [404, 500]) {
  test(`persistent CAP HTTP ${status} never becomes an empty successful inventory`, async () => {
    let attempts = 0;
    const link = `${INMET_CAP_RSS_URL}/56050`;
    await assert.rejects(probeInmetCapWarnings({ fetchImpl: async url => {
      if (String(url) === INMET_CAP_RSS_URL) return new Response(
        `<rss><channel><item><link>${link}</link></item></channel></rss>`,
        { headers: { 'content-type': 'application/xml' } });
      attempts++;
      return new Response('failure', { status });
    }}), error => error.code === 'source_http_error');
    assert.equal(attempts, status === 500 ? 2 : 1);
  });
}

test('failed CAP inventory drains in-flight fetches before returning failure', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let began;
  const started = new Promise(resolve => { began = resolve; });
  let drained = false;
  const collection = probeInmetCapWarnings({ fetchImpl: async url => {
    if (String(url) === INMET_CAP_RSS_URL) return new Response(
      `<rss><channel><item><link>${INMET_CAP_RSS_URL}/1</link></item><item><link>${INMET_CAP_RSS_URL}/2</link></item></channel></rss>`,
      { headers: { 'content-type': 'application/xml' } });
    if (String(url).endsWith('/1')) return new Response('missing', { status: 404 });
    began();
    await pending;
    drained = true;
    return new Response(alertXml(), { headers: { 'content-type': 'application/xml' } });
  }});
  const rejection = assert.rejects(collection, e => {
    assert.equal(drained, true);
    return e.code === 'source_http_error';
  });
  await started;
  await Promise.resolve();
  release();
  await rejection;
});

test('WIS2 municipal parameter requires exact canonical RJ name and IBGE, without expanding areas', () => {
  const xml = value => alertXml({ geocode: '', areaDesc: 'Área de teste RJ' }).replace('</info>',
    `<parameter><valueName>Municipios</valueName><value>${value}</value></parameter></info>`);
  const s = validateInmetCapFeedXml(xml('Rio de Janeiro - RJ (3304557), Niterói - RJ (3303302)'));
  assert.deepEqual(s.rjWarnings[0].rjMunicipalityIbges, ['3303302', '3304557']);
  assert.equal(s.rjWarnings[0].rjMatchMethod, 'CAP_PARAMETER_MUNICIPIOS_IBGE_33');
  assert.throws(() => validateInmetCapFeedXml(xml('Niterói - RJ (3304557)')), e => e.code === 'inmet_municipal_parameter_untrusted');
});

test('WIS2 HTTPS archive validates CAP bytes while keeping inventory partial', async () => {
  const { probeInmetWis2Warnings, parseWis2Listing, INMET_WIS2_URL } = await import('../src/inmet-wis2-source.mjs');
  const { createInmetCapWarningsCache } = await import('../src/inmet-warning-cache.mjs');
  const at = Date.parse('2026-09-09T19:00:00Z');
  const s = await probeInmetWis2Warnings({ now: () => at, fetchImpl: async url => {
    const u = new URL(url);
    if (u.search) {
      const prefix = u.searchParams.get('prefix');
      return new Response(`<ListBucketResult><IsTruncated>false</IsTruncated>${prefix.startsWith('2026-09-09')
        ? `<Contents><Key>${prefix}INMET-ALERT-123_20260909.xml</Key></Contents>` : ''}</ListBucketResult>`,
      { headers: { 'content-type': 'application/xml' } });
    }
    assert.equal(u.hostname, 'wis2bra.inmet.gov.br');
    return new Response(alertXml(), { headers: { 'content-type': 'application/octet-stream' } });
  }});
  assert.equal(s.sourceUrl, INMET_WIS2_URL);
  assert.equal(s.inventoryComplete, false);
  const cache = createInmetCapWarningsCache({ now: () => at }); cache.recordSuccess(s);
  assert.equal(cache.read().state, 'CURRENT_DEGRADED');
  assert.equal(cache.read().snapshot.rjWarningCount, 1);
  assert.throws(() => parseWis2Listing('<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>', 'x'));
  assert.throws(() => parseWis2Listing('<ListBucketResult><IsTruncated>false</IsTruncated><Key>https://evil.test/a.xml</Key></ListBucketResult>', 'x'));
});

test('alternative collectors reach public municipal payload without turning CEMADEN alerts into risk levels', async () => {
  const { createOfficialSourceWorker } = await import('../src/official-source-worker.mjs');
  const { buildRjPublicStatusSnapshot, projectWarningInventories } = await import('../src/rj-public-status-http.mjs');
  const { validateCemadenNationalAlerts } = await import('../src/cemaden-national-source.mjs');
  const at = Date.parse('2026-09-09T19:00:00Z');
  const snapshot = { ...validateInmetCapFeedXml(alertXml()), sourceHost: 'wis2bra.inmet.gov.br',
    sourceUrl: 'https://wis2bra.inmet.gov.br/data/', feedShape: 'WIS2_ARCHIVE_WINDOW_CAP', inventoryComplete: false };
  const national = validateCemadenNationalAlerts({ atualizado: '09-09-2026 18:59:00 UTC', alertas: [{
    cod_alerta: 1, codibge: 3304557, uf: 'RJ', municipio: 'RIO DE JANEIRO', evento: 'Risco Hidrológico - Alto',
    nivel: 'Alto', status: 1, datahoracriacao: '2026-09-09 15:00:00' }] }, { nowMillis: at });
  const worker = createOfficialSourceWorker({
    config: { enabled: true, initialMode: 'normal', inmetWarningsEnabled: true,
      inmetWis2Enabled: true, cemadenNationalEnabled: true },
    now: () => at, autoSchedule: false, maxConcurrency: 3,
    probeAlertaRio: async () => { throw Object.assign(new Error('source_network_error'), { code: 'source_network_error' }); },
    probeInmetWis2: async () => snapshot,
    probeInmetWarningsLive: async () => { throw new Error('RSS must not be used after verified WIS2'); },
    probeCemadenNational: async () => national,
  });
  worker.start(); await worker.tick();
  const s = buildRjPublicStatusSnapshot(worker, { nowMillis: at });
  assert.equal(s.usableOfficialProducts, true);
  assert.equal(s.warnings[0].sourceUrl, 'https://wis2bra.inmet.gov.br/data/');
  assert.equal(s.nationalAlerts.alerts[0].ibge, '3304557');
  assert.ok(s.municipalities.every(city => city.risk === null));
  assert.equal(s.municipalities.find(city => city.ibge === '3304557').warningIds.length, 1);
  assert.equal(s.municipalities.find(city => city.ibge === '3303302').warningIds.length, 0);
  assert.equal(projectWarningInventories(worker, at)[0].complete, false);
  worker.stop();
});
