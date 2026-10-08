# Blaise Vector RJ — Agente de Cálculo e Revalidação Científica

Recuperação de memória em06/10/2026: nome histórico Blaise Sigma AI (25/08); proposta mais recente Blaise Vector RJ (30/09). Fusion, Track, Hydro, Ocean, Seismo e Audit designam funções de coordenação científica. Não são serviços comprovadamente ativos.

## Cinco motores e abrangência recuperada

| Motor previsto | Blocos científicos recuperados |
|---|---|
| Atmosférico | Equações de momento/estado/termodinâmica/transporte; advecção; balanço térmico; pressão ao nível do mar/tendência/gradiente; ponto de orvalho/bulbo úmido/índices calor/frio; razão de mistura/umidade específica/PWAT/transporte vapor. |
| Tempestades/nowcasting | Correlação/extrapolação radar, Z–R, radar avançado/raios; CAPE/CIN/LI/lapse rate/LCL/LFC/EL; shear0–1/0–6km/SRH/vorticidade/divergência/convergência; trajetória/ensemble/derivadas/aceleração/curvatura/ETA/corredor. |
| Hidrológico/geológico | Chuva-vazão/acumulados/níveis; drenagem urbana/saturação solo/encostas/ocupação; risco separado de ocorrência. |
| Oceânico/sismológico | Ondas/maré/storm surge/ressaca; boias/marégrafos; WGS84/UTM/geodesia/batimetria/águas rasas2D/diferenças e volumes finitos/refração/difração/reflexão/ressonância/refinamento costeiro; mecanismo focal/deslocamento oceânico; tsunami sísmico separado de meteotsunami e ressaca. |
| Estatístico/incerteza | Média/mediana/variância/desvio/percentis/média móvel; regressão/séries/derivadas/extremos/anomalias; fusão espaço-temporal/concordância/divergência/intervalos/proveniência/auditoria. Confiança não é probabilidade do fenômeno. |

Escopo RJ e seus municípios, com contexto do Sudeste e Atlântico relevante ao RJ. Lista recuperada de requisitos/propostas anteriores, não evidência de cinco simuladores operacionais. Consumir produtos/modelos autorizados, sem alegar executar modelos globais pesados.

## Fontes e substituição

Observações locais Alerta Rio/INMET; alertas COR/Defesa Civil conforme contrato validado. Substituir INEA por Alerta Rio na capital, CEMADEN, ANA/HidroWebService e SGB/SACE conforme variável/cobertura. Atlântico/ciclone: NOAA/Marinha/INMET e comparação autorizada Windy (não autoridade oficial). Aproximadamente1km da costa: priorizar Alerta Rio/Marinha/INMET/Windy; distância muda prioridade, não severidade. Marinha/CHM para mar/avisos; RSBR/USGS para sismos. Contexto de frentes/massas de ar não substitui observações locais. Magnitude/profundidade não confirmam tsunami.

Não foram recuperados pesos numéricos calibrados por fenômeno. Comparar mesma variável/unidade/período/natureza/cobertura; retransmissão da mesma origem não é fonte independente. Não extrapolar outra cidade como medição do Centro ou de Niterói.

## Implementado nesta revisão

Módulo `backend/src/blaise-vector-rj.mjs`: agente iniciado explicitamente pelo chamador; coleta/validação de Alerta Rio; componentes vetoriais de vento por estação; advecção cartesiana local com velocidade constante e horizonte limitado a2h; núcleo de fusão escalar com política calibrada/versionada fornecida pelo chamador. O limite2h não valida previsão de2h.

Fusão exige proveniência independente, recência/sincronismo, mesma cobertura/unidade/variável/natureza/período e limite de divergência. Preserva dispersão e fonte sem inventar confiança nem emitir alerta oficial. Não foi distribuída política de pesos operacionais: fusão sem ela é rejeitada.

Agendador:5min níveis1–3;30s níveis4–5; sem sobreposição. Severidade vem do chamador. A regra anterior30s coleta+30s revalidação/publicação60s é distinta: esse ciclo em duas fases ainda não foi implementado. O estimador existente `rj-weather-transition-estimator.mjs` continua separado, com exigências de entradas independentes/evidência local/calibração, sem comprovação de ingestão ao vivo.

## Pendências

Extensão marinha: `MARINE_PROPAGATION_RJ_20261006.md` documenta três rotinas novas para altura/períodos espectrais, dispersão linear e tempo condicional por percurso validado fornecido. Total19 rotinas. Não há grade batimétrica importada, primeira chegada2D, altura costeira ou probabilidade de impacto operacional; não chamar destino consultado de cidade atingida.

Complemento posterior no mesmo dia: `WIND_TORNADO_SCIENCE_20261006.md` registra cinco núcleos adicionais (rajada estacionária calibrada, cisalhamento por camada, SRH, rotação/convergência e tendência de pressão). Total16 rotinas. Apoio a tornados não equivale a detecção ou probabilidade de ocorrência; DCAPE e radar Doppler operacional ainda pendentes.

Extensão de06/10/2026: onze núcleos numéricos e contratos de tarefas foram acrescentados em `blaise-scientific-kernels.mjs`/`blaise-scientific-jobs.mjs`, com testes e entrada opcional ao agente. θe aproximada, integração PW por camada, Clausius–Clapeyron, FAO56 diário, balanço do solo, tensão do vento, TCHP, perfil médio neutro, R(KDP) calibrado, MOS fornecido e atualização Kalman escalar. Fórmulas completas, limites, fontes e avaliação da interface em `SCIENTIFIC_EXTENSION_20261006.md`. Não há ingestão operacional dessas novas entradas; rotinas testadas não são simuladores completos ou previsão validada.

Perfis atmosféricos/métodos validados para CAPE/CIN/SRH/PWAT/índices; frames georreferenciados/retrospectiva para radar; batimetria/contornos/observações/validação numérica para oceano/tsunami. Esses simuladores não foram implementados nesta revisão. Sensação térmica segue indisponível no contrato Alerta Rio.

Faltam ligação ao Cloud Run e Android, endpoints operacionais, calibração por região/fenômeno, fases de revalidação, ensaios de alertas/latência/carga e implantação. Módulo executável/testado não significa operação contínua. Precisão e rapidez operacional requerem medições, sem promessa de precisão absoluta.

Fontes documentais consultadas: Baseline Mestre v1.2.0, Especificação Técnica Consolidada, Referencia_Definitiva_Blaise_V6_RJ_atualizada.md versão2, decisões25/08 e30/09. Correções atuais de voz/boletins/escala/fontes prevalecem sobre textos antigos.
