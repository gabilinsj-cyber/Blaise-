# Blaise V6 RJ — Visual Crossing Free / Secret Manager → coletor (somente preparação)

**Data:** 19/11/2026. **Estado:** `PREPARED_OFFLINE_NOT_APPLIED`. **PR:** #173 draft; nenhum merge/deploy nem modificação de IAM, tráfego, coletores ou aplicação.

## Evidências existentes e limitações

- O serviço Cloud Run existente é `blaise-v6-rj-backend`, com identidade `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`.
- A inspeção detalhada do Cloud Run às 18h29 retornou `anySecretReferenceCount=3`, `explicitSecretReferenceIdentified=false` para `blaise-visual-crossing-free-api-key`, `inlineVisualCrossingKeyEnvPresent=false`, `visualCrossingEnvFlagNameCount=0`. Esses são **metadados** e não revelam os outros três segredos.
- A conta de serviço do backend não tinha `roles/secretmanager.secretAccessor` explícito nas políticas diretas consultadas; os vínculos herdados consultados tampouco mostraram concessões explícitas a essa identidade. Isso **não estabelece** acesso efetivo concedido ou negado.
- A tentativa de impersonação do Cloud Shell retornou `SERVICE_ACCOUNT_IMPERSONATION_UNAVAILABLE`, não um diagnóstico válido de acesso ao segredo. Não conceder Token Creator para contornar esse teste.
- `backend/src/rj-visual-crossing-free-private.mjs` já usa `env.BLAISE_VISUAL_CROSSING_FREE_API_KEY` apenas em execução **privada, manual e com gates**. `backend/src/rj-visual-crossing-free-92-collector.mjs` usa um nome distinto de ambiente e exige aprovação, controle de saldo e substituição da chave anteriormente exposta. Esta PR não altera esses contratos e **não liga o segundo coletor**.
- `backend/src/runtime.mjs` tem leitores de cache opcionais, mas **não inicializa** os coletores Visual Crossing no startup e **não habilita** cron, Cloud Scheduler nem publicação.
- A titular decidiu manter por ora a chave Visual Crossing anteriormente exibida em captura. Ela não será alterada nesta preparação. **Persistência de risco:** uma chave já exposta não deve ser considerada segura por estar no Secret Manager. A chave não deve ser publicada nem usada para autorizar rollout de 92 cidades sem decisão de risco posterior.

## Configuração proposta (NÃO APLICADA)

| Item | Proposta |
|---|---|
| Projeto | `blaise-v6-rj` |
| Serviço-alvo futuro (exige decisão de arquitetura) | `blaise-v6-rj-backend` |
| Identidade existente | `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com` |
| Segredo | `blaise-visual-crossing-free-api-key` |
| Versão planejada | `1` (fixa; revalidar se ainda ativa antes de qualquer deploy) |
| Variável usada no coletor privado | `BLAISE_VISUAL_CROSSING_FREE_API_KEY` |
| Cloud Run | Adição **incremental** da referência `--update-secrets`, **nunca `--set-secrets`** (não apagar as outras 3 referências) |
| IAM, se autorizado posteriormente | `roles/secretmanager.secretAccessor` **somente no recurso desse segredo**, vinculada **somente à identidade do workload realmente aprovado** |
| Não conceder | `roles/secretmanager.admin`, `roles/owner`, `roles/editor`, `roles/iam.serviceAccountTokenCreator`, escopo projeto/organização |
| Coleta privada / 92 cidades / publicação | Todas desativadas |
| Exposição de chave no CI, APK, navegador, logs, GitHub, comando ou stdout | Proibida |

A opção de longo prazo preferível, se a coleta passar a operar separadamente, é **identidade dedicada a um coletor isolado**, reduzindo o alcance de uma eventual credencial comprometida. Esta PR não cria uma nova conta, serviço ou job, e não concede acesso ao backend geral.

