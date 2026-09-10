import test from 'node:test';
import assert from 'node:assert/strict';

import { INMET_SOURCE_ID } from '../src/inmet-source.mjs';
import {
  InmetP0PublishError,
  createInternalP0HttpSender,
  publishStagedInmetP0Batch,
  stageInmetP0Batch,
} from '../src/inmet-p0-publish.mjs';

const NOW = Date.parse('2026-09-10T12:00:00Z');

function warning({
  identifier = 'urn:oid:2.49.0.0.76.0.2026.40000.1',
  event = 'Chuvas Intensas',
  severity = 'Severe',
  urgency = 'Immediate',
  certainty = 'Likely',
  sent = '2026-09-10T11:00:00Z',
  expires = '2026-09-10T15:00:00Z',
  ibges = ['3304557', '3304904'],
} = {}) {
  return {
    identifier,
    event,
    severity,
    urgency,
    certainty,
    sent,
    expires,
    affectsRioDeJaneiro: true,
    rjMunicipalityIbges: ibges,
    rjMatchMethod: 'CAP_IBGE_RJ_MUNICIPALITY',
  };
}

function snapshot(records = [warning()]) {
  return {
    sourceId: INMET_SOURCE_ID,
    rjWarnings: records,
  };
}

test('stages deterministic validated INMET P0 batch without publishing', () => {
  const batch = stageInmetP0Batch(snapshot(), NOW);
  assert.equal(batch.schema, 'inmet-p0-batch-v1');
  assert.equal(batch.sourceId, INMET_SOURCE_ID);
  assert.equal(batch.candidateCount, 2);
  assert.equal(batch.delivery, 'STAGED_NOT_PUBLISHED');
  assert.match(batch.batchSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(batch.alerts.map((alert) => alert.cityName).sort(), ['Rio de Janeiro', 'São Gonçalo']);
  assert.ok(batch.alerts.every((alert) => alert.authority === 'official' && alert.severity === 'P0'));
});

test('publishes the staged batch sequentially and records backend duplicates without exposing message names', async () => {
  const batch = stageInmetP0Batch(snapshot(), NOW);
  const seen = [];
  const result = await publishStagedInmetP0Batch(batch, {
    nowMillis: NOW,
    sendAlert: async (alert) => {
      seen.push(alert.id);
      return { accepted: true, duplicate: seen.length === 2, ignoredMessageName: 'projects/x/messages/secret' };
    },
  });
  assert.equal(result.acceptedCount, 2);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.newlyAcceptedCount, 1);
  assert.equal(result.delivery, 'BACKEND_P0_ENDPOINT_ACCEPTED');
  assert.deepEqual(seen, [...seen].sort());
  assert.equal('ignoredMessageName' in result, false);
});

test('rejects a tampered staged batch before any backend request', async () => {
  const batch = stageInmetP0Batch(snapshot(), NOW);
  const tampered = JSON.parse(JSON.stringify(batch));
  tampered.alerts[0].title = 'conteudo adulterado';
  let calls = 0;
  await assert.rejects(
    publishStagedInmetP0Batch(tampered, {
      nowMillis: NOW,
      sendAlert: async () => {
        calls += 1;
        return { accepted: true };
      },
    }),
    (error) => error instanceof InmetP0PublishError && error.code === 'inmet_p0_batch_digest_mismatch',
  );
  assert.equal(calls, 0);
});

test('revalidates expiry at publication time and fails closed before sending stale P0', async () => {
  const batch = stageInmetP0Batch(snapshot(), NOW);
  let calls = 0;
  await assert.rejects(
    publishStagedInmetP0Batch(batch, {
      nowMillis: Date.parse('2026-09-10T16:00:00Z'),
      sendAlert: async () => {
        calls += 1;
        return { accepted: true };
      },
    }),
    (error) => error instanceof InmetP0PublishError && error.code === 'inmet_p0_batch_alert_invalid',
  );
  assert.equal(calls, 0);
});

test('internal P0 sender requires HTTPS and accepts only the protected backend 202 contract', async () => {
  assert.throws(
    () => createInternalP0HttpSender({ baseUrl: 'http://example.com/', authorization: `Bearer ${'x'.repeat(40)}` }),
    (error) => error instanceof InmetP0PublishError && error.code === 'inmet_p0_backend_url_invalid',
  );

  let captured;
  const sendAlert = createInternalP0HttpSender({
    baseUrl: 'https://backend.example/',
    authorization: `Bearer ${'x'.repeat(40)}`,
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return {
        status: 202,
        text: async () => '{"accepted":true,"duplicate":true}',
      };
    },
  });
  const result = await sendAlert({ id: 'not-validated-here' });
  assert.deepEqual(result, { accepted: true, duplicate: true });
  assert.equal(captured.url, 'https://backend.example/v1/internal/p0');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers.authorization, `Bearer ${'x'.repeat(40)}`);
  assert.equal(captured.options.headers['content-type'], 'application/json');
});

test('backend rejection is reduced to a fixed error code', async () => {
  const sendAlert = createInternalP0HttpSender({
    baseUrl: 'https://backend.example/',
    authorization: `Bearer ${'x'.repeat(40)}`,
    fetchImpl: async () => ({ status: 401, text: async () => '{"error":"unauthorized"}' }),
  });
  await assert.rejects(
    sendAlert({}),
    (error) => error instanceof InmetP0PublishError && error.code === 'inmet_p0_backend_rejected',
  );
});
