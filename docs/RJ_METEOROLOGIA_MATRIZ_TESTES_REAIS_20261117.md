# Blaise V6 RJ — 17/11/2026: quem mede, estima e prevê; testes reais e status da interface

**DECISÃO FINAL MAIS RECENTE:** NASA GPM/IMERG, NASA SAT, NASA MUR SST e JAXA GSMaP **removidas** dos candidatos operacionais e da interface. **RAMMB/CIRA SLIDER (GOES-19)** assume apenas a referência **visual externa**, não chuva medida/estimada em mm, com proveniência NOAA e sem independência instrumental. `rainNowMm`, `rainAccumulatedMm`, `oceanRainMm` não aceitam esses fornecedores como dados numéricos. Em caso de ausência de fonte observacional licenciada com idade ≤30 min: `INDISPONÍVEL`. Demais descrições antigas NASA/JAXA abaixo são registro histórico revogado. Veja `docs/RJ_RAMMB_CIRA_SUBSTITUICAO_JAXA_NASA_20261117.md`.


**ATUALIZAÇÃO PRIORITÁRIA (17/11/2026): JAXA EXCLUÍDA.** Por exigência do usuário, nenhum produto GSMaP_NRT (latência ~4 horas) nem GSMaP_NOW (estimativa/extrapolação publicada a cada 30 minutos) pode alimentar chuva atual do Blaise. A JAXA foi retirada das fontes operacionais e da interface pública; qualquer referência histórica a JAXA como fonte principal abaixo está **revogada**. Chuva atual exige observação O licenciada, comprovada e com no máximo 30 minutos de idade. Sem fonte ativa homologada: **INDISPONÍVEL**. NASA IMERG permanece somente na pesquisa interna, não no cliente como chuva atual. Política efetiva em `backend/src/rj-source-sector-matrix.mjs`; documento vigente `docs/RJ_OPERACAO_REAL_GATES_92_CIDADES_20261117.md`.


**Escopo:** atualização da PR #157. Este documento não certifica todos os fornecedores, não é autorização de deploy, não atesta simultaneidade de valores em 92 cidades, nem contém dados fictícios. O=observação; E=estimativa/derivação; P=previsão numérica.

## 1) Responsabilidade por setor — fontes e produtos

| Setor | Principal | Complementares / comparação | Natureza e veto |
|---|---|---|---|
| Temperatura 2m | ECMWF IFS distribuído por MET Norway | DWD ICON Global; NOAA GFS | **P**; MET Norway é mesmo ECMWF, NÃO quarta fonte |
| Sensação térmica | Campo `apparent_air_temperature` da MET Norway | Blaise Vector com T/UR/vento autorizados; agente 13 restrito à contingência térmica 35min/900 dia | **E**; não é termômetro oficial |
| Umidade/pressão | ECMWF IFS | DWD ICON; NOAA GFS | **P**; nível/horário equivalentes |
| Ventos e rajadas | DWD ICON Global | NOAA GFS; ECMWF IFS | **P**; jamais alegar leitura de anemômetro |
| Chuva prevista 1h | ECMWF IFS via MET Norway | NOAA GFS; DWD ICON | **P**; não é chuva ocorrida |
| Chuva estimada RJ | JAXA GSMaP V06 (lançado 19/10/2026) | NASA IMERG Early V07 | **E** com latência e grade: não é estação |
| Chuva oceânica | JAXA GSMaP V06 | NASA IMERG | **E**, não interpolar como medição local |
| Nuvens/tempestades | NOAA GOES-East/ABI | EUMETSAT Meteosat por cobertura válida; ECMWF IFS para previsão | imagem **O**, derivadas **E**, previsão **P**; imagem não confirma tornado |
| Ciclones/frentes afetando RJ | ECMWF IFS | NOAA GFS; DWD ICON | **P**; alerta depende de autoridade/evidência adicional |
| Ciclones no Atlântico | ECMWF IFS e seus produtos de trajetória | NOAA GFS; satélite NOAA GOES | **P/O separados**; fonte não é confirmação automática de ocorrência |
| Ondas/swell/período | NOAA GFS-Wave | ECMWF IFS-Wave | **P**; não é boia; requer validade marítima |
| Temperatura superfície mar | EUMETSAT OSI SAF OSI-207-c | NOAA CoastWatch ACSPO; NASA MUR SST | **E**; OSI/CoastWatch podem compartilhar GOES/ABI; MUR usa composição de múltiplos sensores |
| UV céu limpo | Copernicus CAMS somente via MET Norway | Nenhum comparador efetivo homologado | **P**; não confundir com UV real sob nuvens; exceção direta Copernicus proibida |
| Relâmpagos | NOAA GOES/GLM | Outra rede só com cobertura/licença | **O**; candidatos não são rede validada de contagens municipais |
| Nível de rios/cheias | ANA e SGB/SACE nos locais com instrumentos | Contexto de chuva satelital | **O** se medição de estação; nunca inferir nível de rio a partir de chuva |

