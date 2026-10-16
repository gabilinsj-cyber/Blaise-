#!/usr/bin/env bash
set -euo pipefail
set +x
project=blaise-v6-rj
region=southamerica-east1
service=blaise-v6-rj-backend
secret=blaise-rj-openweather-api-key
repo_dir="$HOME/blaise-rj-fontes"
if [[ ! -d "$repo_dir/.git" ]]; then
  printf '%s\n' 'Pasta ~/blaise-rj-fontes não encontrada. Abra o Cloud Shell usado nas implantações anteriores.' >&2
  exit 1
fi
[[ -t 0 ]] || { printf '%s\n' 'Execute em terminal interativo.' >&2; exit 1; }
command -v gcloud >/dev/null || { printf '%s\n' 'gcloud indisponível: execute no Google Cloud Shell.' >&2; exit 1; }
git -C "$repo_dir" fetch origin codex/rj-marine-primary-sources
commit=$(git -C "$repo_dir" rev-parse FETCH_HEAD)
staging=$(mktemp -d)
cleanup(){ unset owm_key; rm -rf "$staging"; }
trap cleanup EXIT
git -C "$repo_dir" archive "$commit" backend | tar -x -C "$staging"
if [[ ! -s "$staging/backend/Dockerfile" ]]; then
 printf '%s\n' 'Dockerfile ausente no código baixado; implantação interrompida antes de solicitar a chave.' >&2
 exit 1
fi
printf '%s\n' "Código candidato: $commit"
IFS= read -r -s -p 'Cole a API key OpenWeatherMap do e-mail e pressione Enter (entrada oculta): ' owm_key
printf '\n'
[[ "$owm_key" =~ ^[a-fA-F0-9]{32}$ ]] || { printf '%s\n' 'Chave inválida; nenhuma implantação realizada.' >&2; exit 1; }
gcloud services enable secretmanager.googleapis.com --project="$project" >/dev/null
if ! gcloud secrets describe "$secret" --project="$project" >/dev/null 2>&1; then
 gcloud secrets create "$secret" --project="$project" --replication-policy=automatic >/dev/null
fi
version_path=$(printf '%s' "$owm_key" | gcloud secrets versions add "$secret" --project="$project" --data-file=- --format='value(name)')
unset owm_key
version=${version_path##*/}
[[ "$version" =~ ^[0-9]+$ ]] || { printf '%s\n' 'Não foi possível confirmar a versão do segredo.' >&2; exit 1; }
service_account=$(gcloud run services describe "$service" --project="$project" --region="$region" --format='value(spec.template.spec.serviceAccountName)')
[[ "$service_account" == *@*.iam.gserviceaccount.com ]] || { printf '%s\n' 'Conta do serviço não confirmada.' >&2; exit 1; }
gcloud secrets add-iam-policy-binding "$secret" --project="$project" --member="serviceAccount:$service_account" --role=roles/secretmanager.secretAccessor >/dev/null
gcloud run deploy "$service" --project="$project" --region="$region" --source="$staging/backend" --no-traffic --tag=validacao-rj --update-secrets="BLAISE_OPENWEATHER_API_KEY=$secret:$version" --update-env-vars=BLAISE_OPENWEATHER_ENABLED=true,BLAISE_OPENWEATHER_USAGE_APPROVED=true,BLAISE_PUBLIC_OPENWEATHER_APPROVED=true
printf '%s\n' 'Candidata implantada. Falta conferir openWeatherComplement na rota e validar o APK; produção não foi promovida.'
