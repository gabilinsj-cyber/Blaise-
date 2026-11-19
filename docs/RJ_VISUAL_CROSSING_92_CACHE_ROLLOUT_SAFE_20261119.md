# Blaise V6 RJ — Visual Crossing Free: cache privado, 92 municípios e apresentação segura

**Data:** 19/11/2026. **Implementação somente na branch de desenvolvimento da PR #173 (draft).** Não realizar merge/deploy, não alterar Cloud Run, não ativar para assinantes, não contratar plano pago, não alterar o APK original, não sobrescrever `~/Blaise-RJ` nem seus backups. Este arquivo não inclui nenhum segredo.

## Evidência real e estado inicial

A titular executou uma única consulta manual ao fornecedor em 19/11/2026 11h54 BRT no ponto IBGE 3304557; `PRIVATE_REAL_SAMPLE_READY`, 7/10 variáveis atuais E, 36 horários futuros P, `queryCost=1`. Painel da Visual Crossing às 12h05: **1 consulta, custo 1, 0 falhas**; Firestore trial: **1/1 reserva**. A única resposta **não foi gravada com seus números completos** em cache: não é permitido apresentá-la como clima atual ou tentar recriar valores a partir de nomes de campos.

O painel mostra simultaneamente **1.000 registros grátis/dia** e **"créditos gratuitos disponíveis: 0"**. A documentação oficial diz que a conta exibe *available free credits (if there are any)* e estabelece quota Free de 1.000 registros/dia, mas **não identifica com precisão se esse zero significa ausência de crédito promocional adicional** nesta conta. Não chamar de saldo restante 999; não ativar 92 cidades até revisão no suporte/conta e checagem de consumo real. A conta já aparece Free, sem método de pagamento em capturas da titular.

Fontes oficiais:
- <https://www.visualcrossing.com/resources/documentation/weather-api/what-is-the-querycost-parameter/>
- <https://www.visualcrossing.com/resources/documentation/weather-data/what-exactly-is-a-weather-record/>
- <https://www.visualcrossing.com/resources/documentation/weather-data-tutorials/how-to-view-usage-details-of-your-account/>
- <https://www.visualcrossing.com/resources/documentation/can-i-cache-and-store-visual-crossing-weather-data/>
- <https://www.visualcrossing.com/resources/documentation/what-can-i-do-with-the-visual-crossing-weather-free-plan/>

## Implementação concluída em código, ainda não implantada

1. `backend/src/rj-visual-crossing-free-cache.mjs`: armazenamento **privado no Firestore por município IBGE**. Recebe apenas resultado já interpretado e verificado (`status=PRIVATE_REAL_SAMPLE_READY`); normaliza os dez campos conhecidos, aceita valores ausentes como `null`, guarda coordenada de referência/proveniência, horários de recebimento/validade e previsões futuras. Não guarda chave de API, URL com `?key`, JSON bruto, nome de cliente, localização do usuário ou histórico de consulta de assinantes. Cada leitura reavalia a validade e rejeita valores vencidos (mesmo sem exclusão automática do documento).
2. **TTL obrigatório Visual Crossing**: condições atuais E **até 30 minutos desde o recebimento** e com timestamp de origem recente; previsão P **até 6 horas desde recebimento**. Dados de risco severo são **índice E/P, não alerta oficial**. `0` numérico validado é diferente de `null` (ausente). Em cache expirado, exibir `INDISPONIVEL`; não ativar query ao abrir a tela.
3. `backend/src/rj-visual-crossing-free-92-rollout.mjs`: plano de **92 municípios IBGE auditados**, **8 rodadas/dia UTC**, espaçadas de **3h**. Estimativa: 92 × 8 = **736 registros/dia**, se cada requisição de previsão permanecer com `queryCost=1`. Teto interno compartilhado **800 registros/dia** (64 de folga após 736); limite Free anunciado 1.000/dia (264 de margem teórica se nenhuma outra chamada for feita). Não é saldo do fornecedor; o histórico da conta pode ter registros externos.
4. Reserva atômica compartilhada no Firestore por dia + por município: até 8 reservas por cidade/dia UTC, no mínimo 3 horas entre solicitações inclusive após a troca de dia UTC, teto 800/dia, validação de base de uso externo fornecida pelo administrador e revisão da conta com menos de 60 minutos. Falha de Firestore ou qualquer dúvida de limite **bloqueia** a chamada. Não criar rotina por assinante.
5. `backend/src/rj-visual-crossing-free-92-collector.mjs`: caminho de futura requisição sequencial por município e armazenamento somente após `queryCost=1`, validação de coordenadas e dados. **Nenhum agendador, cron, worker operacional ou endpoint chama este módulo hoje**. Todas as flags são OFF na ausência de confirmação explícita: Free sem pagamento, chave substituída após exposição, indicador 0 esclarecido, operador aprovou 92 cidades, conta revisada e orçamento compartilhado. O módulo não imprime a chave nem a URL.
6. `backend/src/rj-meteorological-memory-live.mjs` e `backend/src/runtime.mjs`: leitura **somente privada**, isolada por cidade (selecionada via `GET /v1/admin/meteorological-memory?ibge=3304557`), autenticada com Firebase e UID administrativo. O leitor Firestore VC é OFF por padrão (`BLAISE_VISUAL_CROSSING_ADMIN_PRIVATE_CACHE_ENABLED=false`). Não oferece cache/JSON bruto publicamente. Sem dados, retorna `INDISPONIVEL`.
7. `app/src/admin/java/br/com/blaise/rj/AdminScientificActivity.kt`: entrada IBGE (um dos 92 códigos), estados de fontes, sete ou menos campos E realmente existentes, hora UTC, 36 ou menos horários futuros P e atribuição **“Weather data by Visual Crossing”**. Os números só aparecem se o cache é válido; interface de clientes mantém original. `WeatherSourceResponsibility.kt` inclui apenas o papel da fonte com **`currentlyIntegratedProduct=false`**, não alega medidor em funcionamento no cliente.
8. `backend/scripts/visual-crossing-free-92-dryrun.mjs`: plano sem chave, sem HTTP, sem Firestore, sem custo meteorológico. Testar com `node backend/scripts/visual-crossing-free-92-dryrun.mjs 2026-11-20` no diretório raiz da worktree.

