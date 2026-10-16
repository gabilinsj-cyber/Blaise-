#!/usr/bin/env bash
set -euo pipefail

result_file="${BLAISE_CLOUDRUN_ROLLBACK_PREFLIGHT_RESULT_FILE:-evidence/cloudrun-rollback/preflight.txt}"
mkdir -p "$(dirname "$result_file")"

fail() {
  printf '%s\n' \
    'CLOUDRUN_ROLLBACK_PREFLIGHT=BLOCKED' \
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
  BLAISE_CLOUDRUN_REGION \
  BLAISE_CLOUDRUN_SERVICE \
  BLAISE_CLOUDRUN_EXECUTE_ROLLBACK; do
  require_var "$name"
done

project="$BLAISE_GCP_PROJECT_ID"
[[ "$project" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || fail 'invalid_gcp_project_id'
[[ "$BLAISE_CLOUDRUN_REGION" =~ ^[a-z]+-[a-z0-9]+[0-9]$ ]] || fail 'invalid_cloudrun_region'
[[ "$BLAISE_CLOUDRUN_SERVICE" =~ ^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'invalid_cloudrun_service'
[[ "$BLAISE_GCP_WIF_PROVIDER" =~ ^projects/[0-9]+/locations/global/workloadIdentityPools/[A-Za-z0-9._-]+/providers/[A-Za-z0-9._-]+$ ]] || fail 'invalid_wif_provider'

same_project_sa_re="^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]@${project}\\.iam\\.gserviceaccount\\.com$"
[[ "$BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT" =~ $same_project_sa_re ]] || fail 'invalid_cloudrun_deploy_service_account'

case "$BLAISE_CLOUDRUN_EXECUTE_ROLLBACK" in
  true|false) ;;
  *) fail 'invalid_execute_rollback_mode' ;;
esac

if [[ "$BLAISE_CLOUDRUN_EXECUTE_ROLLBACK" == 'true' ]]; then
  require_var BLAISE_CLOUDRUN_ROLLBACK_TARGET_REVISION
  require_var BLAISE_CLOUDRUN_ROLLBACK_EXPECTED_DIGEST
  require_var BLAISE_CLOUDRUN_ROLLBACK_CONFIRMATION

  [[ "$BLAISE_CLOUDRUN_ROLLBACK_TARGET_REVISION" =~ ^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'invalid_rollback_target_revision'
  [[ "$BLAISE_CLOUDRUN_ROLLBACK_TARGET_REVISION" == "$BLAISE_CLOUDRUN_SERVICE"-* ]] || fail 'rollback_target_revision_service_mismatch'
  [[ "$BLAISE_CLOUDRUN_ROLLBACK_EXPECTED_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 'invalid_rollback_expected_digest'
  [[ "$BLAISE_CLOUDRUN_ROLLBACK_CONFIRMATION" == 'ROLLBACK_BLAISE_PRODUCTION' ]] || fail 'invalid_rollback_confirmation'
fi

printf '%s\n' \
  'CLOUDRUN_ROLLBACK_PREFLIGHT=PASS' \
  'wif=PASS_KEYLESS' \
  'rollback_identity=PASS_USER_MANAGED_SERVICE_ACCOUNT' \
  "execute_rollback=${BLAISE_CLOUDRUN_EXECUTE_ROLLBACK}" \
  'target_binding=PASS_FORMAT_OR_NOT_REQUESTED' \
  'typed_confirmation=PASS_OR_NOT_REQUESTED' \
  'external_traffic_change=NOT_RUN_BY_PREFLIGHT' \
  'secrets=REDACTED' \
  > "$result_file"

cat "$result_file"
