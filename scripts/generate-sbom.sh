#!/usr/bin/env bash
set -euo pipefail
mkdir -p evidence
./gradlew --no-daemon dependencies --configuration debugRuntimeClasspath > evidence/dependencies.txt
python3 scripts/sbom.py evidence/dependencies.txt evidence/sbom.cdx.json