**Limitação física importante:** 8 rodadas/dia (3h) podem sustentar previsões P ainda válidas, mas **não** manter condições atuais E continuamente válidas por 30 minutos. Para 92 municípios, observar E a cada 30 minutos seriam **92 × 48 = 4.416 registros/dia** se cada consulta custar 1, acima da franquia Free. Portanto, o app cliente deve exibir E indisponível no intervalo e usar outras fontes autorizadas de atualidade diferente, sem chamar E de tempo real contínuo. Atribuição e aviso de incerteza meteorológica permanecem necessários para publicação futura.

## Segurança de acesso ao cache (pendência obrigatória de implantação)

O armazenamento foi preparado para ser acessado **somente pelo backend via credencial de serviço**. A API de leitura existente exige Firebase ID token e allowlist de UIDs administrativos antes de consultar o Firestore. **Ainda falta auditar as regras Firestore implantadas no projeto GCP**: como não há arquivo de regras Firebase visível neste repositório, não é possível afirmar que algum wildcard atual bloqueie clientes SDK do Firestore de ler a nova coleção. Antes de salvar dados reais ou habilitar a revisão, aplicar/testar regras que neguem leitura e escrita direta de aplicativos cliente sobre `blaise_rj_visual_crossing_free_private_weather_v1` e `blaise_rj_vc_free_92_future_budget_v1`, mantendo as regras existentes das outras coleções intactas. Operações de servidor precisam de IAM mínimo e logs sem chave. **Não aplicar regras às cegas em produção.**

Um documento expirado não é servido como atual; exclusão física por TTL do Firestore é uma configuração adicional que requer verificação de índices/serviço e aprovação antes de deploy, separada da validação de frescor já implementada.

## Segurança da chave e do crédito

A primeira chave Visual Crossing foi **exposta numa captura anterior**. Ela continua no Secret Manager (nome `blaise-visual-crossing-free-api-key`, versão inicial 1, formato lido com sucesso), mas **isso não equivale a rotação do segredo no fornecedor**. Antes de qualquer execução recorrente, o administrador deverá substituir a chave na conta Visual Crossing e adicionar nova versão ao mesmo segredo no GCP, sem publicá-la em conversas, APK, GitHub ou logs. Não efetuar essa mudança sem decisão explícita da titular.

O sistema atual **não autoriza** a coleta com a chave exposta, o indicador de créditos ainda ambíguo ou sem verificação recente do consumo na conta. Se necessário, procurar confirmação oficial junto ao fornecedor via canal de suporte. Até lá todos os coletores Visual Crossing de 92 pontos permanecem **desligados**.

## Testes

- Testes offline para cache: validação de valor, unidade, município, E/P, 30m/6h, ausência `null`, ponto de origem, Firestore simulado.
- Orçamento: 92 municípios, 8 rodadas, 736 registros previstos, orçamento 800, bloqueio por cidade/horário e por chaves ou aceite ausentes.
- Collector 92: no-credential/no-approval → 0 GET; reserva Firestore antes de GET; `queryCost` diferente de 1 → não armazena e não repete.
- HTTP: token admin e IBGE de sete dígitos da lista dos 92, sem parâmetros adicionais; UI Android mostra E somente com validade.
- CI sem chamar meteorologia: `.github/workflows/rj-visual-crossing-free-offline-ci.yml`; Android CI separado. Sem as duas verificações verdes no HEAD, **não declarar pronta para release**.

## Próxima decisão administrativa, sem repetição da API

Verificar com Visual Crossing o significado específico de `Créditos gratuitos disponíveis: 0` na conta Free com uma chamada contabilizada (1 custo, 0 falhas). Solicitar também confirmação da política de atribuição e da tela de aviso/desresponsabilização para um app meteorológico por assinatura usado por até 3 milhões de assinantes. Nenhuma comunicação externa foi enviada automaticamente.


## Integração concluída no código do cliente — aguardando liberação segura

Além do painel ADM de manutenção da memória científica, a PR #173 agora contém uma **ponte do cache para a interface ORIGINAL do aplicativo dos clientes**, que por padrão é **inteiramente inativa** e não faz chamadas ao fornecedor:

