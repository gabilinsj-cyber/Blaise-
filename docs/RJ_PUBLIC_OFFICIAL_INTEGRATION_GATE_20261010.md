# Blaise V6 RJ — integração do painel oficial de segurança e riscos

**Status: código ligado no backend e no Android, mas não publicado em produção nesta PR Draft.** Somente estado do Rio de Janeiro: 92 municípios oficiais IBGE. Nenhuma outra unidade federativa é tratada como município do RJ.

## Implementado e testável
1. **Backend existente:** `official-source-worker.mjs` coleta e valida o risco hidrológico municipal **CEMADEN-RJ / Defesa Civil** (somente quando o serviço e seu conteúdo passarem no contrato) e os avisos **INMET CAP** (somente regiões com geocódigo municipal exato).
2. **Canal público independente do Play Billing:** `GET /v1/public/rj-status`, contrato `BLAISE_RJ_PUBLIC_OFFICIAL_STATUS_V1` em `backend/src/rj-public-status-http.mjs`. Projeta apenas municípios/riscos com horário próprio, avisos válidos com geocódigos RJ e estados de origem. Não retorna localização do assinante, compra, token, saldo, catálogo comercial, imagens de terceiros nem falsa conclusão de tempo seguro.
3. **Android:** `PublicRjOfficialStatus.kt` valida contrato, os 92 municípios, limites de validade, URL exata da fonte, geocódigo e atribuição de avisos. `MainActivity.kt` consulta o canal em intervalos de 60 segundos **quando ligado e em primeiro plano**, independentemente da assinatura. Mostra risco e avisos nas duas cidades, tela de alertas e lista de 92 municípios; se vencer ou ficar inacessível, a consulta **não sustenta** aviso vigente nem nível de risco.
4. **Gráficos existentes:** amostras horárias reais da INMET por estação no município do Rio, sem interpolação nem criação de pontos. Camadas geográficas do Blaise são desenhadas pelo aplicativo, não copiadas de terceiros.
5. **Dez agentes e prioridade das cinco fontes:** regras científicas e de comparação por município/fenômeno em `rj-agent-orchestration.mjs` e `rj-hierarchical-weather-resolution.mjs`, ainda exigindo adaptadores vivos distintos autorizados. Nem o novo GET nem o mapa constituem radar ou integração ao vivo do INPE/Windy.
6. **Testes automatizados:** `backend/test/rj-public-status-http.test.mjs`, `app/src/androidTest/java/br/com/blaise/rj/data/PublicRjOfficialStatusTest.kt` e os suites existentes do painel e do dashboard.

## Proteção ao publicar

O canal público requer DUAS liberações explícitas no ambiente **Cloud Run backend**:

```text
BLAISE_RJ_PUBLIC_STATUS_ENABLED=true
BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED=true
```

- Manter ambas ausentes/desligadas até confirmar o uso permitido e a atribuição dos produtos CEMADEN/Defesa Civil e INMET CAP, inclusive redistribuição em app com assinaturas.
- O operador deve confirmar que `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED` e as fontes apropriadas estão efetivamente configuradas no ambiente, pois o endpoint devolve **503** quando não há produto válido. Verifique o nome real das variáveis com `backend/src/official-source-worker.mjs` antes de configurar.
- O backend ainda exige a configuração de faturamento e credenciais correspondente ao seu servidor. O canal público não solicita assinatura ao cliente, mas isso **não substitui a configuração de boot, IAM, contas e domínios do serviço existente**.
- Informar aos builds Android, por variável de ambiente de build (HTTPS da origem, sem caminho):
```text
BLAISE_RJ_PUBLIC_STATUS_BASE_URL=https://SEU_BACKEND_AUTORIZADO
```
  Não inventar URL de Cloud Run. A configuração Android deixa o cliente desabilitado quando vazia, e não redireciona para outro servidor.
- Para evidência, consultar `GET https://SEU_BACKEND_AUTORIZADO/v1/public/rj-status` somente após deploy autorizado. Resposta **200 + contrato + 92 municípios** é prova do endpoint, mas não de que todas as 92 cidades têm estações meteorológicas ativas. Estados **503** significam indisponibilidade/sem validação, nunca ausência de risco. Não usar o endpoint para emitir automaticamente P0.
- O canal pago `POST /v1/data/municipalities` permanece protegido pelo servidor; nenhum requisito premium vira alerta oficial bloqueado por assinatura. A separação deve ser validada com autenticação e licença de testes antes do release.
- Proibir chamadas agressivas das fontes. A tela consulta o cache do backend com taxa de 1 minuto, mas a aquisição oficial depende da frequência permitida e da disponibilidade real das fontes.

## Etapas fora desta aprovação técnica

**Ainda não comprovados como ativos:** INPE/CPTEC e Windy como fontes de desempate autorizadas por produto/licença; medições de 92 municípios onde não existe estação local; Defesa Civil municipal específica de cada região; NOAA/Marinha/ANA/SGB por fenômeno; animação de radar real/grades espaciais; notícias e ocorrências de trânsito; testes físicos de microfone, locução feminina e Google Play Billing. Cada subsistema requer confirmação de produto, API, cobertura, licença, testes de erro e observabilidade.

**Segurança pública:** observar avisos oficiais com fonte, data, validade e município. Nenhuma média ponderada de previsão e medição pode gerar alerta P0, sirene ou falsa "segurança". A interface deve distinguir valor medido pontual, risco publicado por município, previsão de modelo e cálculo derivado Blaise.

**Release:** PR #97 Draft. Só após execução CI e validação física de integração, revisão de segurança e confirmação de publicação do desenvolvedor; não exigir downloads de APK grandes no celular a cada commit.
