import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowPath = '../.github/workflows/inmet-p0-publish.yml';

test('INMET P0 publication workflow remains manual-only and fail-closed', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule):/m);
  assert.match(workflow, /execute_live_probe:/);
  assert.match(workflow, /execute_publish:/);
  assert.match(workflow, /PUBLISH_OFFICIAL_P0/);
  assert.match(workflow, /execute_publish requires execute_live_probe=true/);
  assert.match(workflow, /publication confirmation does not match/);
});

test('INMET P0 publication workflow uses pinned OIDC WIF identity without long-lived JSON key', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /google-github-actions\/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093/);
  assert.match(workflow, /token_format:\s*id_token/);
  assert.match(workflow, /id_token_include_email:\s*true/);
  assert.match(workflow, /create_credentials_file:\s*false/);
  assert.doesNotMatch(workflow, /credentials_json:/);
  assert.doesNotMatch(workflow, /SERVICE_ACCOUNT_KEY/);
});

test('INMET P0 publication workflow keeps device delivery evidence separate from backend acceptance', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /BACKEND_ACCEPTANCE_ONLY_DEVICE_DELIVERY_REQUIRES_SEPARATE_EVIDENCE/);
  assert.match(workflow, /fcmDelivery/);
  assert.match(workflow, /NOT_PROVEN/);
  assert.match(workflow, /blaise-inmet-p0-publication-evidence/);
});
