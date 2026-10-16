#!/usr/bin/env bash

adb_capture_retry() {
  local output="$1"
  shift
  local max_attempts="${BLAISE_ADB_RETRY_MAX:-5}"
  local delay_seconds="${BLAISE_ADB_RETRY_DELAY_SECONDS:-1}"
  local attempt tmp

  [[ "$max_attempts" =~ ^[1-9][0-9]*$ ]] || {
    echo "invalid BLAISE_ADB_RETRY_MAX" >&2
    return 2
  }
  [[ "$delay_seconds" =~ ^[0-9]+$ ]] || {
    echo "invalid BLAISE_ADB_RETRY_DELAY_SECONDS" >&2
    return 2
  }

  tmp="${output}.tmp"
  rm -f "$tmp"

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if "$@" > "$tmp"; then
      mv "$tmp" "$output"
      return 0
    fi

    rm -f "$tmp"
    if (( attempt < max_attempts )); then
      adb wait-for-device >/dev/null 2>&1 || true
      sleep "$delay_seconds"
    fi
  done

  echo "ADB command failed after ${max_attempts} attempts: $*" >&2
  return 1
}
