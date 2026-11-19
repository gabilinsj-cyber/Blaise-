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
