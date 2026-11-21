# Blaise V6 RJ — 19/11/2026: sete campos reais da meteoblue sem exceder créditos

## Confirmação posterior — 19/11/2026 às 09h42 BRT, captura Cloud Shell da titular

O teste real e único `node scripts/meteoblue-free-private-field-audit.mjs --live --one-credit --private-staging` foi executado pela titular após criar a versão 3 do Secret Manager, confirmar formato por regex e limitar a chave da meteoblue a 4.000 créditos/dia. O roteiro anterior acima permanece como histórico **pré-teste**, não orientação para repetir a chamada.

**Saída observada na captura (sem segredo, sem valores brutos):**
- `status=PRIVATE_STAGING_FORECAST_READY`
- `runtimeState=READY_FOR_ADMIN_EXPLICIT_CALL`
- `providerContacted=true`, `reservedCreditsThisInvocation=4000` (reserva Firestore; não equivale, por si, a faturamento confirmado no painel do fornecedor)
- `modelRunVerified=true`, `unitMetadataVerified=true`, `sourceCoordinatesVerified=true`
- `sixHourForecastSlots=29`, `completeSevenFieldCoverage=true`, `privateAuditReady=true`, `auditBlockers=[]`
- `fieldCoverage`: **sete entradas `FORECAST_VALUES_PRESENT`**: `forecastPrecipitationSixHourMm`, `forecastConvectivePrecipitationSixHourMm`, `forecastPrecipitationProbabilitySixHourPct`, `forecastWindMeanSixHourKmh`, `forecastWindMaxSixHourKmh`, `forecastHumidityMeanSixHourPct`, `forecastSeaLevelPressureMeanSixHourHpa`.
- `observedData=false`, `paidApiUsed=false`, `publishedToSubscribers=false`.

**Conclusão correta:** houve **uma resposta do fornecedor com valores numéricos de previsão P para os sete campos**, cuja estrutura, unidades, cronologia do modelo e correspondência geográfica passaram no parser privado. Os números concretos e os 29 timestamps não são impressos pelo script; portanto **não** declarar médias/limites/valores meteorológicos exatos, **não** confundir modelo com observação e **não** publicar nos cards do cliente. A **homologação científica/comercial para produção segue pendente**.

**Créditos:** uma reserva local de 4.000 foi efetuada nessa execução. O teto externo é 4.000 por dia UTC, salvo na conta. **Não repetir chamadas reais em 19/11 UTC**, inclusive após falha ou reinicialização. Conferir somente o ledger Firestore e o painel do fornecedor separadamente, porque a reserva local não mede o saldo real. A chave original já apareceu em capturas, e a criação da versão 3 do segredo **não substitui a chave da conta** nem repara sua exposição.

**Segurança e continuidade:** PR #173 continua DRAFT, sem merge/deploy, sem trânsito de clientes e sem conta paga; produção não foi tocada. A versão 3 de `blaise-meteoblue-free-api-key` foi indicada como ativada no Secret Manager; versões 1 e 2 aparecem desativadas — revisar referências a versões explícitas em revisões Cloud Run, somente leitura. Não registrar o valor da credencial, resposta JSON completa ou URL com `apikey` no GitHub.

**Próximo ato sem créditos:** ler somente a cópia do pacote no cache privado Firestore, ainda dentro de seu TTL de seis horas, para inspecionar valores e tempos de previsão por campo em ambiente ADM, mediante script seguro e sem requests à meteoblue. Se estiver expirado, marcar indisponível e **não** chamar novamente hoje.

---


**Situação verificada em 19/11/2026, horário de Brasília.** PR #173 continua DRAFT; não implantada e sem mudança no aplicativo em produção. Nenhuma consulta real foi feita por esta revisão. Usuária autorizou a **auditoria única controlada**, mantendo a chave existente do plano Free.

## Evidências disponíveis / ausentes

