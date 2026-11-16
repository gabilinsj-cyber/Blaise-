#!/usr/bin/env bash
# Isolated Cloud Build: Blaise V6 RJ administrator APK only.
# No Cloud Run/Firestore/OpenWeather deployment or requests.
set -euo pipefail
umask 077
[ "$ACCEPT_ANDROID_SDK_LICENSES" = "yes" ] || {
  echo "ANDROID_LICENSES_NOT_APPROVED"; exit 1;
}
[ -f settings.gradle.kts ] && [ -f app/build.gradle.kts ] || {
  echo "NOT_BLAISE_PROJECT"; exit 1;
}
[ -f gradlew ] || { echo "GRADLE_WRAPPER_NOT_FOUND"; exit 1; }
java -version
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl unzip ca-certificates python3
echo "=== PRECHECK_DORA_HASH_PYTHON_COMPATIBILITY ==="
python3 -m unittest -v scripts/test_prepare_dora_voice_digest.py
python3 -m py_compile scripts/prepare-dora-voice.py
echo "=== PRECHECK_DORA_HASH_PASS ==="
echo "=== PRECHECK_FULL_ADMIN_LAYOUT_AGENTS_SCIENCE ==="
python3 -m unittest discover -s scripts -p 'test_rj_*.py' -v
echo "=== PRECHECK_FULL_ADMIN_PASS ==="
export ANDROID_HOME=/workspace/.android-sdk-build
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export GRADLE_USER_HOME=/workspace/.gradle-admin-build
mkdir -p "$ANDROID_HOME/cmdline-tools" "$GRADLE_USER_HOME"
echo "=== PINNED_ANDROID_CLI_TOOLS ==="
SDK_ZIP=/workspace/.android-cli-tools.zip
curl --fail --location --retry 3 --connect-timeout 20 \
  'https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip' \
  -o "$SDK_ZIP"
printf '%s  %s\n' \
  '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583' "$SDK_ZIP" \
  | sha256sum --check
unzip -q "$SDK_ZIP" -d /workspace/.android-unpacked
mv /workspace/.android-unpacked/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
echo "=== ACCEPTING_ANDROID_SDK_LICENSES_AS_APPROVED_BY_OPERATOR ==="
printf 'y\n%.0s' {1..50} | "$SDKMANAGER" --sdk_root="$ANDROID_HOME" --licenses
echo "=== INSTALLING_ANDROID_SDK_35 ==="
"$SDKMANAGER" --sdk_root="$ANDROID_HOME" \
  'platforms;android-35' 'build-tools;35.0.0' 'platform-tools'
[ -f "$ANDROID_HOME/platforms/android-35/android.jar" ] || {
  echo "ANDROID_PLATFORM_35_MISSING"; exit 1;
}
[ -x "$ANDROID_HOME/build-tools/35.0.0/apksigner" ] || {
  echo "ANDROID_BUILD_TOOLS_35_MISSING"; exit 1;
}
echo "=== BUILDING_REAL_ADMIN_VARIANT ==="
bash ./gradlew :app:assembleAdmin --no-daemon \
  -Dorg.gradle.jvmargs="-Xmx3072m -Dfile.encoding=UTF-8" \
  -Dorg.gradle.workers.max=2
APK=app/build/outputs/apk/admin/app-admin.apk
[ -s "$APK" ] || { echo "ADMIN_APK_NOT_CREATED"; exit 1; }
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose "$APK" >/dev/null
BADGE=$("$ANDROID_HOME/build-tools/35.0.0/aapt" dump badging "$APK" | grep '^package:' | head -1)
case "$BADGE" in
  *"name='br.com.blaise.rj.admin'"*) ;;
  *) echo "WRONG_APPLICATION_ID"; exit 1 ;;
esac
echo "=== ADMIN_APK_SIGNED_VERIFIED ==="
sha256sum "$APK"
du -h "$APK"
echo "=== PRIVATE_BUILD_READY_FOR_CLOUD_STORAGE ==="
