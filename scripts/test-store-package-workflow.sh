#!/usr/bin/env bash
set -euo pipefail

release_gate='scripts/release-gate.sh'
all_stores='scripts/build-all-store-packages.sh'
workflow='.github/workflows/android-store-packages.yml'

for file in "$release_gate" "$all_stores" "$workflow"; do
  [[ -s "$file" ]] || { echo "FAIL: missing $file" >&2; exit 1; }
done

for channel in GOOGLE_PLAY SAMSUNG_GALAXY_STORE AMAZON_APPSTORE; do
  rg -q "$channel" "$release_gate" || { echo "FAIL: release gate lacks $channel" >&2; exit 1; }
  rg -q "$channel" "$all_stores" || { echo "FAIL: package matrix lacks $channel" >&2; exit 1; }
done
rg -q 'bash scripts/build-all-store-packages.sh' "$workflow"
rg -q 'store-packages/\*\*/\*' "$workflow"
rg -q 'publication=REQUIRES_STORE_ACCOUNT_CONFIRMATION' "$all_stores"

bash -n "$release_gate"
bash -n "$all_stores"
echo 'PASS: three-store packaging workflow is fail-closed and syntactically valid.'
