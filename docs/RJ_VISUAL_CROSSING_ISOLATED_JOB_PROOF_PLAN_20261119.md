# Blaise V6 RJ — Visual Crossing: prova operacional em job isolado (NÃO IMPLANTADA)

**Revisão:** 19/11/2026. **Branch:** `feature/rj-meteoblue-full-recovery-admin-ui-20261118`, PR #173 draft. **Estado:** PREPARADO SOMENTE EM CÓDIGO. Não há concessão IAM, criação de job/conta, chamada de `AccessSecretVersion`, execução Cloud Run, chamada à Visual Crossing, assinatura paga, merge, deploy ou publicação de assinantes.

## Motivo da mudança de arquitetura

A inspeção do Cloud Run às 18h29 confirmou que o backend principal usa a conta `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`, preserva outras três referências a segredos e **não possui referência explícita** à chave Visual Crossing. A inspeção IAM das políticas consultadas não encontrou grants diretos de `roles/secretmanager.secretAccessor` para a identidade do backend. A impersonação em Cloud Shell falhou. A consulta aos logs das 20h44 retornou a **versão 1 habilitada**, nenhum acesso bem-sucedido encontrado na janela consultada e acesso efetivo ainda `NOT_VERIFIED`.

A versão de prova anterior tinha a **identidade principal do backend** como esperada; isso foi **substituído na branch** pela proposta de um *Cloud Run Job exclusivo*, de modo a não conceder acesso ao backend de clientes. A prova para este novo job **não comprova nem precisa pressupor** autorização da identidade antiga: cada workload deve ter sua própria permissão auditável. Esta arquitetura preserva a produção existente.

## Contrato do job proposto, sem criar recursos

| Item | Especificação |
|---|---|
| Projeto | `blaise-v6-rj` |
| Conta de serviço **proposta e ainda não criada** | `blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com` |
| Cloud Run Job **proposto e ainda não criado** | `blaise-vc-secret-proof-once` |
| Imagem | Artefato revisado, origem confiável e digest imutável a definir (nunca usar imagem arbitrária ou tag `latest`) |
| Região | Descobrir e aprovar região real; sem assumir |
| IAM, *somente depois de aprovação* | `roles/secretmanager.secretAccessor` **apenas** no segredo `blaise-visual-crossing-free-api-key`, para a conta exclusiva |
| Segredo, versão | `blaise-visual-crossing-free-api-key/versions/1` (revalidar habilitação antes da execução) |
| Execução | 1 tarefa, 0 novas tentativas, timeout curto (ex.: 60 segundos) |
| Entradas | Apenas `BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED=true`, metadados automáticos do job e token efêmero do metadata server |
| Saída | Código de status resumido, **sem chave, token, hash, resposta ou URLs com dados** |
| Tráfego de clientes/HTTP | Nenhum: job finaliza após o teste, não cria rota |
| Consultas ao fornecedor, Firestore, aplicativo | Nenhuma |
| Planejamento de custo | Verificar antes da criação e execução; não pressupor custo zero |

O job proposto **não injeta a API key em env** e não usa `--set-secrets`; o próprio diagnóstico efetua uma chamada HTTPS única ao método Secret Manager `AccessSecretVersion`, descarta o corpo sem processamento, e retorna `GRANTED_AT_TIME_OF_PROBE` apenas em HTTP 200. Essa chamada **é acesso real ao valor do segredo do ponto de vista do serviço**, mesmo sem exibi-lo. Só autorizar em um estágio separado, após revisar riscos, IAM, custo e logs.

A partir desta revisão, o arquivo `backend/src/rj-visual-crossing-runtime-secret-proof.mjs` exige simultaneamente:
1. `BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED=true` configurado no job;
2. `CLOUD_RUN_JOB=blaise-vc-secret-proof-once` (não aceita `K_SERVICE` do backend);
3. `CLOUD_RUN_TASK_INDEX=0` e `CLOUD_RUN_TASK_COUNT=1`;
4. e-mail devolvido pelo metadata server **igual** a `blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com`.

Apenas depois dessas barreiras, consulta token OAuth temporário pelo metadata server e solicita acesso à versão 1. Retornos: `VERSION_ACCESS_GRANTED_AT_TIME`, `VERSION_ACCESS_DENIED_AT_TIME`, ou inconclusivo em erros; nenhum desbloqueia liberação de clientes ou coleta meteorológica. Não imprimir stdout de `gcloud secrets versions access` nem escrever qualquer chave em arquivos.

## Pré-voo de somente leitura disponível agora

`backend/scripts/visual-crossing-isolated-job-preflight-readonly.py` consulta **apenas metadados** de:
- `gcloud iam service-accounts describe` para a conta proposta;
- `gcloud secrets get-iam-policy` para verificar **binding direto** no segredo (nenhum grant é criado);
- `gcloud run jobs list` para detectar nome de job existente e evitar colisões.

Só imprime `BLAISE_VC_ISOLATED_PROOF_PREFLIGHT=` com estados/resumos. Falha de `describe` pode significar falta de permissão ou inexistência, logo `identityExistenceIfDescribeFailed=UNKNOWN`; um binding existente **não prova acesso efetivo**; a existência de job não significa execução; nenhum desses resultados habilita release.

```bash
cd ~/blaise-visual-crossing-audit-20261119
git fetch origin feature/rj-meteoblue-full-recovery-admin-ui-20261118
mkdir -p ~/blaise-vc-security-check
git show FETCH_HEAD:backend/scripts/visual-crossing-isolated-job-preflight-readonly.py > ~/blaise-vc-security-check/visual-crossing-isolated-job-preflight-readonly.py
python3 ~/blaise-vc-security-check/visual-crossing-isolated-job-preflight-readonly.py
```

Se o Cloud Shell tiver pouco espaço, não usar `npm install`, clones adicionais ou `gcloud beta` para esse preflight; o script usa somente Python 3 padrão e gcloud já presente.

## Controles e decisões que permanecem pendentes

1. **Chave exposta:** o usuário escolheu manter a chave Visual Crossing atual. Essa escolha **não equivale a liberar o segredo para produção**. Uma chave exposta não se torna confiável só por estar no Secret Manager; rotação permanece recomendada antes de integração pública. Nenhuma mudança automática de chave será feita.
2. **IAM:** criar uma conta dedicada e conceder `roles/secretmanager.secretAccessor` apenas ao **segredo único** são ações mutáveis e não autorizadas apenas pela ordem genérica “próxima etapa”. Não conceder `Token Creator`, `Editor`, `Owner`, Secret Manager Admin ou acesso no projeto inteiro.
3. **Cloud Run Job:** criar um job pode incorrer em custo e demandar identidade/autorizações de execução. Não implantar ou executar até autorização específica para recursos, custos e leitura real do segredo, com imagem por digest revisada e rollback/parada.
4. **Plano Free:** o job **não chama** Visual Crossing; zero créditos meteorológicos do fornecedor. Isso não garante que a infraestrutura de diagnóstico seja sempre gratuita.
5. **Coletores/clientes:** os 92 municípios, rotas e agendadores de Visual Crossing, interface pública e assinatura permanecem desligados. O runtime do backend **não importa** o módulo de prova nem o coletor privado automaticamente.
6. **Prova efetiva:** somente a execução isolada posteriormente aprovada pode comprovar acesso **da identidade nova ao segredo naquela data**, não da identidade antiga ou de toda a aplicação. Logs históricos sem ocorrência não comprovam negação.

