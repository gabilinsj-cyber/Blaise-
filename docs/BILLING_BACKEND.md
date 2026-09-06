# Blaise V6 — backend de entitlement do Google Play

## Estado

O repositório contém uma fundação executável e fail-closed para verificar assinaturas sem confiar no cliente Android. Ela ainda **não é evidência de produção ativa**: a conta do Play Console, os IDs reais das assinaturas, a identidade de serviço e o endpoint HTTPS implantado continuam sendo dependências externas.

## Contrato Android → backend

`POST /v1/entitlements/verify`

Entrada JSON:

```json
{
  "packageName": "br.com.blaise.rj",
  "purchaseToken": "<token recebido do Google Play>",
  "productIds": ["<id real da assinatura>"]
}
```

Saída deliberadamente mínima:

```json
{"active":true}
```

ou

```json
{"active":false}
```

O backend nunca concede acesso com base apenas no estado local do app. Ele consulta `purchases.subscriptionsv2.get`, exige pacote e produto configurados, rejeita PENDING/PAUSED/ON_HOLD/EXPIRED, exige `expiryTime` futuro e mantém acesso para ACTIVE, IN_GRACE_PERIOD e CANCELED somente enquanto o item ainda não expirou. Compras de teste são bloqueadas por padrão.

Quando a compra inicial ainda está com `ACKNOWLEDGEMENT_STATE_PENDING`, o backend chama a API de acknowledgement antes de retornar acesso. Uma corrida de acknowledgement só é aceita se uma nova consulta ao Google confirmar que a compra já está acknowledged.

## RTDN

`POST /v1/google-play/rtdn` recebe envelopes de Cloud Pub/Sub. O endpoint exige token OIDC do push subscription, validado por audience e e-mail da service account configurada. Depois decodifica o `data` Base64, exige o packageName do Blaise e consulta a Google Play Developer API novamente. A RTDN é tratada apenas como sinal de mudança; o status completo vem da API do Google Play.

O desenho é propositalmente stateless para minimizar retenção. Não há banco com histórico de token, localização, voz ou consultas. Isso reduz superfície de privacidade; o app revalida o entitlement contra o backend quando consulta a assinatura.

## Variáveis obrigatórias do serviço

- `BLAISE_ANDROID_PACKAGE=br.com.blaise.rj`
- `BLAISE_MONTHLY_PRODUCT_ID=<ID real do Play Console>`
- `BLAISE_ANNUAL_PRODUCT_ID=<ID real do Play Console>`
- `BLAISE_PUBSUB_AUDIENCE=<URL/audience configurado para o push>`
- `BLAISE_PUBSUB_SERVICE_ACCOUNT=<service account usada pelo Pub/Sub push>`
- `BLAISE_ALLOW_TEST_PURCHASES=false` em produção

O serviço usa Application Default Credentials por `google-auth-library` com o escopo `https://www.googleapis.com/auth/androidpublisher`. Em Cloud Run, usar uma service account dedicada como identidade do serviço; não colocar arquivo JSON de chave ou `GOOGLE_APPLICATION_CREDENTIALS` no container.

## Configuração externa ainda necessária

1. Aprovação da conta Google Play Console e criação do app.
2. Criação/ativação das assinaturas mensal e anual e oferta de teste de 72h.
3. Google Cloud project com Google Play Developer API habilitada.
4. Service account dedicada convidada no Play Console apenas com permissões necessárias para pedidos/assinaturas.
5. Implantação HTTPS do backend e configuração do `BLAISE_ENTITLEMENT_VERIFY_URL` no GitHub.
6. Pub/Sub/RTDN com push OIDC para o endpoint RTDN.
7. Teste real com licença/test account e evidência do ciclo compra → verify → acknowledge → renovação/cancelamento/expiração.

## Segurança

Corpos HTTP têm limite de tamanho, respostas usam `no-store`, o backend não segue lógica enviada pelo cliente para determinar entitlement e não registra token de compra. Falhas da API Google, autenticação ou acknowledgement resultam em indisponibilidade/fail-closed. O P0 oficial do Blaise permanece fora deste gate e não depende de assinatura.

Referências oficiais:
- Google Play Developer API `purchases.subscriptionsv2`: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
- Acknowledge de assinatura: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge
- RTDN: https://developer.android.com/google/play/billing/rtdn-reference
- Purchase lifecycle/RTDN: https://developer.android.com/google/play/billing/lifecycle
