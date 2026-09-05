#!/usr/bin/env bash
set -euo pipefail

for script in scripts/*.sh; do
  bash -n "$script"
done

./gradlew --no-daemon --continue \
  clean \
  lintDebug lintRelease \
  testDebugUnitTest testReleaseUnitTest \
  assembleDebug assembleRelease assembleDebugAndroidTest \
  bundleRelease

./scripts/generate-sbom.sh
./scripts/verify-artifacts.sh
