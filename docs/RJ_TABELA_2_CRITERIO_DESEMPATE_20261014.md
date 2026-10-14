# Blaise V6 RJ — Tabela 2: critério de desempate (14/10/2026)

**Ordem confirmada pelo proprietário do Blaise V6 RJ**, válida para avaliar divergências meteorológicas no escopo dos 92 municípios fluminenses e Atlântico adjacente quando o produto da fonte for pertinente.

| Hierarquia Tabela 2 | Agência/provedor | Finalidade e restrição |
|---|---|---|
| **1º** | **INPE/CPTEC** | Análise de previsão, modelos e satélite: fonte oficial de **produtos**, mas uma previsão não é medição pontual de estação |
| **2º** | **INMET** | Estações meteorológicas/avisos nacionais; observação pontual validada por estação, hora, localização e variável |
| **3º** | **CEMADEN** | Acumulados de chuva, monitoramento hidrometeorológico, eventos intensos e riscos conforme cobertura e produto; **não** considerar fonte universal de temperatura ou vento |
| **4º** | **Windy** | Comparação de modelos. Não é uma segunda medição independente quando exibe produtos de outros serviços |
| **5º** | **NOAA** | Previsões, satélites e produtos oficiais pertinentes (inclusive Atlântico), respeitando geografia, validade e tipo de produto |

## Distinção obrigatória — Tabela 1 versus Tabela 2

- **Tabela 1 — fontes primárias por localidade/fenômeno:** preserva a prioridade e os avisos competentes de Alerta Rio (somente cidade do Rio), Defesa Civil, INMET e fontes específicas de chuva/rios/mar/tsunami. **Não foi substituída nem reordenada** pela Tabela 2.
- **Tabela 2 — pesquisa de divergência:** consulta as cinco fontes **na ordem acima**, pulando apenas produtos inadequados ou não disponíveis para aquela variável/região. Pode comparar previsões independentes e medições oficiais da mesma variável, horário e lugar, mas **não inventa valores nem transforma previsão em observação**.
- Se duas medições oficiais forem compatíveis e independentes, a **média ponderada** exige pesos técnicos justificados e amostras contemporâneas. Se duas observações divergirem, não calcular média que esconda o conflito. Modelos podem orientar a revisão ou compor uma **estimativa de previsão separada**, claramente rotulada e calibrada historicamente.
- O resultado útil é mostrar as **fontes reais identificadas**, com valores e horários. Um modelo próximo de uma estação não prova que a outra esteja incorreta; avisos oficiais de risco permanecem válidos, sem média de categorias.
- **Cobertura:** 92 municípios são opções de consulta, não garantia de observação em cada um. Sem cobertura, resposta ou permissão de uso comercial, a entrada é ignorada para esse cálculo; não forçar um quinto provedor a emitir dado inexistente.
- **Exceções especializadas:** tsunami, sismo, nível/vazão de rio, marés e diagnóstico exclusivo de radar exigem fonte/autoridade da categoria (USGS, Marinha/NOAA, ANA/SGB, etc.); esta Tabela 2 não prevalece sobre elas.
- Nenhum serviço de dados ou compra de licença é ativado pela simples inclusão no registro de desempate.

## Implementação e verificação

- Política canônica: `backend/src/rj-dispute-table2-policy.mjs`.
- Retorno independente da seleção da Tabela 1: `rjSourceRouting(...).disputeTable2Priority` e `disputeTable2Eligible` em `backend/src/rj-phenomenon-source-policy.mjs`.
- Testes: `backend/test/rj-dispute-table2-policy.test.mjs` (ordem exata de cinco, não inclusão de fenômenos inadequados, separação dos dados, 92 municípios).
- Os adaptadores de INPE, Windy e NOAA requerem autorizações, dados válidos e homologação separada; **não declarar ingestão ao vivo concluída**.