- Dia UTC atual já é **2026-11-19**, diferente da consulta histórica do painel (uma chamada `basic-6h` / 4.000 créditos no intervalo 03–18/11).
- Limite externo **4.000 créditos/dia salvo pela titular**; não há inspeção autenticada desse valor pela integração. A documentação do fornecedor informa que a chave deixa de retornar dados após atingir o teto diário: https://docs.meteoblue.com/en/weather-apis/accounting-api/weather-api-manager
- Firestore compartilhado antes da chamada deve registrar as reservas do coletor, **máximo 1/dia UTC** e 8M no projeto; a medição antiga de 4k foi feita FORA do ledger.
- Nenhum arquivo com payload JSON REAL meteoblue `basic-6h` foi localizado na biblioteca da conversa. Há arquivos JSON de **NOAA GFS**, que não podem ser rebatizados como meteoblue.
- Correção do CI Android: teste de texto `AdminCollectorReadinessTest.kt` buscava a expressão antiga “sete campos numéricos”, enquanto o texto atual diz “sete campos reais”. Ajustado; a próxima compilação precisa aprovar o commit atual.
- Código de auditoria atual `backend/scripts/meteoblue-free-private-field-audit.mjs` retorna cobertura dos sete campos, validade de emissão, metadados, unidades, coordenadas e status, **sem publicar valores brutos, chave ou URL assinada**. A nova proteção bloqueia o teste ao vivo antes do dia UTC 19/11 ou quando não houver confirmação positiva de **0 créditos usados no próprio dia UTC** (`BLAISE_METEOBLUE_PROVIDER_ZERO_USAGE_TODAY_CONFIRMED=true`).
- Novo script `backend/scripts/meteoblue-free-validate-saved-json.mjs` lê apenas arquivo JSON salvo pelo operador (sem rede, segredo ou créditos) e verifica, por município Rio IBGE 3304557, a estrutura/validade temporal, sete campos e unidades; registros antigos podem falhar no gate de recência **e não serão tratados como previsão vigente**, mesmo que a estrutura esteja correta.
- Os **sete** são precipitação prevista 6h, chuva convectiva prevista 6h, probabilidade de precipitação, vento médio, vento máximo (não rajada observada), umidade relativa média e pressão ao nível do mar média. Todos **P**. Sem dados reais, ausência != zero, não preencher cliente.

## Procedimento sem destruir a versão original

Use Cloud Shell (não compartilhar valor de chave; não usar `set -x`), com pasta de revisão separada. Só executar a auditoria live após confirmar no painel meteoblue que **19/11 UTC tem 0 créditos utilizados**, auto top-up desligado e conta ainda Free.

```bash
# Fase A — somente código local / testes e Firestore (sem API meteoblue)
set +x
cd ~/Blaise-RJ
git fetch origin feature/rj-meteoblue-full-recovery-admin-ui-20261118
if [ ! -e ~/blaise-meteoblue-audit-20261119 ]; then
  git worktree add --detach ~/blaise-meteoblue-audit-20261119 FETCH_HEAD
fi
cd ~/blaise-meteoblue-audit-20261119/backend
node --version  # requer Node 24
npm ci --ignore-scripts --no-audit --no-fund
node --test test/rj-meteoblue-free-key-check.test.mjs test/rj-meteoblue-free-collector.test.mjs
node scripts/meteoblue-free-private-field-audit.mjs
node scripts/meteoblue-free-credit-status.mjs --read-firestore-budget
```

Se existir JSON real já salvo no Cloud Shell, pode verificar sem redes:
`node scripts/meteoblue-free-validate-saved-json.mjs /CAMINHO/PRIVADO/resposta-real.json`.
Não subir payload de API ou chave para GitHub público, chat, APK ou log.

### Fase B — uma chamada privada e voluntária; **4.000 créditos**

Confirme **0 créditos utilizados hoje no painel da chave** e não use este bloco se já houver uma chamada no dia UTC, se a chave puder ter sido usada por terceiro ou se os dados de Firestore não estiverem disponíveis. A própria chave foi exibida em captura: reduzir para 4.000/dia diminui dano potencial, mas não substitui rotação. Executar no mesmo diretório seguro após a fase A:

```bash
set +x
BLAISE_METEOBLUE_PROJECT_ID=blaise-v6-rj \
BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED=true \
BLAISE_METEOBLUE_AUTOTOPUP_DISABLED=true \
BLAISE_METEOBLUE_PAID_ALLOWED=false \
BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED=true \
BLAISE_METEOBLUE_FIRESTORE_ENABLED=true \
BLAISE_METEOBLUE_TEMPORARY_KEY_RISK_ACCEPTED=true \
BLAISE_METEOBLUE_STAGING_ONESHOT_APPROVED=true \
BLAISE_METEOBLUE_ALLOW_REAL_CREDIT_SPEND=true \
BLAISE_METEOBLUE_PROVIDER_ZERO_USAGE_TODAY_CONFIRMED=true \
BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE=false \
BLAISE_METEOBLUE_FREE_API_KEY="$(gcloud secrets versions access latest --secret=blaise-meteoblue-free-api-key --project=blaise-v6-rj)" \
node scripts/meteoblue-free-private-field-audit.mjs --live --one-credit --private-staging
```

