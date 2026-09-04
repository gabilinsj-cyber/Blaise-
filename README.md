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
- bundletool 1.18.3 com SHA-256 fixado no CI/Release Gate

## Gates executáveis

- `./scripts/ci.sh`: lint Debug/Release, testes unitários Debug/Release, APK Debug/Release, APK de instrumentação, AAB Release, SBOM, validação de artefatos, hashes e secret scan.
- `Android Runtime`: emulador API 35, testes instrumentados, ciclo de vida, offline/recuperação, reinício de processo, notificação P0 e seleção persistente de municípios.
- `Android Release Gate`: fail-closed; exige credenciais de assinatura via GitHub Secrets e valida APK/AAB assinados antes de gerar evidência de release.

## Estado funcional implementado

- P0 oficial independente de entitlement.
- Políticas de atualização, cache/offline, retenção, boletins e entrega de alertas.
- Catálogo dos 92 municípios do RJ com códigos IBGE oficiais e busca sem depender de acentuação.
- Seleção simultânea e persistente de Cidade 1 e Cidade 2.
- Canais Android de notificação com prioridade elevada e vibração para P0/vermelho.

Produção continua fail-closed: assinatura final, Play Console, integrações externas completas e demais gates de produto só podem ser marcados como PASS com evidência real.

Consulte `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md` e `docs/SECURITY.md`.
