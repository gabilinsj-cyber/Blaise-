# Blaise V6 RJ — Agente 13: fail-closed e integração isolada

Branch de revisão: `safety/rj-agent13-firestore-failclosed-20261115`. **Não implantada**.

O novo módulo `backend/src/rj-agent13-supervised-integration.mjs` recebe por injeção os serviços já existentes `createRjOpenWeatherAgent13Service` e `createRjAgentSupervisor`. Não faz chamadas, agendamento ou publicação na importação.

Gates **obrigatórios**, todos com valor literal `true`: `BLAISE_OPENWEATHER_ENABLED`, `BLAISE_OPENWEATHER_USAGE_APPROVED`, `BLAISE_PUBLIC_OPENWEATHER_APPROVED`, `BLAISE_OPENWEATHER_AGENT13_ENABLED`, `BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED` e `BLAISE_AGENT13_EXCLUSIVE_RUNNER_CONFIRMED`. Esta última exige auditoria prévia dos outros caminhos de OpenWeather para evitar consultas duplicadas. Não habilitar automaticamente esses dois novos gates.

Secret: `BLAISE_OPENWEATHER_API_KEY` deve vir do Secret Manager, nunca de Git, chat, cliente ou log.

O código de quota original `rj-openweather-firestore-store.mjs` utiliza a coleção `blaise_rj_openweather_daily_quota` e transação atômica com limite máximo de **900/dia**. Não usar outro contador para as mesmas chamadas, nem executar consultas se o Firestore falhar. Não introduzir o contador alternativo `blaise_agent13_daily_calls` do pacote antigo na mesma implantação.

O novo supervisor exige `adminAuthorized: true`, obtido de autenticação efetiva no servidor, e o alvo vem de `targetProvider` interno com coordenadas municipais validadas. Não liberar dados inventados ou confundir estimativa com observação.

Executar: `node --test backend/test/rj-agent13-supervised-integration.test.mjs`. Testes são apenas simulações, não validam Cloud Run/Firestore reais.

Antes do release: validação da revisão de Cloud Run, conta OpenWeather e teto de cobrança, IAM Secret Manager/Firestore, canário sem tráfego, controle da ausência de segundo caminho de coleta, plano de rollback e autorização explícita. Preserve os 12 agentes, o original, os backups e as exclusões de fontes.
