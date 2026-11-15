#!/usr/bin/env bash
# Blaise RJ: only a separate Firestore test collection is written.
set -euo pipefail
PROJECT="blaise-v6-rj"
REGION="southamerica-east1"
JOB="blaise-agent13-firestore-check-20261115"
SCRIPT="$1"
[ -f "$SCRIPT" ] || { echo 'PROBE_SCRIPT_NOT_FOUND'; exit 1; }
SA_EXPECT="blaise-agent13-runtime@$PROJECT.iam.gserviceaccount.com"
JOB_JSON=$(gcloud run jobs describe "$JOB" --project="$PROJECT" --region="$REGION" --format=json)
SA_ACTUAL=$(printf '%s' "$JOB_JSON" | python3 -c '
import json,sys
j=json.load(sys.stdin)
found=[]
def walk(o):
  if isinstance(o,dict):
    if "serviceAccountName" in o: found.append(o["serviceAccountName"])
    for v in o.values(): walk(v)
  elif isinstance(o,list):
    for v in o: walk(v)
walk(j)
print(found[0] if len(found)==1 else "")
')
[ "$SA_ACTUAL" = "$SA_EXPECT" ] || { echo "WRONG_JOB_IDENTITY_OR_UNKNOWN"; exit 1; }
node --check "$SCRIPT"
PROBE_ID="agent13_q900_$(date -u +%Y%m%d%H%M%S)_$((1000+RANDOM%9000))"
BASE64=$(base64 -w0 "$SCRIPT")
ENV="PROBE_CODE=$BASE64,PROJECT_ID=$PROJECT,AG13_PROBE_ID=$PROBE_ID"
echo "ISOLATED_PROBE_ID=$PROBE_ID"
for spec in 'seed:1' 'race:2' 'verify:1'; do
  MODE=$(printf '%s' "$spec" | cut -d: -f1)
  TASKS=$(printf '%s' "$spec" | cut -d: -f2)
  echo "=== AGENT13_PROBE_$MODE ==="
  gcloud run jobs execute "$JOB" --project="$PROJECT" --region="$REGION" \
    --update-env-vars="$ENV,AG13_PROBE_MODE=$MODE" \
    --tasks="$TASKS" --task-timeout=120s --wait
  sleep 3
  gcloud logging read \
    "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"$JOB\" AND textPayload:\"AG13_Q900_$PROBE_ID\"" \
    --project="$PROJECT" --freshness=30m --limit=50 --format='value(textPayload)' || true
  if [ "$MODE" = 'verify' ]; then
    echo "=== CHECK LOG FOR VERIFY count=900 AND PASS_NO_OPENWEATHER_CALLED ==="
  fi
done