Em Cloud Run, a referência a um segredo como variável de ambiente é resolvida na inicialização da instância. O Google recomenda fixar a versão da variável em vez de `latest`; se a identidade não puder acessar o segredo, a nova instância poderá **falhar na inicialização**. Portanto, **não testar no tráfego ativo**, não editar o serviço ainda e revisar um procedimento de revisão sem tráfego/rollback em outra mudança aprovada.

### Comandos ilustrativos reservados para uma mudança futura, *NÃO EXECUTAR AGORA*

Abaixo está o formato que precisaria de aprovação explícita, revisão de IAM, versão, região, ausência de colisão do nome da variável e plano de revisão sem tráfego. **Estes comandos são exemplos de mudança de produção; não fazem parte dos testes desta PR.**

```bash
# NÃO EXECUTAR SEM AUTORIZAÇÃO ESPECÍFICA DE IAM E DEPLOY:
# gcloud secrets add-iam-policy-binding blaise-visual-crossing-free-api-key \
#   --project=blaise-v6-rj \
#   --member=serviceAccount:blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com \
#   --role=roles/secretmanager.secretAccessor
#
# NÃO EXECUTAR: a operação cria uma nova revisão do serviço:
# gcloud run services update blaise-v6-rj-backend \
#   --project=blaise-v6-rj --region=REGIAO_REAL_VERIFICADA \
#   --update-secrets=BLAISE_VISUAL_CROSSING_FREE_API_KEY=blaise-visual-crossing-free-api-key:1
```

Em particular, o modo `--update-secrets` é *acrescentar/atualizar* e não o modo substitutivo `--set-secrets`. Uma configuração alterada também criaria nova revisão Cloud Run, que exige avaliação de tráfego; o modelo acima **não** é um procedimento de ativação pronto para uso.

## Pré-requisitos obrigatórios para uma etapa separada de implantação

1. Aprovação específica de risco da chave exposta/rotação, escopo, uso comercial/licença, dados cobrados pelo fornecedor e saldo atual; não aprovar uso da versão exposta apenas com testes de código.
2. Escolha explícita da identidade **isolada do coletor** ou justificativa do uso do backend principal; definição da região/revisão e revisão dos 3 segredos já presentes.
3. Confirmação de acesso **efetivo** ao segredo para a identidade aprovada, sem expor o conteúdo. Nenhuma política IAM é alterada nesta PR.
4. Revisão de permissão mínima **no segredo apenas**, flags de coleta desligadas, nenhuma rota de clientes, orçamento Firestore atômico e limites diários aprovados.
5. Teste sem tráfego e observabilidade sem logs de URLs/segredos; rollback para revisão anterior, com parada/sem cron de fornecedor; aprovação humana de deploy independente.
6. Não usar dados de previsão agregados (E/P) como medição de estação (O), sem rastreabilidade, data de validade e atribuição Visual Crossing.

## Resultado verificável imediatamente, sem Cloud Shell, segredos ou créditos

```bash
node backend/scripts/visual-crossing-secret-wiring-dryrun.mjs
node --test backend/test/rj-visual-crossing-secret-wiring-plan.test.mjs
```

Saída do plano: `BLAISE_VC_SECRET_WIRING_DRYRUN=` com `state=PREPARED_OFFLINE_NOT_APPLIED`, `releaseApproved=false`, `iamModified=false`, `deployExecuted=false`, `weatherApiCalled=false`, `sourceApiKeyValueIncluded=false`. Esse dry-run **não** consulta o GCP nem prova acesso ao segredo.

