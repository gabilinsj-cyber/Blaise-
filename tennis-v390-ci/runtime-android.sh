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

# Cold start is measured separately from steady-state frame health so emulator/first-draw
# initialization cannot be misclassified as sustained match jank. The launch gate remains
# fail-closed: a cold start above 3 seconds fails independently.
COLD_START_MS="$(awk '/^TotalTime:/ {print $2}' "$EVIDENCE/LAUNCH.txt" | tail -n1 | tr -d '\r')"
test -n "$COLD_START_MS"
printf '%s\n' "$COLD_START_MS" | tee "$EVIDENCE/COLD_START_MS.txt"
if [ "$COLD_START_MS" -gt 3000 ]; then
  printf 'binary=exact-signed-release-apk\ninstall=PASS\nlaunch=FAIL\ncold_start_ms=%s\ncold_start_policy_ms=3000\nprocess_alive=NOT_EVALUATED\ncrash_anr_scan=NOT_EVALUATED\nframe_jank_scan=NOT_EVALUATED\napi_level=35\n' "$COLD_START_MS" > "$EVIDENCE/RUNTIME_GATE.txt"
  exit 1
fi

sleep 5
APP_PID="$(adb shell pidof com.blaise.opentennis | tr -d '\r' | awk '{print $1}')"
printf '%s\n' "$APP_PID" | tee "$EVIDENCE/PID.txt"
test -n "$APP_PID"

# Preserve startup diagnostics before beginning the steady-state sample.
adb logcat -d > "$EVIDENCE/STARTUP_LOGCAT.txt"
awk -v pid="$APP_PID" '$3 == pid {print}' "$EVIDENCE/STARTUP_LOGCAT.txt" > "$EVIDENCE/STARTUP_APP_LOGCAT.txt"
if grep -E 'FATAL EXCEPTION|ANR in com\.blaise\.opentennis|Process: com\.blaise\.opentennis.*has died' "$EVIDENCE/STARTUP_LOGCAT.txt"; then
  printf 'binary=exact-signed-release-apk\ninstall=PASS\nlaunch=PASS\ncold_start_ms=%s\nprocess_alive=PASS\ncrash_anr_scan=FAIL\nframe_jank_scan=NOT_EVALUATED\napi_level=35\n' "$COLD_START_MS" > "$EVIDENCE/RUNTIME_GATE.txt"
  exit 1
fi

# Reset diagnostics after warm-up and exercise the real View with several input/draw cycles.
# This measures steady-state responsiveness instead of counting first-draw/emulator warm-up.
adb shell dumpsys gfxinfo com.blaise.opentennis reset >/dev/null 2>&1 || true
adb logcat -c
for point in '540 700' '420 760' '660 740' '520 650' '600 820'; do
  adb shell input tap $point
  sleep 0.25
done
sleep 3

APP_PID_AFTER="$(adb shell pidof com.blaise.opentennis | tr -d '\r' | awk '{print $1}')"
test -n "$APP_PID_AFTER"
printf '%s\n' "$APP_PID_AFTER" | tee "$EVIDENCE/PID_AFTER_INTERACTION.txt"

adb logcat -d > "$EVIDENCE/LOGCAT.txt"
awk -v pid="$APP_PID_AFTER" '$3 == pid {print}' "$EVIDENCE/LOGCAT.txt" > "$EVIDENCE/APP_LOGCAT.txt"
adb shell dumpsys gfxinfo com.blaise.opentennis framestats > "$EVIDENCE/GFXINFO_FRAMESTATS.txt" || true

if grep -E 'FATAL EXCEPTION|ANR in com\.blaise\.opentennis|Process: com\.blaise\.opentennis.*has died' "$EVIDENCE/LOGCAT.txt"; then
  printf 'binary=exact-signed-release-apk\ninstall=PASS\nlaunch=PASS\ncold_start_ms=%s\nprocess_alive=PASS\ncrash_anr_scan=FAIL\nframe_jank_scan=NOT_EVALUATED\napi_level=35\n' "$COLD_START_MS" > "$EVIDENCE/RUNTIME_GATE.txt"
  exit 1
fi

# Fail closed on severe steady-state stalls emitted by the Blaise process itself.
# At 60 Hz, 60 skipped frames is about one second without a rendered frame.
if grep -Eq 'Skipped ([6-9][0-9]|[1-9][0-9]{2,}) frames!' "$EVIDENCE/APP_LOGCAT.txt" || \
   grep -Eq 'Davey! duration=[1-9][0-9]{3,}ms' "$EVIDENCE/APP_LOGCAT.txt"; then
  {
    printf 'binary=exact-signed-release-apk\n'
    printf 'install=PASS\nlaunch=PASS\ncold_start_ms=%s\n' "$COLD_START_MS"
    printf 'process_alive=PASS\ncrash_anr_scan=PASS\n'
    printf 'frame_jank_scan=FAIL\nframe_jank_scope=steady_state_after_warmup_and_input\n'
    printf 'frame_jank_policy=app_process_skipped_frames_ge_60_or_davey_ge_1000ms\n'
    printf 'api_level=35\n'
  } > "$EVIDENCE/RUNTIME_GATE.txt"
  grep -E 'Skipped .* frames!|Davey! duration=' "$EVIDENCE/APP_LOGCAT.txt" > "$EVIDENCE/FRAME_JANK_FINDINGS.txt" || true
  exit 1
fi

adb shell dumpsys activity activities > "$EVIDENCE/ACTIVITY.txt"
grep -q 'com.blaise.opentennis/.MainActivity' "$EVIDENCE/ACTIVITY.txt"
adb exec-out screencap -p > "$EVIDENCE/RUNTIME.png"
printf 'binary=exact-signed-release-apk\ninstall=PASS\nlaunch=PASS\ncold_start_ms=%s\ncold_start_policy_ms=3000\nprocess_alive=PASS\nmain_activity=PASS\ncrash_anr_scan=PASS\nframe_jank_scan=PASS\nframe_jank_scope=steady_state_after_warmup_and_input\nframe_jank_policy=app_process_skipped_frames_ge_60_or_davey_ge_1000ms\napi_level=35\n' "$COLD_START_MS" > "$EVIDENCE/RUNTIME_GATE.txt"
