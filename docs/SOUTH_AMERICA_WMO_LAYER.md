# Camada Meteorológica Sul-Americana / OMM AR-III

## Objetivo

Adicionar contexto meteorológico a montante do Estado do Rio de Janeiro para acompanhar sistemas que se formam ou avançam pelo Cone Sul, Sul/Sudeste do Brasil e Atlântico Sul. Esta camada complementa, mas nunca substitui, as fontes oficiais locais/estaduais do RJ.

## Fontes integradas no contrato operacional

### WMO/WIS 2.0

A camada usa a arquitetura WIS 2.0 como rede internacional de descoberta, notificação, cache e intercâmbio. O WIS2 opera em modelo publish/subscribe sobre MQTT e mantém Global Brokers, Global Caches e Global Discovery Catalogues.

Global Brokers configurados para failover de transporte:

1. INMET/Brasil — `mqtts://everyone:everyone@globalbroker.inmet.gov.br:8883`
2. Météo-France — `mqtts://everyone:everyone@globalbroker.meteo.fr:8883`
3. CMA/China — `mqtts://everyone:everyone@gb.wis.cma.cn:8883`
4. NOAA/NWS — `mqtts://everyone:everyone@wis2broker.globaldata.nws.noaa.gov:8883`

A prioridade acima é de transporte/failover do Blaise e não representa superioridade científica entre os Global Brokers. Uma mesma notificação WIS2 replicada por vários brokers é deduplicada pela identidade de origem, não pelo broker que a transportou.

### SMN Argentina

Centro WIS2: `ar-smn`.

Dataset inicialmente registrado: observações SYNOP horárias de estações terrestres.

- metadata id: `urn:wmo:md:ar-smn:slt0ci`
- broker topic: `cache/a/wis2/ar-smn/data/core/weather/surface-based-observations/synop`
- classe: observação oficial
- papel no Blaise: monitoramento a montante do Cone Sul/AR-III

O portal de modelos do SMN também permanece como fonte editorial/técnica de referência. Um adaptador de produção não deve raspar páginas HTML; só deve consumir endpoint/dataset oficialmente documentado e estável.

### INUMET Uruguai

Centro WIS2: `uy-inumet`.

Observações SYNOP:

- metadata id: `urn:wmo:md:uy-inumet:surface-based-observations.synop`
- origin topic: `origin/a/wis2/uy-inumet/data/core/weather/surface-based-observations/synop`
- broker topic: `cache/a/wis2/uy-inumet/data/core/weather/surface-based-observations/synop`

Alertas CAP:

- metadata id: `urn:wmo:md:uy-inumet:cap-alerts`
- origin topic: `origin/a/wis2/uy-inumet/data/core/weather/advisories-warnings`
- broker topic: `cache/a/wis2/uy-inumet/data/core/weather/advisories-warnings`

Alertas de outro país permanecem alertas oficiais de origem e contexto regional. Eles não são convertidos automaticamente em alerta P0 do RJ.

### ECMWF

Fonte: dados abertos de previsão em tempo real do ECMWF, com foco em IFS para comparação de evolução sinótica e sistemas que possam avançar para Sul/Sudeste/Atlântico.

- raiz: `https://data.ecmwf.int/forecasts`
- classe: orientação numérica
- licença: CC BY 4.0; atribuição obrigatória

### NOAA/NCEP GFS

Fonte: NOMADS/NCEP, GFS 0,25°.

- raiz: `https://nomads.ncep.noaa.gov/`
- classe: orientação numérica
- papel: modelo global complementar e failover científico/comparação com ECMWF

## Procedência obrigatória

Todo registro normalizado da camada deve carregar, no mínimo:

- `sourceId`
- `provider`
- `centreId`
- `canonicalKey`
- `originRecordId`
- `effectiveAtMillis`
- `receivedAtMillis`
- `validUntilMillis` quando existir
- `brokerId` para mensagens WIS2 recebidas via Global Broker
- URL de procedência e digest do payload quando disponíveis

O horário de observação/emissão é diferente do horário de recebimento e deve permanecer separado.

## Frescor e validade

A camada é fail-closed:

- dado no futuro além da tolerância de relógio: `FUTURE`
- validade terminada: `EXPIRED`
- idade acima do limite da fonte: `STALE`
- somente registros `FRESH` entram como candidatos preferenciais

Limites iniciais do contrato:

- SYNOP SMN/INUMET: 120 min
- CAP INUMET: 30 min
- GFS: 540 min
- ECMWF: 900 min

Esses valores são limites de proteção do Blaise, não uma afirmação sobre a frequência garantida de publicação de cada provedor.

## Deduplicação

WIS2 replica notificações por vários Global Brokers. A deduplicação usa `sourceId + originRecordId`; o broker é tratado como transporte. Se a mesma origem chegar por mais de um broker, apenas uma cópia é mantida.

Depois da deduplicação, registros de fontes diferentes podem compartilhar a mesma `canonicalKey`. O Blaise preserva os alternativos e escolhe um preferencial apenas para failover/consumo simplificado, usando prioridade de fonte e recência. GFS e ECMWF continuam disponíveis simultaneamente para comparação de cenários.

## Regra local primeiro

Esta camada é `upstream_context_and_cross_border_guidance`.

Ela nunca pode:

- substituir alerta oficial do COR.Rio, Defesa Civil, Alerta Rio ou outra autoridade competente do RJ;
- substituir observação oficial local do RJ quando a política local-first se aplica;
- transformar saída de GFS/ECMWF em P0 por si só;
- declarar “sem alerta” quando fonte oficial requerida estiver indisponível ou stale.

Ela pode:

- elevar atenção interna e frequência de checagem;
- enriquecer a análise do Blaise sobre frentes, cavados, ciclones, jatos, transporte de umidade e sistemas do Atlântico Sul;
- apoiar comparação de trajetória/tendência antes de o sistema alcançar o Sudeste;
- alimentar contexto regional para boletins e Q&A com procedência explícita.

## Estado de integração

O núcleo de política, procedência, frescor, deduplicação e failover está implementado em `backend/src/south-america-meteorology.mjs` e coberto por testes unitários. A ativação de ingestão contínua de MQTT/GRIB/BUFR deve ocorrer somente com adaptadores de produção validados, limites de rede, observabilidade, retry bounded, backpressure e evidência de runtime. Até essa etapa, não marcar ingestão WIS2/GFS/ECMWF como live.
