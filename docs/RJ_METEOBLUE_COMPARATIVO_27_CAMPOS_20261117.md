# Blaise V6 RJ — meteoblue incluída como candidata e matriz dos 27 campos
Atualizado em **17/11/2026** — PR #157 **draft, sem merge, sem deploy ou publicação no Android original**.

## O/E/P e estágios
- **O:** observação efetiva por sensor identificado (pluviômetro, estação, radar ou imagem GOES/GLM conforme produto); imagens de nuvens não medem chuva em mm. Fonte visual RAMMB/CIRA é GOES/NOAA, não independente.
- **E:** quantidade calculada ou estimada, não medição instrumental direta. Sensação térmica e ponto de orvalho podem ser derivados.
- **P:** previsão de modelos numéricos. Nenhuma previsão é chuva atual medida.
- **Candidato** significa que a variável consta em `backend/src/rj-meteorological-completeness-audit.mjs`, **não** que há feed público ativo. Sem dado validado, mostrar `indisponível`; cobertura dos 92 pontos IBGE não implica 92 sensores.
- **meteoblue NEMS10** (NEMSSA, 10 km nominal sobre América do Sul) foi adicionada a cinco setores apenas para **comparação administrativa de previsão** em `backend/src/rj-source-sector-matrix.mjs`: temperatura, pressão/umidade, vento/rajadas, chuva futura e nuvens. **API comercial, chave e dados reais NÃO HOMOLOGADOS.** Não pertence à allowlist numérica; nem no Android demonstra conexão em tempo real. Não confundir NEMS10 individual (P) com meteoblue mLM (mistura de modelos existentes), nem contar NOAA/ECMWF/DWD reexibidos pelo MultiModel como novas fontes.
- **Condições meteoblue:** pacotes comerciais MultiModel de saída bruta para um ponto, sem downscaling, são diferentes dos produtos combinados mLM com adaptações; cada uso depende da licença do pacote e da proveniência. Testar versão, dados UTC, ponto e altitude no terreno antes de publicar. Docs: https://business.meteoblue.com/pt/produtos/weather-apis/premium-weather-api , https://content.meteoblue.com/en/specifications/data-sources/weather-simulation-data/meteoblue-models , https://docs.meteoblue.com/en/apis/weather-data/introduction .

