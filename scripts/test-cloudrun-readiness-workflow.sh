#!/usr/bin/env bash
set -euo pipefail

workflow='.github/workflows/cloudrun-readiness.yml'
test -s "$workflow"

grep -F 'workflow_dispatch:' "$workflow" >/dev/null
grep -F 'execute_probe:' "$workflow" >/dev/null
grep -F 'default: false' "$workflow" >/dev/null
grep -F 'id-token: write' "$workflow" >/dev/null
grep -F 'google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093' "$workflow" >/dev/null
grep -F 'google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db' "$workflow" >/dev/null
grep -F "version: '583.0.0'" "$workflow" >/dev/null
grep -F 'gcloud artifacts repositories describe' "$workflow" >/dev/null
grep -F 'gcloud run services list' "$workflow" >/dev/null
grep -F 'external_mutation=NOT_RUN' "$workflow" >/dev/null
grep -F 'wif_auth=NOT_RUN_EXPLICIT_APPROVAL_REQUIRED' "$workflow" >/dev/null

if grep -Eq '^[[:space:]]+(push|pull_request|schedule):' "$workflow"; then
  echo 'cloudrun readiness workflow must remain manual-only' >&2
  exit 1
fi
if grep -Eq 'gcloud[[:space:]]+run[[:space:]]+(deploy|services[[:space:]]+update|services[[:space:]]+update-traffic|services[[:space:]]+delete)' "$workflow"; then
  echo 'readiness workflow must not mutate Cloud Run' >&2
  exit 1
fi
if grep -Eq 'gcloud[[:space:]]+artifacts[[:space:]]+repositories[[:space:]]+(create|delete|update)' "$workflow"; then
  echo 'readiness workflow must not mutate Artifact Registry' >&2
  exit 1
fi
if grep -F 'docker push' "$workflow" >/dev/null; then
  echo 'readiness workflow must not push images' >&2
  exit 1
fi
if grep -F 'service_account_key' "$workflow" >/dev/null; then
  echo 'long-lived service-account key reference forbidden' >&2
  exit 1
fi

base_env=(
  BLAISE_GCP_PROJECT_ID=blaise-rj-prod
  BLAISE_GCP_WIF_PROVIDER=projects/123456789012/locations/global/workloadIdentityPools/github/providers/blaise
  BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT=blaise-deploy@blaise-rj-prod.iam.gserviceaccount.com
  BLAISE_CLOUDRUN_RUNTIME_SERVICE_ACCOUNT=blaise-runtime@blaise-rj-prod.iam.gserviceaccount.com
  BLAISE_CLOUDRUN_REGION=southamerica-east1
  BLAISE_CLOUDRUN_SERVICE=blaise-entitlement
  BLAISE_ARTIFACT_REGISTRY_REPOSITORY=blaise-backend
)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

env "${base_env[@]}" \
  BLAISE_CLOUDRUN_READINESS_RESULT_FILE="$tmp/valid.txt" \
  bash scripts/cloudrun-readiness-preflight.sh >/dev/null
grep -F 'CLOUDRUN_READINESS_PREFLIGHT=PASS' "$tmp/valid.txt" >/dev/null
grep -F 'runtime_identity=PASS_SEPARATE_SERVICE_ACCOUNT' "$tmp/valid.txt" >/dev/null
grep -F 'external_mutation=NOT_RUN' "$tmp/valid.txt" >/dev/null

expect_fail() {
  local name="$1"
  shift
  if env "${base_env[@]}" "$@" \
      BLAISE_CLOUDRUN_READINESS_RESULT_FILE="$tmp/${name}.txt" \
      bash scripts/cloudrun-readiness-preflight.sh >/dev/null 2>&1; then
    echo "expected cloudrun readiness failure: $name" >&2
    exit 1
  fi
  grep -F 'CLOUDRUN_READINESS_PREFLIGHT=BLOCKED' "$tmp/${name}.txt" >/dev/null
}

expect_fail malformed_project BLAISE_GCP_PROJECT_ID='BAD_PROJECT'
expect_fail malformed_wif BLAISE_GCP_WIF_PROVIDER='github-provider'
expect_fail malformed_region BLAISE_CLOUDRUN_REGION='southamerica'
expect_fail shared_identity BLAISE_CLOUDRUN_RUNTIME_SERVICE_ACCOUNT=blaise-deploy@blaise-rj-prod.iam.gserviceaccount.com

printf '%s\n' \
  'CLOUDRUN_READINESS_WORKFLOW_SELFTEST=PASS' \
  'manual_only=PASS' \
  'default_no_external_probe=PASS' \
  'wif_keyless=PASS' \
  'read_only_control_plane=PASS' \
  'separate_deploy_runtime_identity=PASS' \
  'preflight_fail_closed=PASS'