## Testes da PR

Rodar no CI somente casos sintéticos:
- `node --test backend/test/rj-visual-crossing-runtime-secret-proof.test.mjs`;
- `python3 -B backend/test/test_visual_crossing_isolated_job_preflight_readonly.py`.

As regras regressivas incluem rejeição no backend de produção, nome de job errado, múltiplas tarefas e identidade inesperada, ausência de leitura do corpo da resposta simulada do Secret Manager e ausência de concessões IAM/release.

Referências oficiais do Google Cloud: [Cloud Run jobs](https://docs.cloud.google.com/run/docs/create-jobs), [jobs service identity](https://docs.cloud.google.com/run/docs/configuring/jobs/service-identity), [Secret Manager access control](https://docs.cloud.google.com/secret-manager/docs/access-control).

**Gate final:** `ISOLATED_DIAGNOSTIC_NOT_PROVISIONED`, `IAM_UNCHANGED`, `SECRET_VERSION_NOT_ACCESSED`, `COLLECTION_DISABLED`, `NO_PUBLIC_RELEASE`.


## Evidência real: pré-voo isolado Cloud Shell — 19/11/2026 20h58 BRT

A titular executou `backend/scripts/visual-crossing-isolated-job-preflight-readonly.py`, obtido da branch da PR #173, e apresentou captura das **20h58 BRT**. Resultado `BLAISE_VC_ISOLATED_PROOF_PREFLIGHT`:

- `state=READ_ONLY_ISOLATED_PROOF_PREFLIGHT`;
- `secretPolicyReadSucceeded=true`;
- `directSecretAccessorBindingFound=false` para `blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com`;
- `directSecretAccessorBindingConditionalCount=0`;
- `identityDescribeSucceeded=false`, `identityExistenceIfDescribeFailed=UNKNOWN` — **não** afirmar que a conta não existe, pois erro de permissão também é possível;
- `cloudRunJobs=NO_MATCH_IN_RESULTS` — o nome `blaise-vc-secret-proof-once` não foi encontrado na listagem acessível, mas não provar ausência universal;
- `effectiveSecretAccess=NOT_VERIFIED`;
- `jobCreatedByThisCheck=false`, `serviceAccountCreated=false`, `cloudRunExecutionTriggered=false`, `secretPayloadRead=false`, `iamPolicyChanged=false`, `weatherApiCalled=false`, `releaseApproved=false`.

**Decisão técnica:** a inspeção segura já foi concluída. Para a identidade isolada proposta, não há concessão `Secret Accessor` **direta** visível no segredo. A identidade proposta não foi confirmada e o job planejado não foi encontrado na listagem; nenhum teste real de `AccessSecretVersion` sob essa conta foi executado. Não confundir a conta isolada proposta com a conta já existente do backend. Permissões herdadas, bindings condicionais e logs continuam sujeitos a limitações de visibilidade.

**Próximos gates independentes, todos com autorização específica:**
1. Criar ou confirmar a identidade `blaise-vc-proof` (se a titular autorizar a mudança, após checar que ela ainda não existe por outro meio). Criar uma conta sem dar-lhe automaticamente papel no segredo.
2. Revisar e aprovar uma concessão no escopo do **segredo único**, `roles/secretmanager.secretAccessor`, exclusivamente para a conta de diagnóstico. **Não conceder papel no projeto, Secret Admin, Token Creator, Owner, Editor, nem atualizar backend principal.**
3. Criar um Cloud Run Job efêmero e privado, usando imagem aprovada por digest, tarefa única, timeout/retries controlados, quota e custo verificados, sem scheduler, tráfego público ou acesso a dados meteorológicos de clientes. **Não executar na criação.**
4. Autorizar separadamente a execução pontual do acesso real à **versão 1** do Secret Manager, com descarte de corpo de resposta, evitando logs de credenciais e sem chamar Visual Crossing.
5. Se autorizado, remover o acesso concedido no diagnóstico e desativar/excluir o job isolado após preservar só logs e evidências seguros; sem mexer na revisão ativa, na chave atual, no aplicativo original e nos três segredos preexistentes.

**Bloqueios mantidos:** chave anteriormente exposta preservada a pedido da titular, mas sem aprovação de uso público; assinatura Free; coleta para 92 municípios desligada; publicação aos clientes desligada; PR draft; IAM e Cloud Run sem mudanças nesta etapa.


## Evidência Cloud Shell — 19/11/2026 21h01 BRT: conta isolada não encontrada

Captura enviada pela titular às **21h01 BRT**, após execução de comando Python que invocou
`gcloud iam service-accounts list --project=blaise-v6-rj --format=json`.
Saídas confirmadas:
- `LISTAGEM: CONCLUIDA` — consulta terminou sem erro;
- `CONTA_ISOLADA: NAO_ENCONTRADA_NA_LISTAGEM` — a identidade `blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com` não apareceu entre contas ativas listadas para o projeto.

**Interpretação limitada:** não há evidência de uma conta isolada ativa com esse endereço na lista consultada. Isso não é autorização para criar recursos, não comprova ausência de identidades excluídas anteriormente nem prova IAM efetivo.

**Próximo gate:** propor `gcloud iam service-accounts create blaise-vc-proof --project=blaise-v6-rj --display-name="Blaise VC Secret Proof (isolated)"`, **somente após autorização específica da titular para criação da conta**. Uma conta nova não recebe automaticamente acesso ao segredo; não aplicar `secretAccessor`, Token Creator ou qualquer papel neste estágio. Não criar Cloud Run Job, executar AccessSecretVersion, mudar a chave exposta, habilitar APIs ou liberar coleta/publicação sem autorizações separadas.


## Evidência Cloud Shell — 19/11/2026 21h04 BRT: identidade isolada criada

A titular apresentou captura do Cloud Shell às **21h04 BRT** após executar `gcloud iam service-accounts create blaise-vc-proof --project=blaise-v6-rj --display-name="Blaise VC Secret Proof Isolated"`. O terminal confirmou `Created service account [blaise-vc-proof]` e exibiu o endereço `blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com`.

**Evidência confirmada:** a conta de serviço isolada foi criada no projeto. O comando exibido **não concede papel no segredo, cria job, executa prova nem atualiza o backend**. Não se pode inferir a ausência de permissões efetivas por políticas herdadas apenas desse comando.

**Gates pendentes:** verificar políticas efetivas e vínculos diretos para a nova identidade, solicitar autorização **específica** antes de eventual concessão `roles/secretmanager.secretAccessor` **somente no segredo**; aprovar separadamente a imagem do diagnóstico, configuração do Cloud Run Job, custo, execução pontual e descarte de permissões depois do teste. Não conceder Token Creator nem grants de projeto/organização. Sem acesso à versão 1, sem chamadas à Visual Crossing, sem merge, sem deploy e sem publicar a clientes. A chave já exposta permanece preservada a pedido da titular e classificada como risco até nova decisão.


## Evidência Cloud Shell — 19/11/2026 21h06 BRT: conta existe, acesso direto ausente

A titular executou novamente o `visual-crossing-isolated-job-preflight-readonly.py` depois de criar `blaise-vc-proof`. Captura das 21h06 BRT confirma:

- `identityDescribeSucceeded=true` para a conta proposta `blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com` — confirmação adicional de existência;
- `secretPolicyReadSucceeded=true`;
- `directSecretAccessorBindingFound=false` e `directSecretAccessorBindingConditionalCount=0` — nenhum vínculo **direto** de `roles/secretmanager.secretAccessor` para essa conta na política do segredo;
- `cloudRunJobs=NO_MATCH_IN_RESULTS` — o nome do job não aparece na listagem consultada;
- `effectiveSecretAccess=NOT_VERIFIED`;
- `cloudRunExecutionTriggered=false`, `iamPolicyChanged=false`, `secretPayloadRead=false`, `weatherApiCalled=false`, `releaseApproved=false`.

**Próxima etapa depende de autorização explícita da titular** para conceder `roles/secretmanager.secretAccessor` à identidade isolada somente no recurso `blaise-visual-crossing-free-api-key`. Essa permissão permite leitura do valor do segredo pela identidade aprovada. Não executar automaticamente esta concessão; não mexer no papel da conta do backend, não conceder acesso em nível de projeto e não criar/rodar o job até consentimento específico adicional. A chave atual permanece não rotacionada conforme decisão anterior, com risco de exposição reconhecido.


## Evidência Cloud Shell — 19/11/2026 21h14 BRT: IAM temporário aplicado

A titular autorizou explicitamente a concessão restrita ao segredo e apresentou captura das **21h14 BRT** contendo a execução de:
`gcloud secrets add-iam-policy-binding blaise-visual-crossing-free-api-key --project=blaise-v6-rj --member=serviceAccount:blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --condition="expression=request.time < timestamp('$EXPIRA'),title=blaiseVcProof24h,description=Temporary isolated diagnostic access" --format=none`.

A CLI confirmou `Updated IAM policy for secret [blaise-visual-crossing-free-api-key]` e imprimiu `EXPIRACAO_UTC: 2026-11-21T00:14:02Z` (20/11/2026 às 21h14min02s no fuso de Brasília, UTC-3). Houve warning de que **adicionar binding condicional em política sem condições muda o tratamento dos comandos add/remove**; **não indica erro da atualização**. Este warning não prova que o vínculo/condição foi persistido conforme intenção; a próxima etapa é uma inspeção `gcloud secrets get-iam-policy` somente leitura, filtrando unicamente o papel e membro aprovados, condição e expiração.

**Estado preciso:** IAM de segredo atualizado após consentimento; conta `blaise-vc-proof` já existente; **Cloud Run Job ainda não foi criado**, acesso operacional `AccessSecretVersion` ainda **não testado**, chave não foi lida nem alterada, backend principal não teve IAM ou revisão alterados, zero consulta Visual Crossing, coleta/publicação de clientes desligadas. A conta isolada pode ganhar acesso ao segredo **somente enquanto a condição IAM de prazo for válida**; isso é permissão sensível. Depois do diagnóstico autorizado, revogar explicitamente o binding **com a mesma condição**, sem usar `--all` e sem remover concessões de terceiros. O prazo temporal impede a avaliação positiva da condição após expirar, mas **não exclui automaticamente o binding** da política.

**Próxima ação aprovada:** confirmar por leitura o binding, título da condição e timestamp, verificando também que não há concessão inesperada ao backend principal. **Não criar job, não executar `AccessSecretVersion`, não conceder papéis adicionais sem autorização específica**.


## Evidência Cloud Shell — 19/11/2026 21h18 BRT: condição IAM validada

A titular executou o filtro somente leitura de `gcloud secrets get-iam-policy blaise-visual-crossing-free-api-key --project=blaise-v6-rj --format=json` e enviou captura às **21h18 BRT**. Resultado:

- `VINCULOS_ALVO: 1` — existe exatamente um binding `roles/secretmanager.secretAccessor` para `serviceAccount:blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com` na política do segredo consultada;
- `CONDICIONAL: True`;
- `TITULO_CORRETO: True` (`blaiseVcProof24h`);
- `RESTRICAO_TEMPORAL: True`: expressão começa com `request.time < timestamp(`;
- `EXPIRACAO_UTC: 2026-11-21T00:14:02Z`, equivalente a **20/11/2026 21h14min02s BRT (UTC-3)**;
- `BACKEND_PRINCIPAL_NO_MESMO_ROLE: False` — a conta de execução do backend não é membro **direto** desse papel no segredo consultado.

**Conclusão com escopo correto:** concessão restrita gravada para a conta isolada, com expiração; o filtro verificou prefixo da condição e extraiu o primeiro timestamp, mas **não validou a expressão inteira nem comprovou acesso operacional**. Vínculos IAM distintos/herdados permanecem fora dessa afirmação. A condição impede essa concessão de ser satisfeita após o prazo, mas não remove automaticamente o binding. Nenhum `AccessSecretVersion` foi executado; Secret Manager não revelou o valor. Nenhum Cloud Run Job foi criado ou executado, nenhum deploy, nenhuma chamada Visual Crossing e nenhuma publicação aos clientes foi autorizada.

**Próximo estágio sem mutação:** descobrir região Cloud Run atual, existência de job de nome planejado, imagem executável revisada e digest imutável; registrar custo/limites e verificar se o operador tem permissão de associar a conta isolada a um novo job, **sem conceder papéis ou iniciar jobs**. Uma possível prova de acesso deve ocorrer antes da expiração, mas nunca burlar o prazo nem renová-lo automaticamente. Criar/rodar o Cloud Run Job e ler versão 1 requerem autorização separada.


## Evidência Cloud Shell — 19/11/2026 21h25 BRT: região definida e artefato específico preparado

A titular executou consulta de metadados `gcloud run services list --project=blaise-v6-rj --format=json` e apresentou captura às **21h25**:
- `BACKEND: ENCONTRADO`;
- `REGIAO: southamerica-east1` (São Paulo).
A região foi observada **no serviço backend**, e é a candidata preferencial ao job isolado, **não uma ordem de deploy**.

**Inspeção de construção da imagem:** o `backend/Dockerfile` atual é o do servidor de assinantes e usa `COPY src ./src`, mas não copia o diretório `scripts`, onde mora `visual-crossing-runtime-secret-proof.mjs`. Essa imagem **não seria suficiente como está** para executar a prova de forma isolada e jamais deve ser apontada para clientes com argumentos de execução alterados.

Para evitar reutilizar a imagem/servidor de produção, foi criado **apenas como código** `backend/Dockerfile.visual-crossing-secret-proof`, cujo contexto de build futuro será `backend/`; ele:
- usa imagem base Node 24 Bookworm Slim **fixada por digest já presente no Dockerfile do backend**, sujeito a revisão de CVEs e proveniência antes da construção;
- copia **somente** `src/rj-visual-crossing-runtime-secret-proof.mjs` e `scripts/visual-crossing-runtime-secret-proof.mjs` — sem pacote de assinantes, chaves, cache nem configuração de produção;
- executa como usuário `node`, sem listener HTTP, e só chama a checagem protegida por `CLOUD_RUN_JOB`, índice/contagem da tarefa, flag explícita e e-mail exato de service account do metadata server;
- não tem `npm install`, push, chamada de rede ou leitura real do Secret Manager no procedimento de CI offline.
O entrypoint retorna **exit code não-zero** quando o diagnóstico não comprova `VERSION_ACCESS_GRANTED_AT_TIME`; falha ou falta de autorização não pode aparecer como execução bem-sucedida.

**Ainda NÃO determinado:** imagem final enviada para Artifact Registry por digest, disponibilidade de permissão `iam.serviceAccounts.actAs` para associar a nova conta ao job, políticas de acesso do operador ao job, custos exatos, configuração do runtime job. Não houve build/push/deploy. Nunca usar a imagem do backend principal como atalho.

**Plano de próxima ação segura:** inspecionar apenas metadados de Artifact Registry e papel `iam.serviceAccountUser` da nova identidade, sem imprimir membros privados nem criar recursos. Depois escolher o procedimento de build restrito e a janela de execução, com autorização separada da titular. IAM `roles/secretmanager.secretAccessor` condicional do segredo foi confirmado e expira em **21/11/2026 00:14:02Z**; se o prazo passar, não renová-lo silenciosamente nem criar prova com privilégio adicional por conveniência.


## Evidência Cloud Shell — 19/11/2026 21h35 BRT: Artifact Registry inventariado

Consulta **somente leitura** concluída pela titular em captura das **21h35 BRT**: `gcloud artifacts repositories list --project=blaise-v6-rj --location=southamerica-east1 --format=json`, filtrada por `format=DOCKER` e sem mostrar credenciais.

Resultado da captura:
- `ARTIFACT_REGISTRY: CONSULTADO`;
- `REPOSITORIOS_DOCKER: 3`;
- `blaise-backend`;
- `blaise-noaa-staging`;
- `cloud-run-source-deploy`.

**Interpretação:** existem 3 repositórios de imagens Docker na região do backend. Isso **não significa** que a imagem de prova Visual Crossing já exista nem que tenhamos o digest ou permissões de escrita/leitura. Evitar reutilizar `blaise-noaa-staging` (outro coletor), `cloud-run-source-deploy` (gerenciamento do serviço) ou sobrescrever imagens do backend. Um repositório dedicado ao diagnóstico poderia reduzir risco de colisão e facilitar inventário/limpeza, mas **criá-lo, fazer build/push, conceder papéis Artifact Registry, criar job e executá-lo exigem decisões/autorização independentes**, com prévia verificação de custo e IAM.

**Próximo passo sem mutação:** consultar **metadados** do repositório candidato de uso exclusivo (`blaise-vc-proof`) e versões/imagens já presentes, se existirem, para evitar duplicatas; não baixar, construir, apagar, mover ou publicar imagens. Por enquanto `IAM_SECRET_CONDITIONAL_ONLY`, `JOB_NOT_CREATED`, `SECRET_ACCESS_NOT_TESTED`, `CLIENT_COLLECTION_OFF`, `PR_DRAFT`. O vínculo condicional da conta isolada expira em **21/11/2026 00:14:02Z** e não será renovado automaticamente.


## Evidência Cloud Shell — 19/11/2026 21h58 BRT: repositório Docker isolado criado

A titular aprovou especificamente **criar somente o repositório Artifact Registry** `blaise-vc-proof` na região `southamerica-east1`, sem build, push nem deploy. Captura do Cloud Shell às **21h58 BRT** mostra o comando:

`gcloud artifacts repositories create blaise-vc-proof --project=blaise-v6-rj --location=southamerica-east1 --repository-format=docker --description="Blaise V6 RJ - Visual Crossing isolated security proof"`

A saída confirmou operação concluída: `Created repository [blaise-vc-proof]`. Houve um `describe` anterior com `NOT_FOUND`, **antes** da criação; não representa falha do `create`.

**Estado comprovado:** repositório Docker dedicado criado. **Não comprovado nessa captura:** upload de qualquer imagem, digest de imagem, deploy/job ou execução do diagnóstico. A próxima etapa segura é ler metadados com `gcloud artifacts repositories describe blaise-vc-proof --project=blaise-v6-rj --location=southamerica-east1 --format=json` e, separadamente, `gcloud artifacts docker images list southamerica-east1-docker.pkg.dev/blaise-v6-rj/blaise-vc-proof --format=json`, filtrando metadados sem credenciais. Nada de `docker build`, `gcloud builds submit`, `docker push`, `gcloud run jobs create/execute` ou expansão de IAM sem aprovação específica.

**Isolamento e custos:** os repositórios `blaise-backend`, `blaise-noaa-staging` e `cloud-run-source-deploy` permanecem fora do escopo; o novo repositório vazio não implica imagem de diagnóstico já publicada. A condição temporária `blaiseVcProof24h` no segredo foi confirmada com expiração **2026-11-21T00:14:02Z**, não deve ser renovada automaticamente. Coleta de Visual Crossing e publicação a clientes permanecem desligadas; chave exposta preservada por escolha da titular.


## Evidência Cloud Shell — 19/11/2026 22h01 BRT: repositório vazio confirmado

A titular executou duas consultas somente leitura, com captura às **22h01 BRT**:

1. `gcloud artifacts repositories describe blaise-vc-proof --project=blaise-v6-rj --location=southamerica-east1 --format="table(name,format)"`: identificou recurso `projects/blaise-v6-rj/locations/southamerica-east1/repositories/blaise-vc-proof`, `FORMAT: DOCKER`, criptografia por chave gerenciada pelo Google e `Repository Size: 0.000MB`.
2. `gcloud artifacts docker images list southamerica-east1-docker.pkg.dev/blaise-v6-rj/blaise-vc-proof --format="table(package,version)"`: terminou sem listar imagens.

**Conclusão:** repositório dedicado existe, vazio no momento da consulta, sem imagens/digests. Não significa que há um build pronto ou Cloud Run Job implantado. Nenhuma dessas consultas criou imagens ou acessou valores de segredo.

**Próximo gate:** revisar o conteúdo mínimo do contexto de build (`backend/Dockerfile.visual-crossing-secret-proof` e dois módulos Node), infraestrutura/credenciais necessárias para build e push, risco de upload acidental de código/segredos, custos/quota do Cloud Build e Artifact Registry. Não executar `gcloud builds submit` nem `docker push` sem autorização separada. Repositórios existentes, backend principal, chave atual e coleta meteorológica dos 92 municípios devem permanecer intactos.

**Prazo de IAM:** o papel condicional Secret Accessor já registrado expira em `2026-11-21T00:14:02Z`, equivalente a `20/11/2026 21:14:02` horário de Brasília; expiração não remove automaticamente o binding.


## 19/11/2026 — preparação de build e publicação da imagem (sem submissão)

A titular autorizou avançar na **preparação** da construção e publicação da imagem exclusiva do diagnóstico, condicionada à revisão de custo, identidade/permissão de build e manutenção da separação entre build, Cloud Run Job e execução de prova. Não foi autorizado executar o job nem coletar dados do Secret Manager/Visual Crossing. O repositório `blaise-vc-proof` foi confirmado como Docker em `southamerica-east1`, com `Repository Size: 0.000MB` e nenhuma imagem listada às 22h01 BRT.

**Tarball de fonte minimizado:** foi adicionado `backend/scripts/visual-crossing-proof-image-prepare.py` para copiar **exatamente três arquivos textuais** do commit `FETCH_HEAD` da PR #173, em uma pasta nova e isolada no diretório pessoal, sem apagar/substituir diretórios existentes:

- `Dockerfile` extraído de `backend/Dockerfile.visual-crossing-secret-proof` (imagem base Node 24 fixada por digest, usuário `node`);
- `src/rj-visual-crossing-runtime-secret-proof.mjs`;
- `scripts/visual-crossing-runtime-secret-proof.mjs`.

Nenhum repositório completo, backup, `.env`, arquivo `firebase`, APK, pacote npm ou outra origem pode ser incluído. O preparo valida nome, tamanho, digest SHA256, Dockerfile e origem do commit. Se o diretório já existir com conteúdo inesperado, **bloqueia** em vez de sobrescrever; não apaga arquivos nem invoca Docker ou APIs. A saída `BLAISE_VC_BUILD_PREP=` fornece `contextPath`, `sourceCommit` e `proposedImageUri`, mas `cloudBuildSubmitted=false` e `artifactUploaded=false`.

**Pré-voo somente leitura:** `backend/scripts/visual-crossing-image-build-preflight-readonly.py` usa apenas comandos de consulta:
- APIs **já habilitadas** Cloud Build e Artifact Registry; não as habilita;
- estado de faturamento `billingEnabled` (não saldo ou franquia);
- `gcloud builds get-default-service-account --region=southamerica-east1` para classificar conta padrão do build **sem imprimir e-mail da identidade**;
- metadados e política IAM do repositório dedicado; **não infere permissão efetiva nem concede escritor**.

Os status `remainingFreeBuildMinutes=NOT_VERIFIED` e `effectiveArtifactUploadPermission=NOT_VERIFIED` são deliberados: uma conta de serviço detectada e um papel IAM direto não provam a capacidade final de publicar, e não é possível garantir custo zero somente com o pré-voo.

**Custos públicos verificados em 19/11/2026:** Cloud Build no pool padrão `e2-standard-2`: franquia promocional de **2.500 build-minutes/mês por conta de faturamento**, tarifa **US$ 0,006/min** além da franquia; [tabela oficial](https://cloud.google.com/build/pricing). Artifact Registry: **0,5 GiB-mês gratuitos por conta de faturamento**, excedente de armazenamento faturado; [preços](https://cloud.google.com/artifact-registry/pricing). Build também pode envolver Cloud Storage para staging de fontes, Cloud Logging ou transferência de dados. Tarifas e franquias compartilhadas podem variar; não assumir zero custo sem comparar com o uso da própria conta.

**Procedimento de pré-voo sem custos de build no Cloud Shell:**
```bash
cd ~/blaise-visual-crossing-audit-20261119
git fetch origin feature/rj-meteoblue-full-recovery-admin-ui-20261118
mkdir -p ~/blaise-vc-security-check
git show FETCH_HEAD:backend/scripts/visual-crossing-proof-image-prepare.py > ~/blaise-vc-security-check/visual-crossing-proof-image-prepare.py
git show FETCH_HEAD:backend/scripts/visual-crossing-image-build-preflight-readonly.py > ~/blaise-vc-security-check/visual-crossing-image-build-preflight-readonly.py
python3 ~/blaise-vc-security-check/visual-crossing-proof-image-prepare.py
python3 ~/blaise-vc-security-check/visual-crossing-image-build-preflight-readonly.py
```

**Modelo de publicação futura — NÃO EXECUTADO, e não utilizar até revisão dos outputs acima:**
```bash
# O caminho e a URI exatos são produzidos pelo PREP com SHA do commit revisado.
# Não construir usando ~/Blaise-RJ, o monorepo, nem a pasta raiz da worktree.
# gcloud builds submit CAMINHO_DO_CONTEXTO_MINIMO \
#   --project=blaise-v6-rj \
#   --region=southamerica-east1 \
#   --machine-type=e2-standard-2 \
#   --timeout=600s \
#   --tag=URI_EXATA_DA_IMAGEM_COM_SHA_DO_PREP
```
`gcloud builds submit --tag` pode criar objetos temporários de fonte no Cloud Storage e publica a imagem no Artifact Registry se o build for bem-sucedido. Após um eventual upload, a imagem deve ser **referenciada por `@sha256`**, não por tag mutável, na configuração do job. Uma imagem publicada **não é execução** e **não comprova Secret Manager**.

**Gates:** imagem sem chaves; origem do commit e digest; CI offline verde; API habilitada e custos conhecidos; identidade padrão de build auditada antes de usar; permissões de gravação somente no destino aprovado; nenhum `roles/owner`/Editor/TokenCreator concedido; job ainda não criado; sem `AccessSecretVersion`, nem consulta meteorológica, nem publicação de clientes.


## Evidência Cloud Shell — 19/11/2026 22h22 BRT: contexto seguro e pré-voo de build

Captura das **22h22 BRT** da execução dos scripts de preparação e pré-voo (somente leitura). `BLAISE_VC_BUILD_PREP` indicou `state=PREPARED_ONLY`, `fileCount=3`, `sourceBytes=6293`, `sourceCommit=9096abc23b7f0a98a752ec0544e71c53864d960b` e `cloudBuildSubmitted=false`, `artifactUploaded=false`, `iamChanged=false`, `secretRead=false`. Contexto mínimo criado em pasta distinta e sem sobrescrever os repositórios originais.

`BLAISE_VC_BUILD_PREFLIGHT` informou `cloudBuildApi=ENABLED`, `artifactRegistryApi=ENABLED`, `billing=ENABLED`, `targetRepositoryConfirmed=true`, `repositoryIamPolicyVisible=true`; `defaultBuildIdentityType=OTHER_OR_UNRECOGNIZED`, `effectiveArtifactUploadPermission=NOT_VERIFIED`, `remainingFreeBuildMinutes=NOT_VERIFIED`, `billingMayApply=true`; `buildNotSubmitted=true`, `imageNotUploaded=true`, `cloudRunJobNotCreated=true`, `secretNotRead=true`.

**Causa técnica possível corrigida no código, não ainda comprovada no projeto:** a versão original do classificador não considerava o campo `serviceAccountEmail` da API `getDefaultServiceAccount`, que pode retornar um caminho `projects/{project}/serviceAccounts/{email}` em vez de um email simples. Atualizado `backend/scripts/visual-crossing-image-build-preflight-readonly.py` para identificar categorias `CLOUD_BUILD_LEGACY`, `COMPUTE_ENGINE_DEFAULT`, `USER_MANAGED_OR_CUSTOM` quando suportadas, sem divulgar a identidade. Documentação Google Cloud: https://docs.cloud.google.com/build/docs/api/reference/rest/v1/projects.locations/getDefaultServiceAccount.

**Próxima consulta:** buscar a versão corrigida do mesmo script na PR e executar somente o pré-voo de build, sem construir imagem/registrar repositório novo/mudar IAM. A confirmação da categoria da identidade não equivale a verificar as permissões efetivas de upload nem significa custo zero. Após validação do uso/cota, imagem e autorização de build, realizar qualquer build apenas no contexto mínimo do commit revisado; nenhum Cloud Run Job ou acesso real ao segredo autorizado nesta etapa.


## Evidência Cloud Shell — 20/11/2026 10h00 BRT: identidade de Cloud Build reconhecida

Após atualizar o `backend/scripts/visual-crossing-image-build-preflight-readonly.py` a titular executou novamente o script somente leitura e enviou captura das **10h00 BRT**. O diagnóstico `BLAISE_VC_BUILD_PREFLIGHT` retornou `defaultBuildIdentityType=COMPUTE_ENGINE_DEFAULT`, `cloudBuildApi=ENABLED`, `artifactRegistryApi=ENABLED`, `billing=ENABLED`, `targetRepositoryConfirmed=true`, `repositoryIamPolicyVisible=true`, `effectiveArtifactUploadPermission=NOT_VERIFIED`, `remainingFreeBuildMinutes=NOT_VERIFIED`, `billingMayApply=true`, `buildNotSubmitted=true`, `imageNotUploaded=true`, `cloudRunJobNotCreated=true`, `secretNotRead=true`. A causa do `OTHER_OR_UNRECOGNIZED` anterior era compatível com a forma do campo `serviceAccountEmail` (corrigido). **Não foi autorizada nem feita alteração IAM ou build neste passo.**

O Cloud Build padrão identificado é a conta Compute Engine default, não a conta `blaise-vc-proof` de execução do teste. Esse tipo de conta pode ter privilégios amplos e precisa ser auditado; não adicionar `Editor` nem papel Writer de projeto automaticamente. Antes de construir, comparar **somente leituras** de políticas IAM de projeto e repositório para o principal exato, incluindo indicação de condições; não confundir ausência de binding direto com ausência de acesso herdado/efetivo. Permissões de submissão do operador, logs de build, disponibilidade da franquia e custo permanecem para revisão. O vínculo temporário do segredo expira em `2026-11-21T00:14:02Z` e não deve ser renovado automaticamente.

O build precisa ser feito somente com o contexto mínimo de três arquivos (`BLAISE_VC_BUILD_PREP` previamente `PREPARED_ONLY`, commit `9096abc23b7f0a98a752ec0544e71c53864d960b`) após atestar imutabilidade do commit e permissões, e nunca enviar todo o workspace. Sem Cloud Run Job, sem leitura do segredo, sem coleta/assinantes.


## 20/11/2026 — próximo gate: auditoria IAM da identidade de construção

O diagnóstico das 10h00 identificou a identidade `COMPUTE_ENGINE_DEFAULT` como padrão do Cloud Build, mas `effectiveArtifactUploadPermission` segue `NOT_VERIFIED`. O Google Cloud recomenda revisar permissões da identidade padrão, que podem ser amplas (especialmente `roles/editor`) ou insuficientes. Não assumir acesso por tipo de conta. Foi preparado `backend/scripts/visual-crossing-build-identity-iam-readonly.py`, que consulta **somente metadados** com `gcloud builds get-default-service-account`, `gcloud projects get-iam-policy` e `gcloud artifacts repositories get-iam-policy`. Imprime **apenas contagens e indicadores de papéis diretamente visíveis para o principal exato**, sem imprimir e-mail da identidade, lista de outros membros, tokens, segredos ou política completa. Os flags `effectiveArtifactUploadPermission`, `buildInvokerActAsPermission` e `remainingFreeBuildMinutes` ficam `NOT_VERIFIED` pois IAM herdado, condições, negações, custo e autorização de submit dependem de análise independente. **Não cria nada.**

Comandos de consulta segura:
```bash
cd ~/blaise-visual-crossing-audit-20261119
git fetch origin feature/rj-meteoblue-full-recovery-admin-ui-20261118
mkdir -p ~/blaise-vc-security-check
git show FETCH_HEAD:backend/scripts/visual-crossing-build-identity-iam-readonly.py > ~/blaise-vc-security-check/visual-crossing-build-identity-iam-readonly.py
python3 ~/blaise-vc-security-check/visual-crossing-build-identity-iam-readonly.py
```

Se `projectEditorOrOwnerDirect=true`, interromper e revisar risco de privilégio excessivo antes do build (sem remover papel do serviço, pois outros sistemas podem depender dele). Se `repositoryArtifactWriterDirect=false`, **não** concluir que push falhará: pode haver concessão de projeto, herdada ou outro papel que inclua a permissão. A imagem só deve ser construída/publicada após a auditoria de origem e custos; não criar/rodar Cloud Run Job nem ler chave neste passo. Referências oficiais: https://docs.cloud.google.com/build/docs/cloud-build-service-account e https://docs.cloud.google.com/artifact-registry/docs/configure-cloud-build .


## Evidência Cloud Shell — 20/11/2026 10h10 BRT: identidade de build com privilégio amplo

A titular executou `backend/scripts/visual-crossing-build-identity-iam-readonly.py` e enviou captura das **10h10 BRT**. O resultado `BLAISE_VC_BUILD_IDENTITY_IAM` confirma:

- `state=READ_ONLY_BUILD_IDENTITY_IAM`, `defaultIdentityRecognized=true` (identidade padrão do tipo Compute Engine, proveniente de consulta anterior);
- `projectPolicyRead=true`, `projectDirectBindingCount=2`;
- **`projectEditorOrOwnerDirect=true`** — a identidade de build participa diretamente de pelo menos um vínculo `roles/editor` ou `roles/owner` **no projeto**. O relatório não distingue qual; não supor um papel específico sem leitura adicional;
- `projectArtifactWriterDirect=false`; `repositoryArtifactWriterDirect=false`, `repositoryDirectBindingCount=0`, `targetRepositoryPolicyRead=true`;
- `projectConditionalBindingCount=0`, `repositoryConditionalBindingCount=0`;
- `effectiveArtifactUploadPermission=NOT_VERIFIED`, `buildInvokerActAsPermission=NOT_VERIFIED`, `inheritedAndDenyPolicies=NOT_EVALUATED`, `remainingFreeBuildMinutes=NOT_VERIFIED`, `billingMayApply=true`;
- `noIamModified=true`, `noBuildSubmitted=true`, `noSecretRead=true`, `noCloudRunJobCreated=true`.

**Decisão técnica de segurança:** BLOQUEAR o uso da conta padrão de construção com Editor/Owner direto neste diagnóstico (risco de privilégio excessivo); não tirar esse papel automaticamente, pois dependências de outros workloads são desconhecidas. O fato de não haver escritor direto no repo **não prova impossibilidade de push**, já que o papel amplo no projeto pode incluir permissões relevantes. Não conceder Editor, Owner ou writer a nível de projeto. Não utilizar a conta isolada **de runtime** `blaise-vc-proof` como identidade de build, pois ela possui temporariamente Secret Accessor e o privilégio de build criaria uma combinação inadequada.

**Novo plano recomendado (ainda não implementado):** reservar a futura identidade **separada** `blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com` apenas para construção. Antes de criá-la, comprovar ausência na lista IAM e revisar a configuração do Cloud Build. Depois, somente com autorização explícita, conceder `roles/artifactregistry.writer` **no repositório `blaise-vc-proof` apenas** e `roles/logging.logWriter` se for selecionado `CLOUD_LOGGING_ONLY`, que é necessário com conta personalizada (documentação: https://docs.cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts e https://docs.cloud.google.com/artifact-registry/docs/configure-cloud-build). Verificar também `iam.serviceAccounts.actAs` do operador e Cloud Build invoker, sem conceder automaticamente. O build deve usar conta explícita no `cloudbuild.yaml`, contexto mínimo já preparado de 3 arquivos, somente uma imagem com commit fixo e logs revisados. **Sem criar conta, conceder roles, executar build ou enviar imagem nesta etapa.**

**Separação mantida:** a autorização para criar repositório e preparar build não autoriza conceder novos papéis nem substituir identidade padrão. Vínculo temporário `blaiseVcProof24h` permanece com expiração em `2026-11-21T00:14:02Z`; não prolongar por conveniência. Cloud Run Job, leitura da chave e coleta/publicação aos clientes seguem desligados.


## Evidência Cloud Shell — 20/11/2026 10h14 BRT: conta de build exclusiva não encontrada

A titular consultou `gcloud iam service-accounts list --project=blaise-v6-rj --format=json` com filtro local da identidade exata `blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com`. A captura das **10h14 BRT** mostra `LISTAGEM: CONCLUIDA` e `CONTA_BUILD: NAO_ENCONTRADA`. A consulta terminou com sucesso; a conta **não apareceu entre contas listadas**. Isso não autoriza criação automática nem garante ausência de entradas excluídas/identidades inacessíveis.

**Próximo gate:** obter autorização específica para criar **somente** a conta isolada `blaise-vc-build`, sem papéis IAM novos, sem chaves JSON, sem build/push, sem Cloud Run Job, sem acesso à chave Visual Crossing. Manter separados `blaise-vc-build` (construção) e `blaise-vc-proof` (futura prova de acesso ao segredo). A identidade padrão Compute Engine com vínculo direto Editor/Owner fica inalterada: não revogar/usar automaticamente. Depois da criação, revisar e solicitar autorização independente para `roles/artifactregistry.writer` **somente no repo** e para qualquer permissão de logs/actAs necessária. Nenhuma política nem infraestrutura alterada por esta consulta.

A concessão temporária de Secret Accessor à identidade `blaise-vc-proof` expira `2026-11-21T00:14:02Z` (20/11 às 21h14 BRT); **não** renovar automaticamente nem antecipar deploy por causa do prazo.


## Evidência Cloud Shell — 20/11/2026 10h17 BRT: identidade de build criada

Captura da titular às **10h17 BRT** confirma que o comando `gcloud iam service-accounts create blaise-vc-build --project=blaise-v6-rj --display-name="Blaise VC Isolated Image Builder"` foi executado com sucesso, retornando `Created service account [blaise-vc-build]` e `Service account email: blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com`.

**Estado técnico:** identidade dedicada de **build** criada, distinta de `blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com`, que é a identidade dedicada ao futuro job e detém um acesso **condicional/temporário** ao segredo. Nenhuma alteração IAM de projeto/repositório, nem acesso ao segredo, nem Docker build/push/deploy, nem Cloud Run Job é comprovada nessa captura. Uma conta nova pode estar sujeita a grants herdados; não afirmar inexistência de permissão efetiva até leitura das políticas.

**Próximo gate separado:** comprovar o e-mail da identidade criada e inspecionar, sem alterações, papéis diretos na política do repositório `blaise-vc-proof`. Se necessário, solicitar autorização específica para `roles/artifactregistry.writer` **somente no repositório** à identidade de build. Dependendo do modo Cloud Build escolhido, revisar `roles/logging.logWriter` e `iam.serviceAccounts.actAs` do invocador antes de `gcloud builds submit`; não conceder Editor/Owner, acesso ao Secret Manager ou papéis no projeto inteiro por conveniência. Não rodar job nem executar prova da versão 1. Prazo de IAM de `blaise-vc-proof`: `2026-11-21T00:14:02Z`; nunca renovar automaticamente.


## Evidência Cloud Shell — 20/11/2026 10h20 BRT: build sem Writer direto no Artifact Registry

A titular executou `gcloud artifacts repositories get-iam-policy blaise-vc-proof --project=blaise-v6-rj --location=southamerica-east1 --format=json`, filtrando localmente o principal `serviceAccount:blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com`. A captura das **10h20 BRT** confirma:

- `POLITICA_REPOSITORIO: CONSULTADA`;
- `VINCULOS_DIRETOS: 0`;
- `WRITER_DIRETO: False`.

**Interpretação:** não foi observado nenhum binding direto desse principal na política do repositório, inclusive `roles/artifactregistry.writer`. Isso **não comprova ausência de permissões efetivas** derivadas do projeto/organização, outras roles, condições ou políticas de negação. Nenhuma permissão foi concedida por esta leitura.

**Gate seguinte:** somente após autorização separada, adicionar `roles/artifactregistry.writer` a `blaise-vc-build` **na política IAM do repositório exato `blaise-vc-proof`**, nunca no projeto inteiro; verificar posteriormente por leitura. Não conceder Secret Accessor à conta de build. A conta padrão do Cloud Build, detectada com Editor/Owner direto, deve ficar intacta e não ser utilizada na imagem restrita. Revisar separadamente a necessidade de `roles/logging.logWriter` ou logs em bucket e `iam.serviceAccounts.actAs` para a conta personalizada antes do build; nenhuma permissão adicional automática. O Cloud Run Job e a leitura de Secret Manager continuam sem autorização de execução; vínculo temporal da conta `blaise-vc-proof` expira em `2026-11-21T00:14:02Z` sem renovação implícita.


## 20/11/2026 — autorização explícita para Writer apenas no repositório

A titular respondeu **“Sim”** à solicitação específica para conceder `roles/artifactregistry.writer` exclusivamente à identidade `blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com` na política do repositório Artifact Registry `blaise-vc-proof`, região `southamerica-east1`, projeto `blaise-v6-rj`. Esse consentimento **não** autoriza outros papéis, build, publicação de imagem, criação/execução de Cloud Run Job, leitura de segredo, troca da chave ou ativação meteorológica.

A operação autorizada a ser executada pela titular em Cloud Shell é:
```bash
gcloud artifacts repositories add-iam-policy-binding blaise-vc-proof \
  --project=blaise-v6-rj \
  --location=southamerica-east1 \
  --member="serviceAccount:blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```
Confirmar depois, via `gcloud artifacts repositories get-iam-policy`, **apenas** se esse vínculo aparece. `artifactregistry.writer` habilita escrita e outras ações sobre artefatos do repositório, não é permissão exclusiva de upload; revogar após a publicação autorizada se não houver necessidade operacional persistente. Antes da execução da CLI, este estado é **AUTHORIZED_NOT_APPLIED**. A CLI exigirá IAM adequado da identidade humana; se retornar `PERMISSION_DENIED`, não ampliar papéis automaticamente. Nenhum comando de Cloud Build será executado nesta autorização.


## Evidência Cloud Shell — 20/11/2026 19h51 BRT: Writer ainda não confirmado

A titular enviou captura às **19h51 BRT** de um `gcloud artifacts repositories get-iam-policy blaise-vc-proof --project=blaise-v6-rj --location=southamerica-east1 --format=json` filtrado localmente para `serviceAccount:blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com` e a role `roles/artifactregistry.writer`. Saída:
- `WRITER_REPOSITORIO: NAO_CONFIRMADO`;
- `VINCULOS: 0`.

**Interpretação restrita:** não se encontrou esse binding direto na política no momento da consulta; a captura **não mostra execução anterior** de `gcloud artifacts repositories add-iam-policy-binding`, nem revela a causa exata de ausência. A titular já autorizou explicitamente o binding restrito em 20/11/2026, e foi orientada a executar **apenas** o `add-iam-policy-binding` no repositório `blaise-vc-proof` para a conta isolada `blaise-vc-build`, seguido de nova leitura da política. **Não houve evidência de construção, publicação, Cloud Run Job ou leitura do segredo**. A conta padrão de Cloud Build e as outras fontes não devem sofrer alterações. Qualquer erro IAM deve ser analisado antes de conceder novos papéis.

A autorização anterior permanece limitada a `roles/artifactregistry.writer` no repositório indicado. O vínculo temporário separado `roles/secretmanager.secretAccessor` para `blaise-vc-proof` expira em **2026-11-21T00:14:02Z**; não renová-lo automaticamente por causa de atrasos no build.


## Evidência Cloud Shell — 20/11/2026 19h55 BRT: Writer permanece não confirmado

Captura enviada às **19h55 BRT**: o terminal mostra novamente uma consulta `gcloud artifacts repositories get-iam-policy blaise-vc-proof --project=blaise-v6-rj --location=southamerica-east1 --format=json`, filtrada para `serviceAccount:blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com` e `roles/artifactregistry.writer`, com resultados `WRITER_REPOSITORIO: NAO_CONFIRMADO` e `VINCULOS: 0`. Não aparece na captura um `add-iam-policy-binding` concluído, nem resposta de atualização IAM.

**Diagnóstico:** a política consultada não contém o vínculo Writer direto esperado; não supor que a concessão já aconteceu. A autorização específica anterior continua limitada a `roles/artifactregistry.writer` no repositório `blaise-vc-proof`. Foi reenviado **somente** o comando `gcloud artifacts repositories add-iam-policy-binding` correspondente para a titular executar no Cloud Shell e verificar a resposta antes de qualquer nova consulta. Se houver erro, não ampliar escopos nem papéis; analisar a mensagem. Não construir imagem, criar ou executar job, acessar segredo ou iniciar coleta/publicação.


## Evidência Cloud Shell — 21/11/2026 01h40 BRT: Artifact Registry Writer concedido

A titular apresentou captura do terminal às **01h40 BRT** com execução bem-sucedida de `gcloud artifacts repositories add-iam-policy-binding blaise-vc-proof --project=blaise-v6-rj --location=southamerica-east1 --member="serviceAccount:blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com" --role="roles/artifactregistry.writer"`. A saída confirma **`Updated IAM policy for repository [blaise-vc-proof]`**, e exibe binding `serviceAccount:blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com` sob `roles/artifactregistry.writer`.

**Escopo autorizado aplicado:** escrita no repositório isolado, sem grant no projeto inteiro; captura não demonstra criação ou execução de Cloud Build, upload de imagem, acesso a valor do segredo ou Cloud Run Job. A conta de build mantém-se distinta da conta `blaise-vc-proof` de diagnóstico. Concessão Artifact Registry Writer é mais ampla que upload puro: após publicação aprovada, avaliar sua remoção sem afetar terceiros.

**Ponto de segurança temporal:** o binding `roles/secretmanager.secretAccessor` condicional da conta `blaise-vc-proof` tinha expressão `request.time < timestamp('2026-11-21T00:14:02Z')`, ou seja, prazo encerrado em 20/11/2026 às 21h14 BRT; **não** está autorizando acesso por esse vínculo após o vencimento, embora permaneça na política até remoção explícita. Qualquer futura execução de prova exigirá nova aprovação **separada** e uma nova condição temporal, sem automatizar renovação.

**Próximo passo:** verificar somente metadados/autorizações para Cloud Build com identidade personalizada `blaise-vc-build`, em especial `iam.serviceAccounts.actAs`, escolha de logs (`CLOUD_LOGGING_ONLY` demanda escritor de logs ou alternativa segura) e consumo/custo, antes de submeter build limitado aos três arquivos do contexto `BLAISE_VC_BUILD_PREP`. Não usar a identidade padrão com vínculo Editor/Owner. Sem novo IAM, build, deploy, job ou chamada meteorológica nesta confirmação.


## Evidência Cloud Shell — 21/11/2026 01h43 BRT: permissões de execução e logs ainda inconclusivas

A titular apresentou captura da saída de consulta IAM somente leitura às **01h43 BRT**. Resultados:

- `POLITICA_CONTA: CONSULTADA` da conta `blaise-vc-build@blaise-v6-rj.iam.gserviceaccount.com`;
- `POLITICA_PROJETO: CONSULTADA` do `blaise-v6-rj`;
- `VINCULOS_SERVICE_ACCOUNT_USER: 0` **na política da própria conta de serviço**: o filtro contou bindings com papel `roles/iam.serviceAccountUser` **sem determinar quem é membro**; não prova ausência de permissão `iam.serviceAccounts.actAs` proveniente de projeto/organização ou outros papéis;
- `BUILDER_LOG_WRITER_DIRETO: False` **no IAM do projeto** para a conta de build; não exclui grants por pasta/organização/outros papéis;
- `PERMISSOES_EFETIVAS: NAO_VERIFICADAS`.

**Risco**: build com conta personalizada precisa que **o operador que submete** tenha `iam.serviceAccounts.actAs`; quando usa `CLOUD_LOGGING_ONLY`, a identidade de build precisa poder gravar logs (em geral `roles/logging.logWriter`). Alternativamente, logs podem usar bucket GCS com permissões estreitas e custos adicionais. Documentação oficial: https://docs.cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts.

**Decisão:** não iniciar Cloud Build, não conceder `roles/iam.serviceAccountUser`/logWriter automaticamente ou no projeto inteiro, não reusar identidade Compute Engine default Editor/Owner. Continuar com filtro somente leitura para permissões explícitas do **operador atualmente autenticado** e da identidade de build nas políticas de projeto; não imprimir e-mails da política nem tokens. Depois solicitar consentimento específico para eventuais grants mínimos necessários. Repositório `blaise-vc-proof` com `roles/artifactregistry.writer` para `blaise-vc-build` permanece confirmado, mas isso isoladamente não libera build. IAM temporário `blaiseVcProof24h` da conta de teste **expirou**; não renovar sem consentimento. Sem imagem publicada, Cloud Run Job, execução da prova ou coleta/publicação de clientes.
