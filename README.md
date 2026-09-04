# Blaise V6 RJ

Base Android do monitor integrado de clima, alertas e risco do Estado do Rio de Janeiro.

## Toolchain reproduzível

- JDK 17
- Android SDK/API 35
- Android Build Tools 35.0.0
- Gradle Wrapper 8.11.1
- Android Gradle Plugin 8.9.2
- Kotlin 2.0.21
- AndroidX + Jetpack Compose BOM 2024.12.01
- Google Play Billing 9.1.0
- bundletool 1.18.3 com SHA-256 fixado no CI/Release Gate

## Gates executáveis

- `./scripts/ci.sh`: lint Debug/Release, testes unitários Debug/Release, APK Debug/Release, APK de instrumentação, AAB Release, SBOM, validação de artefatos, hashes e secret scan.
- `Android Runtime`: emulador API 35, testes instrumentados, ciclo de vida, offline/recuperação, reinício de processo, notificação P0, seleção persistente de municípios e entitlement fail-closed.
- `Android Release Gate`: fail-closed; exige credenciais de assinatura via GitHub Secrets, IDs de produtos Play e endpoint HTTPS de verificação via GitHub Variables; valida APK/AAB assinados antes de gerar evidência de release.

## Estado funcional implementado

- P0 oficial independente de entitlement.
- Políticas de atualização, cache/offline, retenção, boletins e entrega de alertas.
- Catálogo dos 92 municípios do RJ com códigos IBGE oficiais e busca sem depender de acentuação.
- Seleção simultânea e persistente de Cidade 1 e Cidade 2.
- Canais Android de notificação com prioridade elevada e vibração para P0/vermelho.
- Google Play Billing integrado para consulta de assinaturas, consulta de ofertas elegíveis e abertura do fluxo oficial de compra.
- Entitlement premium permanece bloqueado até validação positiva de um backend HTTPS; purchaseToken nunca é tratado como prova local suficiente.

## Configuração de produção do Billing

O pacote de produção exige as variáveis `BLAISE_MONTHLY_PRODUCT_ID`, `BLAISE_ANNUAL_PRODUCT_ID` e `BLAISE_ENTITLEMENT_VERIFY_URL`. O endpoint deve ser HTTPS e validar a assinatura no servidor com Google Play Developer API/RTDN. Preço, teste grátis e elegibilidade são definidos no Play Console e retornados pelo Google Play; o app não fabrica esses dados.

Produção continua fail-closed: Play Console, backend real de entitlement, integrações meteorológicas externas completas e demais gates de produto só podem ser marcados como PASS com evidência real.

Consulte `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md` e `docs/SECURITY.md`.
