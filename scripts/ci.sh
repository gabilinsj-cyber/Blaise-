#!/usr/bin/env bash
set -euo pipefail

# Product-aware CI routing. The Blaise Open Tennis PR is intentionally isolated
# from the Blaise V6 RJ Android application; validating the wrong Android root
# can waste the job budget and cause unrelated cancellations. Shared backend
# validation remains a separate mandatory job in android-ci.yml.
CI_REF="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-}}"
if [[ "$CI_REF" == "tennis-v390-build-main-4" ]]; then
  mkdir -p evidence

  # Keep shell syntax validation as a cheap repository-integrity check.
  for script in scripts/*.sh; do
    bash -n "$script"
  done

  # Fail closed on Tennis lint, deterministic unit tests and both debug/release
  # compilation. These are CI artifacts only; signed release promotion remains
  # owned by tennis-v390-build.yml and its production-key/runtime gates.
  ./gradlew --no-daemon -p tennis-v390-android \
    clean \
    :app:lintDebug :app:lintRelease \
    :app:testDebugUnitTest :app:testReleaseUnitTest \
    :app:assembleDebug :app:assembleRelease \
    :app:bundleRelease

  printf '%s\n' \
    'CI_TARGET=BLAISE_OPEN_TENNIS' \
    'shell_syntax=PASS' \
    'lint_debug=PASS' \
    'lint_release=PASS' \
    'unit_tests_debug=PASS' \
    'unit_tests_release=PASS' \
    'assemble_debug=PASS' \
    'assemble_release=PASS' \
    'bundle_release=PASS' \
    'signed_release_gate=SEPARATE_MANDATORY_WORKFLOW' \
    > evidence/tennis-ci-gate.txt
  exit 0
fi

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
bash scripts/test-official-source-workflow.sh | tee evidence/official-source-workflow-selftest.txt
node --check backend/src/source-contract.mjs
node --check backend/src/alerta-rio-source.mjs
node --check backend/scripts/probe-official-sources.mjs

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
