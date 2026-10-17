# Blaise V6 RJ — regras e registro de correções

Escopo exclusivo: 92 municípios do Rio de Janeiro e Atlântico adjacente. Este registro preserva requisitos; não certifica implantação ou dados operacionais.

## Regras vigentes

- Tabela 1: Alerta Rio, Defesa Civil RJ, OpenWeatherMap e REDEMET/DECEA (aeronáutica). Não contar republicações ou dois aeroportos da mesma rede como fontes independentes.
- Tabela 2 sequencial: INPE/CPTEC, INMET, CEMADEN, Windy e NOAA. Quando houver contribuição da Tabela 1, selecionar no máximo uma fonte compatível da Tabela 2. O recurso de duas observações da Tabela 2 sem primária exige independência, mesma variável, unidade, período, município e qualidade verificadas.
- Médias ponderadas exigem pesos de qualidade comprovados; previsões e produtos combinados não viram observações independentes. Horários de coleta não renovam o horário da medição. Valores com mais de cinco minutos não entram na média.
- Mapa, cartões, gráficos e assistente devem consumir o mesmo resultado por município e variável. Não misturar cidade 1 e cidade 2.
- Marinha/CHM excluída das fontes marítimas por decisão do usuário em 16/10/2026. Usar INPE/CPTEC, INMET, Windy, NOAA, Copernicus Marine e EUMETSAT conforme o produto efetivamente disponível. Imagem de satélite não é medição de onda, corrente ou maré.
- Previsão CPTEC deve indicar data de publicação, instante de validade e natureza de previsão; a fonte só publica o dia de emissão, não inventar hora. Não oferece marés, correntes ou temperatura do mar neste adaptador.
- Fontes indisponíveis não geram zeros, média fictícia, mar seguro ou ausência de risco. Exibir somente dados e horários verificados, com indicação de indisponibilidade quando necessário.
- Configurações operacionais e os dez agentes ficam restritos ao administrador. Assistente feminina, pronúncia de Blaise como “bleiss”, envio ao terminar a fala. Alertas sonoros automáticos apenas no nível 5.
- Atualização normal em 1–5 minutos; categoria 4/5: coleta e recálculo em 30 segundos cada, conforme disponibilidade da fonte. Consulta frequente não aumenta a resolução temporal do fornecedor.
- Alertas: após três horas sem atualização, informar atraso; na quarta hora aplicar o rebaixamento local aprovado (4→2 e 5→3) sem apagar a autoria e o nível oficial. Após 12 horas sair da grade ativa, manter histórico por mais 12 horas e excluir. Retirada comprovada pela fonte vai diretamente ao histórico; falha de conexão não prova retirada. Limpeza diária mantém apenas o essencial.
- Não solicitar outro APK nem promover tráfego de produção antes de concluir os testes de integração e Android.

## Correções e evidências

- Restaurados arquivos de compilação e módulos que faltavam na árvore Git.
- Corrigida a seleção de duas fontes da Tabela 2 quando não há primária válida; adicionados testes do resultado canônico e preservação de horários.
- Adicionado coletor CPTEC de previsão de ondas, com controle de disponibilidade e distinção entre previsão e medição no Android.
- Restaurados scripts de verificação exigidos pelo npm e testes de proveniência REDEMET/CEMADEN.
- Corrigida a disponibilidade da rota pública quando o único produto atual é o complemento OpenWeather, sem criar medições municipais ou alertas.
- Execução local após a correção da rota pública: 673 testes aprovados. A execução CI Android 977 falhou por script ausente, antes da compilação. A execução CI 979 aprovou o backend, incluindo contêiner e teste de inicialização; a compilação Android ainda está em andamento. Resultados posteriores devem ser conferidos no CI; não presumir aprovação.

## Pendências comprovadas

- Médias alimentadas por um par de fontes reais com qualidade e pesos verificados ainda não demonstradas no fluxo em produção.
- OpenWeather recusado na verificação anterior por cálculo com cerca de 20 minutos, além do limite de cinco minutos. Não confundir com chave inválida nem relaxar o limite.
- CPTEC respondeu HTTP 403 na última tentativa documentada; não há ondas atuais validadas. Demais produtos marítimos ainda não têm ingestão contínua validada no painel.
- Revisão Cloud Run 00056-vin validada apenas como implantação candidata com 0% de tráfego; não prova validação funcional completa.
- Validação Android ponta a ponta pendente. A memória desta conversa não modifica o aplicativo instalado; implantação e testes precisam de evidências separadas.

