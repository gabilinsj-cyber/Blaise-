#!/usr/bin/env bash
# Signed owner-only APK verification. Never accepts a renamed debug package.
set -euo pipefail
umask 077

evidence_dir="evidence/admin-release"
package_dir="admin-packages"
mkdir -p "$evidence_dir"
printf '%s\n' 'ADMIN_RELEASE_GATE=IN_PROGRESS' > "$evidence_dir/gate.txt"
block() {
  printf '%s\n' 'ADMIN_RELEASE_GATE=BLOCKED' "reason=$1" 'secrets=REDACTED' > "$evidence_dir/gate.txt"
  printf 'BLOCKED: %s\n' "$1" >&2
  exit 2
}
for name in BLAISE_KEYSTORE_PATH BLAISE_STORE_PASSWORD BLAISE_KEY_ALIAS BLAISE_KEY_PASSWORD ANDROID_SDK_ROOT; do
  [[ -n "$(printenv "$name" 2>/dev/null || true)" ]] || block "missing_$name"
done
[[ -s "$BLAISE_KEYSTORE_PATH" ]] || block 'missing_signing_keystore'
keytool -list -keystore "$BLAISE_KEYSTORE_PATH" -storepass "$BLAISE_STORE_PASSWORD" \
  -alias "$BLAISE_KEY_ALIAS" >/dev/null 2>&1 || block 'invalid_signing_keystore'
tools="$ANDROID_SDK_ROOT/build-tools/35.0.0"
for name in apksigner zipalign aapt; do
  [[ -x "$tools/$name" ]] || block "android_tool_missing_$name"
done
command -v unzip >/dev/null 2>&1 || block 'unzip_missing'
if ! ./gradlew --no-daemon lintAdmin testAdminUnitTest assembleAdmin; then
  block 'gradle_admin_build_failed'
fi

apk="app/build/outputs/apk/admin/app-admin.apk"
[[ -s "$apk" ]] || block 'signed_admin_apk_missing'
"$tools/zipalign" -c -P 16 -v 4 "$apk" > "$evidence_dir/zipalign.txt" \
  || block 'apk_zipalign_invalid'
"$tools/apksigner" verify --verbose --print-certs "$apk" > "$evidence_dir/apksigner.txt" \
  || block 'admin_apk_not_signed_or_invalid'
"$tools/aapt" dump badging "$apk" > "$evidence_dir/aapt-badging.txt" \
  || block 'apk_metadata_unreadable'
identity="$(grep -m 1 '^package:' "$evidence_dir/aapt-badging.txt" || true)"
[[ "$identity" == *"name='br.com.blaise.rj.admin'"* ]] || block 'wrong_admin_application_id'
[[ "$identity" != *".debug"* ]] || block 'debug_variant_forbidden'
code="$(printf '%s\n' "$identity" | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p")"
version="$(printf '%s\n' "$identity" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")"
[[ "$code" =~ ^[0-9]+$ ]] || block 'invalid_admin_version_code'
(( code >= 6000002 )) || block 'admin_version_downgrade'
[[ "$version" == *"-admin" && "$version" != *"-debug"* ]] || block 'not_production_admin_variant'
unzip -Z1 "$apk" > "$evidence_dir/apk-file-list.txt" || block 'apk_archive_unreadable'
for asset in assets/dora/model.onnx assets/dora/voices.bin assets/dora/tokens.txt; do
  grep -Fxq "$asset" "$evidence_dir/apk-file-list.txt" \
    || block 'offline_admin_voice_missing'
done
cert="$(sed -n 's/.*certificate SHA-256 digest: *\([0-9a-fA-F:]*\).*/\1/p' \
  "$evidence_dir/apksigner.txt" | head -n 1 | tr -d ':' | tr 'A-F' 'a-f')"
[[ "$cert" =~ ^[0-9a-f]{64}$ ]] || block 'admin_signing_fingerprint_missing'
continuity='INITIAL_ADMIN_INSTALL_OR_NOT_CHECKED'
if [[ -n "$(printenv BLAISE_ADMIN_EXPECTED_CERT_SHA256 2>/dev/null || true)" ]]; then
  expected="$(printf '%s' "$BLAISE_ADMIN_EXPECTED_CERT_SHA256" | tr -d ':' | tr 'A-F' 'a-f')"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || block 'invalid_expected_cert_sha256'
  [[ "$expected" == "$cert" ]] || block 'admin_certificate_mismatch'
  continuity='ADMIN_CERT_MATCH'
fi

mkdir -p "$package_dir"
install -m 0600 "$apk" "$package_dir/blaise-v6-rj-admin-release.apk"
sha256sum "$apk" "$package_dir/blaise-v6-rj-admin-release.apk" > "$evidence_dir/SHA256SUMS"
printf '%s\n' \
  'ADMIN_RELEASE_GATE=PASS' \
  'apk_signature=VERIFIED' \
  'apk_variant=admin_not_debug' \
  'apk_application_id=br.com.blaise.rj.admin' \
  "version_code=$code" \
  "version_name=$version" \
  "signing_cert_sha256=$cert" \
  "certificate_continuity=$continuity" \
  'offline_dora_assets=VERIFIED_IN_APK' \
  'authorized_source_data=NOT_HOMOLOGATED_BY_THIS_GATE' \
  'admin_server_role_authorization=NOT_HOMOLOGATED_BY_THIS_GATE' \
  'device_installation=NOT_PERFORMED' \
  'store_publication=NOT_PERFORMED' \
  > "$evidence_dir/gate.txt"
echo 'PASS: signed admin APK verified; source and authorization gates remain independent.'
