#!/usr/bin/env bash
set -euo pipefail

result_file="${BLAISE_SCALE_RESULT_FILE:-evidence/scale-readiness/preflight.txt}"
mkdir -p "$(dirname "$result_file")"

fail() {
  printf '%s\n' \
    'SCALE_READINESS_PREFLIGHT=BLOCKED' \
    "reason=$1" \
    'max_request_budget=500' \
    'max_concurrency=32' \
    'production_write_traffic=NOT_RUN' \
    'scale_3m_9m=NOT_RUN_EXTERNAL_LOAD_PLATFORM_REQUIRED' \
    > "$result_file"
  echo "BLOCKED: $1" >&2
  exit 2
}

mode="${BLAISE_SCALE_EXECUTE_PROBE:-false}"
[[ "$mode" == 'true' || "$mode" == 'false' ]] || fail 'invalid_execute_probe_mode'

if [[ "$mode" == 'true' ]]; then
  [[ -n "${BLAISE_SCALE_TARGET_URL:-}" ]] || fail 'missing_target_url'
  BLAISE_SCALE_TARGET_URL="${BLAISE_SCALE_TARGET_URL%/}"
  export BLAISE_SCALE_TARGET_URL
  if ! python3 - <<'PY'
import os
from urllib.parse import urlsplit

raw = os.environ['BLAISE_SCALE_TARGET_URL']
u = urlsplit(raw)
if u.scheme != 'https':
    raise SystemExit(2)
if not u.hostname or u.username or u.password or u.query or u.fragment:
    raise SystemExit(2)
if u.path not in ('', '/'):
    raise SystemExit(2)
if u.port not in (None, 443):
    raise SystemExit(2)
PY
  then
    fail 'invalid_target_url'
  fi
fi

printf '%s\n' \
  'SCALE_READINESS_PREFLIGHT=PASS' \
  "execute_probe=$mode" \
  'method_policy=GET_ONLY' \
  'endpoint_policy=HEALTHZ_READYZ_ONLY' \
  'max_request_budget=500' \
  'max_concurrency=32' \
  'per_request_timeout_seconds=5' \
  'redirects=FORBIDDEN' \
  'production_write_traffic=NOT_RUN' \
  'scale_3m_9m=NOT_RUN_EXTERNAL_LOAD_PLATFORM_REQUIRED' \
  'multi_region_failover=NOT_RUN_EXTERNAL_INFRA_REQUIRED' \
  > "$result_file"

cat "$result_file"
