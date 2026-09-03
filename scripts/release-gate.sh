#!/usr/bin/env bash
set -euo pipefail

required=(BLAISE_KEYSTORE_PATH BLAISE_STORE_PASSWORD BLAISE_KEY_ALIAS BLAISE_KEY_PASSWORD BUNDLETOOL_JAR)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "BLOCKED: required production value $name is missing." >&2
    exit 2
  fi
done

./gradlew --no-daemon clean lintRelease testReleaseUnitTest assembleRelease bundleRelease

sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
build_tools="${sdk_root}/build-tools/35.0.0"
apk="app/build/outputs/apk/release/app-release.apk"
aab="app/build/outputs/bundle/release/app-release.aab"
mkdir -p evidence/release

test -s "$apk"
test -s "$aab"
"${build_tools}/zipalign" -c -P 16 -v 4 "$apk" > evidence/release/zipalign.txt
"${build_tools}/apksigner" verify --verbose --print-certs "$apk" > evidence/release/apksigner.txt
jarsigner -verify -verbose -certs "$aab" > evidence/release/jarsigner-aab.txt
java -jar "$BUNDLETOOL_JAR" validate --bundle "$aab" > evidence/release/bundletool.txt
sha256sum "$apk" "$aab" > evidence/release/SHA256SUMS
printf '%s\n' 'RELEASE_PACKAGE_GATE=PASS' 'play_console_upload=BLOCKED_UNTIL_EXPLICITLY_CONFIGURED' > evidence/release/gate.txt
