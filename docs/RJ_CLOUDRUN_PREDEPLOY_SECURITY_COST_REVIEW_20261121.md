# Blaise V6 RJ — auditoria de segurança, inicialização e custos antes de criar revisão

**21/11/2026. Estado: BLOCKED_FOR_REAL_DEPLOY_PENDING_REVIEW.** Escopo: PR #173, Cloud Run `blaise-v6-rj-backend`, projeto `blaise-v6-rj`, região `southamerica-east1`. Revisão somente documental, de código e de metadados. **Não criar revisão, fazer deploy, habilitar chave, alterar IAM, mudar tag/tráfego ou consultar fornecedor meteorológico nesta etapa.**

## Evidência comprovada no Cloud Shell (capturas da titular)

- Às **10h31**, distribuição de tráfego normal: `00031-vep=99%`, `00038-pin=1%`, total 100%; a revisão candidata `owv2-211126` **não existia**.
- Às **10h33**, preflight somente leitura: `PREFLIGHT_PASS_CANDIDATE_NOT_CREATED`; imagem digest prevista, OpenWeather v2, 8 flags OFF, mínimo histórico 1, template atual 1, futura candidata 0, sem alteração de mínimo global, sem health check de implantação, nenhuma criação.
- `00043-hjk`: nova em tempo, motivo `Retired`, sem tráfego; modelo corrente de Cloud Run referencia OpenWeather Secret Manager **v2 habilitada**.
- `00058-sos`: revisão histórica 0% com **tag `validacao-rj`** e **minScale 1**; `Ready=True` não é prova de HTTP (as chamadas isoladas a `/health` e `/readyz` haviam retornado HTTP 500). Seu vínculo OpenWeather v1 está desabilitado. `MinInstancesProvisioned=True` foi observado no status.

## Revisão de impacto (não inferir comportamento não comprovado)

| Área | Dado / hipótese | Risco | Ação segura |
|---|---|---|---|
| Template de serviço existente | Um novo `gcloud run deploy` cria revisão imutável **e atualiza o template do mesmo serviço** | Mudanças podem afetar futuras implantações, automações e roteamento `LATEST`, ainda que `--no-traffic` evite tráfego na candidata | Preservar 99/1, proibir tráfego `LATEST`, comparar spec/status antes/depois e não executar sem análise de diffs |
| Inicialização da futura candidata | Planejada com `--min-instances=0`, `--no-traffic`, sem tag, `--no-deploy-health-check` | Evita a inicialização **específica da checagem de implantação** e o aquecimento por mínimo, mas **não comprova saúde HTTP, ausência de chamadas incondicionais no código ou custo total zero** | Testes offline antes, nenhum smoke real sem plano de isolamento de egress aprovado |
| Coletor na imagem | No `src/runtime.mjs`, `sourceWorker.start()` só ativa polling se `sourceWorkerConfig.enabled`; `loadOfficialSourceWorkerConfig` usa `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED` e inicia tarefas imediatamente quando true | Desligar o worker reduz risco, mas outros SDKs e inicializadores podem executar acesso externo; a imagem digest implantada pode diferir dos fontes da PR | Não inferir zero chamadas meteorológicas apenas de 8 flags; revisar imagem digest e fluxos de inicialização |
| Revisão histórica com tag | `00058-sos` tem tag e mínimo 1; status reportou mínimo provisionado | **Exposição atual de faturamento por instância mantida ativa mesmo com 0% do tráfego normal** | Auditar modo de cobrança e uso em Billing/Monitoring; não excluir tag, revisão nem zerar histórico sem autorização |
| Tipo de faturamento | Ainda sem dado autenticado sobre CPU throttling/request-based versus instance-based da revisão histórica | Valores financeiros impossíveis de estimar precisamente | Consultar metadados de faturamento e uso real, sem tocar chaves |
| Tag e acesso público | `validacao-rj` é endereçável por tag, independentemente do % de tráfego normal; acesso exige verificar IAM/ingress | **Possível** exposição/ataque à rota problemática (não é prova de acesso público) | Auditar permissões e políticas de ingresso; não divulgar URL nem desativar recursos agora |
| Segurança de credencial | OpenWeather v2 habilitada e binding do template atual, mas acesso real da nova instância e validade da chave no fornecedor não foram testados | Teste de startup pode falhar independentemente das flags meteorológicas | Sem leitura de segredo nem chamadas OpenWeather nesta etapa |
| Política de release | Cloud Shell já havia bloqueado tentativa anterior e nenhum deploy foi feito; PR #173 continua Draft | Um comando futuro mal configurado pode alterar o serviço real | Manter bloqueio físico e solicitar plano de implantação separado com controle de custos |

