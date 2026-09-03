#!/usr/bin/env bash
set -euo pipefail

PKG="br.com.blaise.rj.debug"
ACT="br.com.blaise.rj.MainActivity"
OUT_DIR="evidence/runtime"
mkdir -p "$OUT_DIR"

adb wait-for-device
until [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do sleep 2; done

adb shell am force-stop "$PKG" || true
cold_start="$(adb shell am start -W -n "$PKG/$ACT")"
printf '%s\n' "$cold_start" | tee "$OUT_DIR/cold-start.txt"
printf '%s\n' "$cold_start" | grep -q "Status: ok"
pid1="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid1"

adb shell input keyevent KEYCODE_HOME
sleep 2
resume="$(adb shell am start -W -n "$PKG/$ACT")"
printf '%s\n' "$resume" | tee "$OUT_DIR/background-foreground.txt"
printf '%s\n' "$resume" | grep -q "Status: ok"

adb shell am force-stop "$PKG"
sleep 1
restart="$(adb shell am start -W -n "$PKG/$ACT")"
printf '%s\n' "$restart" | tee "$OUT_DIR/process-restart.txt"
printf '%s\n' "$restart" | grep -q "Status: ok"
pid2="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid2"

adb shell dumpsys activity activities > "$OUT_DIR/activity-dumpsys.txt"
grep -q "$PKG/$ACT" "$OUT_DIR/activity-dumpsys.txt"

adb shell screencap -p /sdcard/blaise-runtime.png
adb pull /sdcard/blaise-runtime.png "$OUT_DIR/blaise-runtime.png" >/dev/null
adb logcat -d -t 500 > "$OUT_DIR/logcat.txt"
if grep -E "FATAL EXCEPTION|ANR in ${PKG}" "$OUT_DIR/logcat.txt"; then
  echo "Runtime fatal signal detected" >&2
  exit 1
fi

cat > "$OUT_DIR/summary.txt" <<EOF
cold_start=PASS
background_foreground=PASS
process_restart=PASS
pid_initial=$pid1
pid_after_restart=$pid2
EOF
