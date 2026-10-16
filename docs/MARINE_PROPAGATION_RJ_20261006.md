# Blaise Vector RJ — propagação oceânica e chegada costeira

06/10/2026. Coordenação: **Blaise Vector RJ — Agente de Cálculo e Revalidação Científica**. Ocean, Seismo e Track são funções previstas de domínio sob o agente; não serviços operacionais independentes comprovados.

## Implementado nesta etapa

Três funções em `backend/src/blaise-marine-kernels.mjs`, reexportadas pelos núcleos científicos e disponíveis ao fornecedor `readScientificJobs` do agente. Total19 rotinas, sem afirmar que19 simuladores ou fontes estejam ativos.

1. **Altura significativa espectral e períodos:** `Hm0=4 sqrt(m0)`, momentos integrados sobre bandas com densidade espectral em m²/Hz e frequências em Hz. `Tm01=m0/m1`, `Tm02=sqrt(m0/m2)`; período de pico aproximado pelo centro da banda de maior densidade. Preserva cobertura das bandas fornecidas e resultado de calmaria. Não calcula altura de toda onda individual nem diagnostica tsunami.
2. **Dispersão linear gravitacional:** resolve numericamente `ω²=g k tanh(kh)`; `ω=2π/T`. Velocidade de fase `cp=ω/k` e de grupo `cg=(cp/2)[1+2kh/sinh(2kh)]`, comprimento `L=2π/k`. Em águas profundas cg≈cp/2; para ondas longas em águas rasas cg≈cp≈sqrt(gh). Sem correntes, quebra de onda, não linearidade ou interação com costa.
3. **Tempo condicional por percurso aquático fornecido:** integra `t≈∫ds/c` com velocidade de grupo para swell ou aproximação de onda longa. Longa exige L/h≥20; este é um critério numérico para validade aproximada, não detector de tsunami. Cada ponto precisa de coordenadas e profundidade positiva; lacunas/terra, destino divergente, segmentos excessivos e falta de proveniência são recusados.

### O que o cálculo de chegada entrega

- Hora de origem e chegada condicional UTC, duração em segundos, distância e velocidades média/mínima/máxima de propagação.
- Município destino por código IBGE e nome canônico, ponto costeiro e versão da geometria. Usa catálogo existente de municípios RJ defrontantes com o mar como **pré-filtro**, sem tratá-lo como geofence validado ou confirmação de impacto.
- Proveniência de batimetria: fonte HTTPS, versão, datum vertical, resolução e SHA-256. O fornecedor externo deve verificar os arquivos, profundidades amostradas, geometria e percurso antes de declarar os metadados validados.
- Flags explícitas: `firstArrivalProven:false`, `coastalImpactConfirmed:false`, `arrivalProbability:null`, `coastalHeightMeters:null`, `inundationMeters:null`.

O alvo é uma cidade **consultada**, não cidade atingida comprovada. O caminho vem de fora; não há busca do primeiro percurso sobre grade batimétrica, frente bidimensional ou emissão de probabilidade. Não usar velocidade de translação do ciclone como velocidade do swell ou tsunami. Horário calculado não prova que um evento ocorreu ou que atingirá RJ.

## Entradas e integração ainda faltantes

| Entrada/módulo | Finalidade | Situação |
|---|---|---|
| Batimetria GEBCO/ETOPO e dados costeiros CHM | Profundidade em cada célula, consistência de datum, qualidade, resolução e costa | Requisito registrado; grade numérica não importada nesta etapa |
| PNBOIA e outras boias validadas | Hs, período, direção, espectros, vento e horários | Fonte identificada; fornecedor operacional dessas entradas ao Vector pendente |
| Produtos WW3 do CHM/Marinha | Campos/ensembles de ondas, contornos, rodada e validade | Produtos oficiais identificados; contrato de ingestão de grade pendente |
| Pressão de fundo DART e marégrafos costeiros | Observação de variação do nível, remoção de maré e corroboração | Integração/qualidade/cobertura regional pendentes; nenhum sensor presumido próximo ao RJ |
| Fonte sísmica/ruptura, vulcânica ou deslizamento | Deslocamento da água e condição inicial de tsunami | Não modelada; magnitude isolada não confirma geração |
| Grade costeira de alta resolução e terra | Refração, reflexão, quebra, runup e inundação por cidade/praia | Importação e solver validados pendentes |
| Fornecedor de tarefas no runtime e Android | Coleta recorrente, cálculo, armazenamento e entrega ao cliente | Ainda não configurado para esses módulos marinhos |

