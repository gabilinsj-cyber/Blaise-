# Evidências — Blaise V6 RJ 6.0.0-rc.1

Política: `PASS` somente com execução registrada; `FAIL` para execução malsucedida; `BLOCKED` para dependência externa comprovada; `NOT_RUN` para o que não foi executado. Uma preparação `PASS` não é promovida para produção sem a evidência da etapa seguinte.

## Baseline validado atual

Código validado: `d2e3ff5d06022461a09e84d2436997d7cef216ed` (`feat: add fail-closed Google Play entitlement backend foundation`).

- Android CI run `34009691574`: `PASS` no mesmo SHA. Incluiu validação de scripts, instalação/verificação/testes do backend de entitlement, lint Debug/Release, testes unitários Android Debug/Release, APKs, AAB, SBOM, bundletool, alinhamento/assinatura de artefatos de CI e secret scan.
- Artefato CI `blaise-v6-evidence`, id `9982104796`: digest `sha256:891e2cfccac1b52b1d40e7391c7d8c46fba6b6225d46cff246d5ace3f0316274`.
- Android Runtime run `34009691557`: `PASS` no mesmo SHA. Setup, JDK 17, SDK/Build Tools 35, wrapper, KVM, instrumentation, smoke e upload das evidências concluíram com sucesso.
- Backend de entitlement: testes de CI `PASS`; contrato fail-closed, consulta Google Play Developer API, estados de assinatura, acknowledgement e RTDN estão implementados como fundação executável. Isso não significa backend de produção implantado.

## Assinatura de produção

Release Gate run `33982986792` (`workflow_dispatch`, baseline `cbd874fb2b787b40a18981e2bbb5613bdf80355a`) comprovou:

- preparação da assinatura de produção: `PASS`;
- keystore PKCS12/alias/senhas do GitHub Actions: combinação válida, sem exposição dos valores;
- build do APK/AAB assinado: `BLOCKED` antes da compilação porque as variáveis reais `BLAISE_MONTHLY_PRODUCT_ID`, `BLAISE_ANNUAL_PRODUCT_ID` e `BLAISE_ENTITLEMENT_VERIFY_URL` não estavam configuradas.

Portanto, não é correto registrar ausência de keystore como bloqueio atual. O bloqueio atual do pacote assinado é a configuração externa real de Google Play Billing/backend. O Release Gate permanece manual e fail-closed.

## Dependências externas ainda bloqueadas

- Conta pessoal do Google Play Console: cadastro enviado e em análise pelo Google; `BLOCKED` até aprovação.
- Assinaturas Play: IDs reais, base plans/ofertas, R$ 3,93 mensal, R$ 35,00 anual e trial de 72 h: `BLOCKED` até acesso ao Play Console; nenhum ID fictício será usado.
- Backend de entitlement em produção: código/testes `PASS`, mas Google Cloud project, Play Developer API, service account vinculada ao Play Console, implantação HTTPS e RTDN/Pub/Sub reais: `BLOCKED`.
- Release Gate com APK/AAB assinados, zipalign, apksigner, jarsigner, bundletool e hashes: `BLOCKED` até os três valores reais acima estarem disponíveis.
- Firebase Test Lab remoto: configuração presente; execução real `BLOCKED` por ausência de projeto/credencial autorizada.
- Carga de 3 milhões de instalações/9 milhões de consultas: teste real `NOT_RUN` enquanto não houver backend/ambiente de carga autorizado.
- Fontes meteorológicas/alertas P0 em produção, FCM, TTS editorial de produção, canary, rollout/rollback e upload Play Console: `BLOCKED`/`NOT_RUN` conforme dependências externas.

## Regra de release

P0 oficial permanece independente da assinatura. `RC/Release PASS` só poderá ser declarado depois de evidência executada de pacote assinado, backend real, configuração Play, runtime/dispositivo e gates externos aplicáveis; nenhum placeholder transforma gate bloqueado em sucesso.
