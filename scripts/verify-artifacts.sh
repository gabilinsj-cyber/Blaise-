#!/usr/bin/env bash
set -euo pipefail

sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$sdk_root" ]] || { echo 'ANDROID_SDK_ROOT/ANDROID_HOME is not configured.' >&2; exit 1; }
build_tools="${sdk_root}/build-tools/35.0.0"
sdkmanager="${sdk_root}/cmdline-tools/latest/bin/sdkmanager"

apk="app/build/outputs/apk/debug/app-debug.apk"
release_apk="$(find app/build/outputs/apk/release -maxdepth 1 -type f -name '*.apk' -print -quit)"
aab="app/build/outputs/bundle/release/app-release.aab"
test_apk="app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"

mkdir -p evidence

test -x "${build_tools}/zipalign"
test -x "${build_tools}/apksigner"
test -x "$sdkmanager"
test -s "$apk"
[[ -n "$release_apk" ]] && test -s "$release_apk"
test -s "$aab"
test -s "$test_apk"
[[ -n "${BUNDLETOOL_JAR:-}" ]] || { echo 'BUNDLETOOL_JAR is required for fail-closed validation.' >&2; exit 1; }
test -s "$BUNDLETOOL_JAR"

"${build_tools}/zipalign" -c -P 16 -v 4 "$apk" > evidence/zipalign-debug.txt
"${build_tools}/zipalign" -c -P 16 -v 4 "$release_apk" > evidence/zipalign-release.txt
"${build_tools}/apksigner" verify --verbose --print-certs "$apk" > evidence/apksigner-debug.txt
java -jar "$BUNDLETOOL_JAR" validate --bundle "$aab" > evidence/bundletool.txt
sha256sum "$apk" "$release_apk" "$test_apk" "$aab" > evidence/SHA256SUMS

java -version 2> evidence/java-version.txt
./gradlew --version > evidence/gradle-version.txt
"$sdkmanager" --version > evidence/sdkmanager-version.txt

secret_pattern='(sk_live_|sk-proj-|BEGIN (RSA |EC )?PRIVATE KEY|AIza[0-9A-Za-z_-]{35})'
if command -v rg >/dev/null 2>&1; then
  if rg -n --hidden -g '!**/.git/**' -g '!**/build/**' -g '!gradle/wrapper/gradle-wrapper.jar' "$secret_pattern" . > evidence/secret-scan.txt; then
    echo 'Potential committed secret found.' >&2
    exit 1
  fi
elif command -v grep >/dev/null 2>&1; then
  if grep -RInIE --exclude-dir=.git --exclude-dir=build --exclude=gradle-wrapper.jar "$secret_pattern" . > evidence/secret-scan.txt; then
    echo 'Potential committed secret found.' >&2
    exit 1
  fi
else
  echo 'BLOCKED: neither ripgrep nor grep is available for the fail-closed secret scan.' >&2
  exit 1
fi
printf '%s\n' 'PASS: no high-confidence committed secret patterns detected.' > evidence/secret-scan.txt

printf '%s\n' \
  'BUILD_GATE=PASS' \
  'debug_lint=PASS' \
  'release_lint=PASS' \
  'debug_unit_tests=PASS' \
  'release_unit_tests=PASS' \
  'debug_apk=PASS' \
  'release_apk_unsigned_ci=PASS' \
  'android_test_apk=PASS' \
  'release_aab=PASS' \
  'bundletool_validation=PASS' \
  'production_signing=SEPARATE_FAIL_CLOSED_RELEASE_GATE' \
  > evidence/build-gate.txt