## Consulta real à candidata em 16/10/2026 às 19:17:55 (Brasília)

A rota pública respondeu HTTP 200. OpenWeather calculado às 19:15:02, coletado às 19:17:32: 23,91 °C; sensação informada 24,81 °C; umidade 94%; vento 9,25 km/h. Trata-se de complemento combinado, não média municipal ou observação independente. CEMADEN nacional publicou atualização de consulta às 19:17:01; isso não altera a hora de abertura de cada alerta. REDEMET trouxe boletins de 19:00, classificados como degradados. `marine` e `marineForecast` vieram nulos. Estes valores são evidência histórica desta consulta, não dados permanentemente atuais.

## Inclusão solicitada: satélites da costa RJ

NASA Worldview / Earthdata, NASA/USGS Landsat e ESA/Copernicus Sentinel-2 incorporados ao painel marítimo no código Android. Duas missões HLS: HLSL30 (Landsat 8/9) e HLSS30 (Sentinel-2). Consultar metadados públicos NASA CMR ao entrar na tela e a cada cinco minutos, limitados ao retângulo RJ (-44,8/-23,6/-40,8/-20,8). Cada cena é parcial; não representa todo o litoral ou Atlântico. Preservar aquisição e consulta separadas; não chamar cena antiga de tempo real. Prévia apenas sob toque, no máximo 2 MB, sem GeoTIFF ou chave de acesso. Visualizadores NASA Worldview e Copernicus Browser permitem explorar a região e escolher outras cenas; USGS EarthExplorer e NASA Earthdata para catálogo. Sentinel-2 é óptico; radar é Sentinel-1. O Playground indicado pelo usuário foi encaminhado ao Copernicus Browser para exploração pública atual.

Consulta real: catálogo Landsat retornou cena de 10/10/2026; catálogo Sentinel-2 retornou cena de 11/10/2026. A prévia Landsat respondeu HTTP 200 (184.427 bytes, MIME binary/octet-stream com assinatura JPEG). Sentinel-2 não forneceu link de prévia pública nessa resposta; nenhum link foi inventado. São imagens orbitais históricas/recentes, não vídeo em tempo real e não medição de ondas, marés ou balneabilidade.

CI Android 981: backend aprovado; Android compilou, mas 13 testes falharam devido à inicialização da Tabela 1 exigir três fontes após sua ampliação para quatro. Corrigida a invariável para quatro e adicionado teste de regressão. Ordem de desempate da interface alinhada ao backend: INPE/CPTEC, INMET, CEMADEN, Windy, NOAA. Nova validação necessária; não declarar APK validado antes de resultado completo.

Referências oficiais: https://hls.gsfc.nasa.gov/data-access-and-tools/ ; https://www.esa.int/Enabling_Support/Operations/Copernicus_Sentinels ; https://www.usgs.gov/faqs/what-are-acquisition-schedules-landsat-satellites ; https://documentation.v1.dataspace.copernicus.eu/Applications/Browser.html

## Resultado intermediário CI 987 / emulador 393

Backend aprovado; compilação Android, lint, testes unitários, APK/AAB e SBOM aprovados. O emulador executou 42 testes: 39 passaram, incluindo os cartões de duas missões, e três testes legados falharam. Esses testes ainda esperavam painel operacional no cliente e dados CHM aceitos. Atualizados para exigir matriz operacional oculta, fontes oceânicas públicas acessíveis e payload CHM ignorado sem perder avisos municipais válidos. Não foi reativada Marinha nem removida a proteção de administrador. Revisão visual completa ainda depende da nova execução.

## Ondas WW3 / PacIOOS e qualidade das médias — 16/10/2026

Novo coletor opcional `noaa-pacioos-rj-wave-forecast` para ponto 23,5°S / 43°W, no oceano diante do RJ. O catálogo NOAA ERDDAP redirecionou (HTTP 302) para o endpoint oficial do produtor PacIOOS/University of Hawaii: https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global.json . O código usa diretamente esse endereço verificado e mantém redirecionamentos bloqueados; não são contadas como duas fontes independentes.

Verificação real do adaptador em 16/10 às 20:03:23 (Brasília): validade 20h, altura significativa 1,59 m, período de pico 8,20 s, direção de origem de pico 142°, swell 1,33 m com período 8,28 s. Grade global de 0,5°; não representa altura na praia. A hora da rodada não consta desse recorte: `issuedAt:null` e `issuanceTimeKnown:false`. Consulta fresca não comprova rodada nova. NÃO fornece maré, correntes, confirmação de ressaca ou tsunami. O painel identifica modelo, ponto, grade, validade, consulta e emissão desconhecida; reavalia validade no relógio já existente, sem inventar amostras por segundo.

