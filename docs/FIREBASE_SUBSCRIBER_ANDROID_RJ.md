# Blaise V6 RJ — Login Android por e-mail verificado (etapa de integração)

**Escopo RJ, ambiente de teste; NÃO publicar como produção.** Depende dos PRs #90 (shield), #91 (atribuição de conta), #92 (backend Firebase).

## Código incluído

- Dependência `com.google.firebase:firebase-auth` via BOM existente.
- Conta Firebase Authentication persistente pelo SDK, com e-mail/senha, criação, confirmação do endereço, reenvio do e-mail de confirmação, recuperação de senha e saída. Senhas e ID tokens não são salvos no aplicativo nem em logs.
- Acesso ao login na área de assinatura da interface, quando `BLAISE_SUBSCRIBER_AUTH_ENABLED=true`. Não interrompe notícias, voz, mapa ou alertas públicos.
- Antes de uma compra com o recurso ativo, exige usuário logado e `isEmailVerified`; calcula o identificador SHA-256 preparado no PR #91 e preenche `BillingFlowParams.setObfuscatedAccountId`.
- Pedidos HTTPS de validação de assinatura, dashboard premium, dados municipais premium e marés premium passam a exigir `Authorization: Bearer <Firebase ID token>`; o token é obtido pelo SDK Firebase e renovado sob demanda. Servidor deve **sempre** verificar assinatura e titularidade de forma independente.
- `onResume` atualiza o estado de assinatura ao retornar do login ou depois de trocar de conta.

## Flags e dependências reais de configuração

- Android: `BLAISE_SUBSCRIBER_AUTH_ENABLED=true`; obrigatório ter `BLAISE_FIREBASE_APPLICATION_ID`, `BLAISE_FIREBASE_API_KEY`, `BLAISE_FIREBASE_PROJECT_ID` e `BLAISE_FIREBASE_SENDER_ID` reais e correspondentes ao mesmo aplicativo/projeto.
- Backend: `BLAISE_REQUIRE_SUBSCRIBER_IDENTITY=true` e `BLAISE_FIREBASE_PROJECT_ID` exato do mesmo projeto Firebase.
- No console do Firebase Authentication: habilitar o provedor **E-mail/senha**, configurar mensagens de verificação e domínios autorizados. Certificar-se de que a conta Firebase e o Google Play funcionam com o `applicationId` correto e com assinaturas de teste.
- `true` apenas no Android ou apenas no backend causa falha de acesso premium (fail-closed). Não lançar builds divergentes e nunca ativar só uma das flags em produção.
- `false` é a configuração padrão por compatibilidade com builds de teste. **Isso não comprova segurança de titularidade.** O Release Gate e o deployment ainda precisam impedir pacotes de produção sem identidade habilitada e comprovada.

## Antes de qualquer merge/publicação

1. Testar CI Android/backend e unidade dos verificadores com flags de produção.
2. Testar o fluxo real no Firebase e Google Play em dispositivos físicos usando contas diferentes; verificar atualização, revogação, logout, token expirado e troca de aparelho.
3. Planejar recuperação para usuários com compras legadas sem `obfuscatedExternalAccountId`. A política atual em modo seguro rejeita esses tokens; fornecer migração autorizada antes de ativar.
4. Testar ausência de crashes quando Firebase não está configurado e preservação de alertas P0; conferir Samsung/Amazon separadamente.
5. Validar backend (certificados Secure Token, auditoria de tokens revogados, quota/Cloud Armor), termos e política de privacidade LGPD, canário e rollback em infraestrutura real.
6. Estabelecer teste de integração real com e-mail verificado; CI com mocks e compilação Android **não valida serviços externos**.

Documentação oficial: https://firebase.google.com/docs/auth/android/password-auth
