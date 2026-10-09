# Blaise V6 RJ — Firebase subscriber authorization gate (staged)

**Escopo**: somente Rio de Janeiro. Código implementado nesta branch como gate de segurança, mas **DESATIVADO na configuração padrão** até Android, Firebase e migração de compras existentes estarem prontos. **Não implantar nem integrar à main como solução concluída.**

## Gate do backend

- `BLAISE_REQUIRE_SUBSCRIBER_IDENTITY=true` habilita a exigência de Firebase ID token no cabeçalho `Authorization: Bearer <ID_TOKEN>` em `POST /v1/entitlements/verify`, `/v1/data/dashboard`, `/v1/data/municipalities` e `/v1/data/chm/tide`.
- Exige `BLAISE_FIREBASE_PROJECT_ID` com o projeto Firebase real. Inicialização falha se ausente.
- Verificador usa `google-auth-library` (já presente no lock), certificados X.509 públicos oficiais de Secure Token, checagem RS256/`kid`, issuer `https://securetoken.google.com/<project>`, audience, `sub`, datas, confirmação `email_verified` e somente provedores `password` ou `google.com`. Falhas de chave/assinatura/claims retornam `401` sem consulta de compra; nenhum token/UID é logado.
- Depois da validação do Google Play, compara `externalAccountIdentifiers.obfuscatedExternalAccountId` ao digest SHA-256 do UID autenticado. Compra ativa com titular divergente ou identificador ausente retorna `{active:false}`; as rotas pagas retornam `403 access_denied`. Nunca associar compras antigas automaticamente à primeira conta que apresentar token.
- O endpoint público `/healthz` e a publicação de alertas oficiais P0 permanecem separados das verificações de assinaturas.
- Testes unitários incluem identidade inválida, outro titular, modo de configuração inválido, 401 sem consulta ao Google, e rotas pagas. Testes simulados de certificados **não provam** emissão de um token real por Firebase.

## Etapas obrigatórias antes de habilitar em produção

1. Provisionar **Firebase Authentication**, ativar e-mail/senha e verificação de e-mail; avaliar login Google (Credential Manager). Não usar autenticação anônima como titularidade.
2. Adicionar `firebase-auth` no Android, tela de cadastro/login/recuperação e persistência de sessão; validar e-mail antes da compra e transmissão do token ID via HTTPS em toda requisição paga. **Essa etapa ainda não faz parte deste PR.**
3. Integrar `BillingFlowParams.Builder.setObfuscatedAccountId` com digest do UID autenticado (helper no PR #91), antes de iniciar compra. Tratar logout/relogin e atualização de ID token.
4. Criar plano de migração supervisionada de assinaturas preexistentes cujo Google Play não retorna `obfuscatedExternalAccountId`; não negar arbitrariamente assinaturas pagas atuais sem fluxo de recuperação.
5. Testar com Firebase e Google Play reais em dispositivos de teste: assinatura nova, expirada/cancelada/reembolsada, conta A versus B, troca de aparelho, token revogado, sessão expirada, compras antigas e assinatura em múltiplos aparelhos.
6. Conferir revogação de sessões pelo Admin SDK ou serviço equivalente quando necessária (a verificação offline de assinatura não consulta estado de conta revogada). Adicionar App Check/Play Integrity com proteção por risco e WAF Cloud Armor, com limite de custo/quotas. A política global de antiabuso não é coberta por este gate.
7. Manter `BLAISE_REQUIRE_SUBSCRIBER_IDENTITY=false` em builds de desenvolvimento que não tenham login preparado. **Não lançar produção** com acesso premium baseado apenas em token de compra. Não usar o flag false como correção para falhas de login.

## Dependências
PR #90 Shield RJ e PR #91 preparação do hash e vínculo. Merge seguro somente depois de revisar todos os PRs, gates e exigências de implantação. Samsung/Amazon precisam validação própria.

Referências oficiais:
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://firebase.google.com/docs/auth/android/manage-users
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
