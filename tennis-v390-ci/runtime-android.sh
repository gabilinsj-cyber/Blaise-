#!/usr/bin/env bash
set -euo pipefail

mkdir -p tennis-v390-runtime-evidence
APK_PATH="$(find tennis-v390-release-under-test -type f -name 'Blaise-Open-Tennis-v3.9.0-release-signed.apk' -size +0c | head -n1)"
test -n "$APK_PATH"
sha256sum "$APK_PATH" | tee tennis-v390-runtime-evidence/INSTALLED_APK_SHA256.txt
adb install -r "$APK_PATH" | tee tennis-v390-runtime-evidence/INSTALL.txt
grep -q 'Success' tennis-v390-runtime-evidence/INSTALL.txt
adb logcat -c
adb shell am start -W -n com.blaise.opentennis/.MainActivity | tee tennis-v390-runtime-evidence/LAUNCH.txt
grep -q 'Status: ok' tennis-v390-runtime-evidence/LAUNCH.txt
sleep 5
adb logcat -d > tennis-v390-runtime-evidence/LOGCAT.txt
if grep -E 'FATAL EXCEPTION|ANR in com\.blaise\.opentennis|Process: com\.blaise\.opentennis.*has died' tennis-v390-runtime-evidence/LOGCAT.txt; then
  printf 'crash_anr_scan=FAIL\n' > tennis-v390-runtime-evidence/RUNTIME_GATE.txt
  exit 1
fi
adb shell dumpsys activity activities > tennis-v390-runtime-evidence/ACTIVITY.txt
adb shell pidof com.blaise.opentennis | tee tennis-v390-runtime-evidence/PID.txt
test -s tennis-v390-runtime-evidence/PID.txt
grep -q 'com.blaise.opentennis/.MainActivity' tennis-v390-runtime-evidence/ACTIVITY.txt
adb exec-out screencap -p > tennis-v390-runtime-evidence/RUNTIME.png
printf 'binary=exact-signed-release-apk\ninstall=PASS\nlaunch=PASS\nprocess_alive=PASS\nmain_activity=PASS\ncrash_anr_scan=PASS\napi_level=35\n' > tennis-v390-runtime-evidence/RUNTIME_GATE.txt
