# Blaise V6 RJ — correção do plano de candidata Cloud Run com 0% tráfego

**Autorização explícita da titular:** 21/11/2026, para uma única nova revisão de homologação com OpenWeather Secret Manager v2, sem alterar a distribuição 99%/1%, sem ativar coletores nem publicar alertas/dados. **Ação atual (após 10h06 BRT): corrigir o procedimento e testar OFFLINE, sem nova tentativa real de implantação.** A autorização anterior **não autoriza** rollout, merge de PR, atualização de APK, novas consultas meteorológicas, novos planos, alteração de chave ou mudança das mínimas das revisões anteriores.

## Resultado do preparatório

- Histórico `blaise-v6-rj-backend-00058-sos`: tag `validacao-rj`, 0% tráfego; `BLAISE_OPENWEATHER_API_KEY` referenciava versão **1 DISABLED** (muito provavelmente responsável pelos 500 HTML, mas não comprovadamente causa única).
- Secret OpenWeather: **v2 ENABLED**; Redemet: **v1 ENABLED**; IAM direta `secretAccessor` identificada (não garante validade do token no fornecedor).
- Segurança: 8 flags explícitas OFF propostas para futura candidata; funcionário histórico `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED` segue true na revisão antiga e nunca é alterado. Plano real de Cloud Shell `REPAIR_PLAN_ELIGIBLE_NOT_DEPLOYED` com blockers `[]`, verificado às 09h19 BRT.
- Dockerfile da branch: `USER node`, `EXPOSE 8080`, `CMD ["node","src/runtime.mjs"]`. Três revisões têm **digests diferentes**; a experiência de homologação deve pinçar o **digest da imagem histórica `00058-sos`**, para testar somente as mudanças de env/secret. Isso **não** testa a imagem da PR #173.
- Método oficial `gcloud run deploy --image ... --no-traffic --update-secrets ... --update-env-vars ...`. **Sem `--tag`**, pois a URL de tag pode ser acessível mesmo com 0% tráfego normal; nenhuma invocação HTTP à candidata ainda. Tags existentes permanecem intocadas.
- O workflow pré-existente `.github/workflows/cloudrun-candidate.yml` **continua bloqueando deploy no backend principal**; este script é uma autorização específica via Cloud Shell autenticado e com guardas de pré/pós verificação. Nunca acionar o workflow de promoção.

## Implementação pronta

- `backend/scripts/rj-openweather-v2-zero-traffic-candidate.mjs`: sem flags faz **preflight somente de leitura**. O parâmetro histórico `--execute-approved-zero-traffic` está **bloqueado** nesta etapa; executá-lo não cria uma revisão.
- Antes de criar: valida projeto, identidade, região, revisão histórica, estados OpenWeather v1/v2 e Redemet v1, IAM direta, distribuição **99% na 00031-vep e 1% na 00038-pin**, ausência de roteamento *latest*, imagem **@sha256 digest** verificável, 1 contêiner, porta 8080, CPU 1, RAM 512Mi, service account igual, flags propostas OFF e inexistência do sufixo de candidata. A configuração atual foi verificada como **última criada 00043-hjk** (estado *Retired*, não elegível como revisão de atendimento), **última pronta 00058-sos** (não funcional em HTTP), **template OpenWeather v2** e mínimos de **1** na revisão histórica e no template atual. O serviço deve continuar **sem mínimo global não-zero**. Mudança inesperada bloqueia sem deploy.
- Criação **somente em etapa posterior**: `gcloud run deploy blaise-v6-rj-backend` com `--no-traffic`, **sem tag**, **`--min-instances=0` (por revisão; NÃO `--min=0` que atua no serviço)**, `--no-deploy-health-check` para não iniciar instância apenas para smoke de implantação, sufixo fixo `owv2-211126`, digest imutável da revisão histórica, `--update-secrets=BLAISE_OPENWEATHER_API_KEY=blaise-rj-openweather-api-key:2` e oito overrides `false`. O **template do serviço** passará a refletir a configuração da candidata, inclusive minScale 0; **revisões existentes e tráfego devem permanecer intactos**. Não altera Redemet nem versão antiga, não executa `update-traffic` e não gera APK.
- Depois: confere existência da candidata, digest do contêiner, vínculo OpenWeather v2, Redemet v1, oito flags OFF, identidade, **minScale=0 na candidata e no novo template**, **minScale=1 preservado na antiga 00058-sos**, mínimo no nível do serviço inalterado e **exatamente a mesma distribuição 99%/1%**, sem tag nova. Se falhar, **não tenta correção/rollback automático**: reporta conflito. Não faz requisições HTTP ao serviço ou fornecedores.
- Aviso financeiro: criação de revisão pode ter efeitos de provisionamento e custos de infraestrutura conforme configuração da conta. O script não usa créditos meteorológicos diretamente; mesmo com switches OFF, **não constitui prova independente** de que uma imagem histórica não faça chamadas de rede incondicionais na inicialização.

