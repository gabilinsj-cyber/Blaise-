# Blaise V6 RJ — Tabela 1, Tabela 2 e complemento marítimo

**Especificação permanente no código do aplicativo • 11/10/2026.** Exclusiva do estado do Rio de Janeiro e de fenômenos com possíveis efeitos sobre o litoral fluminense e o Atlântico adjacente. **INEA excluído.** Fontes listadas como *elegíveis para consulta* não significam que seus dados estejam disponíveis, licenciados ou integrados em produção.

A **Tabela 1 original de 25 fenômenos** e a **Tabela 2 original de oito critérios de desempate** continuam intactas no arquivo `app/src/main/java/br/com/blaise/rj/RjMeteorologicalTables.kt`. Os dez itens abaixo constituem o **complemento da terceira fonte na Tabela 1**, e a matriz marítima é um **complemento separado**, não substitui a Tabela 2.

## Tabela 1 — itens 1 a 10: OpenWeatherMap como 3ª fonte complementar

A prioridade conjunta **P1** Alerta Rio + Defesa Civil RJ aplica-se **somente quando ambos têm produto e cobertura local verificados**. **Alerta Rio é municipal da cidade do Rio de Janeiro**, e não cobre automaticamente os outros 91 municípios. Nos demais, a Defesa Civil competente e as medições INMET/CEMADEN disponíveis seguem a hierarquia de cada fenômeno. **OpenWeatherMap é fonte de comparação de terceiro, não emissor oficial de alertas**.

| Nº | Fenômeno monitorado | Fontes prioritárias (P1, onde aplicável) | 3ª fonte de consulta | Cuidados |
|---:|---|---|---|---|
| 1 | Temperatura | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Medida pontual ≠ previsão da cidade |
| 2 | Sensação térmica | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Fórmula apropriada e variáveis observadas compatíveis |
| 3 | Chuva atual | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Distinguir chuva observada, estimada e prevista |
| 4 | Chuva acumulada | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Somente mesmo intervalo e tipo de produto |
| 5 | Chuva intensa e temporais | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Aviso oficial prevalece, nunca inferir evento confirmado |
| 6 | Vento sustentado | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Mesma altura, unidade e janela de medida |
| 7 | Rajadas fortes | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Não trocar rajada instantânea por vento médio |
| 8 | Pressão atmosférica | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Distinguir pressão na estação e ao nível do mar |
| 9 | Umidade relativa | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Mesma localidade e observação recente |
| 10 | Granizo | Alerta Rio + Defesa Civil RJ | OpenWeatherMap | Somente quando houver produto específico e evidência meteorológica; ausência de granularidade não confirma ocorrência |

* A OpenWeatherMap entra como fonte de comparação quando seu produto, contrato de API, termos de uso e horário permitirem. Seu valor pode ser medição, estimativa ou previsão conforme o produto; **não presumir observação independente**.
* Dados republicados de uma mesma rede não contam como duas medições independentes. A fórmula de média ponderada só recebe medições/observações compatíveis, não avisos oficiais de graus diferentes nem observações misturadas com previsões.
* **Critério de desempate preservado:** Alerta Rio (cidade do Rio) → Defesa Civil → INMET → INPE/CPTEC → Windy, quando esses produtos existirem e a situação exigir comparação. A terceira consulta complementar OpenWeatherMap **não desloca o INMET** nem passa a ser uma terceira *medição oficial* na hierarquia.
* Não há pressuposto de estações físicas cobrindo os 92 municípios. Valores indisponíveis permanecem identificados.

## Quadro complementar marítimo — Marinha, NOAA, Copernicus e EUMETSAT

| Fenômeno | Fontes de consulta | Função |
|---|---|---|
| Ciclones oceânicos | Marinha + NOAA + EUMETSAT + Copernicus Marine | Evolução atmosférica, deslocamento e efeitos no mar |
| Tempestades no Atlântico | Marinha + NOAA + EUMETSAT | Nuvens, sistemas intensos e deslocamento |
| Ondas e swell | Marinha + NOAA + Copernicus Marine | Altura, período, direção e propagação |
| Ressaca no litoral RJ | Marinha + boias autorizadas + Copernicus Marine + NOAA | Avisos oficiais e avaliação de risco costeiro |
| Tsunami e maremoto | NOAA + Marinha do Brasil + autoridades brasileiras | Avisos oficiais e observação do nível do mar para confirmar ameaça |

- **Copernicus Marine:** consultar produtos oceânicos apropriados de ondas, swell, correntes, marés/nível e temperatura da superfície do mar, com resolução, horário e licença de cada produto (visualizadores: https://marine.copernicus.eu/access-data/myocean-viewer e https://data.marine.copernicus.eu/viewer/expert?view=viewer).
- **EUMETSAT:** consultar dados de satélite para nuvens, tempestades, massas de ar e ciclones no Atlântico, conforme produtos autorizados (https://view.eumetsat.int/). Não reutilizar capturas ou imagens sem verificar licença.
- **Marinha do Brasil/CHM e autoridades brasileiras:** avisos oficiais e proteção à navegação/ressaca têm prioridade conforme competência.
- **Tsunami/maremoto:** somente boletins e alertas de órgãos competentes confirmam ameaça; imagens e ondas altas isoladas NÃO provam tsunami. **Meteotsunami** deve distinguir origem meteorológica de terremoto.
- **Mapa Blaise:** visualização renderizada pelo próprio app sobre cartografia aberta; fontes meteorológicas fornecem dados compatíveis, não imagens copiadas. Sem campos georreferenciados licenciados não inventar radar.

## Garantias funcionais e de proveniência

1. Separar **medição oficial**, **consulta complementar de terceiros**, **previsão de modelo**, **imagem/dado satelital**, **aviso de autoridade** e **cálculo derivado do Blaise**.
2. Exibir unidade, hora de observação/execução do modelo, validade, localidade, fonte e janela temporal.
3. Com dados discrepantes, seguir a Tabela 2: buscar duas medições oficiais independentes compatíveis; INPE/CPTEC e Windy podem apoiar a comparação de previsões em etapas, nunca homologar um alerta pela média. OpenWeatherMap não é autoridade.
4. Respeitar termos de uso e acesso comercial por API/produto, não por marca inteira. Sem autorização ou produto válido, status indisponível **não implica** ausência de risco.
5. Os dados hidrológicos de ANA, CEMADEN e SGB/SACE, raios NOAA GOES GLM, sismologia USGS e demais produtos especializados continuam disponíveis por categoria. O INEA permanece excluído.
6. Esta atualização é **especificação de fontes + interface de consulta**, não comprova captura ao vivo de OpenWeatherMap, Copernicus ou EUMETSAT.

## Arquivos do projeto
- Android: `app/src/main/java/br/com/blaise/rj/RjMeteorologicalTables.kt`, `app/src/main/java/br/com/blaise/rj/MainActivity.kt` (telas **Mais → Tabela 1 / Tabela 2** e **Mar e Ondas → Fontes Marítimas**).
- Backend: `backend/src/rj-supplemental-source-matrices.mjs` com proteção territorial e separação por papel da fonte; `backend/src/rj-phenomenon-source-policy.mjs` e `backend/src/rj-hierarchical-weather-resolution.mjs` continuam definindo roteamento/autorização e desempate.
