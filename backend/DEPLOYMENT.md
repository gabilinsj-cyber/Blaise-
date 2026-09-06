# Backend de produção — implantação e operação

## Estado deste pacote

O backend Blaise possui código e testes para verificação de entitlement Google Play, acknowledgement, RTDN autenticado por OIDC, proteção fail-closed, retry transitório limitado, controle de concorrência sem fila ilimitada, canal interno P0 autenticado por OIDC, deduplicação local de alertas P0 e métricas operacionais allowlisted sem dimensões de usuário. O CI executa o container de produção localmente, valida `/healthz`, `/readyz`, autenticação fail-closed dos endpoints internos e smoke de concorrência/backpressure.

Isso **não** significa que o backend esteja implantado em produção. URL pública HTTPS, projeto Google Cloud/Firebase, permissões Android Publisher, Pub/Sub, identidades gerenciadas, FCM real, exportação real de observabilidade, carga de escala e failover multi-região continuam dependências externas até haver evidência executada.

## Arquitetura de implantação recomendada

Usar um runtime HTTPS gerenciado compatível com container, preferencialmente Cloud Run no mesmo projeto Google Cloud vinculado ao Play/Firebase. O container deve usar identidade gerenciada/ADC; não colocar JSON de service account no repositório, imagem, variáveis públicas ou APK.

O serviço de entitlement precisa ter somente as permissões mínimas necessárias para consultar/acknowledge assinaturas no Android Publisher. A publicação FCM deve usar somente a permissão necessária do Firebase Cloud Messaging. Separar identidades para RTDN, publicação P0 e observabilidade, mantendo cada endpoint interno protegido por OIDC e menor privilégio.

Para disponibilidade regional, a arquitetura recomendada é múltiplas regiões atrás de balanceamento HTTPS gerenciado, com health checks, rollout canário e rollback. Essa topologia é desenho de implantação; permanece `BLOCKED_EXTERNAL` até existir infraestrutura real e teste de failover executado.

## Configuração obrigatória

Backend de entitlement e RTDN:

- `BLAISE_ANDROID_PACKAGE=br.com.blaise.rj`
- `BLAISE_MONTHLY_PRODUCT_ID=<id real do Play Console>`
- `BLAISE_ANNUAL_PRODUCT_ID=<id real do Play Console>`
- `BLAISE_PUBSUB_AUDIENCE=<URL/audience HTTPS real do push Pub/Sub>`
- `BLAISE_PUBSUB_SERVICE_ACCOUNT=<service account autorizada do push Pub/Sub>`
- `BLAISE_ALLOW_TEST_PURCHASES=false` em produção
- `BLAISE_VERIFY_MAX_CONCURRENT=128` como ponto inicial, a calibrar por teste real
- `BLAISE_RTDN_MAX_CONCURRENT=64` como ponto inicial, separado do tráfego de entitlement

Canal P0 e observabilidade interna:

- `BLAISE_FIREBASE_PROJECT_ID=<project id real>`
- `BLAISE_FCM_P0_TOPIC=<tópico oficial de P0>`; se omitido, usa `blaise-rj-p0`
- `BLAISE_P0_AUDIENCE=<audience HTTPS exata do endpoint /v1/internal/p0>`
- `BLAISE_P0_SERVICE_ACCOUNT=<identidade autorizada a publicar P0>`
- `BLAISE_P0_MAX_CONCURRENT=32` como ponto inicial
- `BLAISE_OBSERVABILITY_AUDIENCE=<audience HTTPS exata do endpoint /internal/metrics>`
- `BLAISE_OBSERVABILITY_SERVICE_ACCOUNT=<identidade autorizada a ler métricas>`

Pares audience/service account são fail-closed: configurar apenas metade impede a inicialização. Não há bearer token estático de observabilidade no código.

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

## Canal oficial P0

`POST /v1/internal/p0` é um endpoint serviço-a-serviço. Ele só aceita chamada autenticada por OIDC da identidade explicitamente configurada. O payload precisa declarar `authority=official` e `severity=P0`, ter validade temporal limitada e, quando houver cidade, usar código IBGE do RJ válido.

A mensagem enviada ao FCM é data-only, prioridade Android alta, TTL limitado ao restante da validade do alerta e sem userId, purchase token ou identificador de assinatura. O endpoint retorna somente `{accepted:true}`; o identificador interno retornado pelo FCM não é exposto ao chamador.

Há deduplicação em memória por `alertId` durante 24h, marcada somente depois de publicação bem-sucedida. Assim como no RTDN, essa deduplicação é local à instância. Idempotência global multi-instância continua `BLOCKED_EXTERNAL` até existir armazenamento compartilhado ou outra garantia de infraestrutura comprovada.

