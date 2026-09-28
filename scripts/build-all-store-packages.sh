#!/usr/bin/env bash
set -euo pipefail
umask 077

root_evidence="${BLAISE_ALL_STORES_EVIDENCE_DIR:-evidence/stores}"
root_packages="${BLAISE_ALL_STORES_PACKAGE_DIR:-store-packages}"
mkdir -p "$root_evidence" "$root_packages"

channels=(GOOGLE_PLAY SAMSUNG_GALAXY_STORE AMAZON_APPSTORE)
for channel in "${channels[@]}"; do
  case "$channel" in
    GOOGLE_PLAY) slug='google-play' ;;
    SAMSUNG_GALAXY_STORE) slug='samsung-galaxy-store' ;;
    AMAZON_APPSTORE) slug='amazon-appstore' ;;
  esac
  echo "Building signed package for $channel"
  BLAISE_STORE_CHANNEL="$channel" \
  BLAISE_RELEASE_EVIDENCE_DIR="$root_evidence/$slug" \
  BLAISE_STORE_PACKAGE_DIR="$root_packages/$slug" \
    bash scripts/release-gate.sh
done

sha256sum "$root_packages"/*/*.apk "$root_packages"/*/*.aab > "$root_packages/SHA256SUMS"
printf '%s\n' \
  'ALL_STORE_PACKAGES_GATE=PASS' \
  'google_play=PASS' \
  'samsung_galaxy_store=PASS' \
  'amazon_appstore=PASS' \
  'publication=REQUIRES_STORE_ACCOUNT_CONFIRMATION' \
  > "$root_evidence/gate.txt"