**Fontes oficiais:** Google Cloud, [Configure secrets for services](https://docs.cloud.google.com/run/docs/configuring/services/secrets) e [Secret Manager access control / least privilege](https://docs.cloud.google.com/secret-manager/docs/access-control).


## 19/11/2026 — decisão de risco e prova de acesso sem divulgação da chave

**Decisão de segurança (não é autorização de deploy):** a credencial Visual Crossing foi exibida anteriormente em captura; tratar como **EXPOSTA / ALTO RISCO**. A Visual Crossing recomenda **substituição imediata** se houver suspeita de exposição, conforme [How Your Data Is Used](https://www.visualcrossing.com/resources/documentation/weather-api/how-your-data-is-used-within-visual-crossing/) e [How to Change your API Key](https://www.visualcrossing.com/resources/documentation/weather-api/how-to-change-your-visual-crossing-weather-api-key/). A titular optou por **mantê-la**, e essa decisão será respeitada: **não rotacionar nem excluir a versão existente** nesta PR, mas **não usar a chave exposta como aprovação de produção, escala 92 cidades ou publicação para assinantes**. O gate `BLAISE_VC_KEY_ROTATED_AFTER_EXPOSURE` continua exigindo `true` para qualquer coleta futura 92 cidades, e nenhuma flag foi ligada. Secret Manager não desfaz comprometimento anterior do valor.

**Prova de acesso efetivo hoje:** `NOT_VERIFIED`. As listagens de IAM do segredo/projeto/ancestrais não apontaram vínculos `roles/secretmanager.secretAccessor` explícitos para a conta `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com` nos escopos consultados. Três vínculos condicionais visíveis envolvem **outras** contas de serviço. A tentativa de impersonação do Cloud Shell falhou. A revisão Cloud Run não tinha referência explícita à Visual Crossing. Nenhuma dessas observações equivale a um teste real `AccessSecretVersion` executado sob a identidade do runtime.

### Evidência histórica opcional sem mudar recursos

`backend/scripts/visual-crossing-access-history-readonly.py` faz **somente duas leituras** (a partir de Cloud Shell):

1. `gcloud secrets versions describe 1 --secret=blaise-visual-crossing-free-api-key --project=blaise-v6-rj --format=json` — estado/metadados, nunca valor.
2. `gcloud logging read` filtrado para `secretmanager.googleapis.com`, `AccessSecretVersion`, a conta exata de Cloud Run e o segredo exato, últimos 30 dias (até 50 ocorrências). **Só imprime contagem e horário do último sucesso**, não nomes de outras contas, payloads, URLs com chave ou entradas completas.

Saída única `BLAISE_VC_ACCESS_EVIDENCE_READONLY=`. Se o log não estiver disponível/desabilitado, mantém **`effectiveAccessNow=NOT_VERIFIED`**. Mesmo um sucesso histórico não comprova que o IAM **atual** ainda permite acesso. O Audit Logging de `AccessSecretVersion` é classificado como `DATA_READ` e pode não estar habilitado por padrão ([Secret Manager audit logging](https://docs.cloud.google.com/secret-manager/docs/audit-logging); [Configure data access audit logs](https://docs.cloud.google.com/logging/docs/audit/configure-data-access)). **Não habilitar logs nem novas APIs apenas para essa verificação.**

Comandos seguros:

```bash
cd ~/blaise-visual-crossing-audit-20261119
git fetch origin feature/rj-meteoblue-full-recovery-admin-ui-20261118
mkdir -p ~/blaise-vc-security-check
git show FETCH_HEAD:backend/scripts/visual-crossing-access-history-readonly.py > ~/blaise-vc-security-check/visual-crossing-access-history-readonly.py
python3 ~/blaise-vc-security-check/visual-crossing-access-history-readonly.py
```

### Prova operacional de acesso à versão — preparada, NÃO executada

`backend/src/rj-visual-crossing-runtime-secret-proof.mjs` + `backend/scripts/visual-crossing-runtime-secret-proof.mjs` são isolados do servidor e agendadores. Para um **workload Cloud Run temporário, privado, sem tráfego de cliente e aprovado separadamente**, o diagnóstico:

- exige a flag `BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED=true` **e** indicador de runtime Cloud Run; por padrão retorna `EXPLICIT_APPROVAL_AND_CLOUD_RUN_REQUIRED`;
- consulta o **metadata server** para obter o e-mail da conta real e verificar correspondência exata com a identidade autorizada; divergência bloqueia;
- usa o token efêmero recebido do metadata server apenas em memória e chama **uma vez** `GET /v1/projects/blaise-v6-rj/secrets/blaise-visual-crossing-free-api-key/versions/1:access` por HTTPS;
- **não lê, decodifica, imprime, armazena nem gera hash do corpo da resposta** (que contém o valor do segredo). Cancela imediatamente o fluxo de bytes; o processo não contacta a Visual Crossing;
- produz apenas `VERSION_ACCESS_GRANTED_AT_TIME` se o Secret Manager responde **200**, `VERSION_ACCESS_DENIED_AT_TIME` se **401/403**, ou estado inconclusivo se houver falha; **nenhum resultado aprova o release**.
- não é importado pelo `backend/src/runtime.mjs` nem exposto via HTTP, cron, aplicativo, CI com credencial ou deploy automático.

Uma chamada de `AccessSecretVersion`, mesmo descartando o corpo, **é acesso real ao segredo**; por isso **não pode ser feita sob a credencial do usuário no Cloud Shell** nem sem identidade de serviço aprovada, privilégio mínimo, custo previsto do workload e autorização específica de alteração de infraestrutura. Também pode gerar registro de auditoria se configurado. O teste usa a mesma conta proposta, mas *não substitui* validar a configuração de segredos de uma revisão final no Cloud Run; IAM Conditions podem variar conforme contexto.

### Barreiras finais antes de qualquer aplicação

**Não autorizado nesta conversa:** criar conta de serviço/job, conceder `roles/secretmanager.secretAccessor`, impersonar uma conta via Token Creator, atualizar variáveis/referências de segredos, habilitar APIs/audit logs, criar revisão ou executar um teste de acesso real em produção.

Propostas futuras sujeitas a **consentimento explícito e separado**:

1. Revisar/rotacionar a chave exposta com a titular (mantê-la impede a classificação da configuração como segura para produção; o plano Free é preservado se o fornecedor permitir trocar a chave da mesma conta).
2. Aprovar a identidade do serviço de diagnóstico ou do coletor isolado, evitando conceder acesso irrestrito ao backend principal. Se for absolutamente necessário usar a conta principal, justificar e restringir a role ao segredo `blaise-visual-crossing-free-api-key`.
3. Conceder **apenas** `roles/secretmanager.secretAccessor` no recurso do segredo após aprovação de IAM e sem aumentar privilégios do projeto.
4. Aprovar separadamente criação de workload privado/sem tráfego, execução da prova de versão, custos e plano de rollback; nenhuma chamada à Visual Crossing, sem novos créditos meteorológicos.
5. Aprovar eventual alteração da revisão Cloud Run e, separadamente, habilitação de consultas/92 municípios/publicação. A interface fica sem Visual Crossing ativo até passar todos os gates.

**Status do merge e produção:** `PR_DRAFT`, `IAM_NOT_MODIFIED`, `CLOUD_RUN_NOT_UPDATED`, `PROBE_NOT_RUN`, `KEY_NOT_ROTATED`, `COLLECTION_OFF`, `CLIENT_PUBLISHING_OFF`.


## Resultado CI de 19/11/2026 após preparação da prova de identidade

No commit `9c4f2dbb004489791d4c63eb7283837b239463e1`, a workflow de GitHub Actions **RJ Visual Crossing Free zero-credential offline security gate** (run `44637047559`) terminou `success`. Os logs mostram **57 testes Node, 57 pass, 0 fail**, além de quatro suítes de Python com **4 testes cada**, incluindo a consulta histórica (sem acessar o GCP durante os testes); total das quatro suítes Python: **16 testes**. São somente casos offline com mocks/dados sintéticos, não há evidência de `secretmanager.versions.access` real. O projeto de produção, segredos e contas IAM não foram alterados por esse CI.
