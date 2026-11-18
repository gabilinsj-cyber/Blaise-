# Blaise V6 RJ — exclusão EUMETSAT, NOAA e avaliação meteoblue — 18/11/2026

## Decisão do proprietário
- **Excluir EUMETSAT de todo o catálogo ativo, auditoria de origem e coletores do Blaise V6 RJ.** O histórico de PRs/provas científicas anteriores fica apenas no Git, não é fonte autorizada em runtime.
- Para **SST (temperatura da superfície oceânica)** autorizar exclusivamente **NOAA CoastWatch/STAR ACSPO GOES-19**, categoria **E**, com NetCDF recente, pixel com QA=5, carimbo de hora e atribuição. O teste real de 18/11/2026 ainda retornou `UNAVAILABLE` (nenhum arquivo elegível). O catálogo é autorização potencial, NÃO prova de coleta em tempo real.
- Para **nuvens e imagens** conservar NOAA GOES-19 e RAMMB/CIRA SLIDER **como link visual externo** sem reproduzir terceiros. Para **relâmpagos** manter NOAA GOES-19 GLM **como candidata**; sem extrair nem publicar alertas de descargas antes da validação temporal/geográfica dos flashes.
- Para ondas/swell usar NOAA GFS-Wave com 3 pontos marítimos P testados, não as temperaturas atmosféricas.
- **Não utilizar NOAA nem Climatempo para temperatura do ar ou sensação térmica**; continuam restritas a HG Brasil Pro contratado, OpenWeather atual E com limites, DWD ICON P, com checagem visual das fontes oficiais.
- ANA/SGB: acesso a níveis de rios exige estação oficial georreferenciada, unidade, cota, hora, qualidade, licença; **ANA HidroWebService automatizado somente após autorização formal** via manual oficial. Não simular nível de rio.

## Nova fonte única NOAA CoastWatch
- `backend/scripts/noaa-acspo-ghrsst-rj-reader.py` é um decodificador NOAA autônomo; eliminada dependência da EUMETSAT no código.
- `backend/src/rj-noaa-coastwatch-sst-admin.mjs` segue apenas em audit/QA. Nenhum lançamento ao assinante até ter uma amostra real homologada.
- Retirados da branch os dois workflows EUMETSAT, coletores Python, bridge JS, testes e documento operacional. O histórico Git é preservado.

## Avaliação de meteoblue com dados oficiais de 18/11/2026
Fontes:
- https://business.meteoblue.com/products/weather-apis/free-weather-api
- https://business.meteoblue.com/ai-instructions
- https://business.meteoblue.com/pricing

**Free Weather API**: 12 meses, **10 milhões de créditos totais** e uso comercial permitido segundo meteoblue; sem obrigação de compra; **não é ilimitada nem renovável**. Até cerca de **2.500 consultas ao longo de todo o ano** usando pacotes mais econômicos, ou cerca de 1.250 com hourly basic. Cada chamada depende do pacote/variante.

**92 municípios**: uma rodada simples cobre 92 pontos e consome ~92 chamadas. Em 2.500 chamadas, cabem somente ~27 rodadas completas no total, e o gasto real pode ser maior se utilizar pacotes de custo maior. Portanto NÃO ativar polling contínuo nem substituir gratuitamente fontes contínuas DWD/NOAA.

**Usos futuros indicados, após confirmação de região/modelo/contrato**:
- comparador **P** de chuva futura, probabilidade/tendência, rajadas, vento, pressão, umidade, UV de céu limpo, nebulosidade;
- NEMS10 (South America) como terceiro modelo físico candidato independente, SOMENTE se a resposta comprovar qual modelo foi fornecido; Learning MultiModel (mLM) é composto e não acrescenta outra fonte independente a cada submodelo que inclui;
- benefícios regionais na Serra Fluminense e testes de previsões com coordenadas e altitude verificada;
- produtos Sea, Air, Nowcast, Warnings, Maps e Measurements requerem verificação de disponibilidade e plano; **não presumir incluídos na gratuidade**, nem que nowcasting de chuva seja pluviômetro observado.
- meteoblue permanece **excluída de temperatura do ar e sensação térmica** por política operacional atual até decisão expressa do proprietário; não preenche automaticamente `rainNowMm`, `rainAccumulatedMm`, `oceanRainMm` ou `riverLevelM`.

**Comercial**: oferta pública Premium Weather API indica **€ 2.400 por ano** como configuração inicial exibida na página, variando por pacote/calls/contrato/suporte. Não é orçamento assinado e não inclui garantia de publicação de dados de terceiros. Após a Free API: créditos pré-pagos ou contrato anual. **Não realizar compra ou cadastro em nome do usuário**.

A meteoblue pertence ao mesmo grupo controlador de Windy.com desde 2024, mas são produtos e serviços separados; **Windy.com permanece excluído** do Blaise como solicitado.

Climatempo ainda sob análise comercial e Meteomatics futura alternativa. Sem novas assinaturas, credenciais ou quotas alteradas. Revisão PR, CI e permissões obrigatórias antes de mesclar ou publicar APK.
