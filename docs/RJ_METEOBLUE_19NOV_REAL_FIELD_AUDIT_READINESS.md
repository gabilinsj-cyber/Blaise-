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
