#!/usr/bin/env bash
set -euo pipefail

workflow='.github/workflows/cloudrun-candidate.yml'
test -s "$workflow"

grep -F 'workflow_dispatch:' "$workflow" >/dev/null
grep -F 'id-token: write' "$workflow" >/dev/null
grep -F 'google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093' "$workflow" >/dev/null
grep -F 'google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db' "$workflow" >/dev/null
grep -F "version: '583.0.0'" "$workflow" >/dev/null
grep -F -- '--no-traffic' "$workflow" >/dev/null
grep -F 'promotion=BLOCKED_SEPARATE_EXPLICIT_GATE_REQUIRED' "$workflow" >/dev/null
grep -F 'deployment=NOT_RUN_EXPLICIT_APPROVAL_REQUIRED' "$workflow" >/dev/null
if grep -Eq '^[[:space:]]+(push|pull_request):' "$workflow"; then
  echo 'cloudrun workflow must remain manual-only' >&2
  exit 1
fi
if grep -F 'service_account_key' "$workflow" >/dev/null; then
  echo 'long-lived service-account key reference forbidden' >&2
  exit 1
fi
if grep -F 'update-traffic' "$workflow" >/dev/null || grep -F -- '--to-latest' "$workflow" >/dev/null; then
  echo 'candidate gate must not migrate production traffic' >&2
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
  BLAISE_MONTHLY_PRODUCT_ID=blaise_monthly
  BLAISE_ANNUAL_PRODUCT_ID=blaise_annual
  BLAISE_FIREBASE_PROJECT_ID=blaise-rj-prod
  BLAISE_PUBSUB_AUDIENCE=https://api.blaise.example/v1/google-play/rtdn
  BLAISE_PUBSUB_SERVICE_ACCOUNT=blaise-pubsub@blaise-rj-prod.iam.gserviceaccount.com
  BLAISE_P0_AUDIENCE=https://api.blaise.example/v1/internal/p0
  BLAISE_P0_SERVICE_ACCOUNT=blaise-p0svc@blaise-rj-prod.iam.gserviceaccount.com
  BLAISE_OBSERVABILITY_AUDIENCE=https://api.blaise.example/internal/metrics
  BLAISE_OBSERVABILITY_SERVICE_ACCOUNT=blaise-observe@blaise-rj-prod.iam.gserviceaccount.com
  BLAISE_FCM_P0_TOPIC=blaise-rj-p0
)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

env "${base_env[@]}" \
  BLAISE_CLOUDRUN_PREFLIGHT_RESULT_FILE="$tmp/valid.txt" \
  bash scripts/cloudrun-preflight.sh >/dev/null
grep -F 'CLOUDRUN_PREFLIGHT=PASS' "$tmp/valid.txt" >/dev/null
grep -F 'external_deployment=NOT_RUN_BY_PREFLIGHT' "$tmp/valid.txt" >/dev/null

expect_fail() {
  local name="$1"
  shift
  if env "${base_env[@]}" "$@" \
      BLAISE_CLOUDRUN_PREFLIGHT_RESULT_FILE="$tmp/${name}.txt" \
      bash scripts/cloudrun-preflight.sh >/dev/null 2>&1; then
    echo "expected cloudrun preflight failure: $name" >&2
    exit 1
  fi
  grep -F 'CLOUDRUN_PREFLIGHT=BLOCKED' "$tmp/${name}.txt" >/dev/null
}

expect_fail duplicate_products BLAISE_ANNUAL_PRODUCT_ID=blaise_monthly
expect_fail insecure_audience BLAISE_P0_AUDIENCE=http://api.blaise.example/v1/internal/p0
expect_fail malformed_deploy_identity BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT=owner@example.com
expect_fail malformed_wif BLAISE_GCP_WIF_PROVIDER=github-provider

printf '%s\n' \
  'CLOUDRUN_WORKFLOW_SELFTEST=PASS' \
  'manual_only=PASS' \
  'wif_keyless=PASS' \
  'zero_traffic_candidate=PASS' \
  'production_promotion_absent=PASS' \
  'preflight_fail_closed=PASS'