1. `backend/src/rj-visual-crossing-client-projection.mjs` projeta até dois municípios selecionados, somente se um cache já armazenado pela API estiver no estado `PRIVATE_CACHE_VALID`, com origem, validade e intervalos E/P corretos; jamais reclassifica agregado/estimativa como estação, previsão como observação ou `severeRiskIndex` como alerta oficial.
2. `backend/src/dashboard-data-http.mjs` usa `readVisualCrossingPrivateCache` somente **após validação da assinatura Google Play/Firebase** no endpoint de dados dos clientes. Nenhum GET da Visual Crossing é disparado pelo aplicativo. Retorna campo opcional `visualCrossingWeather` apenas se a chave de liberação interna estiver autorizada. Evita tráfego redundante de até 3 milhões de clientes.
3. `backend/src/runtime.mjs` exige **todas** as flags explícitas, atualmente ausentes/OFF: `BLAISE_VC_SUBSCRIBER_CACHED_DISPLAY_ENABLED`, `BLAISE_VC_SUBSCRIBER_LICENSE_APPROVED`, `BLAISE_VC_FIRESTORE_RULES_AUDITED`, `BLAISE_VC_USER_NOTICE_APPROVED`, `BLAISE_VC_OPERATOR_APPROVED_RELEASE`, além do projeto Cloud correto. Falha em IAM/Firestore => desliga o componente.
4. `app/src/main/java/br/com/blaise/rj/data/DashboardDataClient.kt` admite um bloco opcional com contrato próprio; valida whitelist de campos, horário, atribuição **Weather data by Visual Crossing**, dados estimados atuais (até 30 minutos) e previsão de até a próxima hora. Ao faltar qualquer requisito, o bloco não é aceito.
5. `app/src/main/java/br/com/blaise/rj/MainActivity.kt` integra o bloco nos **painéis já existentes de Localidade 1/Localidade 2**, apenas com assinatura ativa, sem substituir layout/marcadores/14 agentes/mapa/gráficos/voz. Temperatura e sensação estimadas são claramente rotuladas, assim como chuva estimada, e a atribuição com aviso de não utilizar como fonte única de decisões de emergência aparece junto aos valores. Valor inexistente é indisponível.
6. `FinalDashboardSpec.kt` e `WeatherSourceResponsibility.kt` incluem a fonte no catálogo de responsabilidades, **não como prova de integração ativa**. Regresso com testes backend e Android de contrato, assinatura, unidade, local, tempo e ausência de chaves.

**Nenhum número climático do ensaio real de 11h54 pode ser retroativamente recriado:** o teste não persistiu o JSON completo. O caminho atualizado mostrará valores somente quando novas coletas autorizadas, seguras e efetivamente persistidas produzirem cache válido. O ensaio atômico de **um registro está esgotado** e não será reiniciado/contornado. O código de coleta dos 92 municípios ainda requer revisão explícita da chave exposta, da franquia e de IAM antes de novo GET.

### A chave atual está mantida

Por decisão da titular, **não houve rotação** na conta Visual Crossing ou no Secret Manager. Evitar mostrar a chave em capturas, comandos/logs de URL ou GitHub. Como ela foi exposta anteriormente, a coleta automática permanece bloqueada por `BLAISE_VC_KEY_ROTATED_AFTER_EXPOSURE` e pela política de orçamento, até uma decisão de segurança futura. **Preparação completa do código ≠ implantação/ativação**.

### Condições de release restantes

- Verificar regras Firestore atuais no GCP via auditoria *read-only* `node backend/scripts/visual-crossing-firestore-rules-readonly.mjs`; revisar wildcard, regras client SDK, IAM serviço e testes emulator. O script imprime somente metadados, não regras completas nem credenciais.
- Revisar custos reais da conta Free (incluindo `Créditos gratuitos disponíveis: 0`), armazenamento permitido, atribuição e aviso adequado para consumidores.
- Reconciliar a limitação do código de coleta para chave exposta com a decisão da titular; **sem afrouxar silenciosamente** a proteção de uma chave divulgada.
- Conferir CI Android + backend verde no **HEAD definitivo**, revisão de limites, compatibilidade das lojas e aprovação expressa antes de deploy e mudança de tráfego.


## Auditoria real somente leitura das regras Firebase — 19/11/2026 14h04 BRT

A titular executou na Cloud Shell a leitura oficial da release ativa de regras `cloud.firestore` do projeto `blaise-v6-rj`, usando `backend/scripts/visual-crossing-firestore-rules-readonly.mjs`, após `git fetch` e `git show`. A captura do terminal confirma a saída:

- `status=REVIEW_REQUIRED`
- `rulesRead=true`, `ruleFiles=1`, `rulesReleaseIsDefault=true`
- `explicitPathMention=false` para **todas as três coleções** `blaise_rj_visual_crossing_free_private_weather_v1`, `blaise_rj_vc_free_92_future_budget_v1` e `blaise_rj_visual_crossing_free_trial_budget_v1`
- **`hasRecursiveWildcard=true`**: a regra ativa contém pelo menos um padrão do tipo `{document=**}`. Este detalhe é crucial: uma permissão `allow` em correspondência recursiva **pode abranger** as novas coleções mesmo sem regra explícita de nome.
- `suspiciousBroadAllowHeuristic=false` indica apenas que o detector **não identificou uma das formas textuais simples** de concessão ampla; **não prova segurança**, pois condições complexas, funções e regras sobrepostas podem existir.
- `isSecureVerdict=false`, `manualReviewRequired=true`, `dataCopied=false`, `modifiedProduction=false`, `noChanges=true`.
- A captura não fornece o texto integral das regras nem resultados de requisições cliente simuladas. **Não afirmar que cliente está bloqueado** ou que as regras Firestore passaram. A leitura só inspecionou metadados e padrões.

