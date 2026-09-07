#!/usr/bin/env bash
set -euo pipefail

workflow='.github/workflows/official-source-probe.yml'
source_module='backend/src/alerta-rio-source.mjs'

test -s "$workflow"
test -s "$source_module"
grep -Fq 'workflow_dispatch:' "$workflow"
grep -Fq 'execute_live_probe:' "$workflow"
grep -Fq 'default: false' "$workflow"
grep -Fq 'if: ${{ inputs.execute_live_probe }}' "$workflow"
grep -Fq 'if: ${{ !inputs.execute_live_probe }}' "$workflow"
grep -Fq 'pgeo3.rio.rj.gov.br' "$source_module"
grep -Fq "outFields: 'cod,est'" "$source_module"
grep -Fq "returnGeometry: 'false'" "$source_module"

if grep -Eq '^  (push|pull_request|schedule):' "$workflow"; then
  echo 'BLOCKED: official source probe must remain manual-only' >&2
  exit 1
fi
if grep -Eq 'service_account|workload_identity_provider|id-token: write' "$workflow"; then
  echo 'BLOCKED: public official source probe must not require cloud credentials' >&2
  exit 1
fi

echo 'OFFICIAL_SOURCE_WORKFLOW_SELFTEST=PASS'
