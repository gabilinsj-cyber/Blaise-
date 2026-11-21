# Blaise V6 RJ — preparação segura para corrigir a revisão Cloud Run (OpenWeather v2)

**Data:** 21/11/2026, evidência operacional capturada pela titular às 08h14–09h01 BRT. **Escopo:** apenas *preparar e validar* a configuração de uma futura revisão isolada. PR #173 segue em Draft. **NÃO realizar implantação, alteração de tráfego, mudança de segredo, reativação de versão nem consulta meteorológica nesta etapa.**

## Evidências reais do Cloud Shell

1. Cloud Run `blaise-v6-rj-backend`, projeto `blaise-v6-rj`, região `southamerica-east1`: revisões `00031-vep` **99%**, `00038-pin` **1%**; revisão histórica `00058-sos`, tag `validacao-rj`, **0%** de tráfego normal.
2. Checagem direta da revisão `00058-sos`: `/health` e `/readyz` retornaram **HTTP 500, text/html**; versões com tráfego responderam `/readyz` HTTP 200 e `/healthz` HTTP 404. A discrepância de `/healthz` nas revisões antigas é um problema separado.
3. Logs de sistema da revisão isolada incluem erros de recuperação de versão de segredo. O log HTTP 500, isoladamente, não identifica a causa; a correlação com a referência a versão DISABLED é forte, mas não prova que seja a única falha.
4. **Configuração imutável da revisão histórica** `00058-sos`: `BLAISE_OPENWEATHER_API_KEY` referencia `blaise-rj-openweather-api-key:1`; `BLAISE_REDEMET_API_KEY` referencia `blaise-rj-redemet-api-key:1`.
5. No Secret Manager, `blaise-rj-openweather-api-key` **v1 DISABLED**, **v2 ENABLED**; `blaise-rj-redemet-api-key` **v1 ENABLED**. Houve conferência de que a identidade de execução está identificada e tem **permissão IAM direta** de `roles/secretmanager.secretAccessor` no segredo OpenWeather, sem leitura de payload.
6. **Não verificados:** conteúdo e validade da chave OpenWeather v2 perante fornecedor, quota/plano, acesso efetivo do contêiner, imagem de código candidata, comportamento HTTP após reparo, ligação de Secret Manager em produção, entrega P0, autorização de coleta/publicação.

## Decisão sobre a correção

**Não é tecnicamente possível corrigir a configuração de segredo de uma revisão imutável in place.** Cloud Run cria uma **nova revisão** para configurações alteradas. A preparação propõe manter o nome da variável `BLAISE_OPENWEATHER_API_KEY` e apontar exclusivamente na **futura revisão candidata** para o segredo `blaise-rj-openweather-api-key` **versão 2 explícita**. `latest` não é permitido nesse plano; **v1 deve permanecer DISABLED**.

Preservar `BLAISE_REDEMET_API_KEY` ligado à v1 *somente se a revisão efetivamente necessitar da fonte e esse segredo continuar aprovado*, sem expor seu conteúdo. Nenhum segrego deve ser exibido, migrado ou alterado pelo plano de auditoria.

**Não clonar cegamente a revisão `00058-sos`:** além da versão de segredo inválida, conferir flags dos coletores, versão da imagem/digest, CPU, RAM, porta, IAM, concorrência, labels e limites de gastos antes de montar a candidata. Para a revisão de teste, exigir `BLAISE_OPENWEATHER_AGENT13_ENABLED=false`, `BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED=false`, `BLAISE_AGENT13_FIRESTORE_ENABLED=false`, `BLAISE_AGENT13_TEMPERATURE_CONTINGENCY_ENABLED=false`, `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED=false`, `BLAISE_MET_NORWAY_ENABLED=false`, `BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED=false` e `BLAISE_INMET_P0_PUBLISH_ENABLED=false` (ou suas ausências equivalentes). Sem polling nem rota pública nova. **Evidência nova (21/11, 09h11 BRT):** a revisão histórica tem `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED=true`; os outros três controles `BLAISE_MET_NORWAY_ENABLED`, `BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED` e `BLAISE_INMET_P0_PUBLISH_ENABLED` estão desligados ou ausentes. Esse estado é legítima evidência da configuração histórica e **não deve ser modificado nem impedirá a preparação do plano isolado**. O gate atualizado registra `historicalAutomaticWeatherCollectionOn` e `historicalActiveWeatherFlags` sem alterar o serviço e exige **oito overrides `false` explicitamente preparados** apenas para uma candidata futura. Nenhum override foi aplicado; `candidateConfigurationApplied=false`.

