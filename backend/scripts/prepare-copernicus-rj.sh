#!/usr/bin/env bash
set -euo pipefail
repo="$HOME/blaise-rj-fontes"
git -C "$repo" fetch origin codex/rj-marine-primary-sources
stage=$(mktemp -d "$HOME/blaise-rj-copernicus.XXXXXX")
git -C "$repo" archive FETCH_HEAD backend | tar -x -C "$stage"
python3 -m venv "$stage/venv"
"$stage/venv/bin/pip" install --disable-pip-version-check copernicusmarine==2.5.0 > "$stage/install.log" 2>&1
"$stage/venv/bin/python" "$stage/backend/scripts/verify-copernicus-rj-secure.py"
