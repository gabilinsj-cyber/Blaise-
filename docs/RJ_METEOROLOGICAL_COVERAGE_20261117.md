# Blaise V6 RJ — inventário real O/E/P e pendências (17/11/2026)

> **Exceção posterior de 17/11/2026:** os portais de avisos de **INMET** e **INPE/CPTEC** podem ser exibidos como **links oficiais estáticos no topo da interface**, junto a Alerta Rio e Defesa Civil RJ. Essa autorização não inclui coleta, cópia ou republicação de avisos ou dados no aplicativo nem alteração da política meteorológica de INMET/CEMADEN apenas para comparação interna. Alertas de nível 1–5 só aparecem com evidência de risco Blaise validada; caso contrário a faixa indica 'não verificado'. Consulte `RJ_CIENTIFICO_MEMORIA_E_ALERTAS_SUPERIORES_20261117.md`.

> **Atualização vinculante:** INMET e CEMADEN não fornecem valores, previsões, chuva, avisos ou alertas para o aplicativo Blaise V6 RJ. São apenas referências brasileiras de comparação interna quando fontes internacionais divergem, usando observações licenciadas geograficamente próximas e comparáveis ao RJ. Os caminhos anteriores do Android que consultavam o INMET foram desativados; a API estadual omite ambos, e o worker não pode publicar P0 INMET. O comparador geográfico novo é apenas lógica sem coleta ao vivo. As entradas históricas do inventário abaixo devem ser lidas conforme esta restrição.

## Status verificado, não presumido

A captura do usuário exibe **fontes candidatas**, não medições. O catálogo oficial dos 92 municípios existe, mas não garante cobertura meteorológica atual.

**Implementado nesta PR #157:** auditoria **offline e interna** com 23 variáveis nos 92 municípios, compatibilidade por fonte e natureza O/E/P, rejeição de campos sem auditoria de backend, licença, georreferência, tempo válido, valores finitos e domínio HTTPS; relatórios sem consulta a API e testes com exemplos sintéticos. Sem alteração de rota HTTP/Android ou conexão automática. Nenhum dado meteorológico real foi criado, obtido ou preenchido por esse módulo.

- **O** Observação: estação, satélite ou sensor diretamente compatível com o fenômeno.
- **E** Estimativa: derivada/algoritmo/modelo assistido. Não confundir com O.
- **P** Previsão: produto de modelo, com tempo e ciclo, sem alegar estação medida.

## Produtos atuais observados no código, sujeitos a funcionamento real em execução

| Fonte ou produto | Código existente | Comprovação atual | Pendência |
|---|---|---|---|
| INMET API de estações | Antigo coletor Android desativado na PR #157 | **Só comparação administrativa de divergências internacionais**. Nenhuma leitura INMET pode abastecer cliente, mapa, boletim ou alerta | Homologar coleta interna de estações brasileiras próximas, com horário e georreferência, sem saída pública |
| INMET CAP/RSS | `backend/src/inmet-source.mjs` | Coletor de **avisos**, não sensor térmico | Não usar como termômetro |
| CEMADEN RJ | `backend/src/cemaden-rj-source.mjs` | Dados de risco hidrológico restritos à **consulta interna de divergência**; não mede temperatura e não abastece clientes | Homologar apenas comparações nacionais pertinentes a chuva; nenhuma publicação |
| NOAA GFS Wave | `backend/src/noaa-wave-collector.mjs` | Coletor para **altura de ondas** onde georreferência comprovada | Não confundir com NOAA/GFS atmosférico; ampliar cobertura/mar conforme autorização |
| ECMWF/IFS | Inventário `south-america-meteorology.mjs` | Catálogo de **modelo**, sem coletor térmico integrado aos 92 municípios | Baixar e decodificar produtos/grids, rodadas e horários reais |
| DWD/ICON Global | Catálogo e especificação | Modelo **candidato**, sem coletor térmico integrado aos 92 | Idem, grade global brasileira e licença comercial |
| NOAA/GFS atmosférico | Catálogo e NOAA produto marinho isolado | **Sem** coletores de temperatura atmosférica por município no backend | Extrair 2m, RH, vento etc. de produto GFS atmosférico |
| NASA | Lista de produtos | Sem coleta municipal comprovada | Produto específico, cobertura/horário/licença |
| JAXA/GSMaP | Lista de produtos | Sem coleta espacial de chuva oceânica demonstrada | Produto específico e grade autorizada |
| EUMETSAT | Lista de produtos | Sem coleta municipal demonstrada | Produto específico e autorização |
| Meteologix / Earth Nullschool / Breezy Weather | Consulta humana complementar | Não são medidores independentes quando reproduzem DWD/NOAA/ECMWF; sem licença para scraping/comercial API | Manter só consulta visual interna |
| OpenWeather / Agente 13 | PR #156 e protótipo TEMP35 da #157 | Uma consulta real passada de One Call; teste de 35 min com mocks, sem contagem de três fontes reais | Último recurso, sob quota, após auditoria por variável |

## Segurança e interface

- **Cliente:** valor validado (se existir), sua **fonte própria** e hora; caso contrário `Indisponível`. Sem agentes, matrizes internas, discrepâncias, cálculos e número de medidores.
- **Administrador:** pode executar `node backend/scripts/inspect-rj-meteorological-coverage.mjs` a partir da raiz **depois de atualizar sua cópia** para a versão desta PR. O programa **não acessa fontes externas**: informa zero valores verificados neste inventário vazio, não zero condições meteorológicas no mundo real.
- Nenhuma reativação de Alerta Rio ou Defesa Civil como coletor. Manter apenas os links de alertas oficiais. Sem reintegrar INEA, Marinha, Windy ou Copernicus.
- A exceção de 35 min/900 chamadas do Agente 13 aplica-se só a temperatura/sensação; sem autorização para extrapolar para chuva, UV, umidade, raio, mar ou risco.
- Não há mecanismo seguro para afirmar dados de todos os fenômenos/todos os municípios até que os adaptadores ao vivo, validação geográfica, políticas de licença e testes de produção estejam implementados.

## Próxima implementação mensurável

1. Coletor de observações INMET no backend com carimbo de hora e georreferência IBGE comprovada; medir cobertura por município.
2. Adapters oficiais para DWD ICON Global, NOAA GFS atmosférico e ECMWF/IFS; preservar previsão P e ciclo/hora.
3. JAXA, EUMETSAT e NASA por produto específico (não fonte genérica).
4. UV via produto licenciado específico (não inferir de temperatura) e sensação via produto ou cálculo com entradas válidas.
5. Conectar somente registros auditados a esta matriz e ao renderizador oficial, com contrato versionado, testes end-to-end, canário e autorização de release.

Fontes públicas verificadas:
- DWD ICON: https://opendata.dwd.de/weather/nwp/icon/
- NOAA GFS: https://www.nco.ncep.noaa.gov/pmb/products/gfs/nomads/
- ECMWF open data e atribuição CC-BY-4.0: https://www.ecmwf.int/en/forecasts/datasets/open-data
