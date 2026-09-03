# Evidências — Blaise V6 RJ 6.0.0-rc.1

Política: `PASS` somente com execução registrada; `FAIL` para execução malsucedida; `BLOCKED` para dependência externa comprovada; `NOT_RUN` para o que não foi executado.

## Ciclos executados

1. Run `33784726808`: `FAIL` em 1/4 testes. Causa: comparação Unicode não representava a ordenação pt-BR.
2. Run `33785243817`: build, lint, 4/4 testes, APK e AAB passaram; `FAIL` posterior no SBOM porque a configuração foi consultada no projeto raiz.
3. Run `33785698507`: pipeline completo `PASS`; commit `1b045c95832bf51875847b27b695f3d7721f2e79`.
4. Run `33786338714`: pipeline completo e APK de instrumentation `PASS`; commit de artefato `e276237afcf87955c1b3a2d9d760eed4af8247b7`.

## Evidência final executada

- GitHub Actions: <https://github.com/gabilinsj-cyber/Blaise-/actions/runs/33786338714>
- Gradle Wrapper validado: SHA-256 `498495120a03b9a6ab5d155f5de3c8f0d986a449153702fb80fc80e134484f17`.
- `lintDebug`: `PASS`.
- `testDebugUnitTest`: `PASS`, 4/4.
- `assembleDebug`: `PASS`.
- `bundleRelease`: `PASS`.
- APK: 9.487.553 bytes; SHA-256 `83eb5e96d5acbbea5828642083e2f9097f78d1ed2dea524b1f8e65e3593ea01c`.
- APK de instrumentation: 961.346 bytes; SHA-256 `e341ddc138dcf1a404bb6e694cf6853a7f74dbde4d9592874fb5bd374d444d26`.
- AAB: 1.517.475 bytes; SHA-256 `0e905cfeb3fa1786c6077621c82360b1201bfe5fc8015c00775adcab1a9e54e1`.
- `zipalign -c -P 16 -v 4`: `PASS`.
- `apksigner verify`: `PASS`, assinatura de debug RSA 2048, APK Signature Scheme v2.
- `bundletool validate`: `PASS` (exit code 0).
- SBOM CycloneDX 1.5: `PASS`, 157 componentes resolvidos.
- Secret scan de padrões de alta confiança: `PASS`.

## Limites e gates externos

- O AAB é real e validado, mas está sem assinatura de produção: assinatura Play App Signing `BLOCKED` por ausência de keystore/credencial de produção.
- Instrumentation/E2E em dispositivo: configuração Firebase Test Lab presente; execução remota `BLOCKED` por ausência de projeto e credencial Firebase.
- Carga de 3 milhões de instalações/9 milhões de consultas: somente arquitetura e plano documentados; teste real `NOT_RUN` porque não há backend/ambiente de carga autorizado.
- Canary, rollout e rollback: plano preparado; execução Play Console `BLOCKED` por ausência de aplicação/credencial de produção.
- RC: `BLOCKED` enquanto o gate de runtime instrumentado não passar.
- Release: `BLOCKED`; não aprovado sem assinatura e evidência de produção.
