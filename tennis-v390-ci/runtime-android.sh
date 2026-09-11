#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
EVIDENCE="$WORKSPACE/tennis-v390-runtime-evidence"
RELEASE_DIR="$WORKSPACE/tennis-v390-release-under-test"
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

APP_PID="$(adb shell pidof com.blaise.opentennis | tr -d '\r' | awk '{print $1}')"
printf '%s\n' "$APP_PID" | tee "$EVIDENCE/PID.txt"
test -n "$APP_PID"

adb logcat -d > "$EVIDENCE/LOGCAT.txt"
awk -v pid="$APP_PID" '$3 == pid {print}' "$EVIDENCE/LOGCAT.txt" > "$EVIDENCE/APP_LOGCAT.txt"
adb shell dumpsys gfxinfo com.blaise.opentennis framestats > "$EVIDENCE/GFXINFO_FRAMESTATS.txt" || true

if grep -E 'FATAL EXCEPTION|ANR in com\.blaise\.opentennis|Process: com\.blaise\.opentennis.*has died' "$EVIDENCE/LOGCAT.txt"; then
  printf 'binary=exact-signed-release-apk\ninstall=PASS\nlaunch=PASS\nprocess_alive=PASS\ncrash_anr_scan=FAIL\nframe_jank_scan=NOT_EVALUATED\napi_level=35\n' > "$EVIDENCE/RUNTIME_GATE.txt"
  exit 1
fi

# Fail closed on severe frame stalls emitted by the Blaise process itself.
# At 60 Hz, 60 skipped frames is about one second without a rendered frame.
if grep -Eq 'Skipped ([6-9][0-9]|[1-9][0-9]{2,}) frames!' "$EVIDENCE/APP_LOGCAT.txt" || \
   grep -Eq 'Davey! duration=[1-9][0-9]{3,}ms' "$EVIDENCE/APP_LOGCAT.txt"; then
  {
    printf 'binary=exact-signed-release-apk\n'
    printf 'install=PASS\nlaunch=PASS\nprocess_alive=PASS\ncrash_anr_scan=PASS\n'
    printf 'frame_jank_scan=FAIL\nframe_jank_policy=app_process_skipped_frames_ge_60_or_davey_ge_1000ms\n'
    printf 'api_level=35\n'
  } > "$EVIDENCE/RUNTIME_GATE.txt"
  grep -E 'Skipped .* frames!|Davey! duration=' "$EVIDENCE/APP_LOGCAT.txt" > "$EVIDENCE/FRAME_JANK_FINDINGS.txt" || true
  exit 1
fi

adb shell dumpsys activity activities > "$EVIDENCE/ACTIVITY.txt"
grep -q 'com.blaise.opentennis/.MainActivity' "$EVIDENCE/ACTIVITY.txt"
adb exec-out screencap -p > "$EVIDENCE/RUNTIME.png"
printf 'binary=exact-signed-release-apk\ninstall=PASS\nlaunch=PASS\nprocess_alive=PASS\nmain_activity=PASS\ncrash_anr_scan=PASS\nframe_jank_scan=PASS\nframe_jank_policy=app_process_skipped_frames_ge_60_or_davey_ge_1000ms\napi_level=35\n' > "$EVIDENCE/RUNTIME_GATE.txt"