## Testes do plano corrigido (não implantar nesta etapa)

**O comando antigo de implantação está revogado para a execução atual.** Ele foi bloqueado às 09h51 e não pode ser repetido. Para a tarefa atual, usar exclusivamente testes sintéticos no GitHub Actions e, quando desejar, o comando offline na worktree local **já atualizada para o último commit**:

```bash
set +x
node --check backend/scripts/rj-openweather-v2-zero-traffic-candidate.mjs
node --test backend/test/rj-openweather-v2-zero-traffic-candidate.test.mjs
```

Os testes usam um executável `gcloud` **falso** e confirmam: template atual OpenWeather v2, minScale anterior 1, argumento revision-level `--min-instances=0`, nenhuma opção `--min` de serviço, `--no-deploy-health-check`, 0% de tráfego, sem tag, preservação da minScale histórica, pós-checagem da minScale 0 da candidata e bloqueios negativos (drift de IAM, versões, tráfego, escala e saída incorreta). **Nenhum teste offline acessa Google Cloud, lê segredo ou chama provedor.** A CI sem credenciais reais não valida o comportamento de uma implantação real.

Para execução real futura, será necessário conferir novamente o ambiente, os custos e a conformidade da imagem no Cloud Shell autenticado. **Não executar agora `--execute-approved-zero-traffic`**, nem comandos `gcloud run deploy` diretos. A titular deverá ver a nova verificação de prontidão antes da tentativa real.

## Limites de conclusão

Mesmo com saída de sucesso, NÃO estão validados: chave v2 do fornecedor; efetiva inicialização por Secret Manager; saúde HTTP da candidata (sem tag intencionalmente); CI Android de publicação; segurança P0; coleta real 92/92; licença de redistribuição; custos da conta. Não promover produção nem liberar clientes. Uma futura inspeção (somente leitura) da condição `Ready` da revisão pode ser feita sem tráfego, mas testes HTTP diretos exigem **plano separado de invocação segura**.

