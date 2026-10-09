# Blaise V6 RJ — identificação do titular da assinatura (preflight)

**Situação: preparação, ainda NÃO ativada.** Esta branch adiciona somente funções determinísticas de atribuição e testes compatíveis no Android e no backend. **Nenhuma rota existente passa a exigir autenticação**, e o token de compra continua insuficiente como prova de titularidade. **Não publicar ou fazer merge como se a identidade já estivesse protegida.**

## Evidência do código atual

- Android usa Google Play Billing, sem fluxo de login/identidade verificado integrado. Firebase Messaging serve a notificações, não é Firebase Authentication.
- `POST /v1/entitlements/verify`, dashboard pago e marés pagas aceitam token de compra; precisam de autenticação consistente antes da produção.
- O backend confirma status e validade via Android Publisher, mas ainda não vincula o token a um usuário autenticado.
- Os alertas meteorológicos essenciais/P0 não podem depender de conta ou pagamento.

## Contrato preparado, sem alteração do comportamento existente

- Identidade futura: UID opaco de conta Firebase Authentication comprovada no servidor por Firebase ID token (audience, issuer, assinatura, expiração, revogação quando aplicável). Não confiar em UID passado isoladamente pelo cliente.
- Para novas compras, depois de login, calcular `SHA256("blaise-v6-rj:google-play:account:v1:" + uid)` em hexadecimal minúsculo de 64 caracteres. Enviar via `BillingFlowParams.Builder.setObfuscatedAccountId` antes de iniciar o fluxo oficial do Google Play. Nunca usar CPF, e-mail, nome ou outro dado identificável diretamente.
- Backend: obter assinatura `purchases.subscriptionsv2.get` do Google, validar estado/produto/expiração, ler `externalAccountIdentifiers.obfuscatedExternalAccountId` e conferir com o mesmo digest do UID **já autenticado pelo servidor**. O helper `matchesVerifiedPlayOwner` é só um comparador; **não** valida identidade nem habilita acesso por conta própria.
- Falhas e compras antigas sem o identificador: negar acesso pelo fluxo novo até existir recuperação/migração autenticada e auditável. **Nunca** atribuir automaticamente a primeira conta que apresentar um token de compra antigo.
- Proteção adicional antes da produção: autenticação em **todas** as rotas pagas, armazenamento compartilhado e transacional de vinculação para renovações/substituições, política de recuperação, cancelamento/reembolso, teste de concorrência e replay, controles contra acesso não autorizado e custo abusivo, logs sem tokens/PII.
- A identidade de usuário é independente da loja; fluxos Samsung/Amazon exigirão verificadores próprios e não herdarão a prova de compra do Google Play.

## Passos obrigatórios que ainda não foram implementados

1. Definir login na interface (recomendação técnica: Firebase Authentication com conta persistente, usando Google ou e-mail com verificação) e fluxo de consentimento/recuperação. Não usar autenticação anônima como identidade permanente de titularidade.
2. Configurar e verificar o token de autenticação no backend (Firebase Admin SDK/ADC), validar revogação quando necessário, tratar erro de autenticação com resposta genérica, sem permissões elevadas no cliente.
3. Passar `setObfuscatedAccountId` no momento da compra **depois** da autenticação; manter compatibilidade segura com compras pré-existentes.
4. Exigir a mesma autenticação e validação de proprietário em `/v1/entitlements/verify`, `/v1/data/dashboard`, `/v1/data/statewide` quando aplicável, e `/v1/data/chm/tide` antes de entregar qualquer dado premium.
5. Adicionar testes de integração com duas contas, troca de aparelhos, compras sem attribution, expiração, RTDN, reembolso, token copiado e rollback; então passar CI e revisão de segurança antes de qualquer merge/deploy.

Documentação oficial:
- https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.Builder#setObfuscatedAccountId(java.lang.String)
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