**Bloqueio atual da liberação:** realizar avaliação formal de `get`, `list`, `create`, `update` e `delete` em **cada uma das três coleções** com usuário não autenticado e assinante autenticado **no emulador local ou simulador oficial**. Atestar que o cliente não consegue ler/escrever os dados privados, mesmo quando há `match /{document=**}`. Documentar resultado e revisão de IAM do serviço backend. Não modificar ruleset/roles de produção a partir desta captura. O SDK Admin de servidor ignora regras Firestore e deve ser limitado por IAM.

Fontes de procedimento oficial: <https://firebase.google.com/docs/firestore/security/test-rules-emulator> e <https://firebase.google.com/docs/firestore/security/rules-structure>. A versão cliente e as flags de publicação Visual Crossing ficam OFF até evidência de negação real e autorização explícita. Chave antiga preservada a pedido da titular; exposição anterior não desaparece.


## Alternativa ao botão ausente no Firebase móvel — teste local 19/11/2026

O simulador do Firebase Console (*Rules Playground*) não estava visível para a titular no navegador Android. Foi preparada uma alternativa **Cloud Shell sem alteração de produção**:

- `backend/scripts/visual-crossing-firestore-local-security-check.mjs` usa as credenciais de leitura já existentes do `gcloud` apenas para baixar da API Firebase Rules a **fonte da release ativa `cloud.firestore`**.
- O conteúdo das regras, potencialmente sensível, fica somente em diretório temporário `/tmp/blaise-vc-local-rules-*`, é removido ao finalizar e **não é enviado ao GitHub/ChatGPT**. Tokens, API keys e corpo das regras não são impressos.
- Instala dependências de emulador **somente no diretório temporário**: `firebase-tools@14`, `firebase@12`, `@firebase/rules-unit-testing@5`; precisa de Java, npm e acesso de rede para instalar dependências. Se faltar Java/permissão, retorna indisponibilidade sem fingir aprovação. **Não realiza solicitação à API meteorológica Visual Crossing**.
- Inicia um **emulador local** num projeto `demo-blaise-vc-firestore-rules` (porta 8185), nunca `blaise-v6-rj`. O arquivo `backend/scripts/visual-crossing-firestore-client-probe.mjs` usa dados fictícios no emulador para 30 operações (`get,list,create,update,delete`) em três coleções privadas, como anônimo e como cliente autenticado comum.
- Veredito `SIMULATED_CLIENTS_DENIED` significa **somente** que as 30 operações simuladas não conseguiram acesso; não substitui revisão de regras mais complexas, claims de admin, credenciais IAM e testes de identidade reais. `ACCESS_RISK_OR_TEST_ERROR` requer correção; não ativar coleta nem publicação.
- Para executar, em worktree isolada Cloud Shell: `git fetch origin feature/rj-meteoblue-full-recovery-admin-ui-20261118`, exportar os dois scripts com `git show FETCH_HEAD:...` para `/tmp` e executar `node /tmp/visual-crossing-firestore-local-security-check.mjs /tmp/visual-crossing-firestore-client-probe.mjs`. Nenhum comando publica regras. **Não executar `firebase deploy`**.

Referência oficial: <https://firebase.google.com/docs/firestore/security/test-rules-emulator>. Não usar a API REST `projects.test` para contornar o simulador, pois a documentação avisa que os testes podem acessar recursos de produção e causar cobranças.

## Auditoria emulador interrompida por timeout — 19/11/2026

Captura de Cloud Shell enviada pela titular (após teste com Java OpenJDK 21.0.13). Saída:
`BLAISE_VC_LOCAL_SECURITY_CHECK={"state":"REVIEW_REQUIRED","reason":"EMULATOR_EXECUTION_TIMEOUT","productionChanged":false,"productionDocumentsRead":false,"weatherApiCalled":false,"clientRelease":false}`.

**Interpretação correta:** o processo de emulação excedeu o limite; nenhum dos 30 resultados `get/list/create/update/delete` foi verificado. **Não concluir** que as regras são seguras ou inseguras. O ruleset real lido em 14h04 tem `hasRecursiveWildcard=true` e três coleções sem menção explícita, portanto uma revisão de permissões de cliente permanece **obrigatória**, apesar do detector não achar `allow` amplo simples.

O script `visual-crossing-firestore-local-security-check.mjs` foi atualizado para emitir marcadores inofensivos de estágio (`ACTIVE_RULES_READ_OK`, `EMULATOR_DEPENDENCIES_INSTALLED`, `EMULATOR_TEST_START`) e distinguir timeout de inicialização/download do timeout após início do processo de teste. Não imprimir regras completas, tokens, segredos, saída integral dos subprocessos. **Não repetir automaticamente a execução longa**, nem implantar regras/mudar IAM, sem inspecionar o ponto onde o emulador parou.

A captura também contém notificação por SMS da Defesa Civil sobre pancadas isoladas, mas o texto está truncado. Não reproduzir nem inferir local, risco, horário ou nível de alerta a partir da prévia.


## Auditoria local concluída: 30/30 acessos de clientes negados — 19/11/2026 15h55 BRT

