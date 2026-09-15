#!/usr/bin/env bash
set -euo pipefail

result_file="${BLAISE_CLOUDRUN_READINESS_RESULT_FILE:-evidence/cloudrun-readiness/preflight.txt}"
mkdir -p "$(dirname "$result_file")"

fail() {
  printf '%s\n' \
    'CLOUDRUN_READINESS_PREFLIGHT=BLOCKED' \
    "reason=$1" \
    'external_mutation=NOT_RUN' \
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
  BLAISE_ARTIFACT_REGISTRY_REPOSITORY; do
  require_var "$name"
done

project="$BLAISE_GCP_PROJECT_ID"
[[ "$project" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || fail 'invalid_gcp_project_id'
[[ "$BLAISE_CLOUDRUN_REGION" =~ ^[a-z]+-[a-z0-9]+[0-9]$ ]] || fail 'invalid_cloudrun_region'
[[ "$BLAISE_CLOUDRUN_SERVICE" =~ ^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'invalid_cloudrun_service'
[[ "$BLAISE_ARTIFACT_REGISTRY_REPOSITORY" =~ ^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'invalid_artifact_registry_repository'
[[ "$BLAISE_GCP_WIF_PROVIDER" =~ ^projects/[0-9]+/locations/global/workloadIdentityPools/[A-Za-z0-9._-]+/providers/[A-Za-z0-9._-]+$ ]] || fail 'invalid_wif_provider'

same_project_sa_re="^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]@${project}\\.iam\\.gserviceaccount\\.com$"
[[ "$BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT" =~ $same_project_sa_re ]] || fail 'invalid_cloudrun_deploy_service_account'
[[ "$BLAISE_CLOUDRUN_RUNTIME_SERVICE_ACCOUNT" =~ $same_project_sa_re ]] || fail 'invalid_cloudrun_runtime_service_account'
[[ "$BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT" != "$BLAISE_CLOUDRUN_RUNTIME_SERVICE_ACCOUNT" ]] || fail 'deploy_and_runtime_service_accounts_must_differ'

printf '%s\n' \
  'CLOUDRUN_READINESS_PREFLIGHT=PASS' \
  'wif_provider=PASS_FORMAT' \
  'deploy_identity=PASS_DEDICATED_SERVICE_ACCOUNT' \
  'runtime_identity=PASS_SEPARATE_SERVICE_ACCOUNT' \
  'artifact_registry=PASS_FORMAT' \
  'cloudrun_target=PASS_FORMAT' \
  'external_probe=NOT_RUN_BY_PREFLIGHT' \
  'external_mutation=NOT_RUN' \
  'secrets=REDACTED' \
  > "$result_file"

cat "$result_file"