Oficial: [Cloud Run - Revisões e rollout](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration), [Cloud Run - Secret Manager](https://docs.cloud.google.com/run/docs/configuring/services/secrets), [CLI gcloud run deploy](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy).


## Resultado real do Cloud Shell — 21/11/2026, 09h51 BRT

A titular executou o procedimento aprovado, após passar nos testes locais. O comando **interrompeu-se no preflight**, com:

```text
RJ_OPENWEATHER_V2_CANDIDATE={
 "status":"BLOCKED_NO_DEPLOY",
 "reason":"PREFLIGHT_NOT_SAFE_TO_CREATE",
 "detail":[
  "SERVICE_TEMPLATE_CHANGED_FROM_HISTORICAL_BASE",
  "CURRENT_TEMPLATE_OPENWEATHER_SECRET_NOT_V1",
  "REVISION_MIN_INSTANCES_NOT_ZERO"
 ],
 "releaseAuthorized":false,
 "weatherProviderCalled":false,
 "secretPayloadRead":false
}
```

**Não houve deploy por esse script.** O template atual do serviço é diferente da imagem da revisão histórica, a referência do OpenWeather na configuração atual não é a versão 1 esperada, e há uma configuração de instâncias mínimas diferente de zero. Esses itens podem ser **legítimos em produção**. É proibido ignorar ou remover as travas sem examinar o template e a escala, pois o efeito de `gcloud run deploy` no serviço ativo não estaria suficientemente controlado.

**Ação imediata**: somente consultar o resumo seguro (template versus revisão histórica, versão de referência OpenWeather, localização da configuração minScale, sem ler secret payload nem imprimir valores de ambiente). Não repetir `--execute-approved-zero-traffic`, não alterar min-instances, template, tráfego, segredos ou IAM. Reavaliar o desenho antes de qualquer nova execução. A autorização original não dá permissão para criar serviço diferente, modificar a configuração atual dos clientes, mudar escalonamento ou aumentar custos.


## Resultado real complementar — 21/11/2026, 09h56 BRT

A inspeção **somente leitura** do modelo atual do serviço Cloud Run e da revisão histórica `00058-sos` mostrou:

- `IMAGEM_TEMPLATE_IGUAL_HISTORICA: True` (referência da imagem coincide).
- `OPENWEATHER_TEMPLATE_VERSAO: 2`; `OPENWEATHER_HISTORICA_VERSAO: 1`. **O template atual já referencia a versão 2**, de modo que reaplicar cegamente o reparo de v1 a v2 seria redundante e poderia sobrescrever outras alterações.
- `MIN_INST_TEMPLATE: 1`; `MIN_INST_REVISAO: 1`; `MIN_INST_SERVICO: NAO_DEFINIDO`. São anotações de mínimo no modelo/revisão, não prova do número de instâncias efetivamente em execução nem de cobrança. Copiar esse mínimo à candidata poderia manter instância provisionada mesmo sem tráfego normal.
- `ULTIMA_REVISAO: blaise-v6-rj-backend-00043-hjk` na resposta do serviço; esse valor exige investigação em face da revisão histórica `00058-sos` previamente localizada, sem presumir qual é a mais nova ou alterar o encaminhamento. O gate compara com a histórica e **bloqueou**, corretamente.

**Decisão:** não contornar `SERVICE_TEMPLATE_CHANGED_FROM_HISTORICAL_BASE`, `CURRENT_TEMPLATE_OPENWEATHER_SECRET_NOT_V1` ou `REVISION_MIN_INSTANCES_NOT_ZERO`. A permissão para **uma revisão candidata 0%** não autoriza alterar mínimos de instâncias dos clientes, mudar o modelo ativo, trocar secret bindings já válidos ou criar despesas recorrentes. A próxima etapa é apenas leitura do `latestCreatedRevisionName`/`latestReadyRevisionName`, atributos de escala e distribuição por revisão, sem exibir segredos. O procedimento de implantação atual permanece **bloqueado** e não deve ser reexecutado.

## Verificação de datas e condições da revisão — 21/11/2026, 10h03 BRT

A consulta de metadados feita no Cloud Shell mostra duas revisões presentes, ambas com `Ready=True`, porém com sinais diferentes:

- `blaise-v6-rj-backend-00043-hjk`: criada em **2026-11-18T17:18:58.377216Z**; `Ready=True`; **reason=Retired**. Embora posterior no tempo, uma condição `Retired` não é prova de que deva receber tráfego ou servir como base para implantação.
- `blaise-v6-rj-backend-00058-sos`: criada em **2026-10-16T23:43:54.247642Z**; `Ready=True`; motivo de prontidão não informado pela consulta. Essa revisão, acessada pela tag de validação, respondeu **HTTP 500** nas rotas de teste e referencia o segredo OpenWeather v1 desabilitado.

**Implicação operacional:** `latestCreatedRevisionName=00043-hjk` não significa candidata homologada; `latestReadyRevisionName=00058-sos` não supera os erros HTTP 500. Manter `BLOCKED_NO_DEPLOY`, sem reexecução do script anterior. Somente ler a configuração de tráfego e as condições efetivas de cada revisão antes de reconsiderar o isolamento. Ambas ainda não foram homologadas para tráfego normal.

## Atualização da solução — 21/11/2026, após 10h06 BRT

- Condições observadas: `00043-hjk` = `Ready=False/Active=False` com motivo `Retired`, 0% e sem tag; `00058-sos` = `Ready=True/Active=True`, tag de validação e 0% (apesar dos erros HTTP 500), com `MinInstancesProvisioned=True` na consulta. **Não confundir Ready com saúde HTTP.**
- A regra anterior `REVISION_MIN_INSTANCES_NOT_ZERO` bloqueava também o **mínimo histórico legítimo de 1**. Foi corrigida: exige `minScale=1` **no histórico/template ANTES**, exige `--min-instances=0` **somente na candidata**, e confere que o histórico se mantém em 1, sem modificar o mínimo global do serviço. Se a configuração observada mudar, bloqueia.
- O template corrente já referencia OpenWeather **versão 2**; o script não deve exigir v1 no template. Sua origem esperada é a última criada `00043-hjk`, mas a imagem vem do digest da revisão histórica `00058-sos`. Nenhuma delas foi homologada para atender clientes.
- O novo script usa `--no-deploy-health-check`: a documentação oficial informa que, desabilitada essa checagem, a validação de startup ocorre quando a revisão for invocada ou tiver instância mínima. Com `minScale=0`, sem tag e sem tráfego, não se prevê inicialização por esse procedimento; **não há garantia de custo absoluto zero** da infraestrutura Cloud Run.
- Documentação oficial: https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy (`--min-instances` por revisão, `--min` por serviço, `--no-deploy-health-check`); https://docs.cloud.google.com/run/docs/configuring/min-instances.

**Estado final desta etapa: somente código e CI offline, SEM implantação, SEM credenciais novas, SEM consumo intencional de créditos, SEM alteração no tráfego.**

## Atualização de segurança — 21/11/2026, após auditoria de 10h06

**ESTA É A INSTRUÇÃO VIGENTE E SUBSTITUI QUALQUER BLOCO DE DEPLOY ANTERIOR DESTE DOCUMENTO.** A usuária solicitou **corrigir o procedimento e testá-lo com instâncias mínimas zeradas ANTES de qualquer nova tentativa real**. Consequentemente, a opção antiga `--execute-approved-zero-traffic` permanece **deliberadamente bloqueada no código** com `REAL_DEPLOY_PAUSED_FOR_SEPARATE_REVIEW`. Não criar a candidata nesta etapa.

### Evidências concretas de produção, obtidas em modo leitura

- O serviço atual tem `latestCreatedRevisionName=blaise-v6-rj-backend-00043-hjk`; essa revisão foi criada em 18/11/2026 e está `Ready=True, reason=Retired, Active=False`. A última pronta informada é `blaise-v6-rj-backend-00058-sos` (16/10/2026; Active=True, mas HTTP 500 nas rotas testadas).
- O **template atual já usa** `BLAISE_OPENWEATHER_API_KEY` do Secret Manager na **v2**, enquanto a histórica `00058-sos` usa **v1 DESABILITADA**. Não forçar downgrade nem sobrescrever configurações existentes.
- **minScale=1 no template atual e na revisão histórica**; deve permanecer sem modificação. Não inferir minScale de uma revisão pela ausência de tráfego.
- A configuração de tráfego normal previamente comprovada continua 99%/1%; a tag `validacao-rj` em `00058-sos` permite testar diretamente, mas **não torna essa revisão adequada para clientes**.
- O Cloud Run dispõe de duas flags distintas: `--min-instances=0` configura **a nova revisão**; `--min=0` configura **o serviço inteiro** e é proibida neste procedimento. Documento oficial: https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy

### Correção simulada na PR #173

**CI validado:** workflow de auditoria meteorológica [run 44907862643](https://github.com/gabilinsj-cyber/Blaise-/actions/runs/44907862643): **42 testes aprovados, 0 falhas**, incluindo os novos testes de controle de mínimo zero e prevenção de implantação real. Nenhum acesso autenticado ao Cloud Run foi usado por esses testes, somente dados simulados.



- `backend/src/rj-openweather-zero-min-candidate.mjs`: função **pura** constrói um plano de comando com `--min-instances=0`, `--no-traffic`, `--no-deploy-health-check` e **sem** `--min` ou `--tag`. Usa digest de imagem imutável e liga OpenWeather somente à referência da v2; oito flags de coletores continuam `false`.
- O mesmo módulo distingue mínimo de **serviço**, **revisão antiga** e **revisão futura** e verifica, em simulação, que a candidata tenha mínimo zero sem que o mínimo de serviço seja alterado. O mínimo 1 observado nas revisões históricas NÃO é apagado ou reconfigurado.
- `backend/scripts/rj-openweather-v2-zero-traffic-candidate.mjs`: preflight **somente leitura** já adaptado ao template v2 e ao `latestCreated=00043-hjk`; uso de `--execute-approved-zero-traffic` resulta em **BLOQUEIO**, mesmo após preflight verde, até análise independente posterior.
- Testes offline: `backend/test/rj-openweather-zero-min-candidate.test.mjs` e `backend/test/rj-openweather-v2-zero-traffic-candidate.test.mjs`. Verificam `minScale` antiga=1, futura=0, serviço preservado, ausência de URL/tag, coleta OFF, bloqueio de tráfego alterado/segredo desabilitado, e proibição de implantar.

### Novo comando permitido no Cloud Shell

Se for solicitada nova captura, entrar na worktree **existente** e atualizar **sem sobrescrever nenhum arquivo modificado** apenas em caminho de trabalho novo. Executar **somente**:

```bash
node --test test/rj-openweather-zero-min-candidate.test.mjs test/rj-openweather-v2-zero-traffic-candidate.test.mjs
node scripts/rj-openweather-v2-zero-traffic-candidate.mjs --preflight-only
```

**NÃO EXECUTAR** `--execute-approved-zero-traffic`, `gcloud run deploy`, `gcloud run services update-traffic`, `gcloud run services update --min` ou qualquer consulta meteorológica. A futura candidata de 0% continua **NÃO CRIADA**, a PR segue DRAFT, nenhuma versão de segredo foi alterada e o release está BLOQUEADO.



## Auditoria real de tráfego e ausência de candidata — 21/11/2026, 10h31 BRT

Consulta autenticada, apenas de leitura, ao `gcloud run services describe` e `gcloud run revisions list --service=blaise-v6-rj-backend` realizada no Cloud Shell pelo proprietário. Saída agregada da captura:

```text
TRAFEGO_31: 99
TRAFEGO_38: 1
TRAFEGO_TOTAL: 100
TRAFEGO_99_1_PRESERVADO: True
CANDIDATA_EXISTE: False
CANDIDATA_AUSENTE: True
AUDITORIA: SOMENTE_LEITURA
DEPLOY_REAL: BLOQUEADO_NESTA_ETAPA
```

**Conclusão limitada:** na leitura das 10h31, o roteamento público continuava 99% na `00031-vep` e 1% na `00038-pin`, sem revisão `blaise-v6-rj-backend-owv2-211126` listada. A linha `DEPLOY_REAL: BLOQUEADO_NESTA_ETAPA` é impressa pelo próprio script, não constitui auditoria independente de todas as alterações históricas; a ausência da candidata e os testes de CI são evidência adicional. `REAL_DEPLOY_PAUSED=true` continua no script da PR #173; **não reexecutar a opção de implantação**. O último CI de auditoria offline passou com **42/42 testes**, referência do run 44907990908. Não houve nova chamada meteorológica intencional nem leitura de payload de segredo nesta etapa.

**Próxima etapa segura:** executar somente o modo `--preflight-only` da versão atualizada em worktree separada, mantendo bloqueada a criação real. Qualquer mudança futura de runtime, API key, minScale global ou tráfego exige nova aprovação e validação.