Evidência: captura do Cloud Shell fornecida pela titular, após execução em emulador local com ruleset **lido** da release ativa do projeto `blaise-v6-rj`. O terminal mostra:

- `BLAISE_VC_LOCAL_PHASE=ACTIVE_RULES_READ_OK`
- `BLAISE_VC_LOCAL_PHASE=EMULATOR_DEPENDENCIES_INSTALLED`
- `BLAISE_VC_LOCAL_PHASE=EMULATOR_TEST_START`
- `BLAISE_VC_LOCAL_SECURITY_RESULTS={"state":"SIMULATED_CLIENTS_DENIED","testCases":30,"denied":30,"unexpected":[],"productionChanged":false,"productionDocumentsRead":false,"cloudWeatherCalls":0,"manualRulesAndIamReviewStillRequired":true}`

**Escopo exato:** foram negadas 30 operações no emulador, representando `get`, `list`, `create`, `update`, `delete` em três coleções (`blaise_rj_visual_crossing_free_private_weather_v1`, `blaise_rj_vc_free_92_future_budget_v1`, `blaise_rj_visual_crossing_free_trial_budget_v1`) para dois perfis: cliente anônimo e cliente autenticado comum sem privilégios. **Nenhum acesso inesperado.** Não houve alteração de regras de produção, leitura de documentos reais ou consumo adicional de créditos meteorológicos.

**Limites de interpretação:** esse resultado NÃO comprova segurança de IAM da conta de serviço backend, contas com claims administrativos, todas as variantes de `request.auth`/RBAC, nem garante que outras regras publicadas não sejam modificadas depois. A regra recursiva `{document=**}` observada anteriormente continua exigindo revisão de mudanças. Um emulador que obedece à release atual, com clientes simulados, não representa a aplicação real em produção. A aprovação técnica é **parcial**, limitada aos trinta testes.

**Próximas barreiras:** auditoria somente leitura das permissões IAM do serviço Cloud Run e da conta de serviço, validação de atribuição/termos e risco da chave Visual Crossing anteriormente exposta (titular não autorizou rotação, chave preservada). Nenhum merge/deploy, nova consulta ao fornecedor, contratação ou publicação de dados aos clientes foi realizado. A integração no código permanece em PR #173 como rascunho.


## Cloud Run service account inventory — 19/11/2026 15h57 BRT

A titular executou somente leitura no Cloud Shell:
`gcloud run services list --project=blaise-v6-rj --format="table(metadata.name,spec.template.spec.serviceAccountName)"`.
A captura exibe dois serviços e respectivas identidades de execução:

- `blaise-v6-rj-backend`: `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`;
- `blaise-noaa-homolog`: `blaise-noaa-staging@blaise-v6-rj.iam.gserviceaccount.com`.

Essa listagem **não mostra permissões de IAM**, roles de projeto/recurso, vínculos herdados, Secret Manager grants ou permissões do serviço, nem prova que essas identidades operam o backend de produção com o mesmo escopo esperado. **Não modificar** contas, roles, regras, Secret Manager, flags nem tráfego de Cloud Run com base nesta saída.

**Próximo controle em somente leitura:** extrair do IAM policy do projeto apenas os vínculos explícitos e conditions dessas duas service accounts, sem publicar o policy completo. Posteriormente conferir vinculações por recurso (Firestore/Secret Manager) e herança de IAM; não declarar princípio do menor privilégio aprovado apenas com roles de projeto. Manter a Visual Crossing sem cliente/automação e a chave atual conforme decisão da titular.


## IAM de projeto — duas contas sem bindings diretos (19/11/2026 16h00 BRT)

Captura do Cloud Shell com o resultado do comando `gcloud projects get-iam-policy blaise-v6-rj --format=json`, filtrado localmente por **duas service accounts específicas** (não imprimiu o documento completo).

- `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`: **SEM VINCULO DIRETO NO IAM DO PROJETO**.
- `blaise-noaa-staging@blaise-v6-rj.iam.gserviceaccount.com`: **SEM VINCULO DIRETO NO IAM DO PROJETO**.

**Não interpretar como ausência total de acesso:** esta consulta não resolve grants via grupos, herança da organização/pasta, permissões de IAM específicas do segredo ou outros recursos, permissões delegadas ou identidade realmente utilizada por outras revisões de Cloud Run. Não alterar serviço, regras, grupo, IAM, secret, chave ou produção sem autorização.

Os 30 testes de cliente **negados em emulador** permanecem evidência favorável, mas não substituem IAM. **Próxima leitura segura**: `gcloud secrets get-iam-policy blaise-visual-crossing-free-api-key --project=blaise-v6-rj --format=json` filtrado pelas contas de serviço; jamais `gcloud secrets versions access` para esta auditoria, pois o valor da chave não é necessário. Verificar bindings de recursos específicos; ausência de vínculo direto também não é prova de acesso negado ou permitido.


## Secret Manager: política direta verificada — 19/11/2026 16h03 BRT

A titular executou `gcloud secrets get-iam-policy blaise-visual-crossing-free-api-key --project=blaise-v6-rj --format=json` e filtrou apenas as roles diretas de duas identidades Cloud Run. A captura de 16h03 confirma:

- `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`: `PAPEIS_DIRETOS: nenhum`;
- `blaise-noaa-staging@blaise-v6-rj.iam.gserviceaccount.com`: `PAPEIS_DIRETOS: nenhum`;
- Nenhum `ACESSO_AMPLO` foi impresso para `allUsers` ou `allAuthenticatedUsers` na **política direta desse segredo**.

