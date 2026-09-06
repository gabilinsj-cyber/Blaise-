#!/usr/bin/env bash
set -euo pipefail

for script in scripts/*.sh; do
  bash -n "$script"
done

mkdir -p evidence
npm --prefix backend install --ignore-scripts --no-audit --no-fund
npm --prefix backend run check
npm --prefix backend test
npm --prefix backend ls --all --json > evidence/backend-npm-dependencies.json
cp backend/package-lock.json evidence/backend-package-lock.json

./gradlew --no-daemon --continue \
  clean \
  lintDebug lintRelease \
  testDebugUnitTest testReleaseUnitTest \
  assembleDebug assembleRelease assembleDebugAndroidTest \
  bundleRelease

./scripts/generate-sbom.sh
./scripts/verify-artifacts.sh