**Atenção especial ao custo histórico:** os mínimos de revisão e a tag da `00058-sos` podem manter instâncias faturáveis mesmo sem clientes, como descreve o Google Cloud. **Não concluir uma cobrança específica nem um valor em R$ sem Cloud Billing/Monitoring; não atribuir esse custo à candidata, ainda inexistente.**

## O que foi fortalecido na PR #173

1. `backend/scripts/rj-openweather-v2-zero-traffic-candidate.mjs` continua somente leitura. O trecho executável de `gcloud run deploy` foi **fisicamente removido**; `--execute-approved-zero-traffic` retorna `REAL_DEPLOY_PAUSED_FOR_SEPARATE_REVIEW`. Um novo deploy futuro exigirá uma ferramenta distinta aprovada separadamente.
2. `backend/src/rj-cloudrun-predeploy-impact-audit.mjs` audita apenas metadados fornecidos; identifica diferença entre template e revisão, tag/mínimo histórico, tráfego normal, modo de faturamento aparente (se explícito) e questões ainda não verificadas. Retorna **sempre** `BLOCKED_FOR_REAL_DEPLOY_PENDING_REVIEW`.
3. `backend/scripts/rj-cloudrun-predeploy-impact-readonly.mjs`, por padrão, **offline**. Com `--cloud-readonly`, acessa somente `gcloud projects describe`, `gcloud run services describe` e duas `gcloud run revisions describe`. Não lê segredo, IAM completo, URL de serviço ou contas de faturamento; não exibe valores brutos das variáveis de ambiente.
4. Os testes em `backend/test/rj-cloudrun-predeploy-impact-audit.test.mjs` exercitam custo potencial por revisão histórica tagueada, modos de faturamento desconhecidos, desvios de tráfego e ausência de homologação de startup. A CI exige esses testes e mantém o release de novas fontes bloqueado.

### Comando para a próxima coleta read-only no Cloud Shell

Use a cópia atualizada da PR #173 em uma worktree independente, sem sobrescrever `~/Blaise-RJ` nem as worktrees anteriores. Depois, dentro de `backend`:

```bash
set +x
node --test test/rj-cloudrun-predeploy-impact-audit.test.mjs
node scripts/rj-cloudrun-predeploy-impact-readonly.mjs --cloud-readonly
```

A saída tem prefixo `RJ_CLOUDRUN_PREDEPLOY_SAFETY=`; compartilhar apenas esse relatório resumido. O status **continua bloqueado por design**, mesmo com `productionTrafficExactly99_1=true`.

## Decisão e alternativas de arquitetura

- **Manter bloqueado o deploy no serviço dos clientes.** Não é possível garantir custo zero nem segurança de startup apenas com mínimo 0.
- Uma alternativa a analisar em fase posterior é **um serviço de homologação separado**, com autenticação obrigatória, egress restringido, mínimo 0 e faturamento monitorado. Isso cria um novo recurso e **não está autorizado nesta etapa**; também precisa de orçamento e revisão de risco.
- Antes de qualquer operação real, exigimos avaliação do modo de faturamento **efetivo**, valor real e histórico de instâncias, política de ingresso/IAM de tags, limites máximos de instância e comparação de todo o template. Nunca reutilizar a revisão `Retired` como evidência de aplicativo saudável.

## Referências oficiais

- Instâncias mínimas no nível de serviço/revisão e cobrança de revisões com tag: https://docs.cloud.google.com/run/docs/configuring/min-instances
- `--no-deploy-health-check` evita a instância de verificação de startup na implantação: https://docs.cloud.google.com/run/docs/deploying
- Configuração request-based versus instance-based: https://docs.cloud.google.com/run/docs/configuring/billing-settings
- Revisões imutáveis e template: https://docs.cloud.google.com/run/docs/managing/revisions
- `--no-traffic` e migração de LATEST: https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy
- Preços e modelo de cobrança: https://cloud.google.com/run/pricing

