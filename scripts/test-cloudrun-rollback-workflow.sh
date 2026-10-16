#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/cloudrun-rollback.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Structural safety: manual-only, keyless auth, pinned CLI, explicit confirmation,
# exact digest binding, 100% target traffic and automatic restoration on failure.
grep -q '^  workflow_dispatch:' "$WORKFLOW"
! grep -q '^  push:' "$WORKFLOW"
! grep -q '^  schedule:' "$WORKFLOW"
grep -q 'default: false' "$WORKFLOW"
grep -q 'ROLLBACK_BLAISE_PRODUCTION' "$WORKFLOW"
grep -q 'google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093' "$WORKFLOW"
grep -q 'google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db' "$WORKFLOW"
grep -q "version: '583.0.0'" "$WORKFLOW"
grep -q 'imageDigest' "$WORKFLOW"
grep -q 'rollback target revision is not Ready' "$WORKFLOW"
grep -q 'restore_on_error' "$WORKFLOW"
grep -q 'BLAISE_CLOUDRUN_PREVIOUS_TRAFFIC_SPEC' "$WORKFLOW"
grep -q -- '--to-revisions=' "$WORKFLOW"
grep -q 'target_traffic_percent=100' "$WORKFLOW"
grep -q 'automatic_restore=READY_NOT_EXECUTED' "$WORKFLOW"
grep -q 'blaise-cloudrun-rollback-evidence' "$WORKFLOW"

base_env=(
  BLAISE_GCP_PROJECT_ID=blaise-prod1
  BLAISE_GCP_WIF_PROVIDER=projects/123456789/locations/global/workloadIdentityPools/github/providers/blaise
  BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT=blaise-deployer@blaise-prod1.iam.gserviceaccount.com
  BLAISE_CLOUDRUN_REGION=southamerica-east1
  BLAISE_CLOUDRUN_SERVICE=blaise-backend
)

env "${base_env[@]}" \
  BLAISE_CLOUDRUN_EXECUTE_ROLLBACK=false \
  BLAISE_CLOUDRUN_ROLLBACK_PREFLIGHT_RESULT_FILE="$TMP/false.txt" \
  bash "$ROOT/scripts/cloudrun-rollback-preflight.sh" >/dev/null
grep -q 'CLOUDRUN_ROLLBACK_PREFLIGHT=PASS' "$TMP/false.txt"
grep -q 'execute_rollback=false' "$TMP/false.txt"

good_digest="sha256:$(printf 'a%.0s' {1..64})"
env "${base_env[@]}" \
  BLAISE_CLOUDRUN_EXECUTE_ROLLBACK=true \
  BLAISE_CLOUDRUN_ROLLBACK_TARGET_REVISION=blaise-backend-00001-abc \
  BLAISE_CLOUDRUN_ROLLBACK_EXPECTED_DIGEST="$good_digest" \
  BLAISE_CLOUDRUN_ROLLBACK_CONFIRMATION=ROLLBACK_BLAISE_PRODUCTION \
  BLAISE_CLOUDRUN_ROLLBACK_PREFLIGHT_RESULT_FILE="$TMP/true.txt" \
  bash "$ROOT/scripts/cloudrun-rollback-preflight.sh" >/dev/null
grep -q 'CLOUDRUN_ROLLBACK_PREFLIGHT=PASS' "$TMP/true.txt"

set +e
env "${base_env[@]}" \
  BLAISE_CLOUDRUN_EXECUTE_ROLLBACK=true \
  BLAISE_CLOUDRUN_ROLLBACK_TARGET_REVISION=blaise-backend-00001-abc \
  BLAISE_CLOUDRUN_ROLLBACK_EXPECTED_DIGEST="$good_digest" \
  BLAISE_CLOUDRUN_ROLLBACK_CONFIRMATION=WRONG \
  BLAISE_CLOUDRUN_ROLLBACK_PREFLIGHT_RESULT_FILE="$TMP/bad-confirmation.txt" \
  bash "$ROOT/scripts/cloudrun-rollback-preflight.sh" >/dev/null 2>&1
bad_confirmation_rc=$?

env "${base_env[@]}" \
  BLAISE_CLOUDRUN_EXECUTE_ROLLBACK=true \
  BLAISE_CLOUDRUN_ROLLBACK_TARGET_REVISION=blaise-backend-00001-abc \
  BLAISE_CLOUDRUN_ROLLBACK_EXPECTED_DIGEST=sha256:1234 \
  BLAISE_CLOUDRUN_ROLLBACK_CONFIRMATION=ROLLBACK_BLAISE_PRODUCTION \
  BLAISE_CLOUDRUN_ROLLBACK_PREFLIGHT_RESULT_FILE="$TMP/bad-digest.txt" \
  bash "$ROOT/scripts/cloudrun-rollback-preflight.sh" >/dev/null 2>&1
bad_digest_rc=$?

env "${base_env[@]}" \
  BLAISE_CLOUDRUN_EXECUTE_ROLLBACK=true \
  BLAISE_CLOUDRUN_ROLLBACK_TARGET_REVISION=other-service-00001-abc \
  BLAISE_CLOUDRUN_ROLLBACK_EXPECTED_DIGEST="$good_digest" \
  BLAISE_CLOUDRUN_ROLLBACK_CONFIRMATION=ROLLBACK_BLAISE_PRODUCTION \
  BLAISE_CLOUDRUN_ROLLBACK_PREFLIGHT_RESULT_FILE="$TMP/bad-revision.txt" \
  bash "$ROOT/scripts/cloudrun-rollback-preflight.sh" >/dev/null 2>&1
bad_revision_rc=$?
set -e

test "$bad_confirmation_rc" -ne 0
test "$bad_digest_rc" -ne 0
test "$bad_revision_rc" -ne 0
grep -q 'reason=invalid_rollback_confirmation' "$TMP/bad-confirmation.txt"
grep -q 'reason=invalid_rollback_expected_digest' "$TMP/bad-digest.txt"
grep -q 'reason=rollback_target_revision_service_mismatch' "$TMP/bad-revision.txt"

printf '%s\n' 'CLOUDRUN_ROLLBACK_WORKFLOW_SELFTEST=PASS'