## Recuperação de upstream

Chamadas Android Publisher e FCM usam retry limitado somente para condições transitórias conhecidas: HTTP 408/425/429, 5xx e erros de rede transitórios allowlisted. O limite é de três tentativas com backoff curto. Erros permanentes como 401/404 não entram em loop de retry.

Os logs de retry registram somente nomes operacionais fixos, nunca purchase token, payload FCM, usuário, cidade ou conteúdo do alerta. Depois do limite, a operação falha fechada.

## Concorrência, backpressure e prioridade operacional

Entitlement, RTDN e P0 possuem gates de concorrência separados. Quando o limite interno é atingido, novas operações não entram em uma fila ilimitada: recebem 503 com `Retry-After: 1`. Isso limita crescimento de memória e preserva capacidade independente para os fluxos críticos durante pico de consultas de assinatura.

Os limites padrão são pontos de partida, não capacidade certificada. Devem ser ajustados junto com a concorrência/autoscaling do runtime usando teste real, limites de quota Google, latência do Android Publisher/FCM e orçamento de memória/CPU.

O CI executa duas provas locais:

- smoke normal: 1.200 verificações com concorrência 48, exigindo 100% de respostas 200 do gateway simulado;
- smoke de saturação: limite deliberado de 2 operações e 64 requisições simultâneas, exigindo combinação de 200/503, pico exatamente limitado e recuperação posterior.

Essas provas demonstram comportamento de concorrência/backpressure do código. **Não demonstram capacidade para 3 milhões de instalações ou 9 milhões de consultas.** O gate de 3M/9M continua `NOT_RUN/BLOCKED_EXTERNAL_LOAD_ENVIRONMENT`.

## Saúde e observabilidade

`GET /healthz` é a probe de liveness local. `GET /readyz` confirma que o processo iniciou e a configuração obrigatória foi aceita; não é prova de conectividade com Google Play, Pub/Sub ou FCM.

`GET /internal/metrics` fica oculto quando não configurado e, quando configurado, exige OIDC da identidade de observabilidade. A resposta contém somente contadores fixos allowlisted, uptime, snapshots de concorrência e quantidade de entradas dos replay guards. Não existem labels livres, payloads, purchase tokens, userId, cidade, consulta ou localização individual.

Contadores atuais cobrem requisições, erros de cliente/servidor, rejeições de autenticação, entitlement ativo/negado, backpressure por fluxo, RTDN processado/duplicado, P0 publicado/duplicado/rejeitado e retries Google Play/FCM.

A exportação para Cloud Monitoring/Prometheus, dashboards, SLOs e alertas permanece `BLOCKED_EXTERNAL` até existir ambiente HTTPS real. O CI prova apenas a política de métricas e que o endpoint interno falha fechado sem identidade válida.

## Segurança HTTP

- somente JSON nos endpoints POST; content type incorreto retorna 415;
- corpo limitado; JSON inválido retorna 400;
- falhas de verificação retornam 503 sem expor tokens ou detalhes internos;
- saturação retorna 503 com retry curto, sem enfileiramento ilimitado;
- endpoints internos P0 e métricas usam OIDC, sem segredo estático embutido;
- `Cache-Control: no-store`, `nosniff`, política de referrer, CSP, frame denial e Permissions-Policy;
- timeouts de request/header/keep-alive configurados;
- nenhum purchase token, token FCM ou dado de usuário deve aparecer em logs ou métricas.

## Escala, rollout e failover

Para produção, configurar autoscaling, limites de concorrência, orçamento de timeout e proteção de borda compatíveis com picos previstos. Canary, rollback, carga 3M/9M e failover multi-região devem usar evidências do ambiente real; não inferir PASS a partir do Docker CI.

## Sequência para fechamento externo

1. Play Console aprovado e produtos reais ativos.
2. Projeto Google Cloud/Firebase vinculado e APIs necessárias habilitadas.
3. Identidades gerenciadas separadas e com menor privilégio para entitlement/RTDN, P0 e observabilidade.
4. Backend implantado em HTTPS e `/healthz`/`/readyz` validados externamente.
5. Pub/Sub RTDN com OIDC configurado e teste oficial entregue.
6. FCM configurado e P0 de teste controlado recebido em dispositivo de teste.
7. Endpoint de métricas ligado ao sistema de observabilidade real, sem exposição pública indevida.
8. Variáveis reais adicionadas ao GitHub Actions.
9. Novo Android Release Gate manual executado no SHA corrente.
10. Test Lab e teste de carga autorizado executados; calibrar concorrência/autoscaling.
11. Canary/rollback e failover multi-região executados e arquivados.
