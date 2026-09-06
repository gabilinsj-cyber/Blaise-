# FCM/P0 — Blaise V6 RJ

## Objetivo

O canal FCM de produção é reservado aqui para alertas P0 oficiais. P0 continua independente de assinatura. O transporte não concede acesso premium e não altera o entitlement.

## Cliente Android

- Firebase Messaging é inicializado somente quando os quatro valores reais de produção estão presentes: application id, API key, project id e sender id.
- Sem configuração Firebase, o app continua compilando e executando, mas o push FCM fica fail-closed e não é tratado como disponível.
- O cliente se inscreve no tópico `blaise-rj-p0` sem registrar ou enviar o token FCM ao backend Blaise.
- `onNewToken` nunca registra o token em log.
- Somente payload `schemaVersion=1`, `eventType=p0_official_alert`, `authority=official` e `severity=P0` é aceito pelo parser P0.
- Alertas expirados, com horário futuro além da tolerância, validade superior a 24h ou município RJ não canônico são rejeitados.
- O P0 aceito é entregue pelo `AlertNotifier` com `Entitlement(active=false)`, exercitando explicitamente o bypass P0 existente.

## Publicação backend preparada

`backend/src/fcm.mjs` prepara a mensagem data-only de alta prioridade para o tópico P0 e usa OAuth/ADC com o escopo Firebase Messaging. Não existe endpoint público para publicar P0: uma futura ingestão oficial deverá chamar o gateway somente depois de verificar a origem oficial e reconciliar o evento.

O backend não incorpora chave JSON de service account, token FCM, purchase token ou identificador de usuário no payload P0.

## Gate de release

O pacote de produção agora exige também:

- `BLAISE_FIREBASE_APPLICATION_ID`
- `BLAISE_FIREBASE_API_KEY`
- `BLAISE_FIREBASE_PROJECT_ID`
- `BLAISE_FIREBASE_SENDER_ID`

Enquanto o projeto Firebase real não existir, esses itens permanecem `BLOCKED_EXTERNAL`; não usar valores fictícios para obter PASS.

## Limites atuais

A infraestrutura real Firebase/Google Cloud, credenciais ADC/Workload Identity, envio FCM real, entrega em aparelho real e ingestão de fonte oficial P0 ainda exigem configuração externa e evidência executada. A presença do código e dos testes não equivale a push de produção ativo.
