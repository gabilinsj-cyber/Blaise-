# Blaise V6 RJ — Tabelas 1, 2 e Mar na interface

Data de implementação: 13/10/2026. Projeto exclusivo **Blaise V6 RJ**, sem INEA.

## Integração executada

A tela **Mais → Matriz Meteorológica** já mostrava 30 fenômenos da Tabela 1,
13 critérios da Tabela 2 e as 5 categorias marítimas. A integração adicional
liga cada linha da Tabela 1 a **valores pontuais reais da cidade escolhida**
quando `OfficialWeatherClient` dispõe de observação recente do **INMET** ou
**Alerta Rio (somente município do Rio)**. Mostra:
- grandeza, valor, unidade, estação, origem, horário e tipo "observação";
- chuva da última hora rotulada como *acumulado horário*, jamais "chovendo agora";
- sensação térmica **derivada** por física pertinente (índice de calor ou
  vento-frio) quando existem todas as entradas válidas;
- avisos INMET apenas com município atribuído exatamente e vigência validada;
- risco hidrológico do CEMADEN-RJ/Defesa Civil apenas com fonte municipal válida;
- para outras variáveis sem conexão específica, "sem produto validado", e não zero.

Os fenômenos levam aos **critérios científicos específicos** na Tabela 2.
Apenas observações pontuais independentes e comparáveis da mesma grandeza,
unidade, cobertura espacial e janela temporal podem formar média:

`estimativa = Σ(peso_i * valor_i) / Σ(peso_i)`

Na ausência de pesos verificados pode-se considerar média simples para
medições compatíveis. **Não** misturar previsão com sensor; **não** fazer média
de avisos, tsunamis, eventos sísmicos ou níveis de alerta. O código Android
apresenta regras; isto não implica que exista hoje um par de observações que
possa gerar média real para cada um dos 92 municípios. O desempate efetivo
depende de adaptadores de produção e trilha de evidência.

## Regras cadastradas na versão principal e compatibilidade

A versão canônica `RjMeteorologicalTables.kt` em `main`, em
13/10/2026, traz como **Tabela 1** Alerta Rio + Defesa Civil RJ P1,
OpenWeatherMap como terceiro produto complementar das 10 variáveis.
O complemento pode ser modelo ou republicação: **nunca** se torna automaticamente
terceira observação oficial. Como **Tabela 2**, a versão principal registra
INPE/CPTEC → INMET → CEMADEN → Windy → NOAA para produtos aplicáveis.

Outro contrato do mesmo repositório (`rj-hierarchical-weather-resolution.mjs`)
prioriza a busca por **Alerta Rio → Defesa Civil → INMET → INPE → Windy**.
Esse conflito de especificações **não foi ocultado nem unificado por suposição**.
Esta entrega preserva a matriz consolidada em `main`, sem mudar a
política de desempate de fontes já implantada; a harmonização do algoritmo
entre matrizes precisa ser homologada antes da fusão operacional.

## Mar e oceano em tempo de consulta

Os painéis **Mar e Ondas** e **Mais → Mar/Satélite** compartilham resultados
do mesmo contrato gratuito `GET /v1/public/rj-status`, que já consulta
riscos e avisos do RJ. Nesta etapa, o backend inclui **somente** um resumo
de **avisos marítimos do Centro de Hidrografia da Marinha** quando:
- o source worker CHM estiver habilitado e tiver uma coleta válida;
- as regras de acesso público/licença aplicáveis tiverem sido aprovadas;
- o inventário tiver idade máxima de 30 minutos e o aviso estiver vigente;
- sua classificação for explicitamente `RJ_MARINE_REGIONAL` na METAREA V.

São exibidos número, tipo, emissão/validade, zona marítima, altura e direção
**se expressas no próprio aviso** e marcador de ressaca **somente se o tipo do
aviso disser RESSACA**. O limiar de 3,5 m é marcador contextual de ondas;
não gera por si só aviso de ressaca ou P0 municipal. Classificação de área
METAREA V **não** equivale à delimitação de praias e municípios fluminenses;
`mayIssueMunicipalP0=false`.