A página informativa de GEBCO não é uma grade incorporada. A documentação de dados não comprova que arquivos foram baixados ou cálculos estejam executando continuamente. O CHM possui outros contratos de avisos/marés no repositório; isso não constitui uma integração completa de ondas ou tsunami ao Vector.

## Cálculos aprofundados recomendados

- **Balanço de ação espectral das ondas:** fontes de vento, interações não lineares, dissipação e correntes; usar produtos autorizados WW3 em oceano aberto e transformação costeira validada, sem alegar executar modelo global pesado.
- **Transformação costeira:** shoaling, refração, difração, reflexão, atrito de fundo, quebra e influência de correntes. Altura ao largo não se copia para Copacabana, Niterói, Cabo Frio ou outra praia.
- **Águas rasas não lineares2D:** conservação de massa/momento, batimetria, atrito, Coriolis quando aplicável e fronteiras abertas; condições wetting/drying para inundação. Conservação, estabilidade CFL e convergência com resolução precisam de testes.
- **Ondas dispersivas/Boussinesq quando necessário:** não escolher aproximação só pelo nome do evento; verificar escala de comprimento, profundidade e resolução.
- **Origem de tsunami:** deslocamento do fundo por ruptura/mecanismo focal; cenários específicos de deslizamento/vulcanismo e acoplamento à superfície. Abertura de uma crista oceânica ou abalo isolado não é prova de deslocamento gerador.
- **Primeira chegada e corredores:** resolver tempos sobre grade, geodesia e obstáculos, além de percurso único; validar com observações históricas e produtos oficiais.
- **Nível costeiro e inundação:** maré astronômica, maré meteorológica, setup/runup e topografia no mesmo datum, tratando suas interações. Não fornecer alcance em metros sem solver e entradas.
- **Assimilação e ensemble:** revalidar com boias/marégrafos, medir erros por evento/local e fornecer faixas de chegada/altura. Probabilidade exige conjunto calibrado e avaliação retrospectiva; concordância entre duas fontes não é percentual de probabilidade.

## Instrumentos e responsabilidade

Não há um único “medidor de chegada”. Boias oceanográficas medem o estado do mar; DART usa pressão no fundo e comunicação por boia; marégrafos medem nível costeiro. O tempo de chegada é resultado de modelo de propagação e observações, com incerteza. Ciclone e tsunami compartilham coordenação Vector, mas exigem métodos físicos e critérios de validação diferentes.

Mantém-se a distinção entre ondas de vento, swell, ressaca, maré meteorológica, tsunami sísmico e meteotsunami. Um instrumento em modo de evento não confirma sozinho tsunami. Alertas oficiais continuam visíveis e identificados; nenhuma rotina marinha promove automaticamente áudio de escala5.

## Evidência de testes

Nove testes marinhos: espectro analítico, não sobreposição de bandas, limites profundo/raso, residual da relação de dispersão, tempo com profundidade constante, swell por velocidade de grupo, recusas de metadados/profundidade/percurso, municípios costeiros canônicos e isolamento do destino no despachante. Dados e geometrias de teste artificiais explicitamente identificados; não representam condições atuais ou pontos costeiros validados do RJ.

## Referências primárias

- NOAA/NDBC, momentos e altura espectral: https://www.ndbc.noaa.gov/faq/wavecalc.shtml
- NOAA/NCEI, tempo de tsunami e limites: https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis/travel-time-maps
- Artigo de pesquisa sobre ondas lineares e velocidade de grupo: https://doi.org/10.3390/en18061495
- Marinha/CHM, modelo WW3: https://www.marinha.mil.br/chm/dados-do-smm-paginas-modelagem-numerica-0
- Marinha/PAM, ondogramas: https://pam.marinha.mil.br/ww3.html
- Marinha/PNBOIA: https://www.marinha.mil.br/chm/dados-do-goos-brasil/pnboia
- GEBCO, grade e metadados atuais: https://www.gebco.net/data-products/gridded-bathymetry-data
- NOAA/NDBC, pressão de fundo DART: https://www.ndbc.noaa.gov/dart/system.shtml e https://www.ndbc.noaa.gov/faq/tsunameters_modes.shtml

Esta etapa incorpora núcleos numéricos e contratos. Não conclui a integração ao vivo, modelagem de tsunami/ondas costeiras ou validação de alerta operacional.
