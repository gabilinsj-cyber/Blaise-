#!/usr/bin/env bash
# Prepare the locked Firestore server SDK in an ISOLATED review worktree.
# Does not deploy, access credentials or change Cloud Run.
set -euo pipefail

repo="$(git rev-parse --show-toplevel)"
cd "$repo"
branch="$(git branch --show-current)"
if [[ "$branch" != "local/agent13-runtime-prep" ]]; then
  echo "STOP: run ONLY from an isolated worktree on branch local/agent13-runtime-prep"
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "STOP: review worktree has local changes; nothing modified"
  git status --short
  exit 1
fi
node_major="$(node -p "process.versions.node.split('.')[0]")"
npm_version="$(npm --version)"
if [[ "$node_major" != "24" || "$npm_version" != "11.19.0" ]]; then
  echo "STOP: requires Node 24 and npm 11.19.0, found Node $node_major / npm $npm_version"
  exit 1
fi

old_sha="$(cut -d' ' -f1 backend/package-lock.sha256)"
if [[ ! "$old_sha" =~ ^[a-f0-9]{64}$ ]]; then
  echo "STOP: existing backend checksum invalid"
  exit 1
fi
(cd backend && sha256sum -c package-lock.sha256)

echo "=== Update lockfile for Firestore 9.4.1 (no provider calls) ==="
(
  cd backend
  npm install --save-exact --package-lock-only --ignore-scripts --no-audit --no-fund @google-cloud/firestore@9.4.1
  sha256sum package-lock.json > package-lock.sha256
  npm ci --ignore-scripts --no-audit --no-fund
  sha256sum -c package-lock.sha256
  npm run check
  node --test test/rj-agent13-runtime-optional.test.mjs \
    test/rj-openweather-onecall4.test.mjs \
    test/rj-openweather-agent13-service.test.mjs \
    test/rj-openweather-firestore-store.test.mjs
)
new_sha="$(cut -d' ' -f1 backend/package-lock.sha256)"
OLD_SHA="$old_sha" NEW_SHA="$new_sha" python3 - <<'PY'
import os
from pathlib import Path
p=Path('.github/workflows/android-ci.yml')
text=p.read_text()
old=os.environ['OLD_SHA']
new=os.environ['NEW_SHA']
if text.count(old)!=1:
    raise SystemExit('STOP: expected exactly one pinned CI lock hash')
p.write_text(text.replace(old,new))
PY

echo "=== Files prepared for careful review (not committed/deployed) ==="
git status --short
echo "Verify checksums, review diff, then commit ONLY from review worktree."
