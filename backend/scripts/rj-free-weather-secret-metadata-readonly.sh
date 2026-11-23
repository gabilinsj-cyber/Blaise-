#!/usr/bin/env bash
# Blaise V6 RJ: READ-ONLY Cloud Shell preflight for two Free providers.
# Does NOT read secret payload, test API key, change IAM, create resources,
# call meteorology, deploy, merge, display credentials or charge anything.
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
project="${1:-blaise-v6-rj}"
if [[ "$project" != "blaise-v6-rj" ]]; then
  printf '%s\n' 'BLOQUEADO: projeto diferente de blaise-v6-rj'
  exit 2
fi
if ! command -v gcloud >/dev/null 2>&1; then
  printf '%s\n' 'BLOQUEADO: gcloud indisponivel'
  exit 2
fi
printf '%s\n' "BLAISE_GCP_METADATA_PREFLIGHT project=$project"
for secret in blaise-weatherapi-free-api-key blaise-visual-crossing-free-api-key; do
  # Only names and states; never versions access / never payload.
  if result="$(gcloud secrets describe "$secret" --project="$project" --format='value(name)' 2>&1)"; then
    printf 'secret=%s state=FOUND_METADATA\n' "$secret"
    if versions="$(gcloud secrets versions list "$secret" --project="$project" --format='value(state)' --limit=100 2>&1)"; then
      enabled=0
      while IFS= read -r state; do
        [[ "$state" == "ENABLED" ]] && ((enabled+=1)) || true
      done <<< "$versions"
      if (( enabled>0 )); then
        printf 'secret=%s enabled_versions=%s payload_not_read=true\n' "$secret" "$enabled"
      else
        printf 'secret=%s enabled_versions=0 payload_not_read=true\n' "$secret"
      fi
    else
      printf 'secret=%s versions=UNKNOWN_NO_METADATA_PERMISSION payload_not_read=true\n' "$secret"
    fi
  elif [[ "$result" == *"NOT_FOUND"* ]]; then
    printf 'secret=%s state=NOT_FOUND payload_not_read=true\n' "$secret"
  else
    printf 'secret=%s state=UNKNOWN_OR_PERMISSION_DENIED payload_not_read=true\n' "$secret"
  fi
done
printf '%s\n' 'DEPLOY_EXECUTED=false IAM_MODIFIED=false PROVIDER_CALLS=0'