**Escopo da afirmação:** não foram encontradas concessões diretas ou públicas explícitas no segredo consultado. Isso **não é prova de bloqueio efetivo nem de menor privilégio**, porque podem existir concessões herdadas, grupos, conditions, outros recursos ou políticas IAM deny. Não provar que o backend tem acesso à chave: não houve impersonação de conta de serviço nem operação real de `secretmanager.versions.access` neste ensaio. Não acessar versão/valor da chave durante a auditoria.

Próximo passo recomendado: usar o **IAM Policy Troubleshooter** em modo somente leitura para checar `secretmanager.versions.access` na versão de segredo para cada uma das duas service accounts. A documentação oficial do gcloud é <https://docs.cloud.google.com/sdk/gcloud/reference/policy-intelligence/troubleshoot-policy/iam>. Evitar interpretar resultados `UNKNOWN`/permissão insuficiente como `DENIED`. Não conceder/revogar roles, não girar chave nem implantar coleta sem a titular autorizar.


## Auditoria IAM Policy Troubleshooter indisponível — 19/11/2026 16h07 BRT

Evidência: captura de Cloud Shell às 16h07 BRT. Ao executar `gcloud policy-intelligence troubleshoot-policy iam` para a identidade `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com` e a permissão `secretmanager.versions.access` sobre a versão 1 de `blaise-visual-crossing-free-api-key`, a ferramenta retornou `PERMISSION_DENIED` com mensagem de que o Application Default Credentials não possui quota project configurado e `ErrorInfo.reason=SERVICE_DISABLED` para `policytroubleshooter.googleapis.com`.

**Interpretação:** essa é uma falha na execução da **ferramenta de auditoria**, não o resultado de `secretmanager.versions.access` para a identidade do backend. Não houve conclusão `ALLOWED`, `DENIED` nem `UNKNOWN` de acesso efetivo. O erro também não implica vazamento da chave, modificação de roles nem consumo de registros meteorológicos.

**Decisão segura:** não habilitar `policytroubleshooter.googleapis.com`, não modificar Application Default Credentials/quota project e não mexer no IAM sem autorização explícita; preferir revisão de política somente leitura já coletada, que confirmou ausência de bindings diretos de projeto/segredo e **não eliminou a possibilidade de herança, grupos ou conditions**. Marcar auditoria IAM efetiva como pendente. As três coleções passaram em 30/30 operações negadas por anônimo/usuário comum **no emulador local**, não como prova ampla de segurança GCP. Visual Crossing permanece com a chave atual (por escolha da titular), sem novas chamadas, sem cron, sem liberação ao cliente e PR em draft.


## Revisão de permissões IAM herdadas sem Policy Troubleshooter — 19/11/2026

**Problema:** a tentativa de Policy Troubleshooter às 16h07 BRT falhou devido a `SERVICE_DISABLED`/`PERMISSION_DENIED` de quota project da **ferramenta**, não do segredo. A titular pediu concluir a análise sem habilitar APIs extras, sem mexer na chave exposta e sem autorizar publicação ou novas consultas meteorológicas.

**Implementação:** `backend/scripts/visual-crossing-iam-inheritance-readonly.py`, Python 3 puro (sem `pip install`, sem `gcloud auth application-default set-quota-project` e sem chamadas ao Policy Troubleshooter). Roda somente comandos `gcloud` de leitura da hierarquia e da política direta do segredo:

- Preferência: `gcloud projects get-ancestors-iam-policy blaise-v6-rj --include-deny --format=json`, que retorna políticas **allow/deny** do projeto e ancestrais conforme a documentação Google Cloud.
- Caso o comando `--include-deny` não esteja disponível ou o operador não possa ler as políticas deny, tenta a consulta sem deny, preservando diagnóstico **`ANCESTOR_DENY_POLICIES_UNVERIFIED`**. Se a consulta consolidada falhar, consulta individualmente `gcloud projects get-iam-policy`, `gcloud projects get-ancestors`, `gcloud resource-manager folders get-iam-policy` e `gcloud organizations get-iam-policy`, conforme disponibilidade. Qualquer nível não legível é declarado **PENDENTE**.
- Compara vínculos explícitos para as identidades `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com` e `blaise-noaa-staging@blaise-v6-rj.iam.gserviceaccount.com`; contabiliza políticas de negação, bindings para `allUsers`/`allAuthenticatedUsers`, grupos/domínios/principalSet e condições. Só imprime **tipo de identidade, escopo e role**, sem nomes de grupos, políticas completas, contas pessoais, tokens ou valor de segredo.
- Revisa a política direta de `blaise-visual-crossing-free-api-key` com `gcloud secrets get-iam-policy`; nunca lê nenhuma versão do segredo. A saída sempre informa `effectiveSecretAccess=NOT_CONCLUSIVELY_EVALUATED`, `releaseApproved=false` — não declara menor privilégio validado a partir de vínculos diretos, pois ainda pode haver grupo, herança, IAM deny, PAB, UAP ou condições que não possam ser avaliadas integralmente.
- Executar pela **worktree isolada**, sem editar o projeto original:
  `git fetch origin feature/rj-meteoblue-full-recovery-admin-ui-20261118`;
  `git show FETCH_HEAD:backend/scripts/visual-crossing-iam-inheritance-readonly.py > ~/blaise-vc-security-check/visual-crossing-iam-inheritance-readonly.py`;
  `python3 ~/blaise-vc-security-check/visual-crossing-iam-inheritance-readonly.py`.
