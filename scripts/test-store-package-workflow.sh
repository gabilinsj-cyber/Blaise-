#!/usr/bin/env bash
set -euo pipefail

release_gate='scripts/release-gate.sh'
all_stores='scripts/build-all-store-packages.sh'
workflow='.github/workflows/android-store-packages.yml'

contains() {
  local pattern="$1" file="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -q "$pattern" "$file"
  else
    grep -Eq "$pattern" "$file"
  fi
}

for file in "$release_gate" "$all_stores" "$workflow"; do
  [[ -s "$file" ]] || { echo "FAIL: missing $file" >&2; exit 1; }
done

for channel in GOOGLE_PLAY SAMSUNG_GALAXY_STORE AMAZON_APPSTORE; do
  contains "$channel" "$release_gate" || { echo "FAIL: release gate lacks $channel" >&2; exit 1; }
  contains "$channel" "$all_stores" || { echo "FAIL: package matrix lacks $channel" >&2; exit 1; }
done
contains 'bash scripts/build-all-store-packages.sh' "$workflow"
contains 'store-packages/\*\*/\*' "$workflow"
contains 'publication=REQUIRES_STORE_ACCOUNT_CONFIRMATION' "$all_stores"

bash -n "$release_gate"
bash -n "$all_stores"
echo 'PASS: three-store packaging workflow is fail-closed and syntactically valid.'
