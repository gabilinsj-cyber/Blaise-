#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"

cat > "$TMP/bin/adb" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "wait-for-device" ]]; then
  exit 0
fi
counter="${BLAISE_FAKE_ADB_COUNTER:?}"
count=0
[[ -f "$counter" ]] && count="$(cat "$counter")"
count=$((count + 1))
printf '%s' "$count" > "$counter"
if (( count < ${BLAISE_FAKE_ADB_SUCCEED_AT:-3} )); then
  exit 255
fi
printf '%s\n' 'fake-adb-success'
SH
chmod +x "$TMP/bin/adb"

export PATH="$TMP/bin:$PATH"
export BLAISE_FAKE_ADB_COUNTER="$TMP/counter"
export BLAISE_ADB_RETRY_MAX=5
export BLAISE_ADB_RETRY_DELAY_SECONDS=0

# shellcheck source=scripts/runtime-adb-retry.sh
source "$ROOT/scripts/runtime-adb-retry.sh"

out="$TMP/out.txt"
BLAISE_FAKE_ADB_SUCCEED_AT=3 adb_capture_retry "$out" adb shell dumpsys notification --noredact
test "$(cat "$out")" = "fake-adb-success"
test "$(cat "$BLAISE_FAKE_ADB_COUNTER")" = "3"

rm -f "$BLAISE_FAKE_ADB_COUNTER" "$out"
set +e
BLAISE_FAKE_ADB_SUCCEED_AT=99 BLAISE_ADB_RETRY_MAX=2 adb_capture_retry "$out" adb shell dumpsys notification --noredact
rc=$?
set -e
test "$rc" -ne 0
test "$(cat "$BLAISE_FAKE_ADB_COUNTER")" = "2"
test ! -e "$out"

printf '%s\n' 'RUNTIME_ADB_RETRY_SELFTEST=PASS'
