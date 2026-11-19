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
