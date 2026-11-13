#!/usr/bin/env bash
# Strict PUBLIC/CUSTOMER APK distribution size gate. 400 MB = 400,000,000 bytes.
# Run on the customer release package, not a ZIP or the owner's APK.
set -euo pipefail
apk="${1:-app/build/outputs/apk/release/app-release.apk}"
aab="${2:-}"
max_bytes=400000000
evidence="${BLAISE_CLIENT_SIZE_EVIDENCE:-evidence/release/client-package-size.txt}"
mkdir -p "$(dirname "$evidence")"
fail() {
  printf '%s\n' 'CLIENT_PACKAGE_GATE=BLOCKED' "reason=$1" \
    "size_limit_bytes=$max_bytes" > "$evidence"
  echo "BLOCKED: $1" >&2
  exit 2
}
[[ -s "$apk" ]] || fail 'missing_customer_release_apk'
command -v unzip >/dev/null || fail 'unzip_required'
count="$(wc -c < "$apk" | tr -d '[:space:]')"
[[ "$count" =~ ^[0-9]+$ ]] || fail 'invalid_apk_byte_count'
(( count <= max_bytes )) || fail 'apk_exceeds_400_decimal_megabytes'
list="$(unzip -Z -1 "$apk")" || fail 'invalid_apk_archive'
if printf '%s\n' "$list" | grep -Eq '^assets/dora/(model\.onnx|voices\.bin|espeak-ng-data/|tokens\.txt)'; then
  fail 'owner_offline_dora_assets_present_in_customer_apk'
fi
if [[ -n "$aab" ]]; then
  [[ -s "$aab" ]] || fail 'missing_customer_bundle'
  bundle_list="$(unzip -Z -1 "$aab")" || fail 'invalid_aab_archive'
  if printf '%s\n' "$bundle_list" | grep -Eq '^base/assets/dora/(model\.onnx|voices\.bin|espeak-ng-data/|tokens\.txt)'; then
    fail 'owner_offline_dora_assets_present_in_customer_bundle'
  fi
fi
mb="$(awk -v bytes="$count" 'BEGIN { printf "%.2f", bytes/1000000 }')"
hash="$(sha256sum "$apk" | awk '{print $1}')"
printf '%s\n' 'CLIENT_PACKAGE_GATE=PASS' \
  "client_apk_bytes=$count" \
  "client_apk_megabytes=$mb" \
  "size_limit_bytes=$max_bytes" \
  'customer_offline_dora_assets=ABSENT' \
  'customer_voice=ANDROID_PT_BR_TTS_ENGINE' \
  "sha256=$hash" \
  > "$evidence"
cat "$evidence"
