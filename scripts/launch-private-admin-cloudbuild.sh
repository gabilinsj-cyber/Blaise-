#!/usr/bin/env bash
# Private Android admin build via Cloud Build, without Cloud Shell SDK or /tmp.
# Only new private Cloud Storage bucket and build IAM binding may be created.
# No backend, Firestore, NOAA or public client modification.
set -euo pipefail
PROJECT="blaise-v6-rj"
REGION="southamerica-east1"
REPO="$HOME/Blaise-RJ"
BR="safety/rj-agent13-firestore-failclosed-20261115"
SAFE="$HOME/blaise-rj-safety"
mkdir -p "$SAFE"
[ -d "$REPO/.git" ] || { echo "BLAISE_REPO_NOT_FOUND"; exit 1; }
for TOOL in git gzip python3 gcloud; do
  command -v "$TOOL" >/dev/null || { echo "MISSING_TOOL_$TOOL"; exit 1; }
done
ENABLED=$(gcloud services list --enabled --project="$PROJECT" \
  --filter='config.name=cloudbuild.googleapis.com' \
  --format='value(config.name)')
[ "$ENABLED" = "cloudbuild.googleapis.com" ] || {
  echo "CLOUD_BUILD_API_NOT_ENABLED: no APIs changed"; exit 1;
}
echo "=== PRIVATE_ANDROID_BUILD_APPROVAL ==="
echo "This operation uses billable Cloud Build and private Cloud Storage."
echo "Android SDK legal terms: https://developer.android.com/studio"
echo "It does not touch the production backend or send OpenWeather requests."
echo "To approve explicitly, re-run this script with BLAISE_BUILD_APPROVAL=ACEITO."
if [ "${BLAISE_BUILD_APPROVAL:-}" != "ACEITO" ]; then
  echo "OPERATOR_DID_NOT_APPROVE: no build or billing initiated"
  exit 1
fi
echo "EXPLICIT_LICENSE_AND_COST_APPROVAL_CONFIRMED"
NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
[ -n "$NUMBER" ] || { echo "PROJECT_NUMBER_NOT_FOUND"; exit 1; }
BUCKET="blaise-v6-rj-admin-private-$NUMBER"
BUILD_SA=$(gcloud builds get-default-service-account --region="$REGION" \
  --project="$PROJECT" --format='value(serviceAccountEmail)')
BUILD_SA=$(printf '%s' "$BUILD_SA" | awk -F/ '{print $NF}')
case "$BUILD_SA" in
  *@*.gserviceaccount.com) ;;
  *) echo "CLOUD_BUILD_ACCOUNT_NOT_FOUND"; exit 1 ;;
esac
echo "=== PRIVATE_BUCKET_CHECK ==="
if gcloud storage buckets describe "gs://$BUCKET" \
  --format=json > "$SAFE/admin-bucket-metadata.json" 2>/dev/null; then
  python3 - "$SAFE/admin-bucket-metadata.json" "$NUMBER" <<'PY'
import json,sys
doc=json.load(open(sys.argv[1]))
iam=doc.get('iamConfiguration',{})
project=str(doc.get('projectNumber',''))
if project and project != sys.argv[2]:
    raise SystemExit('BUCKET_OWNERSHIP_MISMATCH')
if iam.get('publicAccessPrevention')!='enforced' or not iam.get('uniformBucketLevelAccess',{}).get('enabled'):
    raise SystemExit('PRIVATE_BUCKET_SETTINGS_MISMATCH')
print('EXISTING_PRIVATE_BUCKET_VERIFIED')
PY
else
  echo "=== CREATING_PRIVATE_ADMIN_BUCKET ==="
  gcloud storage buckets create "gs://$BUCKET" \
    --project="$PROJECT" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention
fi
echo "=== GRANTING_BUILD_WRITE_ONLY_IN_PRIVATE_BUCKET ==="
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$BUILD_SA" \
  --role='roles/storage.objectCreator'
echo "=== ARCHIVING_ONLY_COMMITTED_ISOLATED_BRANCH ==="
cd "$REPO"
git fetch origin "refs/heads/$BR"
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM
ARCHIVE="$SAFE/admin-source-$RUN_ID.tar.gz"
CONFIG="$SAFE/admin-cloudbuild-$RUN_ID.yaml"
git archive --format=tar FETCH_HEAD | gzip > "$ARCHIVE"
git show "FETCH_HEAD:cloudbuild.admin-private.yaml" > "$CONFIG"
[ -s "$ARCHIVE" ] && [ -s "$CONFIG" ] || {
  echo "BUILD_FILES_MISSING"; exit 1;
}
# Fail closed if the free-tier-eligible machine or default pool is changed.
if ! grep -Eq '^[[:space:]]*machineType:[[:space:]]*E2_STANDARD_2[[:space:]]*
echo "=== PRIVATE_BUILD_FINISHED ==="
echo "PRIVATE_BUCKET=gs://$BUCKET/private-admin/$RUN_ID/"
gcloud storage ls -r "gs://$BUCKET/private-admin/$RUN_ID/**" || true
echo "=== NO_PRODUCTION_APPS_MODIFIED ==="
 "$CONFIG"; then
  echo "BUILD_BLOCKED: ONLY_E2_STANDARD_2_IS_ALLOWED"
  exit 1
fi
if grep -Eq '^[[:space:]]*pool:[[:space:]]*' "$CONFIG"; then
  echo "BUILD_BLOCKED: PRIVATE_POOL_IS_NOT_FREE_TIER"
  exit 1
fi
echo "=== FREE_TIER_ELIGIBLE_MACHINE_CONFIRMED: E2_STANDARD_2 ==="
echo "NOTE: 2500 free minutes are shared by all projects on the billing account."
echo "NOTE: Storage/network charges remain possible; this is not a zero-cost guarantee."
echo "=== SUBMITTING_ISOLATED_ANDROID_ADMIN_BUILD ==="
gcloud builds submit "$ARCHIVE" --project="$PROJECT" --region="$REGION" \
  --config="$CONFIG" --machine-type=e2-standard-2 \
  --substitutions="_ADMIN_BUCKET=$BUCKET,_BUILD_RUN_ID=$RUN_ID" \
  --timeout=3600s
echo "=== PRIVATE_BUILD_FINISHED ==="
echo "PRIVATE_BUCKET=gs://$BUCKET/private-admin/$RUN_ID/"
gcloud storage ls -r "gs://$BUCKET/private-admin/$RUN_ID/**" || true
echo "=== NO_PRODUCTION_APPS_MODIFIED ==="
