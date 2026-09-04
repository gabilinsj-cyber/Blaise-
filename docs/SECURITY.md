# Segurança e cadeia de fornecimento

- JDK, Gradle Wrapper, AGP e SDK são fixados; CI valida o wrapper.
- Segredos e keystores nunca entram no repositório.
- Release de produção usa Play App Signing e credenciais protegidas no ambiente de CI.
- Google Play Billing usa biblioteca 9.1.0. Compra local nunca concede entitlement sozinha: somente estado PURCHASED, produto configurado e verificação positiva no backend podem liberar conteúdo premium; PENDING, produto desconhecido, falha de verificação ou backend indisponível permanecem fail-closed.
- A confirmação/acknowledgement e a validação definitiva da assinatura devem ocorrer no backend seguro com Google Play Developer API/RTDN antes da promoção para produção.
- Network Security Config usa apenas TLS e adaptadores devem validar esquema, tamanho, origem e timestamps.
- SBOM CycloneDX é produzido de dependências resolvidas; revisão de vulnerabilidades deve ocorrer no CI e antes da promoção.
- Logs são estruturados, minimizados e sem voz, localização precisa, tokens de compra ou conteúdo pessoal.