O output seguro do comando `METEOBLUE_PRIVATE_FIELD_AUDIT={...}` deve indicar:
`providerContacted=true` (se de fato houve HTTP), `reservedCreditsThisInvocation=4000`, `modelRunVerified`, `unitMetadataVerified`, `sourceCoordinatesVerified`, `completeSevenFieldCoverage`, `fieldCoverage` (sete nomes), `auditBlockers`, `privateAuditReady`. Mesmo um resultado positivo **não é homologação científica automática nem publicação**.

**Não repetir a chamada após erro de HTTP, schema ou cache.** A reserva é mantida justamente porque o fornecedor pode cobrar mesmo com resposta falha. Reconsultar Firestore e estatísticas da chave em vez de tentar de novo. Nenhuma operação roda sozinha.

## Próxima etapa apenas depois da resposta real
- Investigar cada bloqueio sem gastar novos créditos; ajustar o parser com base no schema **real**, usando apenas amostra sanitizada, nunca segredo.
- Separar classificação de valores/uni dades, período do modelo, geografia e latência antes de conectar visualmente cards/mapas/gráficos.
- Sem planos pagos, sem `merge`, sem `deploy`, sem alterar a versão original ou fontes removidas.

## Resultado efetivamente obtido — 19/11/2026 09h42 BRT

Evidência: saída do Cloud Shell fornecida pela titular em captura, após consulta única por `backend/scripts/meteoblue-free-private-field-audit.mjs --live --one-credit --private-staging` na worktree separada `~/blaise-meteoblue-audit-20261119/backend` com Secret Manager versão 3 válida **quanto ao formato**. Não imprimir, subir ou armazenar o segredo em Git, resposta ou logs.

| Item reportado pelo script | Valor |
|---|---|
| `status` | `PRIVATE_STAGING_FORECAST_READY` |
| `runtimeState` | `READY_FOR_ADMIN_EXPLICIT_CALL` |
| `providerContacted` | `true` |
| `reservedCreditsThisInvocation` | **4.000** no Firestore |
| `modelRunVerified` | `true` |
| `unitMetadataVerified` | `true` |
| `sourceCoordinatesVerified` | `true` |
| `sixHourForecastSlots` | **29** |
| `completeSevenFieldCoverage` | `true` |
| `privateAuditReady` | `true` |
| `auditBlockers` | `[]` |
| `observedData` | `false` |
| `publishedToSubscribers` | `false` |

Todos os sete campos previstos constaram como `FORECAST_VALUES_PRESENT`: `forecastPrecipitationSixHourMm`, `forecastConvectivePrecipitationSixHourMm`, `forecastPrecipitationProbabilitySixHourPct`, `forecastWindMeanSixHourKmh`, `forecastWindMaxSixHourKmh`, `forecastHumidityMeanSixHourPct`, `forecastSeaLevelPressureMeanSixHourHpa`.

**Significado estrito:** uma resposta real do fornecedor para o ponto do Rio de Janeiro (IBGE 3304557) passou por validações estruturais, geográficas, temporais e de unidades. Os valores numéricos de cada período não foram impressos, inspecionados individualmente nem comparados com verificações meteorológicas externas. Isto **não** constitui homologação científica, leituras de estação, validação dos 92 municípios, autorização de publicação ou coleta automática. O saldo restante e eventual cobrança exata no fornecedor **ainda não foram reconferidos**; 4.000 é o valor da reserva local. O limite do fornecedor salvo pela titular é de 4.000 créditos por dia UTC.

**Próxima etapa sem cobrança:** `node scripts/meteoblue-free-credit-status.mjs --read-firestore-budget` e inspeção de estatísticas no painel da meteoblue, sem nova solicitação `basic-6h`. Até 20/11 UTC não tentar novamente. A chave foi exposta anteriormente, e a versão 3 é uma nova versão do *mesmo segredo*, não rotação da credencial no fornecedor. Manter PR #173 em draft, sem merge/deploy, sem atualizar tráfego ou APK cliente.


## Firestore após consulta — 19/11/2026 10h20 BRT

Evidência recebida em captura da titular: `node scripts/meteoblue-free-credit-status.mjs --read-firestore-budget` executado na worktree isolada. Resposta local do Firestore (`METEOBLUE_LOCAL_BUDGET`):

