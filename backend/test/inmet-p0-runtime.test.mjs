import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInmetP0RuntimePublisher,
  InmetP0RuntimeError,
  validateInmetP0RuntimeConfig,
} from '../src/inmet-p0-runtime.mjs';
import { stageInmetP0Batch } from '../src/inmet-p0-publish.mjs';
import { INMET_SOURCE_ID } from '../src/inmet-source.mjs';

const NOW = Date.parse('2026-09-11T15:00:00Z');

function stagedBatch() {
  return stageInmetP0Batch({
    sourceId: INMET_SOURCE_ID,
    rjWarnings: [{
      identifier: 'urn:oid:2.49.0.0.76.0.2026.50000.1',
      event: 'Chuvas Intensas',
      severity: 'Severe',
      urgency: 'Immediate',
      certainty: 'Likely',
      sent: '2026-09-11T14:00:00Z',
      expires: '2026-09-11T18:00:00Z',
      affectsRioDeJaneiro: true,
      rjMunicipalityIbges: ['3304557', '3304904'],
      rjMatchMethod: 'CAP_IBGE_RJ_MUNICIPALITY',
    }],
  }, NOW);
}

test('runtime publisher configuration requires matching HTTPS backend/audience and service account identity', () => {
  assert.deepEqual(validateInmetP0RuntimeConfig({
    baseUrl: 'https://blaise.example/',
    audience: 'https://blaise.example',
    serviceAccount: 'blaise-runtime@sample-project.iam.gserviceaccount.com',
  }), {
    baseUrl: 'https://blaise.example/',
    audience: 'https://blaise.example',
    serviceAccount: 'blaise-runtime@sample-project.iam.gserviceaccount.com',
  });

  assert.throws(
    () => validateInmetP0RuntimeConfig({
      baseUrl: 'http://blaise.example/',
      audience: 'http://blaise.example/',
      serviceAccount: 'blaise-runtime@sample-project.iam.gserviceaccount.com',
    }),
    (error) => error instanceof InmetP0RuntimeError
      && error.code === 'inmet_p0_runtime_backend_url_invalid',
  );
  assert.throws(
    () => validateInmetP0RuntimeConfig({
      baseUrl: 'https://blaise.example/',
      audience: 'https://other.example/',
      serviceAccount: 'blaise-runtime@sample-project.iam.gserviceaccount.com',
    }),
    (error) => error.code === 'inmet_p0_runtime_audience_backend_mismatch',
  );
  assert.throws(
    () => validateInmetP0RuntimeConfig({
      baseUrl: 'https://blaise.example/',
      audience: 'https://blaise.example/',
      serviceAccount: 'not-a-service-account@example.com',
    }),
    (error) => error.code === 'inmet_p0_runtime_service_account_invalid',
  );
});

test('runtime publisher refreshes OIDC authorization per alert and accepts only backend 202 contract', async () => {
  const batch = stagedBatch();
  let authCalls = 0;
  const requests = [];
  const publisher = await createInmetP0RuntimePublisher({
    baseUrl: 'https://blaise.example/',
    audience: 'https://blaise.example/',
    serviceAccount: 'blaise-runtime@sample-project.iam.gserviceaccount.com',
    authorizationProvider: async () => {
      authCalls += 1;
      return `Bearer ${String(authCalls).repeat(40)}`;
    },
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return {
        status: 202,
        text: async () => JSON.stringify({ accepted: true, duplicate: requests.length === 2 }),
      };
    },
  });

  const result = await publisher(batch, { nowMillis: NOW });
  assert.equal(result.acceptedCount, 2);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.newlyAcceptedCount, 1);
  assert.equal(result.delivery, 'BACKEND_P0_ENDPOINT_ACCEPTED');
  assert.equal(authCalls, 2);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.url === 'https://blaise.example/v1/internal/p0'));
  assert.ok(requests.every((request) => request.options.redirect === 'error'));
  assert.ok(requests.every((request) => request.options.headers.authorization.startsWith('Bearer ')));
});

test('runtime publisher fails closed when injected authorization provider is invalid', async () => {
  await assert.rejects(
    createInmetP0RuntimePublisher({
      baseUrl: 'https://blaise.example/',
      audience: 'https://blaise.example/',
      serviceAccount: 'blaise-runtime@sample-project.iam.gserviceaccount.com',
      authorizationProvider: 'not-a-function',
    }),
    (error) => error instanceof InmetP0RuntimeError
      && error.code === 'inmet_p0_runtime_authorization_provider_invalid',
  );
});
