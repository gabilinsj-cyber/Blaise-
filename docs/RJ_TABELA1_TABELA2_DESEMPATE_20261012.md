# Blaise V6 RJ — Tabela 1 e Tabela 2 (revisão de 12/10/2026)

**Escopo:** exclusivamente os **92 municípios do Estado do Rio de Janeiro**, com dados georreferenciados e cobertura confirmada de cada fonte. Não extrapolar uma leitura de estação aos outros municípios.

## Tabela 1 — três fontes de consulta prioritária

| Prioridade | Fonte | Regra de uso |
|---|---|---|
| 1 | **Alerta Rio** | Cidade do Rio de Janeiro apenas; fonte com produto e horário verificados |
| 2 | **Defesa Civil RJ/local competente** | Avisos e dados conforme a localidade, sem contabilizar repostagens como instrumentos independentes |
| 3 | **OpenWeatherMap** | Terceira consulta complementar aprovada anteriormente, **não** automaticamente terceira medição oficial independente; confirmar a origem original do dado e direitos de uso |

**Regra 1:** se duas fontes da Tabela 1 apresentarem **observações independentes**, contemporâneas, próximas, da mesma variável, com unidade e janela compatíveis e valores dentro da tolerância de triagem, calcular **média simples**; calcular **média ponderada** apenas quando **ambas** possuírem pesos auditados, com origem, QC e justificativa. Parar a busca: a Tabela 2 **não é consultada**.

**Atenção:** o OpenWeatherMap pode publicar campos derivados de estações e modelos. Reutilizar o mesmo instrumento de origem **não confirma duas fontes**. Temperatura e sensação térmica não são a mesma variável, e aviso de tempestade não é grandeza numérica para média.

## Tabela 2 — cinco posições de desempate

Consultada **somente se a Tabela 1 não encontrar duas observações independentes compatíveis**. A busca é sequencial; basta encontrar **uma** fonte da Tabela 2 compatível com **uma** das fontes da Tabela 1.

| Ordem | Fonte | Tipo |
|---|---|---|
| D1 | **INPE/CPTEC** | Previsão/modelo e produtos meteorológicos oficiais, não medição municipal de estação |
| D2 | **INMET** | Observação oficial por estação, quando houver localidade e variável |
| D3 | **Windy** | Visualização/previsão de modelos, não estação oficial |
| D4 | **CEMADEN — provisório** | Fonte especializada de chuva/monitoramento por estação; **a usuária ainda não confirmou expressamente o quinto nome desta tabela** |
| D5 | **NOAA** | Produtos pertinentes por variável/região; verificar se o valor é previsão, medição ou alerta |

As quatro fontes **nominalmente confirmadas** na última solicitação são **INPE, INMET, Windy e NOAA**, com **NOAA por último**. CEMADEN ocupa a posição restante como **hipótese de implementação provisória** aproveitando uma fonte já definida no projeto. **Confirmar ou substituir esse nome antes de declarar a hierarquia definitiva.** Outros provedores ANA/SGB/SACE/Marinha/Copernicus/EUMETSAT seguem como fontes especializadas por fenômeno, não como provas da existência de dados para todo o RJ.

### Resultado do desempate

- **Se houver duas observações independentes (Tabela 1 + INMET ou CEMADEN):** calcular média simples, ou ponderada com pesos QC auditáveis.
- **Se houver uma medição da Tabela 1 e uma previsão da Tabela 2 (INPE, Windy, NOAA):** exibir a **medição real e a previsão separadas**, com fonte, unidade, estação/produto e data de referência. É permitido indicar proximidade numérica aproximada **como comparação**, mas **não misturar uma previsão e uma medição numa média observacional**.
- Se os dois valores não coincidirem dentro da tolerância, tentar a próxima fonte da Tabela 2. Preservar as leituras originais conflitantes, sem esconder incerteza.
- Dados desatualizados, não autorizados para o uso correspondente, sem localização, sem unidade, com unidades divergentes, com chuva de janelas diferentes ou com uma fonte republicando outra **não contam como duas fontes independentes**.
- Se nenhuma dupla for verificável, não inventar medições, previsões ou alertas; manter o último dado verificado **com horário original** quando permitido, e registrar a falta de nova confirmação.
- Cálculo não emite alerta P0 nem autoriza sirene por si só. Avisos da Defesa Civil e outros órgãos competentes têm regras de vigência independentes.

## Implementação e situação

- `backend/src/rj-two-table-weather-consensus.mjs`: define as duas tabelas, georreferência, independência, comparação temporal, médias válidas e busca por fonte D1 → D5.
- `backend/test/rj-two-table-weather-consensus.test.mjs`: casos de dupla da Tabela 1, sem desempate, desempate INPE/INMET/Windy/NOAA, pesos, censura de repostagens, limites e 92 cidades.
- `backend/src/rj-agent-orchestration.mjs`: entrada explícita `reconcileRjWeatherCaseTwoTables` para agentes **Sentinel → Fusion → Vector → Audit**.
- **Não há comprovação de que os cinco adapters da Tabela 2 já estejam funcionando ao vivo no backend/Android.** O cadastro e os testes não equivalem à implantação. Nenhuma compra, publicação de alerta, PR merge ou implantação automática faz parte deste módulo.

Esta revisão prevalece como proposta para consulta de fontes meteorológicas gerais, sem alterar critérios especializados de segurança para sismo, tsunami, mar e ciclones.
