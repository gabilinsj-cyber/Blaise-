# Segurança e cadeia de fornecimento

- JDK, Gradle Wrapper, AGP e SDK são fixados; CI valida o wrapper.
- Segredos e keystores nunca entram no repositório.
- Release de produção usa Play App Signing e credenciais protegidas no ambiente de CI.
- Google Play Billing usa biblioteca 9.1.0. Compra local nunca concede entitlement sozinha: somente estado PURCHASED, produto configurado e verificação positiva no backend podem liberar conteúdo premium; PENDING, produto desconhecido, falha de verificação ou backend indisponível permanecem fail-closed.
- Ofertas são consultadas no Google Play imediatamente antes do fluxo de compra; preços e elegibilidade vêm do Play, sem hard-code local. O app relê o ProductDetails antes de chamar launchBillingFlow para reduzir risco de oferta obsoleta.
- O verificador do app aceita somente endpoint HTTPS absoluto, não segue redirects, limita timeout e tamanho de resposta e nunca registra purchaseToken. Sem endpoint válido, usa FailClosedPurchaseVerifier e nenhum conteúdo premium é liberado.
- A confirmação/acknowledgement, RTDN e a validação definitiva da assinatura devem ocorrer no backend seguro com Google Play Developer API antes da promoção para produção.
- O Release Gate exige explicitamente BLAISE_MONTHLY_PRODUCT_ID, BLAISE_ANNUAL_PRODUCT_ID e BLAISE_ENTITLEMENT_VERIFY_URL, além da assinatura de produção; valores ausentes bloqueiam o pacote.
- Network Security Config bloqueia cleartext. BLAISE_MAVEN_PROXY, quando usado, também deve ser HTTPS absoluto; proxy Maven inseguro é rejeitado antes da resolução de dependências.
- SBOM CycloneDX é produzido de dependências resolvidas; revisão de vulnerabilidades deve ocorrer no CI e antes da promoção.
- Logs são estruturados, minimizados e sem voz, localização precisa, tokens de compra ou conteúdo pessoal.
