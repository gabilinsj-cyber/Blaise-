# Blaise V6 RJ

Base Android do monitor integrado de clima e alertas do Estado do Rio de Janeiro.

## Toolchain reproduzível

- JDK 17
- Android SDK 35 / Build Tools 35.0.0
- Gradle Wrapper 8.9
- Android Gradle Plugin 8.7.3
- Kotlin 2.0.21
- AndroidX + Jetpack Compose BOM 2024.12.01

Execute `./scripts/ci.sh`. Evidências e SBOM são escritos em `evidence/`. O build release local é assinado apenas com chave de debug quando explicitamente usado para validação técnica; produção depende de Play App Signing.

Consulte `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md` e `docs/SECURITY.md`.
