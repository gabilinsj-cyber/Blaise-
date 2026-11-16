#!/usr/bin/env bash
# Read-only status and artifact inspection of the existing private admin build.
# Does not start builds, alter IAM, deploy, download APKs, or access OpenWeather.
set -euo pipefail

PROJECT="blaise-v6-rj"
REGION="southamerica-east1"
SAFE="$HOME/blaise-rj-safety"
command -v gcloud >/dev/null || { echo "GCLOUD_NAO_ENCONTRADO"; exit 1; }
command -v python3 >/dev/null || { echo "PYTHON3_NAO_ENCONTRADO"; exit 1; }

LATEST=$(find "$SAFE" -maxdepth 1 -type f -name 'admin-build-*.id' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n 1 | cut -d' ' -f2- || true)
if [ -z "$LATEST" ]; then
  echo "IDENTIFICADOR_LOCAL_NAO_ENCONTRADO"
  echo "Ultimas execucoes; selecione a mais recente do administrador antes de prosseguir:"
  gcloud builds list --project="$PROJECT" --region="$REGION" --limit=6 \
    --format='table(id,status,createTime,finishTime)'
  exit 0
fi
BUILD_ID=$(tr -d '\r\n' < "$LATEST")
if ! printf '%s' "$BUILD_ID" | python3 -c 'import re,sys; raise SystemExit(0 if re.fullmatch("[0-9a-f-]{36}",sys.stdin.read()) else 1)'; then
  echo "BUILD_ID_LOCAL_INVALIDO"; exit 1
fi

echo "=== BUILD_ID ==="
echo "$BUILD_ID"
META=$(gcloud builds describe "$BUILD_ID" --project="$PROJECT" --region="$REGION" --format=json)
# Parse only status and the build-scoped destination; do not expose other substitutions.
FIELDS=$(printf '%s' "$META" | python3 -c '
import json,re,sys
d=json.load(sys.stdin)
status=d.get("status","UNKNOWN")
subs=d.get("substitutions") or {}
bucket=subs.get("_ADMIN_BUCKET","")
run=subs.get("_BUILD_RUN_ID","")
machine=(d.get("options") or {}).get("machineType","")
print(status)
print(bucket)
print(run)
print(machine)
')
STATUS=$(printf '%s\n' "$FIELDS" | sed -n '1p')
BUCKET=$(printf '%s\n' "$FIELDS" | sed -n '2p')
RUN_ID=$(printf '%s\n' "$FIELDS" | sed -n '3p')
MACHINE=$(printf '%s\n' "$FIELDS" | sed -n '4p')
echo "=== STATUS_DA_COMPILACAO: $STATUS ==="
echo "MAQUINA=$MACHINE"
case "$STATUS" in
  QUEUED|PENDING|WORKING) echo "COMPILACAO_EM_ANDAMENTO: nao iniciar outra"; exit 0 ;;
  SUCCESS) echo "COMPILACAO_CONCLUIDA";;
  *) echo "COMPILACAO_NAO_APROVADA: consultar os logs antes de repetir"; exit 0 ;;
esac

case "$BUCKET" in blaise-v6-rj-admin-private-*) ;; *) echo "DESTINO_BUCKET_INESPERADO"; exit 1 ;; esac
if ! printf '%s' "$RUN_ID" | python3 -c 'import re,sys; raise SystemExit(0 if re.fullmatch(r"[0-9]{8}T[0-9]{6}Z-[0-9]+",sys.stdin.read()) else 1)'; then
  echo "RUN_ID_INESPERADO"; exit 1
fi
APK="gs://$BUCKET/private-admin/$RUN_ID/app/build/outputs/apk/admin/app-admin.apk"
echo "=== CONSULTANDO_APK_PRIVADO ==="
DETAILS=$(gcloud storage objects describe "$APK" --format=json) || {
  echo "APK_NAO_ENCONTRADO_OU_ACESSO_NEGADO"; exit 1;
}
printf '%s' "$DETAILS" | python3 -c '
import json,sys
d=json.load(sys.stdin)
size=int(d.get("size",0))
if size<=0: raise SystemExit("APK_TAMANHO_INVALIDO")
print("APK_EXISTE_SIM")
print("APK_BYTES=",size,sep="")
print("APK_MiB=",round(size/1024**2,2),sep="")
print("APK_CRC32C=",d.get("crc32c_hash","indisponivel"),sep="")
'
echo "APK_ORIGEM_PRIVADA=$APK"
echo "A compilacao inclui apksigner verify antes de marcar SUCCESS."
echo "Confirme o hash SHA-256 do APK baixado antes de instalar."
echo "=== INSPECAO_SOMENTE_LEITURA_CONCLUIDA ==="
