# Segurança e cadeia de fornecimento

- JDK, Gradle Wrapper, AGP e SDK são fixados; CI valida o wrapper.
- Segredos e keystores nunca entram no repositório.
- Release de produção usa Play App Signing e credenciais protegidas no ambiente de CI.
- Network Security Config usa apenas TLS e adaptadores devem validar esquema, tamanho, origem e timestamps.
- SBOM CycloneDX é produzido de dependências resolvidas; revisão de vulnerabilidades deve ocorrer no CI e antes da promoção.
- Logs são estruturados, minimizados e sem voz, localização precisa, tokens ou conteúdo pessoal.