**Comparação interna Brasil:** INMET, CEMADEN. Nenhum desses dois fornece observações à interface pública meteorológica do Blaise. Links de **avisos oficiais** de INMET e INPE/CPTEC autorizados na faixa pública, juntamente com Alerta Rio e Defesa Civil RJ. Esses links não são aquisição meteorológica, monitoramento de severidade, nem cópia de boletins. O portal CPTEC/INPE informa restrição de reprodução comercial sem autorização expressa; não coletar/distribuir seus produtos comerciais sem essa autorização.

**Exclusões diretas continuam:** INEA, Marinha do Brasil, Windy, Copernicus direto. A única exceção Copernicus permanece CAMS UV de céu limpo via MET Norway. Aplicativo independente alemão Blaise & Ben não deve ser afetado.

## 2) Prova de teste real controlado — 17/11/2026

Workflow: `RJ International Staging Live Sources`, execução `44133678531`, acesso:
https://github.com/gabilinsj-cyber/Blaise-/actions/runs/44133678531

### NOAA GFS-Wave — **VALOR REAL DE MODELO DECODIFICADO**
- Resultado do script isolado `backend/scripts/probe-noaa-wave-staging.mjs --live`: estado `REAL_MODEL_FIELD_VALIDATED`.
- **1,53 metros** de altura significativa das ondas (previsão **P**), para ponto **fixo de staging offshore** latitude −23,5 / longitude −42,5. Não pertence a município nem corresponde a qualquer praia específica, e não é medição de boia.
- Modelo emitido em **2026-11-17T12:00:00Z**; valor previsto para **2026-11-17T17:00:00Z**; verificado às **2026-11-17T17:08:59.903Z**; expiração às **2026-11-17T18:00:00Z**. Esses horários não são permanentes e não devem ser copiados como valor atual para a interface.
- GRIB2 efetivamente recebido do servidor `nomads.ncep.noaa.gov` e decodificado com ecCodes. O código verifica tipo de produto, campo numérico, ciclo, validade, origem NOAA, expiração, domínio físico. O modelo não gera alarme oficial.
- URL usada (parâmetros do arquivo e recorte RJ): https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl?file=gfswave.t12z.global.0p25.f005.grib2&dir=%2Fgfs.20261117%2F12%2Fwave%2Fgridded&var_HTSGW=on&lev_surface=on&subregion=on&leftlon=-45&rightlon=-40&toplat=-21&bottomlat=-25
- **Estado de publicação:** não enviado a clientes, nem a produção. Serve como evidência de que o pipeline NOAA funciona em um ponto real. O app só poderá mostrar uma onda atual por leitura autenticada do backend e `sourceWorker` homologado.

### NOAA / DWD / EUMETSAT — disponibilidade de catálogo, **não valor meteorológico**
- Script `backend/scripts/probe-international-live-staging.mjs --live` passou nos três catálogos.
- NOAA GFS-Wave — `RECENT_CATALOG`, data de referência do índice **2026-11-17T00:00:00Z**.
- DWD ICON Global t_2m — `RECENT_CATALOG`, ciclo encontrado no catálogo **2026-11-17T00:00:00Z**.
- EUMETSAT OSI SAF OSI-207-c — `RECENT_CATALOG`, produto do catálogo **2026-11-17T16:00:00Z**.
- Checagem dos catálogos às **2026-11-17T17:08:56.314Z**, sem download de valores numéricos, sem chamada à MET Norway. O teste se limita a detectar arquivos/estado atual no servidor. Os catálogos podem ficar indisponíveis ou atrasados a qualquer momento.