**Marinha/CHM, NOAA, Copernicus Marine e EUMETSAT** seguem cadastrados por
fenômeno na Tabela 1 e na matriz marítima. Dados de swell, corrente,
temperatura do oceano, previsões de ciclone, imagens de nuvens e séries de maré
**não passam a estar conectados** por causa desta integração. Para marés já
existe contrato de entrega CHM condicionado à assinatura e a ingestão
contínua de PDFs oficiais não está implantada: a interface marca indisponível.

## Atualização visual em 14/10/2026 — atalhos e status na tela inicial

A versão de desenvolvimento acrescenta ao fim do painel **Início** o quadro
**FONTES ATUAIS • TABELAS 1, 2 E MAR**, com três áreas clicáveis:

- **Tabela 1:** abre `Mais → Matriz Meteorológica`; quando a estação oficial da cidade selecionada tiver leitura atual verificada por `CityWeatherResult.currentObservation(now)`, mostra a origem e o horário *da medição*. Se não tiver, informa que ainda não há leitura atual. A simples consulta ou repintura da tela nunca substitui um horário oficial.
- **Tabela 2:** abre a mesma matriz e a hierarquia **INPE/CPTEC → INMET → CEMADEN (apenas produto aplicável, como chuva horária) → Windy → NOAA**. Exibir uma prioridade **não** significa cinco feeds ligados: a média ponderada continua dependente de pelo menos duas observações independentes comparáveis.
- **Mar:** abre `Mar e Ondas`; exibe a última consulta CHM **somente** se o snapshot público estiver atual e validado, com contagem de avisos marítimos **regionais** e horário da fonte. Do contrário, não inventa aviso nem ausência de risco.

A tela **Mar e Ondas → Fontes e Dados Marítimos** oferece links externos oficiais para
[Marinha/CHM](https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo),
[Copernicus MyOcean](https://marine.copernicus.eu/access-data/myocean-viewer),
[Copernicus Pro](https://data.marine.copernicus.eu/viewer/expert?view=viewer),
[EUMETSAT](https://view.eumetsat.int/) e [NOAA](https://www.noaa.gov/).
**Abrir o visor público no navegador não significa ingerir nem licenciar o produto na API do aplicativo.**
As fontes adicionais permanecem cadastradas, não simuladas.

Os três atalhos usam os **mesmos contratos atuais** dos painéis detalhados,
`LocalCityWeather`, `LocalPublicRjStatus` e `LocalObservationClock`,
sem criar novo polling, baixar imagens de terceiros ou expor dados de assinantes.
O acesso não depende de Google Play Billing.

**Estado real:** INMET municipal no Android depende de estação existente e resposta
recente válida. CHM no backend exige source worker ativo, flags operacionais,
autorização dos termos públicos e metadados METAREA V vigentes. A coleta
OpenWeatherMap, Copernicus Marine, EUMETSAT e a reconciliação completa entre
cinco provedores **ainda não comprovam operação contínua em produção**.
Antes de prometer "tempo real" para todos: configurar acesso autorizado, auditar
licenças, estabelecer georreferenciamento e validade, validar 24 horas de
telemetria e provar atualização para as cidades realmente cobertas.

O CI Node/Android e a instrumentação Compose validam código e navegação,
**não substituem demonstração física** de áudio/voz, Play Billing ou fontes
remotas em produção.

## Segurança e estado de publicação

- Sem dados fictícios, sem imagens meteorológicas de terceiros no mapa próprio.
- O endpoint público só serve dados após autorização da operação; não revela
  identidade, dados de assinatura nem localização individual.
- Sem compra verificada ou Play Console aprovado **não** declarar assinatura
  em produção. P0 oficial permanece separado do faturamento.
- Cada quadro informa indisponibilidade quando fonte/horário/área não forem
  suficientemente validados.
- Integração de interface e contrato **não** significam implantação automática
  no Cloud Run nem prova de execução ao vivo de cada fonte.
- Arquivos afetados: `backend/src/rj-public-status-http.mjs`,
  `app/src/main/java/br/com/blaise/rj/data/PublicRjOfficialStatus.kt`,
  `app/src/main/java/br/com/blaise/rj/RjLiveTableEvidence.kt`,
  `app/src/main/java/br/com/blaise/rj/MainActivity.kt`;
  testes backend, Android e instrumentação.

## Estado

Código preparado para CI e revisão. Publicação/merge condicionados aos
resultados de testes automatizados e prova da consulta real CHM autorizada.
