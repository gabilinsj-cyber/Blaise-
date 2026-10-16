#!/usr/bin/env bash
set -euo pipefail

workflow='.github/workflows/south-america-source-probe.yml'
source_module='backend/src/south-america-meteorology.mjs'
probe_module='backend/src/south-america-source-probe.mjs'
probe_script='backend/scripts/probe-south-america.mjs'

test -s "$workflow"
test -s "$source_module"
test -s "$probe_module"
test -s "$probe_script"
grep -Fq 'workflow_dispatch:' "$workflow"
grep -Fq 'execute_live_probe:' "$workflow"
grep -Fq 'default: false' "$workflow"
grep -Fq 'if: ${{ inputs.execute_live_probe }}' "$workflow"
grep -Fq 'if: ${{ !inputs.execute_live_probe }}' "$workflow"
grep -Fq 'NOT_IMPLEMENTED_AVAILABILITY_ONLY' "$workflow"
grep -Fq 'NOT_IMPLEMENTED_NO_MQTT_CLIENT' "$workflow"
grep -Fq 'wis2globalbroker.nws.noaa.gov:8883' "$source_module"
grep -Fq 'data.ecmwf.int/forecasts' "$source_module"
grep -Fq 'nomads.ncep.noaa.gov' "$source_module"
grep -Fq 'localRjOfficialPrecedencePreserved: true' "$probe_module"
grep -Fq 'canTriggerP0: false' "$probe_module"

if grep -Eq '^  (push|pull_request|schedule):' "$workflow"; then
  echo 'BLOCKED: South America source probe must remain manual-only' >&2
  exit 1
fi
if grep -Eq 'service_account|workload_identity_provider|id-token: write' "$workflow"; then
  echo 'BLOCKED: public South America source probe must not require cloud credentials' >&2
  exit 1
fi
if grep -Fq 'wis2broker.globaldata.nws.noaa.gov' "$source_module"; then
  echo 'BLOCKED: stale NOAA WIS2 broker hostname remains in registry' >&2
  exit 1
fi

echo 'SOUTH_AMERICA_SOURCE_WORKFLOW_SELFTEST=PASS'
