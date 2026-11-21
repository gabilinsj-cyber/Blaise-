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


## Auditoria de acesso externo / IAM — 21/11/2026, 11h26 BRT

Consulta somente leitura no Cloud Shell, captura às 11h26 BRT:

```text
INGRESS: all
INVOCADOR_IAM_DESATIVADO: NAO_INFORMADO
REVISAO_58_TEM_TAG: True
ALL_USERS_INVOCADOR: True
ALL_AUTHENTICATED_INVOCADOR: False
AUDITORIA: SOMENTE_LEITURA
```

**Achado de segurança:** o serviço aceita ingresso externo (`all`) e a política de invocação contém `roles/run.invoker` para `allUsers`. A revisão histórica `00058-sos` mantém tag com 0% de tráfego normal. Em condições normais de URL de tag habilitada, isso **permite invocação externa sem autenticação IAM do Cloud Run**, ainda que uma rota possa ter controle de autenticação implementado no aplicativo. Não há prova de exploração, nem de todas as rotas serem públicas. `run.googleapis.com/invoker-iam-disabled` não foi informado no campo consultado e não deve ser inferido. Não imprimir URL da tag ou credenciais.

**Risco cruzado:** a revisão com tag já havia retornado HTTP 500 e usa segredo OpenWeather v1 desabilitado. Tag + acesso público + `minScale=1` + billing `INSTANCE_BASED` combina risco operacional e de custos. A ausência de tráfego normal NÃO prova ausência de solicitações pela tag.

**Não modificar** `allUsers`, ingresso global, minScale, tags ou IAM sem avaliação específica, pois o serviço também atende clientes (99%/1%). Próxima auditoria deve apenas verificar se a URL padrão de revisão/tag está habilitada e se há registros por revisão, sem produzir chamadas HTTP nem alterar o serviço. A candidata futura NÃO foi criada.

Referências: https://docs.cloud.google.com/run/docs/securing/managing-access ; https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration ; https://docs.cloud.google.com/run/docs/securing/ingress .


## Confirmação de URL por tag — 21/11/2026, 11h29 BRT

A titular executou consulta somente leitura ao status do Cloud Run via `gcloud run services describe`, resumindo apenas os campos booleanos, sem publicar a URL. Captura às **11h29 BRT**:

```text
REVISAO_58_IDENTIFICADA: True
TAG_PRESENTE: True
URL_TAG_DISPONIVEL: True
TRAFEGO_NORMAL: 0
AUDITORIA: SOMENTE_LEITURA
```

**Conclusão:** a revisão histórica `00058-sos` está associada a uma tag e tem URL de tag disponível com 0% do tráfego normal; o serviço tem `ingress=all` e `allUsers` autorizado a invocar, conforme auditoria das 11h26. Isso indica possibilidade de acesso externo direto à revisão por tag, sem prova de exploração nem de ausência de autenticação dentro do app. A revisão já apresentou HTTP 500 e apresenta minScale 1 / billing instance-based, criando riscos operacionais e financeiros separados da candidata futura.

**Próxima etapa sem mutação:** ler apenas logs de requisições HTTP por `resource.labels.revision_name=blaise-v6-rj-backend-00058-sos` e período das últimas 24h, produzindo exclusivamente contagens por status, sem exibir URLs, IPs, tokens, payloads ou identidades. Não fazer novas chamadas HTTP à tag ou a APIs meteorológicas, não mudar permissões compartilhadas com clientes, não desativar tags ou serviço, não implantar a PR #173. Ausência de logs não é prova de ausência de acessos caso logging esteja indisponível/limitado.


## Logs de requisições à revisão tagueada — 21/11/2026, 11h46 BRT

A titular executou no Cloud Shell, sem chamadas HTTP externas, uma consulta **somente leitura** no Cloud Logging com filtro da revisão `blaise-v6-rj-backend-00058-sos`, `logName=run.googleapis.com%2Frequests`, horizonte de 24 horas e limite 1.000. Captura às 11h46 BRT mostra:

```text
REGISTROS_RETORNADOS: 3
HTTP_2XX: 0
HTTP_4XX: 0
HTTP_5XX: 3
SEM_STATUS: 0
LIMITE_DA_CONSULTA: 1000
AUDITORIA: SOMENTE_LEITURA
```

**Interpretação:** os três registros de requisição recuperados para essa revisão tiveram status HTTP 5xx; esses dados são compatíveis com as falhas de `/health` e `/readyz` já observadas nos testes anteriores. **Não comprovam origem externa maliciosa, comprometimento, exposição de dados ou causa técnica do 500.** Não temos ainda correlação por horário nem mensagens do container sobre `startup_failed`, segredo v1, permissões ou falha de dependências. Também não devemos confundir o total recuperado na janela de 24h com uma contagem histórica de todos os acessos.

