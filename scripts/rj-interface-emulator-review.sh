#!/usr/bin/env bash
# Blaise V6 RJ visual/functional evidence capture in a clean CI Android emulator.
# NO real accounts, entitlements, purchases, locations, or production deployment.
set -euo pipefail

OUT="${BLAISE_UI_REVIEW_DIR:-evidence/rj-interface-review}"
mkdir -p "$OUT"

APP_APK="app/build/outputs/apk/debug/app-debug.apk"
TEST_APK="app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
test -s "$APP_APK"
test -s "$TEST_APK"

adb wait-for-device
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb install -r "$APP_APK"
adb install -r "$TEST_APK"

# Screenshots before any test-state changes. Source is a genuinely rendered
# emulator, not a recreated concept mockup.
adb shell am start -W -n br.com.blaise.rj.debug/br.com.blaise.rj.MainActivity \
    > "$OUT/launch.txt"
sleep 8
adb exec-out screencap -p > "$OUT/01-portrait-home.png"
adb shell input swipe 490 1650 490 550 700
sleep 2
adb exec-out screencap -p > "$OUT/02-portrait-middle.png"
adb shell input swipe 490 1650 490 520 700
sleep 2
adb exec-out screencap -p > "$OUT/03-portrait-lower.png"

# Rotate emulator to test the wide layout and capture actual pixels.
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
sleep 4
adb exec-out screencap -p > "$OUT/04-landscape.png"
adb shell settings put system user_rotation 0
sleep 3

# Keep screenshots even if Android instrumentation fails.
set +e
adb shell am instrument -w -r \
    br.com.blaise.rj.debug.test/androidx.test.runner.AndroidJUnitRunner \
    > "$OUT/android-instrumentation.txt" 2>&1
instrument_exit=$?
set -e

# Explicitly reject hidden test failures even if adb itself returned 0.
if (( instrument_exit != 0 )) || ! grep -Eq '^OK \([0-9]+ tests?\)' "$OUT/android-instrumentation.txt" \
   || grep -Eq 'FAILURES!!!|INSTRUMENTATION_FAILED|Process crashed|shortMsg=Process crashed' "$OUT/android-instrumentation.txt"; then
    echo "RJ_UI_FUNCTIONAL_REVIEW=FAIL"
    tail -80 "$OUT/android-instrumentation.txt" || true
    exit 1
fi

for shot in "$OUT"/*.png; do
    test "$(wc -c < "$shot")" -ge 20000
done
printf '%s\n' \
  "RJ_UI_FUNCTIONAL_REVIEW=PASS" \
  "RENDERED_SCREENSHOTS=4" \
  "EMULATOR_PORTRAIT_LANDSCAPE=CAPTURED" \
  "REAL_WEATHER_DATA=NOT_CLAIMED" \
  "REAL_ANDROID_HARDWARE=NOT_TESTED" \
  | tee "$OUT/summary.txt"
