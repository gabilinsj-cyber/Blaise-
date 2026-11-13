# Blaise V6 RJ — auditoria de memória, código e lacunas (13/11/2026)

**Escopo estrito: Rio de Janeiro, 92 municípios + oceano adjacente.** Este arquivo documenta a diferença entre requisitos históricos e implantação comprovável. Não autoriza publicação, merge ou alteração do Cloud Run.

## Fontes aprovadas e fontes proibidas

Principais: **Alerta Rio/COR.Rio; Defesa Civil RJ; INMET; INPE/CPTEC; CEMADEN; NOAA; EUMETSAT; JAXA/GSMaP.**
Complementares por produto: CET-Rio, Geo-Rio, USGS, ANA/Hidroweb, SGB/SACE; Weather.com e Earth Nullschool apenas complementos opcionais sujeitos a licença.
**Proibidas: INEA; Marinha do Brasil/CHM; Copernicus; Windy.** Não podem ser coletoras ativas, fornecedores de cálculo, fallback, avisos, mapa ou status público. Código legado ainda precisa ser auditado por referências transitivas. Nunca apresentar cache antigo como dado atual.

## Matriz operacional: memória versus código conferido

| Requisito da memória | Evidência atual no código GitHub | Lacuna / verificação obrigatória |
| --- | --- | --- |
| 92 municípios IBGE | Catálogo Kotlin/Node de 92; novo asset GeoJSON CC0 com 92 IDs conferidos | Conferir versão de limites para geofences e licenças; a geometria visual NÃO é fronteira oficial de risco |
| Interface original Compose | Duas cidades, voz, LIGADO, navegação, alertas, mar, notícias, mapas e gráficos com placeholders seguros | Verificar Android CI, usabilidade em celulares/tabletes e dados reais em cada painel |
| Fontes atualizadas | Catálogo separado de oito principais + complementos, tela Mais, filtro de fontes proibidas | Provar licença, URL, produto, fonte, tempo e estado para cada origem no backend |
| Mapa próprio | Canvas Jetpack Compose com 92 polígonos locais e pinch-to-zoom; seleção destaca município | Camadas radar/chuva/vento georreferenciadas ainda não ligadas; sem tiles externos ou dados inventados |
| Risco hidrológico | Canvas colore exclusivamente níveis atuais de snapshot estadual worker-active via CEMADEN | Verificar latência real e política de escala; nível hidrológico não é alerta oficial |
| Radar Sumaré | Janela de 30 minutos e painéis no Android | Obter frames oficiais com emissão/validade/georreferência e licença, desenhar sequencialmente sem interpolar |
| Atualização mapa | Android consulta dados estaduais a cada 30 segundos quando autenticado; renderiza ao receber snapshot e relógio | Polling não prova nova observação; normal 5 min, severo 1 min e extremo 25–30 s dependem de origem real e agendador |
| Trânsito e Defesa Civil | Seções, camadas previstas e algumas fontes oficiais | Eventos georreferenciados, cobertura municipal, sirenes, fechamento, pontos de apoio em tempo real não comprovados |
| Notícias e sismos | Seções e referência USGS | Consultas atuais, seleção e publicação de notícias/abalos ainda requerem integração e timestamp |
| 3 dias históricos + hoje + próximos 5 | Requisito documentado; gráfico de tela ainda usa placeholder | Precisam séries reais comparáveis por cidade e natureza OBSERVADO vs MODELO |
| Voz e 800 perguntas | Conversa/voz Kotlin existentes | Testes por intenção/idioma, temas e evidência de fonte para cada resposta |
| Dez agentes | Catálogo de 10, despachante e supervisor sob habilitação explícita | NÃO comprova dez workers em produção; mapear execuções e telemetria antes de habilitar |
| Alertas P0 | Política P0 sem assinatura, worker oficial INMET com processamento protegido | Verificar entrega ao dispositivo FCM, geofencing por município e comportamento offline |
| Preço e assinatura | Planos e callbacks de billing no Android | Confirmar credenciais, entitlement, SKU/preço, publicação na Play |
| NOAA ondas | Coletor, cache e visualização marítima existente | Provar dados atuais, hora de emissão, validade, licença e renderização no dispositivo |
| Tsunami, ressaca, maré de tempestade | Núcleos de onda longa, dispersão e tempo de rota fornecida | Sem rede DART validada, batimetria operacional ou modelo 2D/costa; NUNCA mostrar previsão de impacto ou ETA oficial inferida |

## Inventário exato de cálculos no backend (25 funções exportadas)

**Termodinâmica, atmosfera, solo (10):**
1. equivalentPotentialTemperatureApprox — potencial equivalente aproximado
2. clausiusClapeyronDerivative — derivada de pressão de vapor
3. precipitableWater — PWAT por integração de um perfil de pressão
4. referenceEvapotranspirationDaily — FAO-56 diário
5. soilWaterBalance — balanço de fluxos de água no solo
6. neutralMeanWindProfile — perfil logarítmico com hipótese neutra
7. liftingCondensationLevel — LCL aproximado (Bolton)
8. environmentalLapseRate — gradiente térmico de uma camada
9. hypsometricThickness — espessura hipsométrica
10. suppliedParcelCapeCin — contribuição de CAPE/CIN em perfil FORNECIDO de Tv

