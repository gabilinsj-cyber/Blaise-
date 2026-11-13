#!/usr/bin/env bash
set -euo pipefail
umask 077

EVIDENCE_DIR="${BLAISE_RELEASE_EVIDENCE_DIR:-evidence/release}"
STORE_CHANNEL="${BLAISE_STORE_CHANNEL:-GOOGLE_PLAY}"
case "$STORE_CHANNEL" in
  GOOGLE_PLAY) store_slug='google-play' ;;
  SAMSUNG_GALAXY_STORE) store_slug='samsung-galaxy-store' ;;
  AMAZON_APPSTORE) store_slug='amazon-appstore' ;;
  *) echo "BLOCKED: unsupported BLAISE_STORE_CHANNEL=$STORE_CHANNEL" >&2; exit 2 ;;
esac
PACKAGE_DIR="${BLAISE_STORE_PACKAGE_DIR:-store-packages/$store_slug}"
mkdir -p "$EVIDENCE_DIR"
GATE_FILE="$EVIDENCE_DIR/gate.txt"
printf '%s\n' 'RELEASE_PACKAGE_GATE=IN_PROGRESS' > "$GATE_FILE"

block() {
  local reason="$1"
  shift || true
  {
    echo 'RELEASE_PACKAGE_GATE=BLOCKED'
    echo "reason=$reason"
    echo 'secrets=REDACTED'
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
  BLAISE_FIREBASE_APPLICATION_ID
  BLAISE_FIREBASE_API_KEY
  BLAISE_FIREBASE_PROJECT_ID
  BLAISE_FIREBASE_SENDER_ID
)
if [[ "$STORE_CHANNEL" == 'GOOGLE_PLAY' ]]; then
  required+=(BLAISE_MONTHLY_PRODUCT_ID BLAISE_ANNUAL_PRODUCT_ID BLAISE_ENTITLEMENT_VERIFY_URL)
fi
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

if [[ "$STORE_CHANNEL" == 'GOOGLE_PLAY' ]]; then
  [[ "$BLAISE_ENTITLEMENT_VERIFY_URL" == https://* ]] || block 'entitlement_verify_url_must_be_https'
  [[ "$BLAISE_MONTHLY_PRODUCT_ID" != "$BLAISE_ANNUAL_PRODUCT_ID" ]] || block 'billing_product_ids_must_differ'
fi
[[ "$BLAISE_FIREBASE_APPLICATION_ID" == 1:*:android:* ]] || block 'firebase_application_id_invalid'
[[ "$BLAISE_FIREBASE_SENDER_ID" =~ ^[0-9]+$ ]] || block 'firebase_sender_id_invalid'
[[ ! "$BLAISE_FIREBASE_PROJECT_ID" =~ [[:space:]] ]] || block 'firebase_project_id_contains_whitespace'
[[ ! "$BLAISE_FIREBASE_API_KEY" =~ [[:space:]] ]] || block 'firebase_api_key_contains_whitespace'
[[ -s "$BLAISE_KEYSTORE_PATH" ]] || block 'keystore_missing_or_empty'
[[ -s "$BUNDLETOOL_JAR" ]] || block 'bundletool_missing_or_empty'

if ! ./gradlew --no-daemon clean lintRelease testReleaseUnitTest assembleRelease bundleRelease; then
  block 'gradle_release_build_failed'
fi

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

# A production release is NOT a renamed debug APK. Refuse a wrong Android ID,
# missing signing cert or any version that would be a downgrade to the V6 baseline.
[[ -x "${build_tools}/aapt" ]] || block 'aapt_missing'
"${build_tools}/aapt" dump badging "$apk" | grep '^package:' > "$EVIDENCE_DIR/android-identity.txt" ||
  block 'apk_package_metadata_missing'
apk_package="$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" "$EVIDENCE_DIR/android-identity.txt")"
apk_version="$(sed -n "s/^package: .* versionCode='\([0-9]*\)'.*/\1/p" "$EVIDENCE_DIR/android-identity.txt")"
[[ "$apk_package" == 'br.com.blaise.rj' ]] || block 'not_original_rj_production_package'
[[ "$apk_version" =~ ^[0-9]+$ ]] || block 'apk_version_code_invalid'
(( apk_version >= 6000002 )) || block 'release_version_too_old'
cert_sha="$(sed -n 's/.*certificate SHA-256 digest: *\([0-9A-Fa-f:]*\).*/\1/p' "$EVIDENCE_DIR/apksigner.txt" | head -n1 | tr -d ':' | tr 'A-F' 'a-f')"
[[ "$cert_sha" =~ ^[0-9a-f]{64}$ ]] || block 'apk_signing_fingerprint_missing'
original_cert="${BLAISE_ORIGINAL_CERT_SHA256:-}"
upgrade_status='NOT_PROVEN_ORIGINAL_CERT_NOT_PROVIDED'
if [[ -n "$original_cert" ]]; then
  original_cert="${original_cert//:/}"
  original_cert="${original_cert,,}"
  [[ "$original_cert" =~ ^[0-9a-f]{64}$ ]] || block 'invalid_original_cert_fingerprint'
  [[ "$cert_sha" == "$original_cert" ]] || block 'original_signing_certificate_mismatch'
  upgrade_status='ORIGINAL_SIGNING_CERT_MATCH'
fi
printf '%s\n' "package_id=$apk_package" "version_code=$apk_version" \
  "signing_cert_sha256=$cert_sha" "upgrade_cert_status=$upgrade_status" \
  > "$EVIDENCE_DIR/android-release-identity.txt"

jarsigner -verify -verbose -certs "$aab" > "$EVIDENCE_DIR/jarsigner-aab.txt" || block 'aab_signature_verification_failed'
java -jar "$BUNDLETOOL_JAR" validate --bundle "$aab" > "$EVIDENCE_DIR/bundletool.txt" || block 'bundletool_validation_failed'
sha256sum "$apk" "$aab" > "$EVIDENCE_DIR/SHA256SUMS"
mkdir -p "$PACKAGE_DIR"
install -m 0600 "$apk" "$PACKAGE_DIR/blaise-v6-rj-${store_slug}.apk"
install -m 0600 "$aab" "$PACKAGE_DIR/blaise-v6-rj-${store_slug}.aab"
sha256sum "$PACKAGE_DIR"/* > "$PACKAGE_DIR/SHA256SUMS"
printf '%s\n' \
  "store_channel=$STORE_CHANNEL" \
  "package_slug=$store_slug" \
  'signature=VERIFIED' \
  "android_package=$apk_package" \
  "android_version_code=$apk_version" \
  "in_place_upgrade=$upgrade_status" \
  'publication=REQUIRES_STORE_ACCOUNT_CONFIRMATION' \
  > "$PACKAGE_DIR/manifest.txt"
if [[ "$STORE_CHANNEL" == 'GOOGLE_PLAY' ]]; then
  billing_status='GOOGLE_PLAY_CONFIGURED'
else
  billing_status='STORE_BILLING_FAIL_CLOSED_NOT_CONFIGURED'
fi
printf '%s\n' \
  'RELEASE_PACKAGE_GATE=PASS' \
  "store_channel=$STORE_CHANNEL" \
  "billing=$billing_status" \
  'fcm_p0=CONFIGURED' \
  'apk_signature=VERIFIED' \
  "apk_id=$apk_package" \
  "apk_version_code=$apk_version" \
  "in_place_upgrade=$upgrade_status" \
  'aab_signature=VERIFIED' \
  'bundle_validation=PASS' \
  'store_upload=BLOCKED_UNTIL_ACCOUNT_CONFIRMATION' \
  > "$GATE_FILE"
