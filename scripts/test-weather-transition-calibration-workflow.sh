#!/usr/bin/env bash
set -euo pipefail

workflow=.github/workflows/weather-transition-calibration.yml

test -s "$workflow"
grep -F 'workflow_dispatch:' "$workflow" >/dev/null
if grep -Eq '^[[:space:]]*(push|schedule):' "$workflow"; then
  echo 'unexpected automatic trigger in weather transition calibration workflow' >&2
  exit 1
fi

grep -F 'id-token: write' "$workflow" >/dev/null
grep -F 'BLAISE_GCP_CALIBRATION_SERVICE_ACCOUNT' "$workflow" >/dev/null
grep -F 'dataset_gcs_uri' "$workflow" >/dev/null
grep -F 'google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093' "$workflow" >/dev/null
grep -F 'google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db' "$workflow" >/dev/null
grep -F "version: '583.0.0'" "$workflow" >/dev/null
grep -F 'gcloud storage objects describe' "$workflow" >/dev/null
grep -F 'gcloud storage cp' "$workflow" >/dev/null
grep -F 'generation_changed_during_copy' "$workflow" >/dev/null
grep -F -- '--require-production-pass' "$workflow" >/dev/null
grep -F 'productionConfidenceLabelAllowed' "$workflow" >/dev/null
grep -F 'BLOCKED_EXTERNAL_EXECUTION_NOT_REQUESTED' "$workflow" >/dev/null
grep -F 'blaise-weather-transition-calibration-evidence' "$workflow" >/dev/null

echo 'WEATHER_TRANSITION_CALIBRATION_WORKFLOW_SELFTEST=PASS'
