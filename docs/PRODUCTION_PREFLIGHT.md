# Production Preflight — Blaise V6 RJ

Este gate é **manual** e não implanta recursos, não cria serviços pagos e não publica o app. Ele existe para transformar as dependências externas de produção em evidência verificável antes do Release Gate final.

## O que valida

O script `scripts/production-preflight.sh` falha fechado se faltar qualquer configuração obrigatória de produção ou se houver formato inválido. Ele valida, sem imprimir valores sensíveis:

- IDs mensal/anual do Google Play e diferença entre eles;
- URL HTTPS real do verificador de entitlement;
- configuração Firebase Android;
- audience + service account do Pub/Sub RTDN;
- audience + service account do canal interno P0;
- audience + service account da observabilidade interna.

`BLAISE_PREFLIGHT_LIVE_PROBE` aceita somente `true` ou `false`; qualquer outro valor bloqueia o gate em vez de desativar silenciosamente a verificação externa.

Quando `BLAISE_PREFLIGHT_LIVE_PROBE=true`, o gate também verifica externamente `GET /healthz` e `GET /readyz` do backend HTTPS. Se a URL de verificação seguir o contrato padrão `/v1/entitlements/verify`, a URL-base é derivada automaticamente; caso contrário, definir `BLAISE_BACKEND_BASE_URL`.

## Variáveis GitHub esperadas

- `BLAISE_MONTHLY_PRODUCT_ID`
- `BLAISE_ANNUAL_PRODUCT_ID`
- `BLAISE_ENTITLEMENT_VERIFY_URL`
- `BLAISE_BACKEND_BASE_URL` (opcional no caminho padrão)
- `BLAISE_FIREBASE_APPLICATION_ID`
- `BLAISE_FIREBASE_API_KEY`
- `BLAISE_FIREBASE_PROJECT_ID`
- `BLAISE_FIREBASE_SENDER_ID`
- `BLAISE_PUBSUB_AUDIENCE`
- `BLAISE_PUBSUB_SERVICE_ACCOUNT`
- `BLAISE_P0_AUDIENCE`
- `BLAISE_P0_SERVICE_ACCOUNT`
- `BLAISE_OBSERVABILITY_AUDIENCE`
- `BLAISE_OBSERVABILITY_SERVICE_ACCOUNT`

Não usar placeholders para obter PASS.

## Auto-teste no CI

`scripts/test-production-preflight.sh` executa no Android CI com valores de teste isolados e **sem probe externa**. Ele comprova o comportamento fail-closed do script para configuração válida, URL HTTP inválida, IDs duplicados, service account inválida e modo de probe inválido. Também verifica que o arquivo de evidência não contém os valores de teste sensíveis usados na execução.

O resultado `PRODUCTION_PREFLIGHT_TESTS=PASS` é preservado em `evidence/production-preflight-selftest.txt`. Isso é evidência de comportamento do gate, não evidência de produção.

## Estados de evidência

`PRODUCTION_PREFLIGHT_CONFIG=PASS` significa apenas que os valores obrigatórios existem e passaram nas validações locais de formato. `PRODUCTION_PREFLIGHT_LIVE=PASS` significa apenas que o backend HTTPS respondeu corretamente às probes de liveness/readiness.

Isso **não** prova Google Play API real, entrega FCM real, RTDN real, carga 3M–9M, failover multi-região, Test Lab, canary, rollback ou upload na Play Store. Esses itens continuam `NOT_RUN/BLOCKED_EXTERNAL` até execução no ambiente autorizado.

## Execução

No GitHub Actions, usar o workflow manual **Production Preflight**. O resultado é salvo como artefato `blaise-production-preflight-evidence`, inclusive em falha. Depois que esse gate e os testes externos necessários estiverem verdes, executar separadamente o **Android Release Gate** manual no mesmo SHA de `main`.
