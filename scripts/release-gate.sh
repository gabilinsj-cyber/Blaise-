#!/usr/bin/env bash
set -euo pipefail
umask 077

EVIDENCE_DIR="${BLAISE_RELEASE_EVIDENCE_DIR:-evidence/release}"
mkdir -p "$EVIDENCE_DIR"
GATE_FILE="$EVIDENCE_DIR/gate.txt"
: > "$GATE_FILE"

block() {
  local reason="$1"
  shift || true
  {
    echo 'RELEASE_PACKAGE_GATE=BLOCKED'
    echo "reason=$reason"
    for detail in "$@"; do
      printf '%s\n' "$detail"
    done
  } > "$GATE_FILE"
  echo "BLOCKED: $reason" >&2
  exit 2
}

required=(
  BLAISE_KEYSTORE_PATH
  BLAISE_STORE_PASSWORD
  BLAISE_KEY_ALIAS
  BLAISE_KEY_PASSWORD
  BUNDLETOOL_JAR
  BLAISE_MONTHLY_PRODUCT_ID
  BLAISE_ANNUAL_PRODUCT_ID
  BLAISE_ENTITLEMENT_VERIFY_URL
  BLAISE_FIREBASE_APPLICATION_ID
  BLAISE_FIREBASE_API_KEY
  BLAISE_FIREBASE_PROJECT_ID
  BLAISE_FIREBASE_SENDER_ID
)
missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done
if (( ${#missing[@]} > 0 )); then
  printf 'BLOCKED: missing required production values:\n' >&2
  printf ' - %s\n' "${missing[@]}" >&2
  block 'missing_required_production_values' "missing=${missing[*]}"
fi

[[ "$BLAISE_ENTITLEMENT_VERIFY_URL" == https://* ]] || block 'entitlement_verify_url_must_be_https'
[[ "$BLAISE_MONTHLY_PRODUCT_ID" != "$BLAISE_ANNUAL_PRODUCT_ID" ]] || block 'billing_product_ids_must_differ'
[[ "$BLAISE_FIREBASE_APPLICATION_ID" == 1:*:android:* ]] || block 'firebase_application_id_invalid'
[[ "$BLAISE_FIREBASE_SENDER_ID" =~ ^[0-9]+$ ]] || block 'firebase_sender_id_invalid'
[[ ! "$BLAISE_FIREBASE_PROJECT_ID" =~ [[:space:]] ]] || block 'firebase_project_id_contains_whitespace'
[[ ! "$BLAISE_FIREBASE_API_KEY" =~ [[:space:]] ]] || block 'firebase_api_key_contains_whitespace'
[[ -s "$BLAISE_KEYSTORE_PATH" ]] || block 'keystore_missing_or_empty'
[[ -s "$BUNDLETOOL_JAR" ]] || block 'bundletool_missing_or_empty'

./gradlew --no-daemon clean lintRelease testReleaseUnitTest assembleRelease bundleRelease

sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$sdk_root" ]] || block 'android_sdk_root_missing'
build_tools="${sdk_root}/build-tools/35.0.0"
apk="app/build/outputs/apk/release/app-release.apk"
aab="app/build/outputs/bundle/release/app-release.aab"

[[ -x "${build_tools}/zipalign" ]] || block 'zipalign_missing'
[[ -x "${build_tools}/apksigner" ]] || block 'apksigner_missing'
[[ -s "$apk" ]] || block 'release_apk_missing_or_empty'
[[ -s "$aab" ]] || block 'release_aab_missing_or_empty'

"${build_tools}/zipalign" -c -P 16 -v 4 "$apk" > "$EVIDENCE_DIR/zipalign.txt" || block 'zipalign_verification_failed'
"${build_tools}/apksigner" verify --verbose --print-certs "$apk" > "$EVIDENCE_DIR/apksigner.txt" || block 'apk_signature_verification_failed'
jarsigner -verify -verbose -certs "$aab" > "$EVIDENCE_DIR/jarsigner-aab.txt" || block 'aab_signature_verification_failed'
java -jar "$BUNDLETOOL_JAR" validate --bundle "$aab" > "$EVIDENCE_DIR/bundletool.txt" || block 'bundletool_validation_failed'
sha256sum "$apk" "$aab" > "$EVIDENCE_DIR/SHA256SUMS"
printf '%s\n' \
  'RELEASE_PACKAGE_GATE=PASS' \
  'billing_products=CONFIGURED' \
  'entitlement_backend=HTTPS_CONFIGURED' \
  'fcm_p0=CONFIGURED' \
  'apk_signature=VERIFIED' \
  'aab_signature=VERIFIED' \
  'bundle_validation=PASS' \
  'play_console_upload=BLOCKED_UNTIL_EXPLICITLY_CONFIGURED' \
  > "$GATE_FILE"
