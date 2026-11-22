# Blaise V6 RJ — trava de homologação meteoblue: semântica convectiva e publicação

**Revisão:** 21/11/2026. **Escopo:** PR #173 (draft), coletor `basic-6h` em staging privado, um único município IBGE 3304557. **Não há autorização para implantar ou mostrar dados a assinantes** e esta revisão não chama a API meteoblue.

## 1. O que os documentos oficiais demonstram

### Definições científicas
- Documento [meteoblue Weather Variables](https://docs.meteoblue.com/en/meteo/variables/weather-variables): **precipitation** é quantidade *total*, em milímetros de água equivalente, acumulada **no intervalo anterior**; **convective precipitation** é **componente produzido por convecção**, também acumulado no intervalo anterior. O rótulo da hora é o fim do intervalo.
- São duas grandezas distintas por definição, mas podem assumir o mesmo número em um intervalo. **Valores iguais não são provas de erro** nem autorizam considerá-las 2 observações independentes, detecção de trovoadas ou sinal de ocorrência real.
- No parser da branch: `data_6h.precipitation` → `forecastPrecipitationSixHourMm`; `data_6h.convective_precipitation` → `forecastConvectivePrecipitationSixHourMm`. Cada array é lido por sua própria chave `sourceField`; a chave faltante resulta em indisponível, sem copiar o total.
- A auditoria de 19/11, preservada no Firestore histórico, constatou **29/29 pares iguais na tolerância de 0,001 mm**; **14/14 intervalos úmidos iguais**. Sem JSON bruto da resposta original não é possível reconstruir integralmente sua origem/transformação do lado do fornecedor. A igualdade permanece **REVIEW_REQUIRED**.
- Verificação estrutural de sete campos, unidades, localização e 29 tempos ≠ homologação científica da origem dos dados. Até esclarecimento, **não permitir que `convective_precipitation` alimente alertas de tempestade, raios, granizo, risco ou clientes**.

### Condições comerciais e contratuais
- [Página oficial Free Weather API](https://business.meteoblue.com/products/weather-apis/free-weather-api): **10 milhões de créditos, um ano, sem obrigação de compra**, e tabela comparativa com **Commercial use ✓ para a Free API**. Logo, não afirmar que todo uso comercial do plano Free é proibido.
- [Termos e Condições oficiais](https://business.meteoblue.com/terms-conditions): seções 5.04–5.06 tratam de licenças gerais e comerciais; 9.03–9.06 falam de atribuição e permissões de referência; 10.03–10.05 tratam de armazenar/reproduzir/transmitir e derivar dados. O texto da página promocional **não esclarece expressamente** se esta conta está autorizada a **reproduzir, armazenar por 6h, criar métricas derivadas e mostrar previsões meteorológicas a assinantes pagantes em app Android**.
- Não há nas fontes auditadas um aceite contratual específico da titular liberando esses atos, nem um acordo particular conferido nesta revisão. A busca limitada em e-mails por "meteoblue" não retornou mensagem de concessão. Ausência de mensagem ≠ proibição definitiva, mas **escopo não confirmado**.
- Possível atribuição à meteoblue perto de cada previsão e link para a fonte segundo os termos, mas **forma exata para aplicativo móvel e necessidade de autorização escrita precisam ser esclarecidas**. Não copiar mapas ou textos da meteoblue; manter mapa RJ próprio.
- **Status:** `freeApiCommercialUseAdvertised=true`; `subscriberDistributionRightsVerified=false`; `dataReproductionAndRetentionRightsVerified=false`; `customerAttributionRequirementsVerified=false`. Uso comercial anunciado, **publicação específica e redistribuição não homologadas**. Não declarar que assinatura paga é obrigatória para esclarecer licença.

## 2. Gate fail-closed no código da PR #173

`backend/src/rj-meteoblue-free-publication-contract.mjs` mantém
`clientPublicationAllowed=false`, `androidPublicationAllowed=false`,
`canGenerateOfficialAlerts=false`, `canPopulateRiskCalculator=false`,
`clientPayload=null`, `alertPayload=null`, `mapLayerPayload=null`.

O relatório distingue:
1. **qualidade estrutural/científica** dos sete campos (`structuralChecksPassed`, `warnings`, `convectiveSemanticReviewStatus`), inclusive igualdade integral de intervalos úmidos;
2. **direitos contratuais** (`freeApiCommercialUseAdvertised`, `contractualBlockers`, `subscriberDistributionRightsVerified`);
3. **tempo**: previsão histórica em cache expirado nunca vira condição atual nem medição de estação, mesmo que a qualidade numérica seja boa.

Nenhum `env`, `releaseApproved` ou flag fornecida por chamador abre automaticamente o contrato. São necessários revisão científica, prova de direito de reprodução/distribuição e posterior release humano separado; essa avaliação não faz merge nem deploy.

## 3. Pedido de esclarecimento a meteoblue (não enviado)

**Assunto sugerido (inglês):** Written clarification — Free Weather API commercial display in a subscriber Android app

Hello meteoblue team,

We are developing Blaise V6 RJ, a subscription-based Android weather app for 92 municipalities in Rio de Janeiro, Brazil. Our current Free Weather API access is being used solely for private technical verification; we have not published meteoblue forecasts to subscribers.

Your Free Weather API page indicates that commercial use is allowed. Please confirm in writing whether this account's Free Weather API terms allow:
1. Displaying `basic-6h` forecast values (not raw API credentials or the full feed) to paying Android subscribers, with meteoblue attribution and an official source link;
2. Server-side caching for up to six hours and storing short historical diagnostic summaries privately;
3. Combining these forecasts with other properly licensed weather sources in our own interface and derived scientific comparisons, with clear attribution and without presenting forecasts as observations;
4. Scaling to 92 municipalities, subject to the existing 10-million-credit free allowance and API key's daily cap;
5. The required wording and placement of attribution, any redistribution/sublicensing limitations, and any additional written approval needed under your Terms & Conditions sections 5, 9 and 10.

One `basic-6h` private test for Rio de Janeiro on 19 November 2026 returned **29 out of 29** six-hour values where `data_6h.precipitation` and `data_6h.convective_precipitation` were numerically equal (including **14 wet intervals**). Is such equality consistent with your Basic-package mLM processing or does it require a source-field/schema clarification? We are not requesting another billable API call.

We do not wish to purchase a paid plan at this stage. Please let us know whether the Free API is sufficient for the above display use and if any additional agreement is required.

Thank you.

**Não enviar credencial, resposta JSON crua, dados de clientes, ID da chave, segredo ou URL com `apikey`.**

## 4. Critérios para eventual homologação futura

- Resposta escrita e aplicável à conta sobre publicação comercial, cache, obras derivadas e atribuição, sem pressupor contrato pago; registrar data e texto do aceite (em local privado, não Git público).
- Esclarecimento semântico da coincidência chuva total/convectiva ou parecer científico documentado sobre a confiabilidade da componente; campo pode continuar bloqueado enquanto os demais avançam apenas se a licença específica permitir.
- Apenas valores **P (previsão)** com município/coordenadas, fonte, unidades e validade temporal da própria rodada; expiração 6h operacional nunca reclassificada como "agora"/"observação".
- Novos dados só com credencial protegida, orçamento disponível e autorização específica, sem aproveitar a chave exposta para novo polling e sem contornar limite de 4.000/dia.
- Testes end-to-end autenticados, revisão de privacidade, segurança, CI, metadados, atribuição/consentimento e canário separados antes de qualquer publicação.
- A resposta real de **19/11 é histórica** e não pode servir para provar frescor em novembro posterior.

**Decisão em 21/11/2026:** revisão semântica **não encerrada**; uso comercial genérico anunciado; direitos de distribuição de valores aos pagantes **não comprovados**. Portanto, Blaise V6 RJ permanece com os dados meteoblue apenas em **staging privado**, sem alertas, mapa público, API de assinantes, plano pago, nova consulta ou merge/deploy.