| Campo | Valor |
|---|---|
| `campaign` | `trial_2026_11_18` |
| `providerCreditBalance` | `UNVERIFIED_IN_PROVIDER_DASHBOARD` |
| `providerChargeAuthorized` | `false` |
| `sourceOfCounts` | `LOCAL_FIRESTORE_RESERVATIONS_ONLY` |
| `creditCostPerBasic6h` | 4.000 |
| `localSpentCredits` | **4.000** |
| `localCreditCeiling` | 8.000.000 |
| `localRemainingReservedAllowance` | **7.996.000** |
| `localCallsReserved` | **1** |
| `callsReservedToday` | **1** |
| `maxCallsPerUtcDay` | **1** |
| `freeExpiryUtc` | `2027-11-18T00:00:00.000Z` |

**Conclusão:** a única chamada real de 19/11 teve reserva atômica persistida no Firestore. O bloqueio de novas reservas no mesmo dia UTC está previsto pelo código e testes, sem necessidade de executar outra chamada. O orçamento interno restante **não equivale ao saldo real de créditos do fornecedor**. Verificar dashboard meteoblue para cobrança externa e consumo total; nenhuma nova consulta `basic-6h` hoje. Não alterar chave, produção, cliente nem PR draft por este registro.

## Continuidade — 21/11/2026: auditoria numérica histórica sem novas chamadas

A inspeção anterior `meteoblue-free-private-cache-inspect.mjs` **não** devolve previsão vencida: `getCached` bloqueia após TTL 6h. Como o ensaio real foi às **09h42 BRT de 19/11**, em 21/11 seus valores são **históricos, não atuais**. O documento Firestore pode continuar existindo porque a coleção privada desliga exclusão automática, porém sua existência **não foi verificada diretamente neste chat**.

O novo comando **somente leitura** consulta a versão histórica guardada (se ainda existir), sem depender de segredo ou token meteoblue, sem crédito e sem nova previsão:

```bash
set +x
cd ~/Blaise-RJ
git fetch origin feature/rj-meteoblue-full-recovery-admin-ui-20261118
# Pasta independente; nunca substituir a auditoria de 19/11 ou o repositório original.
if [ ! -e ~/blaise-meteoblue-historico-20261121 ]; then
  git worktree add --detach ~/blaise-meteoblue-historico-20261121 FETCH_HEAD
fi
cd ~/blaise-meteoblue-historico-20261121/backend
nvm use 24
npm ci --ignore-scripts --no-audit --no-fund
node --test test/rj-meteoblue-free-historical-audit.test.mjs
node scripts/meteoblue-free-private-history-inspect.mjs --read-historical-cache
node scripts/meteoblue-free-credit-status.mjs --read-firestore-budget
```

Resumo seguro no terminal: `METEOBLUE_HISTORICAL_NUMERIC_AUDIT` indica `HISTORICAL_FORECAST_AUDITED_NOT_CURRENT` com *count/missingCount/min/max/mean/median* de cada um dos sete campos, timestamp de armazenamento, primeiro e último período e marcadores de proveniência; sem chave, endpoints, localização de usuários ou dados crus completos. O resultado **não** homologará produção nem atualizará clientes. `NO_HISTORICAL_CACHE_DOCUMENT` significa que o documento já não existe e **não** autoriza recaptura. `HISTORICAL_RECORD_INVALID` ou `FIRESTORE_READ_UNAVAILABLE` devem ser diagnosticados sem modificar cache e sem nova chamada.

Como já houve uma solicitação real com a **chave exposta**, o ledger da campanha inclui **uma** reserva global e o código bloqueia novas sondagens com aquela credencial; não tentar contornar com outra variável ou chave. O saldo real do fornecedor só pode ser confirmado no próprio painel.

## Resultado histórico numérico — 21/11/2026 às 02h14 BRT

A captura da titular do Cloud Shell na worktree `~/blaise-meteoblue-historico-20261121/backend` mostra que o **documento histórico foi recuperado** e o relatório de sete séries foi calculado: `privateAuditReady=true`, **29 números em cada campo** (`missingCount=0`) e `rangeValidated=true`. Esses valores são **previsões passadas do modelo, não observações meteorológicas nem previsão atual**.