## 3) Implementação no aplicativo — versão de desenvolvimento
- `backend/src/rj-source-sector-matrix.mjs`: tabela de 15 setores, produtos, origem/modelo e O/E/P; **registro não é conexão**.
- `backend/src/rj-meteorological-completeness-audit.mjs`: auditoria interna inclui NASA IMERG, JAXA GSMaP, OSI SAF SST e ECMWF Waves como candidatos de campos com dados separados. Não inventar resultados.
- `app/src/main/java/br/com/blaise/rj/WeatherSourceResponsibility.kt`: matriz de proveniência do cliente; só MET Norway ECMWF com resposta validada, NOAA GFS-Wave com snapshot válido e CAMS UV céu limpo efetivamente recebido podem ser assinalados como disponíveis. Outros fornecedores permanecem explicitamente **COLETA NÃO HOMOLOGADA**.
- `app/src/main/java/br/com/blaise/rj/MainActivity.kt`: cartão de origem e status no menu **Mais**, mantendo a calculadora separada no APK administrador. O mapa de 92 municípios só mostra pontos geográficos válidos, sem chuva interpolada, sem raster sintético e sem valores emprestados da cidade vizinha.
- `backend/src/dashboard-data-http.mjs` + `backend/src/rj-met-norway-runtime-optional.mjs`: contrato de MET Norway/ECMWF em cache compartilhado (desligado por padrão); não faz chamadas MET em requests dos clientes.
- Fitas superiores: Alerta Rio, Defesa Civil RJ, INMET e INPE/CPTEC, frase curta preta e em negrito, cinco níveis Blaise APENAS com prova validada no backend e botão **Mais** para avisos adicionais.

## 4) Segurança, custo e qualidade
1. Staging executa **somente quando explicitamente acionado**. O novo workflow não executará coleta real continuamente a cada commit comum. Sem GPS de usuário, credenciais ou dados de cliente.
2. O operador precisa aceitar pessoalmente os termos MET Norway de 05/11/2026, fornecer User-Agent com contato real e configurar Firestore antes da API; o mínimo de **3 horas para mesma consulta global no RJ** deve ser respeitado. A tela pode checar cache com frequência maior sem renovar o modelo.
3. Atribuição e licença são por **produto**. O uso comercial de CPTEC exige autorização expressa; NOAA/EUMETSAT/JAXA/NASA/DWD requerem verificação final por produto e crédito adequado.
4. Para **90 municípios sem coordenadas/altitude homologadas** no coletor MET atual, manter valores indisponíveis; o cadastro dos 92 no seletor não prova que a coleta funcione nos 92.
5. Os modelos de chuva/vento/temperatura só podem substituir variável por variável, respeitando escala espacial, unidade e validade, sem chamar P de O. INMET/CEMADEN funcionam apenas como revisão de divergências internas.
6. O Agente 13 OpenWeather conserva política própria de teto interno de 900/dia e fallback limitado a temperatura/sensação após indisponibilidade comprovada das fontes internacionais; não está ativo automaticamente.
7. Se houver erro de rede, atraso, rejeição de licença ou ciclo faltante, mostrar **indisponível** e hora de checagem; jamais exibir 0 indevido, `sem alerta` sem evidência ou um valor estático do teste.
8. Não publicar APK/AAB nem anunciar integração em produção antes de CI Android e backend, validação por município, licenças, conta da loja, IAM, monitoramento e aprovação de release.

## Fontes consultadas
- MET Norway: https://api.met.no/weatherapi/locationforecast/2.0/documentation
- ECMWF open data, mudanças de 20/10/2026: https://confluence.ecmwf.int/spaces/DAC/pages/272310539/ECMWF%2Bopen%2Bdata%2Breal-time%2Bforecasts%2Bfrom%2BIFS%2Band%2BAIFS
- NOAA GFS / GFS-Wave: https://nomads.ncep.noaa.gov/
- DWD ICON global: https://opendata.dwd.de/weather/nwp/icon/grib/00/t_2m/
- JAXA GSMaP V06 (19/10/2026): https://www.gportal.jaxa.jp/notice/notice/view/1508?lang=en
- NASA GPM/IMERG: https://gpm.nasa.gov/data/imerg
- EUMETSAT OSI SAF: https://osi-saf.eumetsat.int/products/osi-207-c
- INPE/CPTEC: https://www.cptec.inpe.br/
