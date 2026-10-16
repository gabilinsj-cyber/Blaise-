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

run_missing() {
  local missing_name="$1"
  local evidence="$tmp/missing-$missing_name"
  local -a filtered=()
  local pair
  local status
  for pair in "${common[@]}"; do
    [[ "$pair" == "$missing_name="* ]] || filtered+=("$pair")
  done
  set +e
  env -u "$missing_name" "${filtered[@]}" \
    BLAISE_PREFLIGHT_EVIDENCE_DIR="$evidence" \
    BLAISE_PREFLIGHT_LIVE_PROBE=false \
    bash "$script" >/dev/null 2>&1
  status=$?
  set -e
  [[ "$status" == '2' ]]
  grep -Fx 'PRODUCTION_PREFLIGHT_CONFIG=BLOCKED' "$evidence/gate.txt"
  grep -Fx 'reason=missing_required_values' "$evidence/gate.txt"
  grep -Fq "$missing_name" "$evidence/gate.txt"
}

make_curl_stub() {
  local mode="$1"
  local bin_dir="$2"
  mkdir -p "$bin_dir"
  cat > "$bin_dir/curl" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
output=''
url=''
while (($#)); do
  case "$1" in
    --output)
      output="$2"
      shift 2
      ;;
    --write-out|--connect-timeout|--max-time)
      shift 2
      ;;
    --fail-with-body|--silent|--show-error)
      shift
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done
case "${BLAISE_TEST_CURL_MODE:?}" in
  pass)
    case "$url" in
      */healthz) printf '%s\n' '{"status":"ok"}' > "$output" ;;
      */readyz) printf '%s\n' '{"status":"ready"}' > "$output" ;;
      *) exit 22 ;;
    esac
    printf '200'
    ;;
  health-fail)
    exit 22
    ;;
  ready-fail)
    case "$url" in
      */healthz)
        printf '%s\n' '{"status":"ok"}' > "$output"
        printf '200'
        ;;
      */readyz)
        exit 22
        ;;
      *) exit 22 ;;
    esac
    ;;
  *) exit 64 ;;
esac
STUB
  chmod +x "$bin_dir/curl"
  export BLAISE_TEST_CURL_MODE="$mode"
}

run_live() {
  local mode="$1"
  local expected_status="$2"
  local expected_reason="${3:-}"
  local evidence="$tmp/live-$mode"
  local bin_dir="$tmp/bin-$mode"
  local status
  make_curl_stub "$mode" "$bin_dir"
  set +e
  env "${common[@]}" \
    PATH="$bin_dir:$PATH" \
    BLAISE_TEST_CURL_MODE="$BLAISE_TEST_CURL_MODE" \
    BLAISE_PREFLIGHT_EVIDENCE_DIR="$evidence" \
    BLAISE_PREFLIGHT_LIVE_PROBE=true \
    bash "$script" >/dev/null 2>&1
  status=$?
  set -e
  [[ "$status" == "$expected_status" ]]
  grep -Fx 'PRODUCTION_PREFLIGHT_CONFIG=PASS' "$evidence/gate.txt"
  if [[ "$expected_status" == '0' ]]; then
    grep -Fx 'PRODUCTION_PREFLIGHT_LIVE=PASS' "$evidence/gate.txt"
    grep -Fx 'backend_healthz=PASS' "$evidence/gate.txt"
    grep -Fx 'backend_readyz=PASS' "$evidence/gate.txt"
    grep -Fx '{"status":"ok"}' "$evidence/healthz.json"
    grep -Fx '{"status":"ready"}' "$evidence/readyz.json"
  else
    grep -Fx 'PRODUCTION_PREFLIGHT_LIVE=BLOCKED' "$evidence/gate.txt"
    grep -Fx "reason=$expected_reason" "$evidence/gate.txt"
  fi
}

run_pass
run_missing BLAISE_MONTHLY_PRODUCT_ID
run_blocked BLAISE_ENTITLEMENT_VERIFY_URL http://backend.example.test/v1/entitlements/verify entitlement_verify_url_must_be_https
run_blocked BLAISE_ANNUAL_PRODUCT_ID blaise_monthly billing_product_ids_must_differ
run_blocked BLAISE_P0_SERVICE_ACCOUNT not-a-service-account p0_service_account_invalid
run_live pass 0
run_live health-fail 3 healthz_probe_failed
run_live ready-fail 3 readyz_probe_failed

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
