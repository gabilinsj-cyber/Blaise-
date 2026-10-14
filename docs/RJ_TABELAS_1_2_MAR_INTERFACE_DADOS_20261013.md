# Blaise V6 RJ — Tabelas 1, 2 e Mar na interface

Base de implementação: 13/10/2026; revisão de hierarquia: 14/10/2026. Projeto exclusivo **Blaise V6 RJ**, sem INEA.

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

## Hierarquia consolidada em 14/10/2026 — versão vigente, sem matriz concorrente

A regra meteorológica principal homologável para **temperatura, sensação térmica, vento, rajadas, chuva e temporal** segue:

1. **Alerta Rio**, somente se a cidade selecionada for o município do Rio de Janeiro e o produto existir.
2. **Defesa Civil regional ou municipal competente**, conforme dado próprio e cobertura.
3. **INMET**, quando possuir medição/aviso referente à área e variável.
4. **INPE/CPTEC** como primeira referência de previsão na comparação de discrepâncias.
5. **Windy** somente se o INPE não fornecer comparação adequada.

Se duas leituras oficiais independentes e comparáveis concordarem entre as três primeiras, o Blaise encerra a procura e aplica cálculo ponderado apenas com pesos e qualidade adequados. Se divergirem, as previsões INPE e depois Windy podem orientar a apresentação de uma leitura pontual oficial, **sem transformar previsão em medição nem ocultar as leituras divergentes**.

**OpenWeatherMap continua a terceira consulta complementar dos dez primeiros fenômenos**, conforme produto e autorização, mas **não é a terceira medição oficial nem altera a ordem acima**. CEMADEN, ANA e SGB/SACE para hidrologia e outras fontes especializadas seguem com precedência técnica segundo a categoria. Avisos oficiais de tempestade, ressaca e tsunami **não são ponderados**.

Uma antiga rotina concorrente (`backend/src/rj-table12-five-source-dispute.mjs`) foi retirada: o roteiro único agora é `backend/src/rj-hierarchical-weather-resolution.mjs` e as duas tabelas extraem a mesma política de `backend/src/rj-canonical-table-sources.mjs`. Registro técnico: `backend/src/rj-meteorological-homologation.mjs`; índice visível no Android: `RjMeteorologicalTables.kt`. **A alteração de código não prova cinco APIs conectadas em produção.**

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

## Reconsulta controlada e estado da conexão (14/10/2026)

A tela **Mais → Matriz Meteorológica** mantém as Tabelas 1 e 2 e agora mostra:

- **13 produtos/canais** com indicador específico por fonte, não o rótulo enganoso “13 fontes conectadas”.
- Resultado da verificação do canal HTTPS público: *não configurado*, *configurado sem resposta vigente*, ou *resposta pública vigente*. Um JSON com relógio recente não torna atual o dado original de cada fornecedor.
- **Última tentativa de consulta**, que é distinta do horário observado da estação e da emissão do aviso.
- Botão **Atualizar avisos públicos e fontes marítimas**. O botão só habilita quando `BLAISE_RJ_PUBLIC_STATUS_BASE_URL` contém um URL HTTPS válido nesta build e o app está ligado; requisições manuais têm espaçamento mínimo de 30 segundos.
- Na tela **Mar e Ondas → Fontes e dados marítimos**, botão **Reconsultar boletins marítimos** usando o mesmo contrato público e as mesmas regras, sem exigir assinatura.

O cliente consulta o produto público a cada **60 segundos enquanto a atividade está iniciada**. A obtenção independente de leituras pontuais de estação INMET pode ocorrer em intervalo de cerca de 60 segundos, e séries horárias INMET em cerca de 5 minutos. **Intervalos de consulta não garantem atualização de origem em tempo real.** Na perda de rede, dados não vigentes ficam indisponíveis ou são explicitamente datados. O botão de atualização não habilita novas fontes por si só e não faz nova compra, registro ou deploy.

**Para habilitar o caminho público no binário e no backend**, os operadores devem verificar, com testes de produção e termos de redistribuição de dados:

- Android (no momento de compilar): `BLAISE_RJ_PUBLIC_STATUS_BASE_URL=https://ENDERECO_REAL_VALIDADO`; se vazia, o cliente público permanece desabilitado por segurança. Não presumir um URL do Cloud Run.
- Cloud Run: `BLAISE_RJ_PUBLIC_STATUS_ENABLED=true` e `BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED=true`, **apenas** após os termos concretos do produto serem avaliados.
- O `official-source-worker` e seus *adapters* de INMET/CEMADEN/CHM devem estar realmente configurados, executando, respondendo com horários vigentes e escopo RJ apropriado. O endpoint pode retornar `503` se não houver produto oficial utilizável.
- Verificar no dispositivo **GET /v1/public/rj-status** sem identidade de assinante e sem localização pessoal; verificar a validade das leituras, as licenças, o horário Brasília, limites IBGE e falhas sem alertas fictícios.
- Alerta Rio cobre o município do Rio. Os **92 municípios** são selecionáveis, mas **não** necessariamente dispõem de medição pontual ou cobertura de cada fonte.
- **OpenWeatherMap, INPE/CPTEC, Windy, NOAA, Copernicus Marine e EUMETSAT** continuam na matriz como fornecedores complementares por fenômeno. Não há comprovação de ingestão contínua autorizada de todos; não rotular sua previsão como uma estação real.

**Aprovação de CI ou emulador verifica comportamento do software com fixtures, não comprova que Cloud Run esteja com essas chaves ativas ou que os provedores respondam em produção.** PR em rascunho até a validação de runtime e da distribuição. Nenhum APK precisa ser baixado no celular para cada alteração.

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
