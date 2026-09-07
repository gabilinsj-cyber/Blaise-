#!/usr/bin/env bash
set -euo pipefail

for script in scripts/*.sh; do
  bash -n "$script"
done

mkdir -p evidence
BLAISE_PREFLIGHT_TEST_RESULT_FILE=evidence/production-preflight-selftest.txt \
  bash scripts/test-production-preflight.sh
bash scripts/test-testlab-workflow.sh | tee evidence/firebase-testlab-workflow-selftest.txt
bash scripts/test-cloudrun-workflow.sh | tee evidence/cloudrun-workflow-selftest.txt
bash scripts/test-cloudrun-promotion-workflow.sh | tee evidence/cloudrun-promotion-workflow-selftest.txt
bash scripts/test-runtime-adb-retry.sh | tee evidence/runtime-adb-retry-selftest.txt

test "$(node --version)" = "v24.20.0"
test "$(npm --version)" = "11.19.0"
(
  cd backend
  rm -f package-lock.json
  npm install --package-lock-only --ignore-scripts --no-audit --no-fund
  sha256sum package-lock.json
  sha256sum -c package-lock.sha256
  npm ci --ignore-scripts --no-audit --no-fund
  npm run check
  npm test
  npm ls --all --json > ../evidence/backend-npm-dependencies.json
)
cp backend/package-lock.json evidence/backend-package-lock.json

./gradlew --no-daemon --continue \
  clean \
  lintDebug lintRelease \
  testDebugUnitTest testReleaseUnitTest \
  assembleDebug assembleRelease assembleDebugAndroidTest \
  bundleRelease

./scripts/generate-sbom.sh
./scripts/verify-artifacts.sh
