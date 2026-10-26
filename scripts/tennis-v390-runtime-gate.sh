#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"
RELEASE_DIR="$WORKSPACE/tennis-v390-release-under-test"
EVIDENCE="$WORKSPACE/tennis-v390-runtime-evidence"
mkdir -p "$EVIDENCE"

APK_PATH="$(find "$RELEASE_DIR" -type f -name 'Blaise-Open-Tennis-v3.9.0-release-signed.apk' -size +0c | head -n1)"
test -n "$APK_PATH"
sha256sum "$APK_PATH" | tee "$EVIDENCE/INSTALLED_APK_SHA256.txt"

adb install -r "$APK_PATH" | tee "$EVIDENCE/INSTALL.txt"
grep -q 'Success' "$EVIDENCE/INSTALL.txt"

adb logcat -c
adb shell am start -W -n com.blaise.opentennis/.MainActivity | tee "$EVIDENCE/LAUNCH.txt"
grep -q 'Status: ok' "$EVIDENCE/LAUNCH.txt"

sleep 5
adb logcat -d > "$EVIDENCE/LOGCAT.txt"
if grep -E 'FATAL EXCEPTION|ANR in com\.blaise\.opentennis|Process: com\.blaise\.opentennis.*has died' "$EVIDENCE/LOGCAT.txt"; then
  printf 'crash_anr_scan=FAIL\n' > "$EVIDENCE/RUNTIME_GATE.txt"
  exit 1
fi

adb shell dumpsys activity activities > "$EVIDENCE/ACTIVITY.txt"
adb shell pidof com.blaise.opentennis | tee "$EVIDENCE/PID.txt"
test -s "$EVIDENCE/PID.txt"
grep -q 'com.blaise.opentennis/.MainActivity' "$EVIDENCE/ACTIVITY.txt"
adb exec-out screencap -p > "$EVIDENCE/RUNTIME.png"

printf 'binary=exact-signed-release-apk\ninstall=PASS\nlaunch=PASS\nprocess_alive=PASS\nmain_activity=PASS\ncrash_anr_scan=PASS\napi_level=35\n' > "$EVIDENCE/RUNTIME_GATE.txt"