**Nenhum deploy, merge, mudança de tráfego, segredo ou consulta ao fornecedor meteorológico foi realizado por esta revisão da PR #173.**


## Evidência operacional de cobrança por instância — 21/11/2026, 10h50 BRT

A titular executou a auditoria somente leitura `rj-cloudrun-predeploy-impact-readonly.mjs --cloud-readonly` e forneceu a captura dos oito campos em 21/11/2026 às 10h50 BRT. A saída mostrou:

```text
status: BLOCKED_FOR_REAL_DEPLOY_PENDING_REVIEW
productionTrafficExactly99_1: True
historicalRevisionHasTag: True
minimumInstancesHistorical: 1
billingModeHistorical: INSTANCE_BASED
billingModeCurrentTemplate: INSTANCE_BASED
historicTagCostExposure: True
createdNewRevision: False
```

**Conclusão de segurança/custo:** o modo instance-based da revisão histórica e do template atual foi identificado nos metadados. A revisão `00058-sos` tem tag, mínimo 1 e 0% de tráfego normal, portanto **há risco concreto de cobrança contínua** por uma instância sem requisições. Segundo a documentação oficial, no modo instance-based cobra-se durante a vida da instância. Isso **NÃO comprova o valor líquido realmente cobrado nem identifica a parcela por revisão**, pois não consultamos Cloud Billing, créditos promocionais, descontos nem métricas de uso.

**Política de segurança vigente:** não remover a tag, não alterar mínimo de instância da `00058-sos`, não alterar tipo de faturamento do serviço, não executar `gcloud run deploy`, não criar nova candidata, não alterar tráfego 99%/1%, não ler segredos e não consultar meteorologia. Qualquer ajuste de custo de produção exigirá autorização específica após avaliação do impacto de acesso da revisão histórica e do orçamento. **Próxima etapa: somente consultar os valores reais no Google Cloud Billing Reports**, filtrando projeto `blaise-v6-rj`, serviço `Cloud Run` e intervalo recente, e distinguir uso bruto, créditos e custo líquido. Os custos podem ter defasagem na consolidação dos relatórios.

Referências: https://docs.cloud.google.com/run/docs/configuring/billing-settings ; https://docs.cloud.google.com/run/docs/configuring/min-instances ; https://docs.cloud.google.com/billing/docs/how-to/reports .


## Relatório de faturamento real — 21/11/2026, 10h56 BRT

A titular enviou duas capturas do **Google Cloud Billing > Relatórios** às 10h56 BRT. O painel mostra, para o período indicado **1–21/11/2026**, custo de uso por serviço: **Cloud Run R$ 661,25**, **Cloud Build R$ 1,50**, **Cloud Storage R$ 0,03**. Total líquido exibido na página: **R$ 0,00**, com aproximadamente **R$ 662,77 de economia** aplicada no período (o total arredondado dos SKUs e o valor da economia podem diferir por centavos). A previsão do mesmo painel para 1–30/11/2026 mostra líquido R$ 0,00 e economias previstas ~R$ 856,67, **não é garantia de custo futuro zero**.

**Limites críticos:** os prints mostram serviço agregado, não evidenciam filtro aplicado exclusivamente ao projeto `blaise-v6-rj`, não trazem SKU Cloud Run, instância/revisão nem categoria CPU/memória. Logo os **R$ 661,25 não podem ser atribuídos diretamente** à revisão `00058-sos` ou ao próprio projeto sem consultar filtros. O modo `INSTANCE_BASED`, tag ativa e minScale 1 são sinais de exposição financeira, mas o valor proporcional dessa revisão **não está quantificado**. O líquido zero do período não garante cobertura de créditos futuros; confirmação do tipo/duração de economias e créditos exige consulta específica, sem alteração de faturamento.

**Próxima leitura recomendada no próprio console:** Relatórios → selecionar **Projeto blaise-v6-rj** → **Serviço Cloud Run** → **Agrupar por SKU**, primeiro período 1–21/11 e depois últimos 7 dias. Capturar nome da SKU, valor bruto e economia/crédito, omitindo ID de conta e informações pessoais. A documentação oficial confirma que reports por SKU permitem identificar componentes de uso: https://docs.cloud.google.com/billing/docs/how-to/reports.

**Bloqueios mantidos:** nenhum deploy, alteração de tag, minScale, tráfego 99/1, credencial, conta de faturamento ou consulta meteorológica.