**Próxima ação:** somente análise agregada dos timestamps e dos logs de erro/instância da revisão sem exibir IPs, URLs, payloads, chaves, principal ou tokens. Não chamar a tag, não executar deploy, não remover IAM/allUsers nem alterar serviço/instâncias ou chave. A candidata segue inexistente.

## Horários dos HTTP 500 e ausência de logs ERROR — 21/11/2026, 11h49 BRT

Auditoria somente leitura da titular, filtrando revisão `blaise-v6-rj-backend-00058-sos`, horizonte de 24h, via Cloud Logging. Captura das 11h49 BRT:

```text
REQUISICOES: 3
REQ 1 UTC: 2026-11-21T11:14 HTTP: 500
REQ 2 UTC: 2026-11-21T11:26 HTTP: 500
REQ 3 UTC: 2026-11-21T11:26 HTTP: 500
REGISTROS_ERRO_CONTAINER: 0
AUDITORIA: SOMENTE_LEITURA
DEPLOY: NAO_EXECUTADO
```

As requisições correspondem aproximadamente a **08h14 e 08h26 BRT**, horários compatíveis com testes já realizados pelo usuário. Correspondência temporal **não prova identidade/origem**; não afirmar invasão. O contador de erros de contêiner é referente a `severity>=ERROR` excluindo o log de requisições; **não significa que stdout/stderr/system estejam vazios**, que não houve startup failure ou que o segredo v1 desabilitado seja a causa exclusiva. Causa dos HTTP 500 continua não comprovada.

**Próxima etapa:** consultar, somente leitura, a distribuição dos logs do mesmo período entre `requests`, `stdout`, `stderr` e `varlog/system`, com contagens por severidade, sem imprimir mensagens, endereços, IPs, chaves ou identificadores. Não chamar endpoint de tag, fornecedores, nem efetuar deploy. A PR continua Draft e o serviço dos clientes permanece inalterado.


## Distribuição de Cloud Logging — 21/11/2026, 11h52 BRT

A consulta real de Cloud Logging da revisão `blaise-v6-rj-backend-00058-sos`, janela de 24 horas, retornou **exatamente o limite solicitado de 1.000 registros**, conforme captura das 11h52:

```text
TOTAL_LOGS: 1000
REQUISICOES: 3
STDOUT: 0
STDERR: 0
SISTEMA: 997
OUTROS: 0
SEVERIDADES: {'ERROR': 3, 'INFO': 498, 'WARNING': 499}
LIMITE_ATINGIDO: True
AUDITORIA: SOMENTE_LEITURA
```

**Interpretação cuidadosa:** o limite 1.000 foi atingido, portanto os dados **não constituem inventário completo das 24h**. O conjunto consultado é dominado por logs do sistema; `varlog/system` inclui eventos de escalonamento, inicialização e desligamento de instâncias, conforme documentação oficial do Cloud Run. Os 3 `ERROR` podem corresponder aos 3 HTTP 500 dos logs de requisição. Não atribuir automaticamente as 499 advertências à falha HTTP nem ao segredo. A ausência de `stdout`/`stderr` nessa amostra limitada não comprova que o contêiner não emitiu logs fora da amostra. Referência: https://docs.cloud.google.com/run/docs/logging.

**Próxima ação:** consulta somente leitura **exclusiva** de `run.googleapis.com%2Fvarlog%2Fsystem`, em duas janelas pequenas de 21/11/2026 em UTC ao redor de `11:14` e `11:26`. Exibir apenas contagem por severidade, motivo de escalonamento categorizado e indicadores anônimos de erros, sem textos brutos/URLs/identificadores de instâncias. Manter PR Draft, acesso e tráfego inalterados, sem deploy/consulta meteorológica.


## Janelas de logs do sistema sobre inicialização — 21/11/2026, 11h55 BRT

A titular executou análise **somente leitura** de logs de sistema da revisão `blaise-v6-rj-backend-00058-sos` em duas janelas de 5 minutos, em UTC, próximas aos três HTTP 500 observados anteriormente. Captura das 11h55 BRT:

```text
JANELA: ERRO_0814
LOGS: 4
SEVERIDADES: {'WARNING': 2, 'INFO': 2}
MOTIVOS: {'INSTANCIA_MINIMA': 2}
LIMITE_ATINGIDO: False

JANELA: ERROS_0826
LOGS: 4
SEVERIDADES: {'WARNING': 2, 'INFO': 2}
MOTIVOS: {'INSTANCIA_MINIMA': 2}
LIMITE_ATINGIDO: False
AUDITORIA: SOMENTE_LEITURA
```

