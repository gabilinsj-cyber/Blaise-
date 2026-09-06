#!/usr/bin/env bash
set -euo pipefail
umask 077

EVIDENCE_DIR="${BLAISE_PREFLIGHT_EVIDENCE_DIR:-evidence/production-preflight}"
mkdir -p "$EVIDENCE_DIR"
GATE_FILE="$EVIDENCE_DIR/gate.txt"
: > "$GATE_FILE"

required=(
  BLAISE_MONTHLY_PRODUCT_ID
  BLAISE_ANNUAL_PRODUCT_ID
  BLAISE_ENTITLEMENT_VERIFY_URL
  BLAISE_FIREBASE_APPLICATION_ID
  BLAISE_FIREBASE_API_KEY
  BLAISE_FIREBASE_PROJECT_ID
  BLAISE_FIREBASE_SENDER_ID
  BLAISE_PUBSUB_AUDIENCE
  BLAISE_PUBSUB_SERVICE_ACCOUNT
  BLAISE_P0_AUDIENCE
  BLAISE_P0_SERVICE_ACCOUNT
  BLAISE_OBSERVABILITY_AUDIENCE
  BLAISE_OBSERVABILITY_SERVICE_ACCOUNT
)

missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  {
    echo 'PRODUCTION_PREFLIGHT_CONFIG=BLOCKED'
    echo 'reason=missing_required_values'
    printf 'missing=%s\n' "${missing[*]}"
  } > "$GATE_FILE"
  echo 'BLOCKED: missing required production values:' >&2
  printf ' - %s\n' "${missing[@]}" >&2
  exit 2
fi

fail() {
  local code="$1"
  printf '%s\n' 'PRODUCTION_PREFLIGHT_CONFIG=BLOCKED' "reason=$code" > "$GATE_FILE"
  echo "BLOCKED: $code" >&2
  exit 2
}

https_url() {
  [[ "$1" == https://* && "$1" != *[[:space:]]* ]]
}

service_account() {
  [[ "$1" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.iam\.gserviceaccount\.com$ ]]
}

[[ "$BLAISE_MONTHLY_PRODUCT_ID" != "$BLAISE_ANNUAL_PRODUCT_ID" ]] || fail 'billing_product_ids_must_differ'
[[ "$BLAISE_MONTHLY_PRODUCT_ID" != *[[:space:]]* ]] || fail 'monthly_product_id_contains_whitespace'
[[ "$BLAISE_ANNUAL_PRODUCT_ID" != *[[:space:]]* ]] || fail 'annual_product_id_contains_whitespace'
https_url "$BLAISE_ENTITLEMENT_VERIFY_URL" || fail 'entitlement_verify_url_must_be_https'
https_url "$BLAISE_PUBSUB_AUDIENCE" || fail 'pubsub_audience_must_be_https'
https_url "$BLAISE_P0_AUDIENCE" || fail 'p0_audience_must_be_https'
https_url "$BLAISE_OBSERVABILITY_AUDIENCE" || fail 'observability_audience_must_be_https'
service_account "$BLAISE_PUBSUB_SERVICE_ACCOUNT" || fail 'pubsub_service_account_invalid'
service_account "$BLAISE_P0_SERVICE_ACCOUNT" || fail 'p0_service_account_invalid'
service_account "$BLAISE_OBSERVABILITY_SERVICE_ACCOUNT" || fail 'observability_service_account_invalid'
[[ "$BLAISE_FIREBASE_APPLICATION_ID" == 1:*:android:* ]] || fail 'firebase_application_id_invalid'
[[ "$BLAISE_FIREBASE_SENDER_ID" =~ ^[0-9]+$ ]] || fail 'firebase_sender_id_invalid'
[[ "$BLAISE_FIREBASE_PROJECT_ID" != *[[:space:]]* ]] || fail 'firebase_project_id_contains_whitespace'
[[ "$BLAISE_FIREBASE_API_KEY" != *[[:space:]]* ]] || fail 'firebase_api_key_contains_whitespace'

printf '%s\n' \
  'PRODUCTION_PREFLIGHT_CONFIG=PASS' \
  'billing_products=CONFIGURED' \
  'entitlement_backend_url=HTTPS_CONFIGURED' \
  'firebase_android=CONFIGURED' \
  'pubsub_rtdn_identity=CONFIGURED' \
  'p0_service_identity=CONFIGURED' \
  'observability_identity=CONFIGURED' \
  > "$GATE_FILE"

if [[ "${BLAISE_PREFLIGHT_LIVE_PROBE:-false}" != 'true' ]]; then
  printf '%s\n' \
    'PRODUCTION_PREFLIGHT_LIVE=NOT_RUN' \
    'reason=set_BLAISE_PREFLIGHT_LIVE_PROBE_true_for_external_https_probe' \
    >> "$GATE_FILE"
  exit 0
fi

base_url="${BLAISE_BACKEND_BASE_URL:-}"
if [[ -z "$base_url" ]]; then
  suffix='/v1/entitlements/verify'
  [[ "$BLAISE_ENTITLEMENT_VERIFY_URL" == *"$suffix" ]] || fail 'backend_base_url_required_when_verify_url_has_nonstandard_path'
  base_url="${BLAISE_ENTITLEMENT_VERIFY_URL%$suffix}"
fi
https_url "$base_url" || fail 'backend_base_url_must_be_https'
base_url="${base_url%/}"

probe_json() {
  local path="$1"
  local expected="$2"
  local output="$3"
  local status
  status="$(curl --fail-with-body --silent --show-error \
    --connect-timeout 5 --max-time 10 \
    --output "$output" --write-out '%{http_code}' \
    "$base_url$path")" || return 1
  [[ "$status" == '200' ]] || return 1
  grep -Fq "$expected" "$output"
}

probe_json '/healthz' '"status":"ok"' "$EVIDENCE_DIR/healthz.json" || {
  printf '%s\n' 'PRODUCTION_PREFLIGHT_LIVE=BLOCKED' 'reason=healthz_probe_failed' >> "$GATE_FILE"
  exit 3
}
probe_json '/readyz' '"status":"ready"' "$EVIDENCE_DIR/readyz.json" || {
  printf '%s\n' 'PRODUCTION_PREFLIGHT_LIVE=BLOCKED' 'reason=readyz_probe_failed' >> "$GATE_FILE"
  exit 3
}

printf '%s\n' \
  'PRODUCTION_PREFLIGHT_LIVE=PASS' \
  'backend_healthz=PASS' \
  'backend_readyz=PASS' \
  'google_play_live_api=NOT_PROBED_WITHOUT_PURCHASE_TOKEN' \
  'fcm_live_delivery=NOT_PROBED_WITHOUT_CONTROLLED_DEVICE' \
  'rtdn_live_delivery=NOT_PROBED_WITHOUT_PUBSUB_EVENT' \
  'scale_3m_9m=NOT_RUN_EXTERNAL_LOAD_ENVIRONMENT' \
  'multi_region_failover=NOT_RUN_EXTERNAL_INFRA' \
  >> "$GATE_FILE"