- **Não** executar `gcloud services enable`, `gcloud projects add-iam-policy-binding`, `gcloud secrets versions access`, `firebase deploy` ou reiniciar serviços. Não atualizar a chave por conta própria.

**Referências oficiais consultadas em 19/11/2026:**
<https://docs.cloud.google.com/sdk/gcloud/reference/projects/get-ancestors-iam-policy>
<https://docs.cloud.google.com/iam/docs/troubleshoot-policies>
<https://docs.cloud.google.com/iam/docs/deny-access>

**Resultado da execução real:** ainda aguardando saída deste comando no Cloud Shell. Não inventar conclusão sobre a hierarquia sem evidência; 30/30 testes de cliente do Firestore no emulador permanecem comprovados e a interface Visual Crossing continua em rascunho, sem release.


## Auditoria IAM herdada executada — 19/11/2026 16h18 BRT

Captura do Cloud Shell da titular referente à execução de `backend/scripts/visual-crossing-iam-inheritance-readonly.py` em worktree isolada. A saída `BLAISE_VC_INHERITED_IAM_AUDIT` informa:

- `coverage=PROJECT_ANCESTORS_ALLOW_DENY` e `denyPoliciesQueryCompleted=true`;
- `policyLevelsRead=[{"scope":"project"}]`: **somente o escopo projeto apareceu na lista de políticas efetivamente retornadas**. Não afirmar verificação de pasta ou organização não presentes;
- `broadAllowBindings=[]`, `dynamicOrGroupBindings=[]`;
- `iamConditionsCount=3` — há três bindings condicionais a investigar; o script não imprimiu seus membros nem as expressões;
- `denyPolicyObjectsSeen=0`, `issues=[]`, `unrecognizedPolicyItemsCount=0`;
- `serviceAccountExplicitAllowBindings` mostra listas vazias tanto para a identidade do backend `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com` como para a NOAA `blaise-noaa-staging@blaise-v6-rj.iam.gserviceaccount.com`;
- `secretDirectPolicyRead=true`; `effectiveSecretAccess=NOT_CONCLUSIVELY_EVALUATED`, `releaseApproved=false`;
- `secretValueRead=false`, `weatherApiCalls=0`, `productionChanged=false`, `clientPublished=false`.

**Conclusão exata:** não foram encontrados vínculos `allow` explícitos dessas duas contas nas políticas consultadas nem concessões públicas amplas ou por grupos nesses documentos; isso **não equivale** a aprovação de menor privilégio nem negação/concessão efetiva de `secretmanager.versions.access`. Há três condições IAM cujo conteúdo e membros ainda não foram avaliados; grants podem ocorrer por mecanismos não cobertos (inclusive outros níveis, políticas ou identidades). Nunca ler ou imprimir o segredo. Não alterar a chave atual, regras Firestore, IAM, ativar serviço/cobrança, criar cron, publicar dados, mesclar PR ou implantar produção.

Próxima análise sem habilitar API: coletar **somente metadados seguros das três condições IAM** (escopo, papel e presença de condição), verificando suas relações com contas de execução e permissões relevantes, sem apresentar identidades pessoais, valores de segredo ou expressões sensíveis. Uma conclusão integral de acesso efetivo pode continuar pendente sem ferramentas e permissões adicionais, e isso deve ser comunicado honestamente.


## Identificação dos três papéis IAM condicionais — 19/11/2026 16h23 BRT

A titular enviou captura de comando **somente leitura** `gcloud projects get-ancestors-iam-policy blaise-v6-rj --include-deny --format=json` que listou os seguintes três `bindings` condicionais no escopo `project`:

- `projects/blaise-v6-rj/roles/blaiseAgent13WriteProbe` (papel personalizado, **permissões desconhecidas** até inspecionar a definição da role);
- `roles/datastore.user` (**pode autorizar leitura/escrita do Firestore**, conforme identidade e condição);
- `roles/datastore.viewer` (**pode autorizar leitura de metadados/dados conforme as permissões reais da role**, condicionada).

A captura só imprimiu papel, escopo e `CONDICAO_PRESENTE: SIM`. **Não informou quem são os membros nem o predicado da condição**. Resultado anterior do auditor específico registrou listas vazias de vínculos IAM diretos ou herdados **explícitos** para `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com` e `blaise-noaa-staging@blaise-v6-rj.iam.gserviceaccount.com`; isso não exclui outras identidades ou grant condicional e não equivale a `secretmanager.versions.access` verificado.

Não alterar ou remover roles: podem ser necessárias ao aplicativo original, ao Agente 13 e à homologação. **Próxima leitura recomendada:** imprimir apenas se cada vínculo contém as duas contas de serviço do backend/NOAA, quantidade de membros, tipos de principal (sem endereços) e presença de condição. Também revisar permissões do papel personalizado de forma limitada e sem consultar segredos ou documentos de produção. **Não aprovar release, coleta ou cliente.**


## Três IAM bindings condicionais: identidades conferidas — 19/11/2026 16h43 BRT

