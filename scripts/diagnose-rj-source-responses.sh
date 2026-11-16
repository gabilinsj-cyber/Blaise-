#!/usr/bin/env bash
# Read-only operational diagnosis: official INMET and Alerta Rio endpoints.
# No OpenWeather request, no credentials, no backend deployment or Cloud Build.
set -uo pipefail
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
probe() {
  local name="$1" url="$2" accept="$3" output="$TMP/$1.body"
  printf '\n=== FONTE_%s ===\n' "$name"
  local response
  response=$(curl --silent --show-error --ipv4 --http1.1 \
    --connect-timeout 6 --max-time 22 --max-redirs 0 --max-filesize 4194304 \
    -H "Accept: $accept" -H 'Cache-Control: no-cache' \
    --output "$output" \
    --write-out 'HTTP:%{http_code} MIME:%{content_type} BYTES:%{size_download} REDIRECT:%{redirect_url}' \
    "$url" 2>"$TMP/$name.error")
  local rc=$?
  printf 'CURL_EXIT:%s %s\n' "$rc" "$response"
  if [ "$rc" -ne 0 ]; then
    echo 'REDE_OU_TLS_INDISPONIVEL'
    if [ -s "$TMP/$name.error" ]; then
      sed -E 's/(Authorization: |Bearer )[A-Za-z0-9_.-]+/\\1[REDACTED]/g' "$TMP/$name.error" | head -n 2
    fi
  fi
}
probe INMET 'https://apitempo.inmet.gov.br/estacoes/T' 'application/json'
probe ALERTA_RIO 'https://websempre.rio.rj.gov.br/estacoes/' 'text/html'
python3 - "$TMP/INMET.body" "$TMP/ALERTA_RIO.body" <<'PY'
import json, re, sys
from pathlib import Path

inmet_path, rio_path = map(Path, sys.argv[1:])
print('\n=== VALIDACAO_DE_CONTEUDO_SEM_DIVULGAR_MEDICOES ===')
if inmet_path.is_file():
    raw = inmet_path.read_bytes()
    try:
        stations = json.loads(raw)
        if not isinstance(stations, list):
            print('INMET_JSON_TIPO_INESPERADO')
        else:
            rows = [s for s in stations if isinstance(s, dict)]
            rj = [s for s in rows if s.get('SG_ESTADO') == 'RJ'
                  and s.get('SG_ENTIDADE') == 'INMET'
                  and s.get('CD_SITUACAO') == 'Operante']
            print('INMET_CATALOGO_JSON_VALIDO')
            print('INMET_ESTATISTICA_ESTACOES_RJ_OPERANTES:', len(rj))
            print('INMET_MEDICOES_ATUAIS_NAO_TESTADAS')
    except (ValueError, UnicodeError):
        print('INMET_CORPO_NAO_E_JSON_VALIDO')
else:
    print('INMET_SEM_CORPO')
if rio_path.is_file():
    html = rio_path.read_bytes().decode('utf-8', 'replace')
    markers = {
        'DADOS_METEOROL': 'Dados Meteorol' in html,
        'ORVALHO': 'P. de Orvalho' in html,
        'UMIDADE': 'Umi. do Ar' in html,
        'TABELA_HTML': bool(re.search(r'<table\\b', html, re.I)),
    }
    for key, present in markers.items():
        print('ALERTA_RIO_' + key + ':', 'SIM' if present else 'NAO')
    print('ALERTA_RIO_POSSIVEL_BLOQUEIO_OU_LOGIN:',
          'SIM' if any(x.lower() in html.lower() for x in
                       ('request rejected', 'access denied', 'captcha', 'accounts/login')) else 'NAO')
    print('ALERTA_RIO_TABELA_POTENCIALMENTE_COMPATIVEL:',
          'SIM' if all(markers.values()) else 'NAO')
    print('ALERTA_RIO_MEDICOES_ATUAIS_NAO_TESTADAS')
else:
    print('ALERTA_RIO_SEM_CORPO')
print('=== DIAGNOSTICO_OFICIAL_SOMENTE_LEITURA_CONCLUIDO ===')
PY
