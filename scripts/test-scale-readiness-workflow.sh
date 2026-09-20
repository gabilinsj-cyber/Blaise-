#!/usr/bin/env bash
set -euo pipefail

workflow='.github/workflows/scale-readiness.yml'
test -s "$workflow"

grep -F 'workflow_dispatch:' "$workflow" >/dev/null
grep -F 'execute_probe:' "$workflow" >/dev/null
grep -F 'default: false' "$workflow" >/dev/null
grep -F 'environment: production' "$workflow" >/dev/null
grep -F '400 32' "$workflow" >/dev/null
grep -F '100 16' "$workflow" >/dev/null
grep -F 'scale_3m_9m=NOT_RUN_EXTERNAL_LOAD_PLATFORM_REQUIRED' "$workflow" >/dev/null
grep -F 'production_write_traffic=NOT_RUN' "$workflow" >/dev/null
grep -F "curl --fail --silent --show-error" "$workflow" >/dev/null
grep -F 'node scripts/bounded-http-probe.mjs' "$workflow" >/dev/null

if grep -Eq '^[[:space:]]+(push|pull_request|schedule):' "$workflow"; then
  echo 'scale readiness workflow must remain manual-only' >&2
  exit 1
fi
if grep -Eq '(^|[[:space:]])(-X|--request)[[:space:]]+(POST|PUT|PATCH|DELETE)' "$workflow"; then
  echo 'scale readiness workflow must remain GET-only' >&2
  exit 1
fi
if grep -Eq '(^|[[:space:]])--data([-=[:space:]]|$)' "$workflow"; then
  echo 'scale readiness workflow must not send request bodies' >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

BLAISE_SCALE_EXECUTE_PROBE=false BLAISE_SCALE_RESULT_FILE="$tmp/no-probe.txt" bash scripts/scale-readiness-preflight.sh >/dev/null
grep -F 'SCALE_READINESS_PREFLIGHT=PASS' "$tmp/no-probe.txt" >/dev/null
grep -F 'execute_probe=false' "$tmp/no-probe.txt" >/dev/null

BLAISE_SCALE_EXECUTE_PROBE=true BLAISE_SCALE_TARGET_URL='https://blaise.example.test' BLAISE_SCALE_RESULT_FILE="$tmp/valid.txt" bash scripts/scale-readiness-preflight.sh >/dev/null
grep -F 'SCALE_READINESS_PREFLIGHT=PASS' "$tmp/valid.txt" >/dev/null
grep -F 'execute_probe=true' "$tmp/valid.txt" >/dev/null

expect_fail() {
  local name="$1"
  shift
  if env "$@" BLAISE_SCALE_RESULT_FILE="$tmp/${name}.txt" bash scripts/scale-readiness-preflight.sh >/dev/null 2>&1; then
    echo "expected scale readiness preflight failure: $name" >&2
    exit 1
  fi
  grep -F 'SCALE_READINESS_PREFLIGHT=BLOCKED' "$tmp/${name}.txt" >/dev/null
}
expect_fail missing_target BLAISE_SCALE_EXECUTE_PROBE=true BLAISE_SCALE_TARGET_URL=''
expect_fail http_target BLAISE_SCALE_EXECUTE_PROBE=true BLAISE_SCALE_TARGET_URL='http://example.test'
expect_fail path_target BLAISE_SCALE_EXECUTE_PROBE=true BLAISE_SCALE_TARGET_URL='https://example.test/api'
expect_fail invalid_mode BLAISE_SCALE_EXECUTE_PROBE=maybe BLAISE_SCALE_TARGET_URL='https://example.test'

node --check scripts/bounded-http-probe.mjs
if node scripts/bounded-http-probe.mjs 'http://127.0.0.1/healthz' 1 1 >/dev/null 2>&1; then
  echo 'bounded probe must reject HTTP before network access' >&2
  exit 1
fi
if node scripts/bounded-http-probe.mjs 'https://127.0.0.1/healthz' 501 1 >/dev/null 2>&1; then
  echo 'bounded probe must enforce request cap' >&2
  exit 1
fi
if node scripts/bounded-http-probe.mjs 'https://127.0.0.1/healthz' 1 33 >/dev/null 2>&1; then
  echo 'bounded probe must enforce concurrency cap' >&2
  exit 1
fi

printf '%s\n' \
  'SCALE_READINESS_WORKFLOW_SELFTEST=PASS' \
  'manual_only=PASS' \
  'default_no_external_probe=PASS' \
  'get_only=PASS' \
  'request_cap_500=PASS' \
  'concurrency_cap_32=PASS' \
  'https_only=PASS' \
  'scale_3m_9m_not_falsely_claimed=PASS'
