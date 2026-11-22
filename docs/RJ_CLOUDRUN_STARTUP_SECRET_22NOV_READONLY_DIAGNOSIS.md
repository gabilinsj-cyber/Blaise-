# Blaise V6 RJ — retomada de 22/11/2026, diagnóstico não invasivo dos HTTP 500

**Projeto:** `blaise-v6-rj` · **Serviço:** `blaise-v6-rj-backend` · **PR:** #173 Draft · **Revisão histórica:** `00058-sos`

## Evidências reais herdadas, sem repetir consultas meteorológicas

A revisão `blaise-v6-rj-backend-00058-sos` registrou três HTTP 500 às **2026-11-21 11:14:06, 11:26:07, 11:26:08 UTC** (08h14/08h26 BRT), com latência textual `0s`. Os três request logs foram categorizados como `POSSIVEL_FALHA_INICIALIZACAO` com base em `could not start` ou `failed to start`; as mensagens completas não foram divulgadas. No intervalo 11h10–11h32 UTC, o Cloud Run apresentou 18 eventos de sistema, nove de início de instância e nove não classificados, sem logs `stdout/stderr` retornados. Isso não comprova a causa dos HTTP 500, múltiplas instâncias simultâneas, intrusão nem defeito do parser meteorológico.

O vínculo histórico lido anteriormente indicou **OpenWeather Secret Manager v1 = DISABLED** e **template atual OpenWeather v2 = ENABLED**, com Redemet v1 habilitada e permissão direta `roles/secretmanager.secretAccessor` observada para a identidade runtime. A revisão histórica tem tag `validacao-rj`, mínimo 1, modo instance-based e 0% de tráfego normal; serviço com ingresso `all` e invocação `allUsers`. Em 21/11 às 10h31 o tráfego continuava **99% na `00031-vep` e 1% na `00038-pin`**, sem candidata `owv2-211126`.

## Fato técnico oficial e hipótese

Segundo a documentação do Cloud Run, secrets em **variáveis de ambiente** são recuperados **antes da inicialização do contêiner**; se a recuperação falha, a instância não inicia. Consequentemente, uma referência fixa a **v1 DISABLED** é incompatível com uma nova inicialização que precise obter essa versão. Este é um bloqueador de startup **plausível e verificável por metadados**, mas não é prova causal dos três HTTP 500 sem confirmar o erro real de resolução de segredo nos eventos correspondentes. Outros segredos, IAM efetiva, imagem do contêiner, porta, política de ingresso e falhas da plataforma permanecem hipóteses a investigar.

- https://docs.cloud.google.com/run/docs/configuring/services/secrets
- https://docs.cloud.google.com/run/docs/troubleshooting
- https://docs.cloud.google.com/run/docs/logging

## Código preparado em 22/11

- `backend/src/rj-openweather-startup-secret-cause-audit.mjs`: redutor puro, sem acesso externo. Confronta bindings de variáveis OpenWeather/Redemet, estado de metadados das versões, serviço e revisão, IAM direta (sem alegar teste de IAM herdada), tráfego 99/1 e indicadores textuais do request log. O resultado mantém `causeOfThreeHttp500=NOT_CONCLUSIVELY_PROVEN` mesmo que v1 esteja desabilitada. O redutor **nunca revela** mensagens do log, URLs, conta de serviço ou payloads.
- `backend/scripts/rj-openweather-startup-secret-cause-readonly.mjs`: sem flags retorna `OFFLINE_NO_CLOUD_ACCESS`. Somente com `--cloud-readonly` usa `gcloud projects describe`, `run revisions/services describe`, `secrets versions describe` (metadados, nunca **access**), `secrets get-iam-policy` e `logging read` para os três HTTP 500 já gravados. Saída sintética única `RJ_OPENWEATHER_STARTUP_CAUSE_READONLY=...` sem segredos, URL, IP, identidade da SA ou texto bruto de logs.
- `backend/test/rj-openweather-startup-secret-cause-audit.test.mjs`: dez testes offline cobrindo v1 desabilitada, v2 habilitada, incerteza causal, IAM não comprovada, versões ausentes, bindings repetidos, segurança da saída, ausência de deploy e não consumo de créditos meteorológicos.
- `.github/workflows/rj-meteorological-production-readiness.yml`: novos testes e verificações de sintaxe incluídos no CI sem credenciais.