Captura do Cloud Shell enviada pela titular com saída filtrada de `gcloud projects get-ancestors-iam-policy blaise-v6-rj --include-deny --format=json`. O filtro imprimiu **apenas tipos e contagens de membros**, nunca os identificadores dos destinatários.

| Papel condicional (escopo `project`) | Total membros | Tipos | `blaise-cloud-run-runtime` diretamente incluído? | `blaise-noaa-staging` diretamente incluído? |
|---|---:|---|---|---|
| `projects/blaise-v6-rj/roles/blaiseAgent13WriteProbe` | 1 | `serviceAccount` | NÃO | NÃO |
| `roles/datastore.user` | 1 | `serviceAccount` | NÃO | NÃO |
| `roles/datastore.viewer` | 1 | `serviceAccount` | NÃO | NÃO |

Assim, **nenhuma das duas identidades sob análise recebe esses três papéis por associação direta**. O comando **não revelou** as identidades que de fato recebem os papéis, o predicado das condições ou todas as concessões possíveis por outros mecanismos. Não inferir vínculo desses papéis com o backend Visual Crossing, nem aprovar acesso efetivo ao segredo.

A auditoria anterior identificou `policyLevelsRead=[{"scope":"project"}]`, `secretDirectPolicyRead=true`, `serviceAccountExplicitAllowBindings` vazios para ambas as identidades, `broadAllowBindings=[]`, `dynamicOrGroupBindings=[]`, `denyPolicyObjectsSeen=0`, `iamConditionsCount=3`, `effectiveSecretAccess=NOT_CONCLUSIVELY_EVALUATED`. As **30/30 requisições anônimas/cliente comum** às três coleções foram negadas no emulador Firestore; isso é avaliação independente de IAM Admin SDK.

**Resultado:** revisão dos vínculos condicionais específicos finalizada; revisão global de IAM **ainda inconclusiva quanto ao acesso efetivo** da conta de serviço ao Secret Manager. A chave foi previamente mostrada em captura e, por opção da titular, **não foi rotacionada**. Não conceder roles, ativar o coletor, modificar a chave, publicar valores, implantar ou mesclar sem uma avaliação e autorização de release posteriores.


## Diagnóstico não divulgador da conta de serviço — 19/11/2026

Foi preparado `backend/scripts/visual-crossing-secret-effective-permission-readonly.py` para o único passo que a análise de políticas não consegue provar: avaliar a solicitação **sob a identidade real** `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`, sem trocar chaves nem adicionar IAM roles.

O script apenas **tenta impersonação preexistente**, com token OAuth de curta validade armazenado na memória do processo e nunca exibido, usando `gcloud auth print-access-token --impersonate-service-account=...`. Se a conta do operador não tem `iam.serviceAccounts.getAccessToken` ou a IAM Service Account Credentials API estiver indisponível, responde `SERVICE_ACCOUNT_IMPERSONATION_UNAVAILABLE` e **não deve ser tratado como acesso negado da conta backend ao segredo**. Não habilita APIs, não modifica IAM, não altera a credencial do operador nem o projeto padrão.

Se a impersonação for possível, faz uma única chamada `POST /v1/projects/blaise-v6-rj/secrets/blaise-visual-crossing-free-api-key:testIamPermissions` com `secretmanager.versions.access`. O request **não lê o valor do segredo**, não acessa nenhum número de versão da chave, não solicita a Visual Crossing e não imprime dados de autenticação. Retornos:
- `PERMISSION_REPORTED_BY_API`: a API declarou a permissão para essa identidade na *secret resource*, **mas a documentação oficial adverte que o método pode falhar aberto e NÃO é verificação de autorização para operação real**;
- `PERMISSION_NOT_REPORTED`: não declarou permissão, mas **não é prova conclusiva de bloqueio** de acesso a versão específica;
- `SERVICE_ACCOUNT_IMPERSONATION_UNAVAILABLE`: o operador não conseguiu emitir token para a conta backend; não se pode inferir nada sobre a autorização do backend em Cloud Run;
- `SECRET_MANAGER_PERMISSION_TEST_UNAVAILABLE`: falha HTTP específica sem revelar corpo ou header; também não é um veredito IAM.

Mesmo quando o método retornar uma permissão, o documento mantém `releaseApproved=false`. **Prova operacional** de `versions.access` exigiria uma operação real sob a identidade do serviço, com revisão de escopo, logs e risco; ela foi deliberadamente excluída deste script porque exige acesso ao valor da chave. Não usar `testIamPermissions` como fundamento único para mudar release, publicar a interface ou ativar coleta. Referências oficiais:
<https://docs.cloud.google.com/secret-manager/docs/reference/rest/v1/projects.secrets/testIamPermissions>
<https://docs.cloud.google.com/iam/docs/service-account-impersonation>

Comando seguro:
`git fetch origin feature/rj-meteoblue-full-recovery-admin-ui-20261118`
`git show FETCH_HEAD:backend/scripts/visual-crossing-secret-effective-permission-readonly.py > ~/blaise-vc-security-check/visual-crossing-secret-effective-permission-readonly.py`
`python3 ~/blaise-vc-security-check/visual-crossing-secret-effective-permission-readonly.py`

**Status:** implementação no PR draft com testes offline; o comando ainda não foi executado pela titular, portanto nenhum resultado de acesso atual foi observado. Chave atual preservada, sem merge, deploy ou nova chamada meteorológica.
