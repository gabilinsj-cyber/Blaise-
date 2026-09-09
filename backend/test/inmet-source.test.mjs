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
