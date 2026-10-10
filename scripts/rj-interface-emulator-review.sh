#!/usr/bin/env bash
# Blaise V6 RJ rendered visual and functional review in a clean CI emulator.
# No paid product, real customer account, production deploy or phone download.
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

# The initial 10/10 run produced FOUR screenshots, but all three portrait
# captures were identical and Pixel Launcher had an ANR dialog obscuring them.
# UI instrumentation had passed underneath. We MUST no longer count this as
# visual approval. First let the emulator settle and run functional tests.
sleep 12
set +e
timeout 240s adb shell am instrument -w -r \
    br.com.blaise.rj.debug.test/androidx.test.runner.AndroidJUnitRunner \
    > "$OUT/android-instrumentation.txt" 2>&1
instrument_exit=$?
set -e
if (( instrument_exit != 0 )) || ! grep -Eq '^OK \([0-9]+ tests?\)' "$OUT/android-instrumentation.txt" \
   || grep -Eq 'FAILURES!!!|INSTRUMENTATION_FAILED|Process crashed|shortMsg=Process crashed' "$OUT/android-instrumentation.txt"; then
    echo "RJ_UI_FUNCTIONAL_REVIEW=FAIL"
    tail -80 "$OUT/android-instrumentation.txt" || true
    exit 1
fi

# Force-stop only the ephemeral emulator launcher after instrumentation; start
# the Blaise activity explicitly, never through the home-screen launcher.
adb shell am force-stop com.google.android.apps.nexuslauncher || true
adb shell am force-stop br.com.blaise.rj.debug || true
adb shell am start -W -n br.com.blaise.rj.debug/br.com.blaise.rj.MainActivity \
    > "$OUT/launch.txt"
grep -Fq 'Activity: br.com.blaise.rj.debug/br.com.blaise.rj.MainActivity' "$OUT/launch.txt"
sleep 8

snapshot() {
    local file="$1"
    local name="${file%.png}"
    # Inspect a real accessibility hierarchy BEFORE accepting screenshots,
    # because a nontransparent ANR dialog can otherwise hide the entire UI.
    timeout 60s adb shell uiautomator dump /sdcard/blaise-rj-ui.xml \
        > "$OUT/${name}-dump.log" 2>&1 || {
            echo "RJ_UI_VISUAL_REVIEW=FAIL hierarchy timeout ($file)"
            return 1
        }
    adb shell cat /sdcard/blaise-rj-ui.xml > "$OUT/${name}-hierarchy.xml"
    if grep -Eiq "isn.t responding|is not responding|application not responding|has stopped|close app|Pixel Launcher" \
        "$OUT/${name}-hierarchy.xml"; then
        echo "RJ_UI_VISUAL_REVIEW=FAIL blocking Android system dialog ($file)"
        return 1
    fi
    # Ensure our own activity is foreground, not a launcher ANR.
    adb shell dumpsys activity activities > "$OUT/${name}-activity.txt"
    if ! grep -Eq 'mResumedActivity.*br\.com\.blaise\.rj\.debug|topResumedActivity.*br\.com\.blaise\.rj\.debug|ResumedActivity.*br\.com\.blaise\.rj\.debug' \
        "$OUT/${name}-activity.txt"; then
        echo "RJ_UI_VISUAL_REVIEW=FAIL Blaise activity not resumed ($file)"
        return 1
    fi
    adb exec-out screencap -p > "$OUT/$file"
    test "$(wc -c < "$OUT/$file")" -ge 20000
}

snapshot 01-portrait-home.png
adb shell input swipe 500 1680 500 480 700
sleep 2
snapshot 02-portrait-middle.png
adb shell input swipe 500 1680 500 470 700
sleep 2
snapshot 03-portrait-lower.png

# Move back to the first section; a landscape screenshot of an already
# scrolled view cannot establish that the complete three-column layout exists.
for _ in 1 2 3 4; do
    adb shell input swipe 500 390 500 1750 450
done
sleep 2
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
sleep 5
snapshot 04-landscape-top.png
adb shell input swipe 1180 870 1180 280 660
sleep 2
snapshot 05-landscape-map.png
adb shell settings put system user_rotation 0

# Simple non-negotiable visual evidence gates (screenshots cannot be identical).
if cmp -s "$OUT/01-portrait-home.png" "$OUT/02-portrait-middle.png" \
   || cmp -s "$OUT/02-portrait-middle.png" "$OUT/03-portrait-lower.png" \
   || cmp -s "$OUT/04-landscape-top.png" "$OUT/05-landscape-map.png"; then
    echo "RJ_UI_VISUAL_REVIEW=FAIL identical scrolling screenshots"
    exit 1
fi
test_count="$(sed -n 's/^OK (\([0-9]*\) tests).*/\1/p' "$OUT/android-instrumentation.txt" | tail -1)"
printf '%s\n' \
  "RJ_UI_FUNCTIONAL_REVIEW=PASS" \
  "RJ_UI_VISUAL_EVIDENCE_GATE=PASS" \
  "INSTRUMENTATION_TESTS=$test_count" \
  "RENDERED_SCREENSHOTS=5" \
  "EMULATOR_PORTRAIT_LANDSCAPE=CAPTURED" \
  "HUMAN_VISUAL_PARITY=REQUIRES_MANUAL_REVIEW" \
  "REAL_WEATHER_DATA=NOT_CLAIMED" \
  "REAL_ANDROID_HARDWARE=NOT_TESTED" \
  | tee "$OUT/summary.txt"