**Interpretação restrita:** as duas janelas têm eventos classificados pelo script como `STARTING NEW INSTANCE` por `MANUAL_OR_CUSTOMER_MIN_INSTANCE`, compatíveis com manutenção do mínimo 1 previamente observado. A contagem de dois eventos por janela **não é contagem de instâncias simultâneas**, nem evidencia por si só reinícios por crash ou motivo do HTTP 500. As janelas não mostram entradas de severidade ERROR nesse log específico; isso não exclui falhas noutras severidades, códigos de saída ou logs de containers. O efeito financeiro pode estar relacionado ao mínimo de instâncias e modo `INSTANCE_BASED`, mas valores atribuíveis a esta revisão ainda não foram medidos.

**Próxima ação segura:** analisar apenas contagens e categorias dos eventos de ciclo de vida no `varlog/system` e a presença de `stdout/stderr` nas janelas (consultas separadas, sem payload bruto). **Não alterar** minimum scale, IAM, tráfego 99%/1%, tag ou segredos; não implantar candidata, não executar chamadas meteorológicas.


## Ciclo de vida e logs do container — 21/11/2026, 15h59 BRT

A titular enviou captura do Cloud Shell da consulta somente leitura na janela UTC de **2026-11-21T11:10:00Z a 11:32:00Z** para a revisão histórica `blaise-v6-rj-backend-00058-sos`. Resultado visível:

```text
TIPO: SISTEMA
REGISTROS: 18
CATEGORIAS: {'OUTROS': 9, 'INICIO_INSTANCIA': 9}
LIMITE_ATINGIDO: False
TIPO: STDOUT
REGISTROS: 0
CATEGORIAS: {}
LIMITE_ATINGIDO: False
TIPO: STDERR
REGISTROS: 0
CATEGORIAS: {}
LIMITE_ATINGIDO: False
AUDITORIA: SOMENTE_LEITURA
```

**Interpretação:** nove eventos classificados como `starting new instance` entre 11h10 e 11h32 UTC não demonstram nove instâncias simultâneas nem ciclos de crash. Outros nove eventos de sistema não foram categorizados; ainda não se pode concluir causa dos três HTTP 500 das 11h14/11h26 UTC. A ausência de STDOUT/STDERR nesse período não prova ausência de erros do aplicativo ou ausência de tráfego meteorológico. Exigem-se evidências adicionais, sem leitura de payloads contendo credenciais e sem chamar endpoints da tag.

**Estado:** PR #173 permanece draft; não executar deploy, alterar instâncias, IAM, segredos ou tráfego 99%/1%. Próximo diagnóstico permitido: contagens anonimizadas das nove entradas `OUTROS` por grupos de palavras-chave previamente fixos, ou metadados de latência do request log, sem mensagens brutas/URLs/IPs.


## Classificação ampliada de eventos do sistema — 21/11/2026, 16h01 BRT

O usuário executou no Cloud Shell a classificação somente leitura de `run.googleapis.com/varlog/system` para a revisão `blaise-v6-rj-backend-00058-sos`, janela `2026-11-21T11:10:00Z` a `11:32:00Z`, limite 200. Saída da captura das 16h01 BRT:

```text
TOTAL: 18
INICIO_INSTANCIA: 9
NAO_CLASSIFICADO: 9
LIMITE_ATINGIDO: False
AUDITORIA: SOMENTE_LEITURA
```

Nenhum evento foi classificado pelos padrões textuais específicos `failed to start`, `startup probe failed`, `failed to listen`, `terminated`, `shutting down`, `exit code`, `sigterm`, `out of memory`, `oom`, `memory limit`, `permission denied`, `secretmanager`, `access denied`. Isso **não prova ausência de tais falhas**, já que a categorização é por frases. Os nove registros não classificados não são, por si só, anomalias. As 3 respostas HTTP 500 permaneceram não explicadas, e a existência de eventos de início por minimum instances não comprova crash, nove instâncias simultâneas ou causa de 500.

Próxima leitura recomendada: obter **somente metadados das três requisições HTTP 500** (latência e status, sem caminhos, IPs, URLs, traceIDs ou textos), para distinguir falha imediata da aplicação versus espera pela instância sem chamar a URL. A investigação de código da imagem de produção requer evidência da imagem efetiva e revisão controlada, sem publicar credenciais.

BLOQUEIOS: PR Draft; nenhum merge/deploy; preservar 99%/1% de tráfego, IAM compartilhado, tag, segredos e instâncias. Nenhuma consulta meteorológica intencional.
