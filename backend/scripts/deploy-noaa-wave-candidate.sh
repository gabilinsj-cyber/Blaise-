#!/usr/bin/env bash
set -euo pipefail
repo_dir="$HOME/blaise-rj-fontes"
staging=$(mktemp -d "$HOME/blaise-rj-noaa-validacao.XXXXXX")
project=blaise-v6-rj
region=southamerica-east1
service=blaise-v6-rj-backend
command -v gcloud >/dev/null
command -v node >/dev/null
test -d "$repo_dir/.git"
git -C "$repo_dir" fetch origin codex/rj-marine-primary-sources
candidate_sha=$(git -C "$repo_dir" rev-parse FETCH_HEAD)
git -C "$repo_dir" archive "$candidate_sha" backend | tar -x -C "$staging"
test -s "$staging/backend/package.json"
test -s "$staging/backend/src/noaa-rj-wave-forecast.mjs"
printf 'Código candidato: %s\n' "$candidate_sha"
node "$staging/backend/scripts/verify-noaa-rj-waves.mjs"
gcloud run deploy "$service" --project="$project" --region="$region" --source="$staging/backend" --no-traffic --tag=validacao-rj --update-env-vars=BLAISE_NOAA_WAVES_ENABLED=true,BLAISE_PUBLIC_NOAA_WAVES_APPROVED=true --quiet
printf '%s\n' 'Candidata implantada sem tráfego de produção. Verifique oceanWaveForecast na rota pública; ainda não comprova o aplicativo instalado.'
