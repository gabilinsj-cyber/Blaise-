#!/usr/bin/env bash
# Blaise V6 RJ: build ADMIN in ephemeral storage when Cloud Shell HOME lacks space.
# Makes no production deploys and never deletes/overwrites user backups or APKs.
set -euo pipefail
REPO="$HOME/Blaise-RJ"
BR="safety/rj-agent13-firestore-failclosed-20261115"
TARGET="$HOME/blaise-rj-safety/admin-apk"
[ -d "$REPO/.git" ] || { echo "ORIGINAL_REPO_NOT_FOUND"; exit 1; }
for cmd in git java python3 curl unzip sha256sum base64; do
  command -v "$cmd" >/dev/null || { echo "TOOL_MISSING:$cmd"; exit 1; }
done
FREE_MB=$(df -Pm /tmp | awk 'NR==2 {print $4}')
HOME_MB=$(df -Pm "$HOME" | awk 'NR==2 {print $4}')
echo "HOME_AVAILABLE_MB=$HOME_MB"
echo "TEMP_AVAILABLE_MB=$FREE_MB"
if [ "$FREE_MB" -lt 8000 ]; then
  echo "TEMPORARY_DISK_TOO_SMALL: require 8000MB, nothing removed"
  exit 1
fi
mkdir -p "$TARGET"
if [ -e "$TARGET/blaise-v6-rj-admin.apk" ]; then
  echo "ADMIN_APK_ALREADY_EXISTS: refusing overwrite"
  exit 1
fi
WORKSPACE=$(mktemp -d /tmp/blaise-rj-admin-XXXXXXXX)
mkdir -p "$WORKSPACE/tmp" "$WORKSPACE/android-sdk/cmdline-tools"
export TMPDIR="$WORKSPACE/tmp"
export ANDROID_HOME="$WORKSPACE/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export GRADLE_USER_HOME="$WORKSPACE/.gradle"
echo "EPHEMERAL_BUILD_AREA=$WORKSPACE"
echo "=== ANDROID_SDK_OFFICIAL_DOWNLOAD ==="
ZIP="$WORKSPACE/sdktools.zip"
curl -fL --retry 3 --connect-timeout 20 \
 "https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip" -o "$ZIP"
echo "4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583  $ZIP" | sha256sum -c -
unzip -q "$ZIP" -d "$WORKSPACE/unpacked"
[ -x "$WORKSPACE/unpacked/cmdline-tools/bin/sdkmanager" ] || { echo "SDKMANAGER_NOT_FOUND"; exit 1; }
mv "$WORKSPACE/unpacked/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
echo "=== ANDROID_SDK_LICENSES_REVIEW ==="
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" --licenses
echo "=== ANDROID_PLATFORM_35 ==="
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
 "platforms;android-35" "build-tools;35.0.0" "platform-tools"
[ -x "$ANDROID_HOME/build-tools/35.0.0/apksigner" ] || { echo "ANDROID_SDK_INCOMPLETE"; exit 1; }
echo "=== ISOLATED_REPO_CHECKOUT ==="
cd "$REPO"
git fetch origin "refs/heads/$BR"
git worktree add --detach "$WORKSPACE/worktree" FETCH_HEAD
cd "$WORKSPACE/worktree"
# Resource limits only in ephemeral worktree. Never touches original.
printf '\norg.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\norg.gradle.workers.max=2\n' >> gradle.properties
echo "=== COMPILE_ADMIN APK ==="
bash scripts/build-admin-private-apk.sh
APK="$PWD/app/build/outputs/apk/admin/app-admin.apk"
[ -s "$APK" ] || { echo "ADMIN_APK_MISSING"; exit 1; }
[ -x "$ANDROID_HOME/build-tools/35.0.0/apksigner" ] || exit 1
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify "$APK" >/dev/null
SIZE=$(stat -c %s "$APK")
FREE_HOME_BYTES=$(df -PB1 "$HOME" | awk 'NR==2 {print $4}')
if [ "$FREE_HOME_BYTES" -le "$SIZE" ]; then
  echo "HOME_SPACE_TOO_SMALL_FOR_FINAL_APK: build valid and still at $APK"
  exit 1
fi
if [ -e "$TARGET/blaise-v6-rj-admin.apk" ]; then
  echo "ADMIN_APK_ALREADY_EXISTS: refusing overwrite"; exit 1
fi
cp "$APK" "$TARGET/blaise-v6-rj-admin.apk"
echo "=== ADMIN_APK_SIGNED_AND_SAVED ==="
sha256sum "$TARGET/blaise-v6-rj-admin.apk"
du -h "$TARGET/blaise-v6-rj-admin.apk"
echo "ADMIN_APK_PATH=$TARGET/blaise-v6-rj-admin.apk"
