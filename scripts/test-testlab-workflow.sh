#!/usr/bin/env bash
set -euo pipefail

workflow=.github/workflows/firebase-testlab.yml
policy=firebase/testlab.yml

test -f "$workflow"
test -f "$policy"

grep -Fx '  workflow_dispatch:' "$workflow"
if grep -Eq '^  (push|pull_request|schedule):' "$workflow"; then
  echo 'Firebase Test Lab workflow must remain manual-only' >&2
  exit 1
fi

grep -F 'google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093' "$workflow"
grep -F 'google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db' "$workflow"
grep -F "version: '583.0.0'" "$workflow"
grep -F 'default: false' "$workflow"
grep -F 'gcloud firebase test android models list' "$workflow"
grep -F -- '--filter=virtual' "$workflow"
grep -F 'gcloud firebase test android models describe' "$workflow"
grep -F 'gcloud firebase test android versions describe' "$workflow"
grep -F "model.get('supportedVersionIds', [])" "$workflow"
grep -F "('deprecated', 'reduced_stability')" "$workflow"
grep -F 'execution=NOT_RUN_EXPLICIT_APPROVAL_REQUIRED' "$workflow"
grep -F 'selection: live_catalog_required' "$policy"
grep -F 'mode: github_oidc_workload_identity_federation' "$policy"
grep -F 'long_lived_service_account_key: forbidden' "$policy"

if grep -Fq 'Pixel2' "$policy"; then
  echo 'Static Pixel2 target is forbidden; use the live catalog' >&2
  exit 1
fi
if grep -Eq '^[[:space:]]*version:[[:space:]]*30([[:space:]]|$)' "$policy"; then
  echo 'Static API 30 target is forbidden; use the live catalog' >&2
  exit 1
fi
if grep -Eq 'credentials_json|service_account_key_file|service-account-key' "$workflow"; then
  echo 'Long-lived service-account JSON credentials are forbidden' >&2
  exit 1
fi

printf '%s\n' 'FIREBASE_TESTLAB_WORKFLOW_SELFTEST=PASS'
