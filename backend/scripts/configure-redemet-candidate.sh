#!/usr/bin/env bash
# Run interactively in the operator's Cloud Shell. Never paste the key in chat.
set +x
set -euo pipefail
project=blaise-v6-rj
region=southamerica-east1
service=blaise-v6-rj-backend
secret=blaise-rj-redemet-api-key
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
backend_dir=$(cd -- "$script_dir/.." && pwd)
test -f "$backend_dir/Dockerfile"
command -v gcloud >/dev/null
test -t 0 || { echo 'Execute em um terminal interativo.'; exit 1; }
account=$(gcloud run services describe "$service" --project="$project" --region="$region" --format='value(spec.template.spec.serviceAccountName)')
test -n "$account" || { echo 'Conta do backend não identificada; nenhuma chave foi solicitada.'; exit 1; }
gcloud services enable secretmanager.googleapis.com --project="$project"
if ! gcloud secrets describe "$secret" --project="$project" >/dev/null 2>&1; then
  gcloud secrets create "$secret" --project="$project" --replication-policy=automatic
fi
redemet_key=''
trap 'unset redemet_key' EXIT
IFS= read -r -s -p 'Cole a chave REDEMET recebida por e-mail e pressione Enter (entrada oculta): ' redemet_key
printf '\n'
if [[ ! "$redemet_key" =~ ^[A-Za-z0-9_-]{20,1024}$ ]]; then
  echo 'Formato inválido; chave não armazenada.'
  exit 1
fi
version=$(printf '%s' "$redemet_key" | gcloud secrets versions add "$secret" --project="$project" --data-file=- --format='value(name)')
unset redemet_key
version=${version##*/}
[[ "$version" =~ ^[0-9]+$ ]]
gcloud secrets add-iam-policy-binding "$secret" --project="$project" \
  --member="serviceAccount:$account" --role=roles/secretmanager.secretAccessor >/dev/null
# Collection was authorized by the operator; public publication is separate.
gcloud run deploy "$service" --project="$project" --region="$region" \
  --source="$backend_dir" --no-traffic --tag=validacao-rj \
  --update-secrets="BLAISE_REDEMET_API_KEY=$secret:$version" \
  --update-env-vars=BLAISE_REDEMET_ENABLED=true,BLAISE_REDEMET_USAGE_APPROVED=true
echo 'Candidata configurada. Publicação REDEMET permanece sob aprovação separada.'
