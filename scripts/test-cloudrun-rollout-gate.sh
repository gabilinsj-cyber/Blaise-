#!/usr/bin/env bash
set -euo pipefail

workflow=.github/workflows/cloudrun-rollout.yml
[[ -s "$workflow" ]]

grep -F 'workflow_dispatch:' "$workflow" >/dev/null
! grep -Eq '^[[:space:]]+(push|pull_request|schedule):' "$workflow"
grep -F 'default: plan' "$workflow" >/dev/null
grep -F 'confirm_production_change:' "$workflow" >/dev/null
grep -F "inputs.operation != 'plan'" "$workflow" >/dev/null
grep -F 'google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093' "$workflow" >/dev/null
grep -F 'google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db' "$workflow" >/dev/null
grep -F "version: '583.0.0'" "$workflow" >/dev/null
grep -F -- '--no-traffic' "$workflow" >/dev/null
grep -F 'gcloud run services update-traffic' "$workflow" >/dev/null
grep -F 'gcloud auth print-identity-token' "$workflow" >/dev/null
grep -F 'CLOUD_RUN_ROLLOUT_GATE=BLOCKED_EXTERNAL_EXECUTION_NOT_REQUESTED' "$workflow" >/dev/null
grep -F 'CLOUD_RUN_ROLLOUT_GATE=PASS' "$workflow" >/dev/null
! grep -F 'credentials_json:' "$workflow"
! grep -F 'service_account_key' "$workflow"

echo 'CLOUD_RUN_ROLLOUT_SELFTEST=PASS'
