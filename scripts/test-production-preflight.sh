#!/usr/bin/env bash
set -euo pipefail
umask 077

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script="$root/scripts/production-preflight.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

common=(
  BLAISE_MONTHLY_PRODUCT_ID=blaise_monthly
  BLAISE_ANNUAL_PRODUCT_ID=blaise_annual
  BLAISE_ENTITLEMENT_VERIFY_URL=https://backend.example.test/v1/entitlements/verify
  BLAISE_FIREBASE_APPLICATION_ID=1:123456789:android:abcdef123456
  BLAISE_FIREBASE_API_KEY=AIza-test-key
  BLAISE_FIREBASE_PROJECT_ID=blaise-test-project
  BLAISE_FIREBASE_SENDER_ID=123456789
  BLAISE_PUBSUB_AUDIENCE=https://backend.example.test/v1/google-play/rtdn
  BLAISE_PUBSUB_SERVICE_ACCOUNT=pubsub@blaise-test-project.iam.gserviceaccount.com
  BLAISE_P0_AUDIENCE=https://backend.example.test/v1/internal/p0
  BLAISE_P0_SERVICE_ACCOUNT=p0@blaise-test-project.iam.gserviceaccount.com
  BLAISE_OBSERVABILITY_AUDIENCE=https://backend.example.test/internal/metrics
  BLAISE_OBSERVABILITY_SERVICE_ACCOUNT=metrics@blaise-test-project.iam.gserviceaccount.com
)

run_pass() {
  local evidence="$tmp/pass"
  env "${common[@]}" \
    BLAISE_PREFLIGHT_EVIDENCE_DIR="$evidence" \
    BLAISE_PREFLIGHT_LIVE_PROBE=false \
    bash "$script"
  grep -Fx 'PRODUCTION_PREFLIGHT_CONFIG=PASS' "$evidence/gate.txt"
  grep -Fx 'PRODUCTION_PREFLIGHT_LIVE=NOT_RUN' "$evidence/gate.txt"
  grep -Fx 'reason=live_probe_disabled' "$evidence/gate.txt"
  ! grep -Fq 'blaise_monthly' "$evidence/gate.txt"
  ! grep -Fq 'AIza-test-key' "$evidence/gate.txt"
}

run_blocked() {
  local name="$1"
  local value="$2"
  local expected_reason="$3"
  local evidence="$tmp/$name"
  local status
  set +e
  env "${common[@]}" \
    "$name=$value" \
    BLAISE_PREFLIGHT_EVIDENCE_DIR="$evidence" \
    BLAISE_PREFLIGHT_LIVE_PROBE=false \
    bash "$script" >/dev/null 2>&1
  status=$?
  set -e
  [[ "$status" == '2' ]]
  grep -Fx 'PRODUCTION_PREFLIGHT_CONFIG=BLOCKED' "$evidence/gate.txt"
  grep -Fx "reason=$expected_reason" "$evidence/gate.txt"
}

run_pass
run_blocked BLAISE_ENTITLEMENT_VERIFY_URL http://backend.example.test/v1/entitlements/verify entitlement_verify_url_must_be_https
run_blocked BLAISE_ANNUAL_PRODUCT_ID blaise_monthly billing_product_ids_must_differ
run_blocked BLAISE_P0_SERVICE_ACCOUNT not-a-service-account p0_service_account_invalid

set +e
env "${common[@]}" \
  BLAISE_PREFLIGHT_EVIDENCE_DIR="$tmp/live-mode" \
  BLAISE_PREFLIGHT_LIVE_PROBE=typo \
  bash "$script" >/dev/null 2>&1
status=$?
set -e
[[ "$status" == '2' ]]
grep -Fx 'reason=live_probe_mode_must_be_true_or_false' "$tmp/live-mode/gate.txt"

result='PRODUCTION_PREFLIGHT_TESTS=PASS'
echo "$result"
if [[ -n "${BLAISE_PREFLIGHT_TEST_RESULT_FILE:-}" ]]; then
  mkdir -p "$(dirname "$BLAISE_PREFLIGHT_TEST_RESULT_FILE")"
  printf '%s\n' "$result" > "$BLAISE_PREFLIGHT_TEST_RESULT_FILE"
fi
