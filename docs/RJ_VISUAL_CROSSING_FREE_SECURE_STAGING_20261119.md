# Blaise V6 RJ — Visual Crossing Free: integração segura em preparação

**Situação 19/11/2026:** usuário informou que criou conta e possui a chave. Nenhuma credencial foi compartilhada com o modelo, nenhum segredo Visual Crossing foi criado/verificado no GCP por esta PR, nenhuma chamada real ou gasto de franquia Visual Crossing foi feito. Código somente na PR **#173 (draft)**, sem merge/deploy/alteração de produção ou clientes.

## Informações verificadas em documentação do fornecedor

- Plano padrão Free: até **1.000 registros por dia**, uso comercial permitido sob condições/atribuição. Uma consulta de *previsão* Timeline em uma localidade costuma custar **1 registro**, mas consultar `queryCost` real para confirmar, pois diferentes modalidades e opções podem custar mais.
- Documentação: <https://www.visualcrossing.com/resources/documentation/what-can-i-do-with-the-visual-crossing-weather-free-plan/> e <https://www.visualcrossing.com/resources/documentation/weather-api/what-is-the-querycost-parameter/> e <https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/>.
- Campos potencialmente disponíveis: `temp`, `feelslike`, `humidity`, `dew`, `windspeed`, `windgust`, `precip`, `precipprob`, `pressure`, `severerisk`. Falta de campo = **null/indisponível**, nunca zero inventado. Unidade `metric`: °C, %, km/h, mm, hPa; índice `severerisk` não é alerta oficial.
- O campo `currentConditions` representa condições agregadas/estimadas (**E**) sem estação física homologada; elementos futuros horários são **P**. Não chamar um índice de risco de tempestade de nível oficial ou precipitação de pluviômetro observado.
- A API usa o valor secreto na query HTTPS `key=...`, razão adicional para proibir URL completo em logs, frontend e relatórios de erro.
- O plano gratuito não autoriza execução automática de 92 municípios em alta frequência. O máximo futuro interno proposto é **900 registros/dia em Firestore**, com até 100 registros de margem (sujeito à verificação de `queryCost` e conta). Nenhuma rotina de 92 municípios foi ativada.

## Implementado agora, sem acesso a segredo e sem consulta ao fornecedor

1. `backend/src/rj-visual-crossing-free-private.mjs`: coleta de estágio somente Rio IBGE 3304557, parse científico, classificação E/P, checagem de coordenadas/frescor, avaliação conservadora dos dez campos; `fetch` protegido por flags e nunca exposto no APK.
2. `backend/src/rj-visual-crossing-free-budget.mjs`: reserva atômica em **Firestore** de **uma única chamada na campanha de estágio**, inclusive após trocar o dia UTC. Não há contador local em memória como contingência; falha de Firestore = sem contato externo.
3. `backend/scripts/visual-crossing-free-private-audit.mjs`: **offline por padrão** (imprime `VISUAL_CROSSING_FREE_PRIVATE_AUDIT=OFFLINE_NO_NETWORK`). Somente `--live --one-record --private-staging` com aprovações explícitas e segredo de servidor permite um teste real; relatório só com nomes de campos e `queryCost`, sem mostrar dados numéricos ou chave.
4. `backend/test/rj-visual-crossing-free-private.test.mjs` com mocks e teste de reserva única; CI `rj-visual-crossing-free-offline-ci.yml` não recebe segredos, não faz GET ao fornecedor.
5. Memória/admin `rj-meteorological-memory-live.mjs`: fonte `VISUAL_CROSSING_FREE` catalogada como **NOT_YET_VALIDATED**. `AdminMeteorologicalMemoryClient.kt` reconhece esse estado. **Nenhum valor Visual Crossing é anunciado como ativo**.

## Instrução segura para o operador (sem enviar a chave ao chat)

1. Abrir <https://console.cloud.google.com/security/secret-manager?project=blaise-v6-rj>. Confirmar projeto **blaise-v6-rj**.
2. Escolher **Criar segredo**. Nome exato: `blaise-visual-crossing-free-api-key`. Colar **só o valor da chave** no campo Valor do segredo; salvar. Evitar prints com valor legível.
3. Confirmar no painel Visual Crossing que conta é **Free**, 1.000 registros/dia, **sem pagamentos automáticos** ou vínculo que permita cobranças extras. Não cadastrar cartão para teste e não alterar um plano existente.
4. Após o segredo existir, **inspecionar apenas formato e permissões sem imprimir valor**; não enviar chave no ChatGPT, URL ou repositório.
5. Só depois, com confirmação da conta e da margem diária, executar o ensaio de um registro no **Cloud Shell isolado**, usando a worktree da PR #173 (não o app original), com `BLAISE_VISUAL_CROSSING_FREE_API_KEY` carregada via `gcloud secrets versions access latest`. Evitar repetir, inclusive após erro, pois o contador Firestore pode ter reservado o registro e a API pode já ter contabilizado.
6. Validar `queryCost=1`, hora UTC, localização Rio, conteúdo e origem E/P. Registrar evidência técnica sem segredo. **Não publicar** valores para clientes até homologação, licença e decisão de integração.

