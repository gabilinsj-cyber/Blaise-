# Blaise-Trabalhe diretamente no repositório GitHub:

gabilinsj-cyber/Blaise-

Este é o projeto Android Blaise V6 RJ.

REGRA PRINCIPAL:
“Sempre o melhor, tudo junto.”

Inspecione primeiro todo o repositório e depois execute automaticamente a alternativa tecnicamente superior, sem me pedir escolhas intermediárias.

Faça tudo integrado:

1. Inicialize ou corrija o projeto Android existente.
2. Configure uma toolchain Android estável e reproduzível, usando JDK 17, Android SDK/API 35 e Gradle Wrapper compatível.
3. Configure corretamente AGP, Kotlin, AndroidX e Jetpack Compose.
4. Implemente a arquitetura base do Blaise V6 RJ.
5. Preserve e integre todo código válido já existente.
6. Configure os módulos/camadas de clima, alertas, cidades, radar, risco, marinha, trânsito, notícias, assinatura, Blaise/voz, configurações e observabilidade.
7. Prepare suporte aos 92 municípios do RJ e seleção simultânea de Cidade 1 e Cidade 2.
8. Mantenha alertas oficiais P0 disponíveis independentemente do entitlement.
9. Aplique segurança, privacidade, minimização de dados, cache, freshness, offline/recovery e failover.
10. Crie testes unitários, instrumentation e E2E necessários.
11. Crie GitHub Actions para CI Android.
12. Compile de verdade o projeto.
13. Corrija imediatamente TODOS os erros de Gradle, SDK, dependências, código, testes e CI encontrados.
14. Depois de cada correção, execute novamente os testes/builds afetados.
15. Gere APK e AAB reais.
16. Valide os artefatos com zipalign, apksigner e bundletool quando aplicável.
17. Gere SHA-256 e evidências dos artefatos.
18. Prepare SBOM e verificações de segurança.
19. Execute os testes de runtime possíveis no ambiente.
20. Prepare Firebase Test Lab para os testes instrumentados que dependerem dele.
21. Documente carga/escala para aproximadamente 3 milhões de instalações e picos de 9 milhões de consultas, sem afirmar que essa escala foi testada se não houver teste real.
22. Prepare failover, canary e rollback.
23. Crie documentação técnica e relatório de evidências.
24. Faça commits claros no repositório.

POLÍTICA FAIL-CLOSED:

PASS = realmente executado, validado e com evidência.
FAIL = executado e falhou.
BLOCKED = existe bloqueio externo comprovado.
NOT_RUN = ainda não executado.

Não invente resultados.

RC só pode ser PASS quando os gates obrigatórios realmente passarem.

Release só pode ser APPROVED quando houver evidências suficientes de produção.

Se faltar assinatura de produção, credencial, Firebase ou outro recurso externo, marque somente esse gate como BLOCKED e continue corrigindo e executando tudo que puder ser resolvido localmente.

Não pare no primeiro erro.

Ciclo obrigatório:
inspecionar → implementar → compilar → testar → analisar erro → corrigir causa raiz → executar novamente.

Continue até não existir mais erro solucionável no ambiente.

No final informe:

- versão;
- commit SHA;
- arquivos criados/modificados;
- Gradle/JDK/SDK/AGP utilizados;
- testes executados;
- erros encontrados e corrigidos;
- APK real e caminho;
- SHA-256 do APK;
- AAB real e caminho;
- SHA-256 do AAB;
- resultados de assinatura/validação;
- SBOM;
- resultados de runtime;
- evidências;
- Build Gate;
- APK Gate;
- AAB Gate;
- Runtime Gate;
- Security Gate;
- RC;
- Release;
- bloqueios externos restantes.

Não declare sucesso sem evidência verificável.

Execute agora tudo que estiver ao seu alcance no repositório.