Ativação separada: `BLAISE_NOAA_WAVES_ENABLED=true` e `BLAISE_PUBLIC_NOAA_WAVES_APPROVED=true`. Desativado por padrão. Rota pública expõe `oceanWaveForecast` somente sob aprovação específica, sem transformar o produto em risco municipal ou aviso. Script `backend/scripts/verify-noaa-rj-waves.mjs` verifica HTTP e schema; `backend/scripts/deploy-noaa-wave-candidate.sh` prepara e verifica a fonte antes de implantar candidata sem tráfego. Requer execução no Cloud Shell do projeto; nenhum deploy foi executado a partir deste ambiente.

Calculadora ponderada reforçada: exige base de pesos `VERIFIED_STATION_QC_AND_LOCAL_SKILL`, identificador de evidência, independência comprovada, produtor subjacente e registro original distintos. Adaptador INMET preserva identidade do registro oficial e só aplica peso quando há evidência fornecida para a estação e variável; não cria calibração. Testes usam evidências fictícias explicitamente identificadas para verificar o contrato, sem apresentar pesos de testes como operacionais. Sem pares reais e QC verificável, a média continua indisponível.

Verificação CPTEC: HTTP 403; canal NOAA RTOFS testado: HTTP 404. Chave Windy Point Forecast e credenciais Copernicus Marine não encontradas neste ambiente (nenhum valor de segredo lido ou exposto). Documentação Windy oferece `waves`/`swell` e correntes `cmems`; `currentsTide` é corrente de maré, não tabela de preamar/baixa-mar. Não calcular maré/tsunami/ciclone a partir de parâmetros insuficientes. Alertas de autoridade competente e cálculos físicos permanecem separados.

678 testes locais backend aprovados após as correções; nova revisão CI/Android necessária para estes novos arquivos. A validação anterior aprovou 42 testes de emulador, mas não certifica este novo conjunto nem hardware instalado. Nenhum APK solicitado.

## Continuação — 16/10, noite de Brasília

- Evidência do Cloud Shell: candidata 00058 implantada sem tráfego de produção; a rota pública retornou previsão WW3/PacIOOS com ponto -23.5/-43, horários originais e emissão da rodada desconhecida. Não equivale a prova do aplicativo instalado.
- Alerta Rio chuva: em 23:21 BRT, os logs exibiram 31 registros atuais de 33, com dois excluídos. Houve consultas anteriores sem registros atuais. Sucesso HTTP não substitui validade das observações.
- Conector meteorológico separado adicionado ao worker (`BLAISE_ALERTA_RIO_METEOROLOGY_ENABLED`) e à projeção pública com aprovação própria (`BLAISE_PUBLIC_ALERTA_RIO_METEOROLOGY_APPROVED`). Preserva temperatura, umidade, pressão e vento por estação; recusa página de acesso rejeitado, datas futuras e observações com mais de cinco minutos. Não fabrica térmica, rajada, média ou peso de QC.
- Android: decodificação estrita e quadro de estações somente na capital, em Fontes Oficiais. Mantém relógio original e oculta a leitura após vencer. Não mistura a cidade selecionada com outra cidade. Código novo ainda depende de CI Android e de prova no aparelho; sem novo download de APK.
- Verificação local: 682 testes de backend aprovados e verificação de sintaxe aprovada. Testes com fixtures não são comprovação de dados reais. Daqui, a fonte Alerta Rio retornou página Request Rejected; requer validar o novo conector no ambiente Cloud Shell/Cloud Run que obteve chuva.
- Copernicus: produto GLOBAL_ANALYSISFORECAST_PHY_001_024 contém correntes de superfície horárias SMOC (utotal/vtotal e componentes) e níveis horários MOWL (ocean_tide separado de total_sea_level). Referências: https://documentation.marine.copernicus.eu/PUM/CMEMS-GLO-PUM-001-024.pdf e https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/services . São produtos numéricos; maré relativa ao nível médio não é altura sobre datum de carta náutica nem tabela portuária. Ainda não há conector autenticado operacional. Usuária corrigiu que não tem conta e indicou o e-mail de acesso; cadastro/autenticação não concluídos.
- Médias: continuam sem par real compatível com pesos de qualidade comprovados. Não atribuir peso arbitrário para forçar resultado. Marés, correntes e teste do Android instalado continuam pendentes.