## Segurança

Nenhuma alteração nas branches de produção, serviço Cloud Run, Play Store, assinatura HG Brasil ou coletor meteoblue; nenhuma chave gravada no GitHub. Visual Crossing continua com flag `BLAISE_VISUAL_CROSSING_PRIVATE_ENABLED=false` por padrão. O uso automático para 92 cidades exigiria uma implementação posterior de cota compartilhada e revisão de preços, atualidade, cache, direitos de armazenamento/reexibição e atribuição.

**Importante:** previsão 15 dias custar 1 registro normalmente não prova que *qualquer* consulta e parâmetros custam 1. A avaliação `queryCost` no ensaio real é obrigatória, e o teste é interrompido caso a resposta exceda o custo previsto; a reserva ocorre antes da chamada e não é reembolsável pelo programa.


## Consulta real concluída — 19/11/2026 11h54 BRT

**Fonte da evidência:** captura do Cloud Shell da titular com a saída do script `node scripts/visual-crossing-free-private-audit.mjs --live --one-record --private-staging` executado na worktree isolada `~/blaise-visual-crossing-audit-20261119/backend`.

- `status: "PRIVATE_REAL_SAMPLE_READY"`, `reason: null`, `providerContacted: true`.
- `localRecordsReserved: 1` (reserva **local Firestore**), `queryCost: 1` (custo reportado pela resposta real do fornecedor). Ainda convém conferir a contabilização no dashboard da conta; não assumir o saldo de 999 registros sem inspeção do fornecedor.
- `currentTimeVerified: true`, `forecastHourlySlots: 36`.
- **7/10 campos atuais E presentes**: `temperatureC`, `feelsLikeC`, `relativeHumidityPct`, `dewPointC`, `windSpeedKmh`, `precipitationProbabilityPct`, `pressureHpa`.
- **Não vieram como valores numéricos atuais neste ensaio**: `windGustKmh`, `precipitationMm`, `severeRiskIndex`. Ausência **não** é zero. É possível que algum campo apareça em outros horários ou nas previsões, mas o relatório não discrimina seus valores individuais.
- `categoryCurrent: E_AGGREGATED_NOT_STATION_MEASUREMENT`, `categoryForecast: P_FORECAST_ONLY`, `publishedToSubscribers: false`, `paidApiUsed: false`.
- O script imprime **nomes dos campos e contagens**, não valores numéricos nem o JSON bruto. Não afirmar homologação de valor individual, aferição de instrumento ou cobertura dos 92 municípios.
- **Não há persistência do resultado meteorológico Visual Crossing em cache de produção/admin** neste ensaio: o código fez leitura/parsing, registrou a reserva de orçamento e devolveu um relatório de auditoria resumido. Logo, o painel pode mostrar `PRIVATE_ONE_SHOT_AUDITED_NO_CURRENT_CACHE`, mas **não** deve exibir temperatura atual Visual Crossing nem inventar histórico.
- O controle de Firestore permite **uma única reserva de teste para a campanha inteira**, mesmo após mudar o dia UTC. **Não repetir** a solicitação real; próximo passo seguro é ler o contador Firestore e conferir o painel de consumo Visual Crossing.
- A chave da conta foi mostrada em captura anterior e deve ser considerada exposta. O valor não deve aparecer aqui, em logs, no APK ou no GitHub. Antes de coleta regular/implantação, planejar rotação no fornecedor e atualização do Secret Manager **somente com autorização expressa do titular**.
- A PR #173 permanece em rascunho sem merge, produção, cobrança paga ou publicação.

## Firestore confirmado após consulta — 19/11/2026 12h02 BRT

Captura do Cloud Shell da titular após leitura **somente do Firestore** (`createRjVisualCrossingFreeBudget({db}).readBudget()`), sem consulta HTTP à Visual Crossing:

- `campaign=staging_one_rio_20261119`
- `sourceOfCounts=LOCAL_FIRESTORE_RESERVATIONS_ONLY`
- `providerRecordsUsed=UNVERIFIED_IN_PROVIDER_DASHBOARD`
- `localCallsReserved=1`
- `localRecordsReserved=1`
- `maxTrialCalls=1`
- `automaticPolling=false`
- `paidAllowed=false`
- `publishedToSubscribers=false`

A tentativa privada das 11h54 registrou uma única reserva e a resposta do fornecedor informou `queryCost=1`. Isso comprova a contabilidade **local**, não o saldo atual do painel da Visual Crossing. **Não repetir a consulta real, nem com a mudança de dia UTC**, pois esta campanha foi deliberadamente de um ensaio. Próxima ação sem gasto de registros: verificar no painel da conta Visual Crossing (Uso/uso recente) o consumo externo de 19/11/2026 e guardar a evidência sem chave ou dados pessoais. O projeto original e a produção continuam sem alterações.
