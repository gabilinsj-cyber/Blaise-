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
