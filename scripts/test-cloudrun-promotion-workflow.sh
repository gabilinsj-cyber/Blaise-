#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/cloudrun-promotion.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Structural safety: manual only, keyless auth, pinned gcloud and explicit rollback.
grep -q '^  workflow_dispatch:' "$WORKFLOW"
! grep -q '^  push:' "$WORKFLOW"
! grep -q '^  schedule:' "$WORKFLOW"
grep -q 'default: false' "$WORKFLOW"
grep -q 'google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093' "$WORKFLOW"
grep -q 'google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db' "$WORKFLOW"
grep -q "version: '583.0.0'" "$WORKFLOW"
grep -q 'next_stage = {0: 1, 1: 5, 5: 10, 10: 25, 25: 50, 50: 100}' "$WORKFLOW"
grep -q 'rollback_on_error' "$WORKFLOW"
grep -q 'BLAISE_CLOUDRUN_PREVIOUS_CANDIDATE_PERCENT' "$WORKFLOW"
grep -q -- '--to-revisions=' "$WORKFLOW"
grep -q 'next_stage=REQUIRES_SEPARATE_EXPLICIT_WORKFLOW_DISPATCH' "$WORKFLOW"

base_env=(
  BLAISE_GCP_PROJECT_ID=blaise-prod1
  BLAISE_GCP_WIF_PROVIDER=projects/123456789/locations/global/workloadIdentityPools/github/providers/blaise
  BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT=blaise-deployer@blaise-prod1.iam.gserviceaccount.com
  BLAISE_CLOUDRUN_REGION=southamerica-east1
  BLAISE_CLOUDRUN_SERVICE=blaise-backend
)

env "${base_env[@]}" \
  BLAISE_CLOUDRUN_EXECUTE_PROMOTION=false \
  BLAISE_CLOUDRUN_PROMOTION_PREFLIGHT_RESULT_FILE="$TMP/false.txt" \
  bash "$ROOT/scripts/cloudrun-promotion-preflight.sh" >/dev/null
grep -q 'CLOUDRUN_PROMOTION_PREFLIGHT=PASS' "$TMP/false.txt"
grep -q 'execute_promotion=false' "$TMP/false.txt"

env "${base_env[@]}" \
  BLAISE_CLOUDRUN_EXECUTE_PROMOTION=true \
  BLAISE_CLOUDRUN_CANDIDATE_REVISION=blaise-backend-00001-abc \
  BLAISE_CLOUDRUN_CANDIDATE_TAG=candidate-deadbeef \
  BLAISE_CLOUDRUN_TARGET_PERCENT=1 \
  BLAISE_CLOUDRUN_PROMOTION_PREFLIGHT_RESULT_FILE="$TMP/true.txt" \
  bash "$ROOT/scripts/cloudrun-promotion-preflight.sh" >/dev/null
grep -q 'CLOUDRUN_PROMOTION_PREFLIGHT=PASS' "$TMP/true.txt"

set +e
env "${base_env[@]}" \
  BLAISE_CLOUDRUN_EXECUTE_PROMOTION=true \
  BLAISE_CLOUDRUN_CANDIDATE_REVISION=blaise-backend-00001-abc \
  BLAISE_CLOUDRUN_CANDIDATE_TAG=candidate-deadbeef \
  BLAISE_CLOUDRUN_TARGET_PERCENT=7 \
  BLAISE_CLOUDRUN_PROMOTION_PREFLIGHT_RESULT_FILE="$TMP/bad-percent.txt" \
  bash "$ROOT/scripts/cloudrun-promotion-preflight.sh" >/dev/null 2>&1
bad_percent_rc=$?

env "${base_env[@]}" \
  BLAISE_CLOUDRUN_EXECUTE_PROMOTION=true \
  BLAISE_CLOUDRUN_CANDIDATE_REVISION=other-service-00001-abc \
  BLAISE_CLOUDRUN_CANDIDATE_TAG=candidate-deadbeef \
  BLAISE_CLOUDRUN_TARGET_PERCENT=1 \
  BLAISE_CLOUDRUN_PROMOTION_PREFLIGHT_RESULT_FILE="$TMP/bad-revision.txt" \
  bash "$ROOT/scripts/cloudrun-promotion-preflight.sh" >/dev/null 2>&1
bad_revision_rc=$?
set -e

test "$bad_percent_rc" -ne 0
test "$bad_revision_rc" -ne 0
grep -q 'reason=invalid_target_percent' "$TMP/bad-percent.txt"
grep -q 'reason=candidate_revision_service_mismatch' "$TMP/bad-revision.txt"

printf '%s\n' 'CLOUDRUN_PROMOTION_WORKFLOW_SELFTEST=PASS'
