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

adb shell cmd connectivity airplane-mode enable
sleep 2
airplane_on="$(adb shell settings get global airplane_mode_on | tr -d '\r')"
test "$airplane_on" = "1"
adb shell am force-stop "$PKG"
offline_start="$(adb shell am start -W -n "$PKG/$ACT")"
printf '%s\n' "$offline_start" | tee "$OUT_DIR/offline-start.txt"
printf '%s\n' "$offline_start" | grep -q "Status: ok"
adb shell cmd connectivity airplane-mode disable
sleep 2
airplane_off="$(adb shell settings get global airplane_mode_on | tr -d '\r')"
test "$airplane_off" = "0"

adb shell am force-stop "$PKG"
sleep 1
restart="$(adb shell am start -W -n "$PKG/$ACT")"
printf '%s\n' "$restart" | tee "$OUT_DIR/process-restart.txt"
printf '%s\n' "$restart" | grep -q "Status: ok"
pid2="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid2"

adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS
P0_TITLE="BLAISE_P0_TEST"
adb shell am broadcast -W --user 0 \
  -n "$PKG/br.com.blaise.rj.debug.RuntimeDebugReceiver" \
  -a br.com.blaise.rj.debug.RUNTIME_P0 \
  --es title "$P0_TITLE" | tee "$OUT_DIR/p0-broadcast.txt"
sleep 1
adb shell dumpsys notification --noredact > "$OUT_DIR/notifications.txt"
grep -q "blaise_p0" "$OUT_DIR/notifications.txt"
grep -q "$P0_TITLE" "$OUT_DIR/notifications.txt"

adb shell dumpsys activity activities > "$OUT_DIR/activity-dumpsys.txt"
grep -q "$PKG/$ACT" "$OUT_DIR/activity-dumpsys.txt"

adb shell screencap -p /sdcard/blaise-runtime.png
adb pull /sdcard/blaise-runtime.png "$OUT_DIR/blaise-runtime.png" >/dev/null
adb logcat -d -t 700 > "$OUT_DIR/logcat.txt"
if grep -E "FATAL EXCEPTION|ANR in ${PKG}" "$OUT_DIR/logcat.txt"; then
  echo "Runtime fatal signal detected" >&2
  exit 1
fi

cat > "$OUT_DIR/summary.txt" <<EOF
cold_start=PASS
background_foreground=PASS
offline_start=PASS
airplane_mode_restore=PASS
p0_notification=PASS
process_restart=PASS
pid_initial=$pid1
pid_after_restart=$pid2
EOF
