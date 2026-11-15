#!/usr/bin/env bash
# Owner-only Android admin APK. Does not publish, deploy, upload or copy secrets.
set -eo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
if [ ! -f app/build.gradle.kts ] || [ ! -f settings.gradle.kts ]; then
  echo "NOT_BLAISE_ANDROID_ROOT"; exit 1
fi
if ! grep -q 'create("admin")' app/build.gradle.kts; then
  echo "ADMIN_VARIANT_MISSING"; exit 1
fi
if [ ! -f gradlew ]; then echo "GRADLE_WRAPPER_MISSING"; exit 1; fi
SDK="$ANDROID_HOME"
if [ -z "$SDK" ]; then SDK="$ANDROID_SDK_ROOT"; fi
if [ -z "$SDK" ]; then echo "ANDROID_SDK_ENV_NOT_CONFIGURED"; exit 1; fi
echo "=== ADMIN_LOCAL_BUILD_NO_PRODUCTION_DEPLOY ==="
echo "Build downloads pinned offline-voice assets when absent."
bash ./gradlew :app:assembleAdmin --no-daemon
APK="$ROOT/app/build/outputs/apk/admin/app-admin.apk"
if [ ! -s "$APK" ]; then echo "ADMIN_APK_NOT_FOUND"; exit 1; fi
SIGNER=$(find "$SDK/build-tools" -maxdepth 2 -type f -name apksigner | sort -V | tail -n 1)
if [ -z "$SIGNER" ]; then echo "APKSIGNER_NOT_FOUND"; exit 1; fi
"$SIGNER" verify --verbose "$APK" >/dev/null
echo "ADMIN_APK_SIGNED_AND_VERIFIED"
sha256sum "$APK"
du -h "$APK"
echo "APK_PATH=$APK"
echo "=== ADMIN_APK_PRIVATE_BUILD_VALIDATED ==="
echo "Never share this admin APK publicly or upload it to a client store."