O fluxo manual já existente em `.github/workflows/cloudrun-candidate.yml` contém proteção **contra deploy direto no serviço `blaise-v6-rj-backend`**. **Não remover essa barreira** automaticamente. Uma implementação futura no serviço real requer desenho específico e autorização nova, com candidato 0%, tag, digest fixado, autenticação por identidade, pré-checagem de 99%/1%, validação do vínculo secret v2 e rollback sem impactar clientes. Nada disso é realizado aqui.

## Verificação que foi adicionada à PR #173

- `backend/src/rj-openweather-secret-v2-repair-plan.mjs`: função **pura**, fail-closed; confirma nomes exatos, ligação histórica v1, estado DISABLED v1, ENABLED v2, Redemet v1 habilitado, IAM direto/incondicional, cliente 99%/1%, tag de validação 0%, Agente 13/autorizações desligados. Registra coletores ativos **da revisão antiga sem tentar desligá-los** e prepara explicitamente as oito flags `false` para uma nova revisão futura. Falta de prova do segredo/tráfego/IAM → `REPAIR_PLAN_BLOCKED`; coletor habilitado **somente no histórico** não bloqueia o plano isolado.
- `backend/scripts/rj-openweather-secret-v2-repair-readonly.mjs`: sem argumento, saída `OFFLINE_NO_CLOUD_ACCESS`; com `--gcloud-readonly` executa **apenas** `projects describe`, `run revisions describe`, `run services describe`, `secrets versions list` (para OpenWeather e Redemet), `secrets get-iam-policy`. Não lê payload, não chama fornecedor, não faz alterações. Exibe somente booleanos, estados e códigos, sem identidades ou URLs.
- `backend/test/rj-openweather-secret-v2-repair-plan.test.mjs`: casos sintéticos positivos e negativos para IAM, flags, versões, serviço/identidade, tráfego e isolamento. CI em `.github/workflows/rj-meteorological-production-readiness.yml`.

### Leitura autenticada de produção pelo Cloud Shell, SEM alterar recursos

Use uma worktree **nova**, distinta de `~/Blaise-RJ` e do histórico meteoblue. Não sobrescrever/excluir nenhum arquivo original:

```bash
set +x
cd ~/Blaise-RJ
git fetch --no-tags origin feature/rj-meteoblue-full-recovery-admin-ui-20261118
if [ -e "$HOME/blaise-rj-ow-v2-repair-20261121" ]; then
  echo "PASTA_JA_EXISTE_NAO_SOBRESCREVER"
else
  git worktree add --detach "$HOME/blaise-rj-ow-v2-repair-20261121" FETCH_HEAD
fi
cd "$HOME/blaise-rj-ow-v2-repair-20261121/backend"
nvm use 24 || nvm install 24
node --test test/rj-openweather-secret-v2-repair-plan.test.mjs
node scripts/rj-openweather-secret-v2-repair-readonly.mjs --gcloud-readonly
```

**Se a pasta já existia, não presumir que contenha o último commit:** conferir `git rev-parse HEAD` e `git status --short` antes de qualquer atualização. Nunca usar `reset --hard` nem `clean -fd`.

Output `RJ_OPENWEATHER_V2_REPAIR_READONLY`: `REPAIR_PLAN_ELIGIBLE_NOT_DEPLOYED` indica APENAS que o plano passou nos controles e nenhuma alteração foi feita; `REPAIR_PLAN_BLOCKED` identifica o(s) item(ns) faltante(s). **Não é um GO para implantar**, pois segue `vendorKeyValid=NOT_VERIFIED`, `effectiveSecretAccess=NOT_VERIFIED`, `endpointHealthAfterRepair=NOT_TESTED`, `productionReleaseApproved=false`.

## Critérios para futura candidata de 0%

Somente após autorização separada de implantação: preparar imagem pinada a digest com **código aprovado**, instanciar nova revisão com `--no-traffic` e tag exclusiva; confirmar sem alteração dos percentuais **99/1**, permissão IAM e revisão secreta **2**; então validar `/health` e `/readyz` autenticados, sem chamar OpenWeather. Caso retorne 500, rever origem de outras dependências e logs de inicialização. Somente após homologação dos demais 5 critérios se cogita uma promoção canário com rollback.

## Fontes públicas oficiais

- Cloud Run: https://docs.cloud.google.com/run/docs/configuring/services/secrets — variável secreta recuperada na inicialização, fixar versão explícita; falha em recuperação impede iniciar instância.
- Cloud Run: https://docs.cloud.google.com/run/docs/configuring/services/environment-variables — alterar a configuração cria nova revisão.

**Estado:** PREPARAÇÃO PRIVADA. PR Draft, sem merge, sem deploy, sem alteração em 99%/1%, sem nova chamada ou despesa meteorológica.
