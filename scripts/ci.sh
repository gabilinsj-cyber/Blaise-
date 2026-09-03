#!/usr/bin/env bash
set -euo pipefail
./gradlew --no-daemon --continue clean lintDebug testDebugUnitTest assembleDebug assembleDebugAndroidTest bundleRelease
./scripts/generate-sbom.sh
./scripts/verify-artifacts.sh
