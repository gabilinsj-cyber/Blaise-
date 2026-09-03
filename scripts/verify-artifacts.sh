#!/usr/bin/env bash
set -euo pipefail
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
build_tools="${sdk_root}/build-tools/35.0.0"
apk="app/build/outputs/apk/debug/app-debug.apk"
aab="app/build/outputs/bundle/release/app-release.aab"
test_apk="app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
mkdir -p evidence
test -s "$apk"
test -s "$aab"
test -s "$test_apk"
"${build_tools}/zipalign" -c -P 16 -v 4 "$apk" > evidence/zipalign.txt
"${build_tools}/apksigner" verify --verbose --print-certs "$apk" > evidence/apksigner.txt
sha256sum "$apk" "$test_apk" "$aab" > evidence/SHA256SUMS
if [[ -n "${BUNDLETOOL_JAR:-}" ]]; then
  java -jar "$BUNDLETOOL_JAR" validate --bundle "$aab" > evidence/bundletool.txt
else
  printf '%s\n' 'BLOCKED: BUNDLETOOL_JAR is not configured.' > evidence/bundletool.txt
fi
if rg -n --hidden -g '!**/.git/**' -g '!**/build/**' -g '!gradle/wrapper/gradle-wrapper.jar' '(sk_live_|sk-proj-|BEGIN (RSA |EC )?PRIVATE KEY|AIza[0-9A-Za-z_-]{35})' . > evidence/secret-scan.txt; then
  echo 'Potential committed secret found.' >&2
  exit 1
else
  printf '%s\n' 'PASS: no high-confidence committed secret patterns detected.' > evidence/secret-scan.txt
fi
