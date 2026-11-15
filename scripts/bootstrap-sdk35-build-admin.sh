#!/usr/bin/env bash
# Blaise V6 RJ — isolated Android SDK 35 bootstrap + private admin build.
# No production deploy, no original repo mutation, no secret printing.
set -euo pipefail
ROOT="$HOME/Blaise-RJ"
BR="safety/rj-agent13-firestore-failclosed-20261115"
SAFE="$HOME/blaise-rj-safety"
mkdir -p "$SAFE"
[ -d "$ROOT/.git" ] || { echo "BLAISE_REPOSITORY_NOT_FOUND"; exit 1; }
command -v java >/dev/null || { echo "JAVA_NOT_FOUND"; exit 1; }
command -v unzip >/dev/null || { echo "UNZIP_NOT_FOUND"; exit 1; }
command -v curl >/dev/null || { echo "CURL_NOT_FOUND"; exit 1; }
java -version
echo "=== VERIFICANDO SDK EXISTENTE ==="
SDK=""
for CANDIDATE in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk" "$HOME/android-sdk" "/opt/android-sdk" "/usr/local/lib/android/sdk" "$SAFE/android-sdk"; do
  if [ -n "$CANDIDATE" ] && [ -d "$CANDIDATE/platforms/android-35" ] && [ -d "$CANDIDATE/build-tools/35.0.0" ]; then
    SDK="$CANDIDATE"
    break
  fi
done
if [ -z "$SDK" ]; then
  SDK="$SAFE/android-sdk"
  mkdir -p "$SDK/cmdline-tools"
  AVAILABLE_MB=$(df -Pm "$HOME" | awk 'NR==2{print $4}')
  echo "ESPACO_DISPONIVEL_MB=$AVAILABLE_MB"
  if [ "$AVAILABLE_MB" -lt 2600 ]; then
    echo "ESPACO_INSUFICIENTE_PARA_SDK_E_COMPILACAO"
    echo "Nenhum arquivo existente foi excluido."
    exit 1
  fi
  if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo "=== BAIXANDO FERRAMENTAS ANDROID OFICIAIS ==="
    ZIP="$SAFE/commandlinetools-linux-15859902_latest.zip"
    curl -fL --retry 3 --connect-timeout 20 \
      "https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip" \
      -o "$ZIP"
    printf '%s  %s\n' '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583' "$ZIP" | sha256sum --check --status || {
      echo "SHA256_INVALIDO - INSTALACAO INTERROMPIDA"
      exit 1
    }
    STAGING=$(mktemp -d "$SAFE/sdk-unpack-XXXXXXXX")
    unzip -q "$ZIP" -d "$STAGING"
    [ -x "$STAGING/cmdline-tools/bin/sdkmanager" ] || {
      echo "SDKMANAGER_NAO_ENCONTRADO"; exit 1
    }
    if [ -e "$SDK/cmdline-tools/latest" ]; then
      echo "SDK_TOOLS_PARTIAL_FOUND - NAO SOBRESCRITO"
      exit 1
    fi
    mv "$STAGING/cmdline-tools" "$SDK/cmdline-tools/latest"
    rmdir "$STAGING"
  fi
  echo "=== LICENCAS DO ANDROID SDK ==="
  echo "Leia e aceite manualmente as licencas se concordar."
  "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --licenses
  echo "=== INSTALANDO PLATFORM 35 E BUILD TOOLS 35 ==="
  "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" \
    "platforms;android-35" "build-tools;35.0.0" "platform-tools"
fi
[ -d "$SDK/platforms/android-35" ] && [ -x "$SDK/build-tools/35.0.0/apksigner" ] || {
  echo "SDK35_NAO_INSTALADO_COMPLETAMENTE"; exit 1
}
export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"
echo "ANDROID_SDK_35_VALIDADO"
echo "=== PREPARANDO WORKTREE ISOLADA ==="
cd "$ROOT"
git fetch origin "refs/heads/$BR"
DIR=$(mktemp -d "$SAFE/admin-build-XXXXXXXX")
git worktree add --detach "$DIR/worktree" FETCH_HEAD
cd "$DIR/worktree"
echo "=== COMPILACAO PRIVADA ADMINISTRADOR ==="
bash scripts/build-admin-private-apk.sh
APK="$PWD/app/build/outputs/apk/admin/app-admin.apk"
[ -s "$APK" ] || { echo "ADMIN_APK_NAO_GERADO"; exit 1; }
mkdir -p "$SAFE/admin-apk"
if [ -e "$SAFE/admin-apk/blaise-v6-rj-admin.apk" ]; then
  echo "ARQUIVO_ADMIN_JA_EXISTE - NAO SOBRESCRITO"; exit 1
fi
cp "$APK" "$SAFE/admin-apk/blaise-v6-rj-admin.apk"
echo "=== APK ADMINISTRADOR GERADO E VERIFICADO ==="
sha256sum "$SAFE/admin-apk/blaise-v6-rj-admin.apk"
du -h "$SAFE/admin-apk/blaise-v6-rj-admin.apk"
echo "APK_ORIGEM=$SAFE/admin-apk/blaise-v6-rj-admin.apk"