## Matriz completa de 27 campos de auditoria
| # | Campo | Tipo e fontes elegíveis na auditoria atual | Lacuna real (sem confundir cadastro com ingestão) |
|---:|---|---|---|
| 1 | Temperatura (°C) | P: DWD ICON, NOAA GFS, ECMWF/IFS, INPE/CPTEC; meteoblue NEMS10 só candidata à comparação, fora da allowlist | O: rede de termômetros terrestres homologados, 92 municípios; feeds operacionais limitados |
| 2 | Sensação térmica (°C) | E: derivada de DWD/NOAA/ECMWF | Exige entradas aferidas e fórmula adequada, não sensor de sensação |
| 3 | Umidade (%) | P: DWD/NOAA/ECMWF; meteoblue NEMS10 catálogo administrativo | O: higrômetros locais, tempo válido e QC |
| 4 | UV geral (índice) | P: NOAA UV | O: instrumento UV à superfície não homologado |
| 5 | UV céu limpo (índice) | P: CAMS via MET Norway (exceção definida) | Não significa UV observado em céu real |
| 6 | Chuva na próxima hora (mm) | P: ECMWF, NOAA GFS, DWD; meteoblue NEMS10 catálogo administrativo | Previsão não é chuva presente; falta validação do feed e geolocalização |
| 7 | Probabilidade de chuva próxima hora (%) | P: ECMWF | Calibração e acesso do produto específico |
| 8 | Ponto de orvalho (°C) | E: DWD/NOAA/ECMWF | Valor derivado de T/UR ou observação por estação não conectada |
| 9 | Pressão (hPa) | P: DWD/NOAA/ECMWF; meteoblue catálogo | O: barômetros locais e altitude/pressão referencial |
| 10 | Vento sustentado (km/h) | P: DWD/NOAA/ECMWF; meteoblue catálogo | O: anemômetros a altura/exposição comparáveis |
| 11 | Rajadas (km/h) | P: DWD/NOAA/ECMWF; meteoblue catálogo | O: sensor de rajadas, janela e horário |
| 12 | Chuva agora (mm) | **Nenhum candidato O numérico homologado** | **CRÍTICA** — dados reais de pluviômetros/radar válidos ≤30 min |
| 13 | Chuva acumulada (mm) | **Nenhum candidato numérico homologado** | **CRÍTICA** — pluviômetro com janela e dados licenciados, ≤30 min para atual |
| 14 | Chuva oceânica (mm) | **Nenhum candidato numérico homologado** | **CRÍTICA** — observação oceânica especializada (não PWS terrestre) |
| 15 | Nuvens (%) | O/E: EUMETSAT observação candidata; P: DWD/NOAA; meteoblue NEMS10 P catálogo | Cobertura percentual medida/grade geográfica e qualidade; RAMMB apenas visual |
| 16 | Visibilidade (km) | P: DWD/NOAA | O: sensor de visibilidade local; nevoeiro real não homologado |
| 17 | Radiação solar (W/m²) | P: DWD/NOAA | O: piranômetro terrestre e horários |
| 18 | Raios (contagem) | O: NOAA GLM candidata | Evento, tempo, geolocalização e licença ainda não validados |
| 19 | Probabilidade de granizo (%) | P: ECMWF/DWD/NOAA | Produto e calibração; não confirma granizo caído |
| 20 | Risco de ciclone em terra (%) | E: ECMWF/NOAA derivados | Índice operacional validado e alerta oficial independente |
| 21 | Risco de ciclone no mar (%) | E: ECMWF/NOAA derivados | Índice calibrado; fonte oficial de vigilância |
| 22 | Altura de onda (m) | P: NOAA GFS-Wave/ECMWF Wave | Evidência NOAA numérica histórica em staging, **não** feed RJ vivo |
| 23 | Período do swell (s) | P: NOAA GFS-Wave/ECMWF Wave | Produto específico, ponto oceânico, ciclo e licença |
| 24 | Corrente marinha (m/s) | P: NOAA RTOFS | Validação espacial e temporal, boias não homologadas |
| 25 | Temperatura da superfície do mar (°C) | E: EUMETSAT OSI SAF / NOAA CoastWatch | NetCDF recente, qualidade e máscara de terra; mesmo GOES pode ser insumo compartilhado |
| 26 | Nível de rio (m) | O: ANA/SGB SACE candidatos | Estações por bacia e município não homologadas |
| 27 | Risco hidrológico (nível) | **Nenhum candidato numérico homologado** | **CRÍTICA** — regras municipais/autoridade, alagamento e cheias |
 
## Outras lacunas fora dos 27 campos
- Maré astronômica, ressaca oficial confirmada, qualidade do ar, microclima de encostas, chuva medida por radar licenciado, risco de deslizamentos e qualidade de estação urbana exigem fontes e contratos próprios.
- PWS Weather Underground e Ambient são **candidatas não licenciadas**, Weathercloud somente estudo visual autorizado; Zoom Earth, NASA, JAXA, INEA, Marinha e Windy continuam excluídos. Alerta Rio/Defesa Civil só links oficiais; INMET/CEMADEN comparação interna.
- Segurança e rollout: nenhuma chave meteoblue no APK ou repositório, respeito a volume/cotas, amostras em staging, cache por município, evitar consultar separadamente o mesmo campo por múltiplos usuários, e cliente de até 400 MB.
- Operação: verificar se existem fontes de medição e acesso comercial suficiente. A matriz **não** comprova medidas reais em 92 municípios nem aprovação final do telefone.