**Ventos, tempestades, assimilação e radar (9):**
11. calibratedKdpRainRate — chuva KDP somente calibrada
12. calibratedMos — MOS somente calibrado
13. scalarKalmanUpdate — atualização escalar de Kalman
14. calibratedTurbulentGust — estimativa calibrada de rajadas
15. bulkWindShear — cisalhamento de camada, inclusive 0–1 e 0–6 km se suprido
16. stormRelativeHelicity — SRH em hodógrafa fornecida
17. horizontalWindDiagnostics — divergência, convergência, vorticidade, deformação
18. stationPressureTendency — tendência de pressão por estação
19. oceanWindStress — tensão de vento oceânica

**Oceano, ondas e tsunami (6):**
20. tropicalCycloneHeatPotential — potencial térmico oceânico
21. significantWaveSpectrum — altura espectral significativa e períodos
22. linearWaveDispersion — dispersão, velocidade de fase/grupo, comprimento de onda
23. conditionalMarineTravelTime — velocidade e tempo condicionais ao longo de trajeto marítimo validado
24. shallowWaterLongWaveSpeed — celeridade de onda longa sqrt(g*h), com checagem do regime
25. tsunamiConditionalPathSensitivity — sensibilidade do tempo condicional à variação da profundidade, sem previsão probabilística

**Android, cinco fórmulas adicionais em RjScientificCalculations.kt:** ponto de orvalho Magnus, déficit de pressão de vapor, índice de calor Rothfusz, sensação de frio por vento, bulbo úmido aproximado Stull. O painel de Cidades exibe apenas valores adequados ao domínio e com observações recentes.

O despachante científico exige origem HTTPS, escopo RJ IBGE, natureza OBSERVADO ou MODELO, qualidade validada, hora válida e frescor. Resultado científico é `CALCULO_BLAISE` com `officialAlert:false`, e relatório integral apenas administrativo (TTL 24 h). Não preencher CAPE/CIN, LI, LFC/EL e tsunami a partir de uma estação sem perfil apropriado.

## Tsunami — fronteira de segurança obrigatória

- **Onda longa:** `c=sqrt(g*h)` é resultado físico ideal para água rasa no sentido relativo ao comprimento de onda; não equivale a detectar um tsunami.
- **Rota:** batimetria versionada e assinada, ponto costeiro IBGE validado, caminho sobre água, extensão de segmentos, tempo de origem e perfil de profundidade. Sensibilidade de profundidade NÃO é intervalo de confiança probabilístico.
- **Impossível inferir com os núcleos atuais:** primeiro tempo de chegada global, amplitude/run-up, inundação, altura na praia, risco municipal, rotas de evacuação, probabilidade, alerta tsunami P0 ou cancelamento de aviso.
- **Pré-requisitos para capacidade operacional de previsão:** fontes oficiais de sismo/tsunami e observações de nível da água/DART, validação de batimetria e datum/costa, roteamento 2D sobre grade oceânica, assimilação e verificação de skill/uncertainty. Nunca emitir aviso com base em cálculo isolado.
- NOAA: https://www.noaa.gov/jetstream/tsunamis/tsunami-propagation
- NCEI NOAA: https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis/travel-time-maps

## Dez agentes — contratos de execução

1. Integridade e correção (auditoria e patch sujeito a autorização)
2. Checagem horária de fontes
3. Rotina 01h Brasília
4. Auditoria/limpeza 24h
5. Cálculos severos: 5 min normal, 1 min severo, 25–30 s extremo sob gatilho
6. Trânsito RJ: 5 min normal
7. Marítimo: 5 min normal, frescor por produto
8. Voz e perguntas: sob demanda
9. Fiscalização de fontes/licenças: hora
10. Segurança/assinantes/escala: 5 min

`blaise-rj-agent-supervisor.mjs` valida cadências, permite ticks explicitamente habilitados e bloqueia ID de fonte proibida. Não cria timers nem liga coletores sozinho; a produção deve conectar executores e monitoramento antes de habilitar. NÃO afirmar “dez agentes ativos” apenas pela presença do catálogo.

## Pendências prioritárias antes de publicação

1. Android CI completo, testes científicos, testes do mapa com dados reais/ausentes, regressão de fontes e P0.
2. Retirada auditada de restos legados de CHM/INEA e demais origens proibidas de todos os módulos com integração real e contratos de teste; preservar backups e não apagar sem diff.
3. Fonte oficial e frames georreferenciados do radar, adapter do mapa local, níveis de risco, relógio, validade, legenda, zoom e cache nos dois layouts.
4. Perfiles reais validados para CAPE, CIN, LFC/EL, shear/SRH/LI e modelo 2D de tsunami **se for possível e validado**; não prometer capacidade não existente.
5. Agentes: executar habilitação gradual apenas após testes, deduplicação, limitação de taxa, autorização e telemetria.
6. Segurança, escala 3M/9M, alertas P0 e distribuição Android só após homologação, canary e rollback.
7. Comparar código GitHub com `~/Blaise-RJ` e backups locais antes de mover qualquer branch; não fazer reset/pull cego.
