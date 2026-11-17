# Blaise V6 RJ — RAMMB/CIRA SLIDER substitui JAXA e NASA

**Decisão operacional do proprietário — 17/11/2026 — PR #157 (ainda não publicada).**

## Substituição aprovada
- **JAXA GSMaP:** excluída das fontes operacionais de chuva e do catálogo público. Cadastro existente preservado fora do aplicativo; não realizar downloads automáticos.
- **NASA GPM/IMERG, NASA SAT e NASA MUR SST:** excluídas das fontes meteorológicas candidatas e do painel do cliente. Arquivos históricos de staging podem permanecer no repositório para auditoria **sem qualquer agendamento ou publicação**. Não continuar solicitando cadastro NASA.
- **RAMMB/CIRA SLIDER:** referência externa e visual para imagens de nuvens, frentes, tempestades e sistemas no Rio de Janeiro e no Atlântico Sul. Abrir **https://rammb-slider.cira.colostate.edu/** pelo navegador externo do Android, dentro da seção de fontes em **Mais**. Não embutir/copiar mosaicos, tiles, mapas, frames, GIFs, logos ou outras imagens/derivados do CIRA sem confirmar direito de redistribuição comercial e atribuição.
- **Fonte instrumental real:** GOES-19/ABI da NOAA; SLIDER é um **visualizador** dos mesmos dados, não mais um satélite, sensor ou modelo independente. Categoria O se refere à imagem de nuvens observada, **não à medição de chuva em mm**.
- **Zoom Earth excluído (decisão expressa 17/11/2026):** não usar para dados, imagens, pesquisa, comparação, links do aplicativo ou contingência. A referência visual permanece **somente RAMMB/CIRA SLIDER**, além da aquisição autorizada dos dados originais da **NOAA**.
- É legítimo consultar a imagem; **não** inferir precipitação acumulada, relâmpagos ou severidade de alertas apenas por cor/temperatura de nuvem. Os alertas continuam exclusivamente mediante fontes oficiais e backend verificável.
- **30 minutos:** esse limite aplica-se à exigência de **chuva atual observada** do cliente. Enquanto não houver fonte licenciada homologada com aquisição e publicação confirmadas em no máximo 30 minutos, `rainNowMm`, `rainAccumulatedMm` e `oceanRainMm` ficam **INDISPONÍVEIS**. Horário de imagem visual também deve ser apresentado pelo site (nunca fabricado) e não presume latência contínua abaixo de 30 min.
- **Previsões P** de modelos ECMWF/IFS via MET Norway, DWD ICON e NOAA GFS são separadas, com hora e etiqueta de previsão, e podem ser exibidas se tiverem dados reais validados, licença, cobertura e validade. Não confundi-las com medição atual.
- Outras fontes aprovadas (**NOAA, ECMWF, DWD, EUMETSAT**) e fontes brasileiras restritas (**INMET/CEMADEN comparações internas; Alerta Rio/Defesa Civil somente encaminhamento**) ficam intactas. INEA, Marinha, Windy e Copernicus direto seguem excluídos.

## Evidência de implementação (branch ainda não mergeada)
- `backend/src/rj-source-sector-matrix.mjs`: setores `SATELLITE_VISUAL_RJ` e `SATELLITE_VISUAL_ATLANTIC`, RAMMB/CIRA como referência GOES, política formal de link, ausência de imagens embutidas, fonte não independente.
- `backend/src/rj-meteorological-completeness-audit.mjs`: remove candidatos e categorias NASA/JAXA, chuva atual sem valores substitutos, e RAMMB não é candidato a campos numéricos.
- `app/src/main/java/br/com/blaise/rj/WeatherSourceResponsibility.kt`: painel público substituído sem nomes JAXA/NASA.
- `app/src/main/java/br/com/blaise/rj/MainActivity.kt`: botão **Abrir imagens GOES-19 • RAMMB/CIRA SLIDER** no painel **Mais → Fontes Meteorológicas**; abre navegador externo via HTTPS.
- Testes `backend/test/rj-source-sector-matrix.test.mjs`, `backend/test/rj-meteorological-completeness-audit.test.mjs` e `app/src/test/java/br/com/blaise/rj/WeatherSourceResponsibilityTest.kt` asseguram exclusão e não falsificação de chuva.
- **Não significa que dados visuais foram ingeridos, que o SLIDER autoriza cópia comercial ou que a versão instalada no celular já foi substituída.** O aplicativo original e o backend implantado permanecem intactos até revisão, CI, build e publicação autorizada.

## Documentação oficial
- RAMMB/CIRA SLIDER (GOES-19 Full Disk / GeoColor): https://slider.cira.colostate.edu/?sat=goes-19&sec=full_disk
- Visualizador histórico principal: https://rammb-slider.cira.colostate.edu/
- Ajuda e explicação sobre latência e características da fonte: https://slider.cira.colostate.edu/
- Contato técnico do CIRA indicado no portal: cira_slider@mail.colostate.edu.
- Para imagens diretamente processadas pela NOAA, verificar as condições de acesso e licença do produto GOES específico; direitos do produto CIRA sobre suas composições e tiles não foram comprovados para redistribuição comercial.
