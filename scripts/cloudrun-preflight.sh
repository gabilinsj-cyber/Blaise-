#!/usr/bin/env bash
set -euo pipefail

result_file="${BLAISE_CLOUDRUN_PREFLIGHT_RESULT_FILE:-evidence/cloudrun/preflight.txt}"
mkdir -p "$(dirname "$result_file")"

fail() {
  printf '%s\n' \
    'CLOUDRUN_PREFLIGHT=BLOCKED' \
    "reason=$1" \
    'secrets=REDACTED' \
    > "$result_file"
  echo "BLOCKED: $1" >&2
  exit 2
}

require_var() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "missing_${name}"
}

for name in \
  BLAISE_GCP_PROJECT_ID \
  BLAISE_GCP_WIF_PROVIDER \
  BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT \
  BLAISE_CLOUDRUN_RUNTIME_SERVICE_ACCOUNT \
  BLAISE_CLOUDRUN_REGION \
  BLAISE_CLOUDRUN_SERVICE \
  BLAISE_ARTIFACT_REGISTRY_REPOSITORY \
  BLAISE_MONTHLY_PRODUCT_ID \
  BLAISE_ANNUAL_PRODUCT_ID \
  BLAISE_FIREBASE_PROJECT_ID \
  BLAISE_PUBSUB_AUDIENCE \
  BLAISE_PUBSUB_SERVICE_ACCOUNT \
  BLAISE_P0_AUDIENCE \
  BLAISE_P0_SERVICE_ACCOUNT \
  BLAISE_OBSERVABILITY_AUDIENCE \
  BLAISE_OBSERVABILITY_SERVICE_ACCOUNT; do
  require_var "$name"
done

project="$BLAISE_GCP_PROJECT_ID"
[[ "$project" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || fail 'invalid_gcp_project_id'
[[ "$BLAISE_FIREBASE_PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || fail 'invalid_firebase_project_id'
[[ "$BLAISE_CLOUDRUN_REGION" =~ ^[a-z]+-[a-z0-9]+[0-9]$ ]] || fail 'invalid_cloudrun_region'
[[ "$BLAISE_CLOUDRUN_SERVICE" =~ ^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'invalid_cloudrun_service'
[[ "$BLAISE_ARTIFACT_REGISTRY_REPOSITORY" =~ ^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'invalid_artifact_registry_repository'
[[ "$BLAISE_GCP_WIF_PROVIDER" =~ ^projects/[0-9]+/locations/global/workloadIdentityPools/[A-Za-z0-9._-]+/providers/[A-Za-z0-9._-]+$ ]] || fail 'invalid_wif_provider'

same_project_sa_re="^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]@${project}\\.iam\\.gserviceaccount\\.com$"
[[ "$BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT" =~ $same_project_sa_re ]] || fail 'invalid_cloudrun_deploy_service_account'
[[ "$BLAISE_CLOUDRUN_RUNTIME_SERVICE_ACCOUNT" =~ $same_project_sa_re ]] || fail 'invalid_cloudrun_runtime_service_account'

generic_sa_re='^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$'
for value in \
  "$BLAISE_PUBSUB_SERVICE_ACCOUNT" \
  "$BLAISE_P0_SERVICE_ACCOUNT" \
  "$BLAISE_OBSERVABILITY_SERVICE_ACCOUNT"; do
  [[ "$value" =~ $generic_sa_re ]] || fail 'invalid_service_to_service_account'
done

for value in \
  "$BLAISE_PUBSUB_AUDIENCE" \
  "$BLAISE_P0_AUDIENCE" \
  "$BLAISE_OBSERVABILITY_AUDIENCE"; do
  [[ "$value" =~ ^https://[^[:space:]]+$ ]] || fail 'invalid_oidc_audience'
done

[[ "$BLAISE_MONTHLY_PRODUCT_ID" != "$BLAISE_ANNUAL_PRODUCT_ID" ]] || fail 'duplicate_play_product_ids'
for value in "$BLAISE_MONTHLY_PRODUCT_ID" "$BLAISE_ANNUAL_PRODUCT_ID"; do
  [[ ${#value} -le 128 ]] || fail 'play_product_id_too_long'
  [[ ! "$value" =~ [[:space:]] ]] || fail 'play_product_id_contains_whitespace'
done

if [[ -n "${BLAISE_FCM_P0_TOPIC:-}" ]]; then
  [[ "$BLAISE_FCM_P0_TOPIC" =~ ^[A-Za-z0-9._~-]{1,900}$ ]] || fail 'invalid_fcm_p0_topic'
fi

printf '%s\n' \
  'CLOUDRUN_PREFLIGHT=PASS' \
  'wif=PASS_KEYLESS' \
  'deploy_identity=PASS_USER_MANAGED_SERVICE_ACCOUNT' \
  'runtime_identity=PASS_USER_MANAGED_SERVICE_ACCOUNT' \
  'artifact_registry=PASS_FORMAT' \
  'cloudrun_target=PASS_FORMAT' \
  'billing_runtime_config=PASS_FORMAT' \
  'oidc_internal_routes=PASS_FORMAT' \
  'external_deployment=NOT_RUN_BY_PREFLIGHT' \
  'secrets=REDACTED' \
  > "$result_file"

cat "$result_file"
