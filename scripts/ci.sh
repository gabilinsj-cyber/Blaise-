#!/usr/bin/env bash
set -euo pipefail
./gradlew --no-daemon clean lintDebug testDebugUnitTest assembleDebug bundleRelease
./scripts/generate-sbom.sh
./scripts/verify-artifacts.sh
