# Backend de produção — implantação e operação

## Estado deste pacote

O backend Blaise possui código e testes para verificação de entitlement Google Play, acknowledgement, RTDN autenticado por OIDC, proteção fail-closed e preparação de FCM P0. O CI também executa o container de produção localmente e valida `/healthz`.

Isso **não** significa que o backend esteja implantado em produção. URL pública HTTPS, projeto Google Cloud/Firebase, permissões Android Publisher, Pub/Sub, identidade gerenciada, FCM real, carga e failover continuam dependências externas até haver evidência executada.

## Arquitetura de implantação recomendada

Usar um runtime HTTPS gerenciado compatível com container, preferencialmente Cloud Run no mesmo projeto Google Cloud vinculado ao Play/Firebase. O container deve usar identidade gerenciada/ADC; não colocar JSON de service account no repositório, imagem, variáveis públicas ou APK.

O serviço de entitlement precisa ter somente as permissões mínimas necessárias para consultar/acknowledge assinaturas no Android Publisher. A publicação FCM deve usar somente a permissão necessária do Firebase Cloud Messaging. Separar identidades quando a política operacional exigir isolamento entre verificação de compra, RTDN e publicação P0.

## Configuração obrigatória

Backend de entitlement:

- `BLAISE_ANDROID_PACKAGE=br.com.blaise.rj`
- `BLAISE_MONTHLY_PRODUCT_ID=<id real do Play Console>`
- `BLAISE_ANNUAL_PRODUCT_ID=<id real do Play Console>`
- `BLAISE_PUBSUB_AUDIENCE=<URL/audience HTTPS real do push Pub/Sub>`
- `BLAISE_PUBSUB_SERVICE_ACCOUNT=<service account autorizada do push Pub/Sub>`
- `BLAISE_ALLOW_TEST_PURCHASES=false` em produção

Android/Release Gate:

- `BLAISE_ENTITLEMENT_VERIFY_URL=<HTTPS real>/v1/entitlements/verify`
- `BLAISE_FIREBASE_APPLICATION_ID=<app id Android real>`
- `BLAISE_FIREBASE_API_KEY=<API key do app Firebase real>`
- `BLAISE_FIREBASE_PROJECT_ID=<project id real>`
- `BLAISE_FIREBASE_SENDER_ID=<sender id real>`

Não preencher nenhum desses campos com placeholders para obter PASS de release.

## RTDN e idempotência

O endpoint `/v1/google-play/rtdn` exige OIDC com audience e e-mail da service account exatamente configurados. O payload é reconsultado no Google Play; o evento recebido não é usado como prova autônoma de entitlement.

Existe um replay guard em memória, limitado e com TTL de 24h, baseado somente em `messageId` do Pub/Sub. Ele evita reprocessamento duplicado dentro da mesma instância e somente marca o evento depois de processamento bem-sucedido; falhas permanecem elegíveis para retry.

Esse guard **não é uma garantia global entre múltiplas instâncias**. Antes de classificar RTDN como idempotência global de produção, validar se as operações Google usadas são suficientemente idempotentes para o volume real e, se necessário, adicionar uma store compartilhada com TTL e chave de `messageId`. Esse item fica `BLOCKED_EXTERNAL/NOT_RUN` até existir ambiente de produção.

## Segurança HTTP

- somente JSON nos endpoints POST; content type incorreto retorna 415;
- corpo limitado; JSON inválido retorna 400;
- falhas de verificação retornam 503 sem expor tokens ou detalhes internos;
- `Cache-Control: no-store`, `nosniff`, política de referrer, CSP, frame denial e Permissions-Policy;
- timeouts de request/header/keep-alive configurados;
- nenhum purchase token, token FCM ou dado de usuário deve aparecer em logs.

## Saúde, escala e rollout

`GET /healthz` é a probe local básica. O CI comprova inicialização real do container como usuário não-root e resposta da probe, mas não mede dependências Google externas.

Para produção, configurar autoscaling, limites de concorrência, orçamento de timeout e proteção de borda compatíveis com picos previstos. O teste de 3M instalações/9M consultas continua `NOT_RUN` até existir ambiente autorizado. Canary, rollback e failover devem usar evidências do ambiente real; não inferir PASS a partir do Docker CI.

## Sequência para fechamento externo

1. Play Console aprovado e produtos reais ativos.
2. Projeto Google Cloud/Firebase vinculado e APIs necessárias habilitadas.
3. Identidade gerenciada com menor privilégio.
4. Backend implantado em HTTPS e `/healthz` validado externamente.
5. Pub/Sub RTDN com OIDC configurado e teste oficial entregue.
6. FCM configurado e P0 de teste controlado recebido em dispositivo de teste.
7. Variáveis reais adicionadas ao GitHub Actions.
8. Novo Android Release Gate manual executado no SHA corrente.
9. Test Lab, carga, canary/rollback e demais gates externos executados e arquivados.