**CI auditado:** [run #45018015887](https://github.com/gabilinsj-cyber/Blaise-/actions/runs/45018015887), **62 testes, 62 aprovados, zero falhas**, executados offline. Nenhum script foi usado para modificar Google Cloud ou consultar fornecedor meteorológico.

## Próxima verificação da titular no Cloud Shell (apenas leitura)

Para preservar `~/Blaise-RJ` e os outros worktrees, buscar somente o commit da branch e criar um diretório de auditoria inédito:

```bash
set +x
(
  set -e
  cd ~/Blaise-RJ
  git fetch --no-tags origin feature/rj-meteoblue-full-recovery-admin-ui-20261118
  DEST="$HOME/blaise-rj-startup-audit-20261122"
  if [ -e "$DEST" ]; then
    echo "AUDITORIA_PASTA_EXISTENTE_NAO_SOBRESCREVER"
    exit 2
  fi
  git worktree add --detach "$DEST" FETCH_HEAD
  cd "$DEST/backend"
  nvm use 24 || nvm install 24
  node scripts/rj-openweather-startup-secret-cause-readonly.mjs --cloud-readonly
)
```

Compartilhar apenas as propriedades agregadas da saída, principalmente `historicalBindingVersion`, `historicalSecretVersion1State`, `currentTemplateBindingVersion`, `currentSecretVersion2State`, `historicalSecretDirectIam`, `historicalStartupErrorPhraseCount`, `likelyStartupBlocker` e `causeOfThreeHttp500`. **Não executar `secrets versions access`, `run deploy`, `services update-traffic` ou `--execute-approved-zero-traffic`.**

## Estado de aprovação

**SEM HOMOLOGAÇÃO EM PRODUÇÃO.** A PR #173 permanece Draft, sem merge. Não criar revisão, não reativar v1, não trocar chaves, não atualizar minScale/tag/IAM, não chamar Weather APIs. Preservar 92 municípios, interface original, agentes, backups, APK e 99%/1% do tráfego existente. Quaisquer correções de runtime devem ocorrer primeiro apenas no código revisado em PR e testes locais, com implantação exclusivamente após autorização separada.

## Evidência adicional do Cloud Shell — 22/11/2026, 09h05 BRT

A titular executou uma consulta **somente leitura** de Cloud Logging na revisão histórica `blaise-v6-rj-backend-00058-sos`, janela `2026-11-21T11:10:00Z`–`11:32:00Z`. O filtro excluiu request logs, buscando as expressões `secret` e `disabled` na combinação de campos textuais/JSON/Proto. **Nove** registros retornaram indicadores `openweather=True`, `versao_1=True`, `erro_inicio=False` (este último testa somente as frases literais `failed to start` e `could not start`).

Carimbos UTC retornados: `11:10:52`, `11:12:42`, `11:15:17`, `11:18:25`, `11:21:44`, `11:22:16`, `11:24:43`, `11:28:05`, `11:31:34` (todos em 21/11/2026). Os três HTTP 500 conhecidos ocorreram em `11:14:06`, `11:26:07` e `11:26:08` UTC. **Há sobreposição de janela, não associação direta evento a evento.** A contagem de nove não comprova nove tentativas de startup nem o número de instâncias.

Diagnóstico atualizado: a indisponibilidade da versão 1 do segredo OpenWeather na revisão histórica continua sendo uma **causa plausível e forte de impedimento a novos starts**, mas `causeOfThreeHttp500=NOT_CONCLUSIVELY_PROVEN`. O código de saída não encontrou frases de falha de inicialização por correspondência textual; isso **não exclui** falhas de startup. Para a próxima consulta, limitar a saída a metadados `timestamp`, `severity`, tipo de log e código de status estruturado, **sem imprimir** `textPayload`, `jsonPayload`, `protoPayload` completos, conteúdo do segredo ou identidade da conta. Não reativar v1, não alterar IAM, não fazer deploy, merge, restart, rotação automática, teste HTTP real ou mudança do tráfego 99%/1%. Nenhuma chamada meteorológica foi realizada.


## Evidência de severidade — 22/11/2026, 09h08 BRT

Nova captura da consulta `gcloud logging read` **somente leitura** confirmou nove registros na janela histórica associada à revisão `00058-sos`, todos com `severity=WARNING`, fonte classificada como **sistema** e `protoPayload.status.code` **ausente** (`NAO_INFORMADO`). Os mesmos nove eventos foram filtrados por `secret`, `disabled` e `openweather`. Esta ausência de código estruturado **não prova ausência de erro**, nem `WARNING` implica sucesso de inicialização. Os timestamps permanecem os nove já documentados.

A orientação oficial do Cloud Run confirma que uma referência de Secret Manager montada como **variável de ambiente** é lida na inicialização; se a leitura falhar, a instância não inicia (https://docs.cloud.google.com/run/docs/configuring/services/secrets). A incompatibilidade v1 desabilitada é um **bloqueio plausível de novos starts**. Porém, os **três HTTP 500 ainda não possuem vínculo causal comprovado** com esses nove warnings: manter `causeOfThreeHttp500=NOT_CONCLUSIVELY_PROVEN`.

**Próxima investigação permitida:** correlacionar eventos por campos estruturados como `trace`, `labels`, `timestamp` e `severity`; imprimir somente contagens e indicadores booleanos, nunca payload dos logs, identidades, segredo ou URLs. Não reativar v1, alterar tráfego 99%/1%, fazer deploy, merger ou chamadas meteorológicas.


## Correlação temporal dos três HTTP 500 — 22/11/2026, 09h10 BRT

Captura da titular do Cloud Shell, análise **somente leitura** da revisão histórica `blaise-v6-rj-backend-00058-sos` e intervalo `2026-11-21T11:10:00Z`–`11:32:00Z`, contendo **3 HTTP 500** e **9 avisos de sistema (WARNING)**. Correlação calculada por `trace` e janela **simétrica de 120 segundos**, sem imprimir conteúdo, IDs ou URL:

| Requisição | UTC | Avisos ±120 segundos | trace compartilhado |
| --- | --- | ---: | --- |
| 1 | 2026-11-21T11:14:06 | 2 | false |
| 2 | 2026-11-21T11:26:07 | 2 | false |
| 3 | 2026-11-21T11:26:08 | 2 | false |

A contagem de proximidade não indica se os avisos ocorreram **antes ou depois** da falha. As requisições 2 e 3 distam apenas um segundo e podem referir-se aos mesmos avisos. `trace=false` significa apenas que não foi comprovado um identificador comum (pode estar ausente); não exclui causalidade. **Não** somar os avisos próximos e concluir que ocorreram seis eventos independentes. O marcador continua `causeOfThreeHttp500=NOT_CONCLUSIVELY_PROVEN` e `likelyStartupBlocker=DISABLED_ENV_SECRET_V1` é uma hipótese baseada em metadados, não um resultado causal confirmado.

Próximo estudo permitido: correlacionar apenas avisos **anteriores** à respectiva requisição (0–120 segundos antes), e presença de `labels.instanceId` compartilhado, retornando só contagens/booleanos. Não revelar identificadores, corpo dos logs, IP, endpoint ou segredo. Não fazer deploy, alterar IAM, segredos, tag, minScale, tráfego 99%/1%, ou consultar APIs meteorológicas.

## Fechamento da correlação de instâncias — 22/11/2026, 09h12 BRT

Resultado de captura da titular após comando Cloud Shell **somente leitura** que correlacionou os três HTTP 500 da revisão `00058-sos` aos `WARNING` anteriores por janela de 120 segundos, sem exibir IDs:

| HTTP 500 | Warnings anteriores <=120s | Identificador de instância no request | Mesma instância comprovada |
| --- | ---: | --- | --- |
| 1 (2026-11-21T11:14:06Z) | 1 | false | false |
| 2 (2026-11-21T11:26:07Z) | 1 | false | false |
| 3 (2026-11-21T11:26:08Z) | 1 | false | false |

Os dois últimos requests podem referir-se ao **mesmo aviso anterior**. `mesma_instancia=false` resulta da **ausência de ID no request** e significa `NÃO VERIFICADO`, não instâncias diferentes. Nenhuma linha vincula diretamente um WARNING à falha HTTP correspondente por trace/instance. O histórico sustenta um **bloqueador técnico conhecido para novos starts**: a revisão antiga referencia OpenWeather Secret Manager **v1 DISABLED**, enquanto a configuração atual já referencia **v2 ENABLED**. Isso **não demonstra a causa exata dos três HTTP 500**.

**Decisão após o diagnóstico:** encerrar consultas repetitivas de correlação dos mesmos logs. Não atribuir certeza causal, nem reativar v1. O procedimento para corrigir a referência deve usar somente um plano **offline e fail-closed** para **futura revisão isolada com v2**, e não deve sobrescrever o template já v2 do serviço ativo. Os módulos preexistentes `rj-openweather-secret-v2-repair-plan.mjs`, `rj-openweather-zero-min-candidate.mjs` e `rj-openweather-v2-zero-traffic-candidate.mjs` já apresentam o plano e impedem o deploy real; **não mudar essas travas nem executar `--execute-approved-zero-traffic`**. Checagens exigidas antes de autorização separada de futura implantação: verificar estado e vínculo v2, integridade de Redemet, IAM efetiva em runtime, impacto no template/escala/custos, identidade, imagem/digest, ausência de coletores ativos, CI/Android e preservação comprovada de tráfego 99%/1%. A candidata não está autorizada nesta etapa.

**Estado:** `causeOfThreeHttp500=NOT_CONCLUSIVELY_PROVEN`, `newRevisionCreated=false`, `mergePerformed=false`, `trafficChanged=false`, `meteorologicalAPICalls=0`. Valores 99%/1% são a última evidência de leitura anterior; não houve nova mudança promovida por este diagnóstico. Nenhum dado pessoal ou conteúdo de segredo foi adicionado ao repositório.

## Prova local dos testes de reparo — 22/11/2026, 09h14 BRT

Captura do Cloud Shell da titular na worktree isolada `~/blaise-rj-startup-audit-20261122/backend`: execução somente offline dos três arquivos `rj-openweather-secret-v2-repair-plan.test.mjs`, `rj-openweather-zero-min-candidate.test.mjs` e `rj-openweather-startup-secret-cause-audit.test.mjs`. O resumo TAP na captura mostra **31 testes, 31 aprovados, 0 falhas, 0 ignorados e 0 cancelados**, sem execução de qualquer comando `gcloud run deploy` ou leitura de payload de segredo. Testes de plano simulado não comprovam inicialização real da revisão nem a causa dos três HTTP 500.

A PR #173 continua Draft. O pré-voo separado `node scripts/rj-openweather-v2-zero-traffic-candidate.mjs --preflight-only` consulta **somente metadados** de Cloud Run e Secret Manager, se executado em um diretório existente com o código atual; ele não cria revisão. Se a saída indicar divergência, bloquear e não tentar `--execute-approved-zero-traffic`. Nunca reativar OpenWeather v1 ou mudar template, minScale, tag, IAM, tráfego ou plano pago sem autorização separada.

## Preflight repetido no Cloud Shell — 22/11/2026, 09h18 BRT

A titular executou, na worktree isolada `~/blaise-rj-startup-audit-20261122/backend`, `node scripts/rj-openweather-v2-zero-traffic-candidate.mjs --preflight-only`. A captura mostra resultado `PREFLIGHT_PASS_CANDIDATE_NOT_CREATED`, com `clientTraffic=99_1`, `secretVersionRequested=2`, `candidateWeatherFlagsOff=8`, `imageDigestPinned=true`, `tagCreated=false`, `priorHistoricalRevisionMinInstances=1`, `priorTemplateMinInstances=1`, `proposedCandidateMinInstances=0`, `candidateZeroMinFlagPresent=true`, `serviceMinNotModifiedByProposedCommand=true`, `startupHealthCheckSkippedInPlan=true`, `simulatedPlanOnly=true`, `existingServiceLevelMinInstances=NOT_SET`, `providerKeyValid=NOT_VERIFIED`, `actualRuntimeSecretAccess=NOT_VERIFIED`, `deploymentPerformed=false`, `productionTrafficChanged=false` e `releaseAuthorized=false`.

**Limites:** evidência de elegibilidade do **plano de candidata**, não de disponibilidade/saúde HTTP, uso autorizado do segredo em runtime, custo zero, integração de fornecedor ou release. O executor de deploy foi removido e o uso de `--execute-approved-zero-traffic` continua bloqueado. A revisão candidata não foi criada; a PR continua Draft. Não executar implantação, alterar tráfego, escala, IAM/segredos ou chamar API meteorológica. Documentos prévios de custo e segurança continuam válidos, inclusive possibilidade de custo na revisão histórica com tag, minScale=1 e billing instance-based.

A próxima ação de baixo risco é **validar prontidão meteorológica offline** com `node scripts/rj-meteorological-production-readiness.mjs --assert-private` na worktree já existente. Esse teste não entra na nuvem e deve continuar mostrando `meteorologicalProductionHomologated=false`, `noProviderNetworkCalls=true` e `noDeployment=true`; não o usar como autorização de produção.