| Campo 6h histórico | Mínimo | Máximo | Média | Mediana |
|---|---:|---:|---:|---:|
| `forecastPrecipitationSixHourMm` | 0 mm | 10,2 mm | 1,597 mm | 0 mm |
| `forecastConvectivePrecipitationSixHourMm` | 0 mm | 10,2 mm | 1,597 mm | 0 mm |
| `forecastPrecipitationProbabilitySixHourPct` | 0% | 92% | 44,586% | 46% |
| `forecastWindMeanSixHourKmh` | 1,03 km/h | 12,25 km/h | 4,086 km/h | 3,79 km/h |
| `forecastWindMaxSixHourKmh` | 1,3 km/h | 16,58 km/h | 6,313 km/h | 6,28 km/h |
| `forecastHumidityMeanSixHourPct` | 64% | 100% | 93,414% | 98% |
| `forecastSeaLevelPressureMeanSixHourHpa` | 1006,52 hPa | 1012,21 hPa | 1009,556 hPa | 1009,4 hPa |

**Verificação científica pendente:** precipitação prevista total e convectiva têm exatamente o mesmo mínimo, máximo, média e mediana. Isso não demonstra que todos os 29 pares de valores são iguais. Foi acrescentada à rotina puramente histórica uma auditoria **por período alinhado**, `precipitationRelationship`, com pares comparados, coincidências, períodos úmidos e períodos nos quais o componente convectivo excede o total. Marcar `needsScientificReview` não é declarar falha do fornecedor, alerta ou anomalia meteorológica observada.

**Firestore na mesma captura:** `localSpentCredits=4000`, `localRemainingReservedAllowance=7996000`, `localCallsReserved=1`, `callsReservedToday=0`, `maxCallsPerUtcDay=1`, `providerCreditBalance=UNVERIFIED_IN_PROVIDER_DASHBOARD`. O zero hoje é apenas do ledger e **não** permite nova chamada com chave previamente exposta (`TEMPORARY_KEY_ONESHOT_SPENT`). O histórico real foi lido **sem novos créditos meteoblue**.

Próxima checagem, depois do CI, com a versão mais recente do leitor em worktree **separada**, mantendo a existente intocada. Ler apenas `precipitationRelationship` (não segredo, JSON bruto ou URL com chave). Continuar PR #173 em draft, sem publicar dados expirados, fazer deploy, merge, assinatura paga ou coleta adicional com a mesma credencial.

## Evidência de pares alinhados — 21/11/2026 às 02h19 BRT

A titular executou consulta SOMENTE DE LEITURA ao documento privado Firestore `blaise_rj_meteoblue_free_private_cache_v1/3304557`. O terminal devolveu literalmente as contagens (sem valores crus):

```text
RAIN_COMPARISON={"valid":29,"equal":29,"wet":14,"equalWet":14,"exceeds":0,"historicalOnly":true,"creditsUsed":0}
```

Interpretação rigorosa: **todos os 29 pares** `forecastPrecipitationSixHourMm` vs. `forecastConvectivePrecipitationSixHourMm` coincidem à tolerância **0,001 mm**; **14 pares** contêm chuva prevista e também coincidem; os 15 demais são secos na tolerância; em nenhum par o componente convectivo excede o total. Isso vai além da igualdade anterior apenas de mínimo, máximo, média e mediana: as **duas séries históricas coincidem período a período**. Não se sabe ainda se resulta da forma de geração do produto meteoblue ou de uma correspondência indevida do schema, sem revisar documentação do pacote e um payload sanitizado. Não presumir erro ou fraude do fornecedor, e **não** interpretar como chuva medida.

**Decisão de segurança:** marcar **REVISÃO CIENTÍFICA PENDENTE** para a independência semântica dos dois campos; não usar a componente convectiva para cálculo de risco/alerta, distinção de tipos de chuva ou publicação em aplicativo cliente. Todos os dados são históricos (P), com cache operacional vencido. O script do backend `rj-meteoblue-free-historical-audit.mjs` já produz `precipitationRelationship.needsScientificReview=true` nessa condição; seus testes offline foram aprovados, sem chamar o fornecedor. Não gastar outros 4.000 créditos para resolver uma dúvida que pode ser investigada com documentação e o cache existente.

**Créditos:** `creditsUsed=0` é apenas o relatório desta leitura histórica. Ledger continua com **uma reserva de 4.000**; não representa saldo confirmado na meteoblue. Chave original exposta e One-shot usada; nenhum replay live com esta credencial. PR #173 segue DRAFT; o cliente original e as configurações de produção não foram alterados.
