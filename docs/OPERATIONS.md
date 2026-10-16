# Operação, escala e recuperação

## Capacidade planejada

A arquitetura alvo considera aproximadamente 3 milhões de instalações e picos de 9 milhões de consultas. Esses números são metas de dimensionamento, não resultados de carga. A validação real exige ambiente backend, dados representativos e ferramenta de carga autorizada.

- CDN/cache de borda para respostas públicas e snapshots assinados.
- Agregação server-side das fontes; dispositivos não devem multiplicar chamadas às fontes oficiais.
- Jitter, backoff exponencial, circuit breaker e orçamento por fonte.
- Em pico, priorizar P0, alerta, temperatura, chuva, vento e freshness; conteúdo pesado depois.
- RTO de 15 minutos e RPO de 5 minutos para estado agregado; P0 usa distribuição redundante.

## Canary e rollback

Distribuir por trilhas internas, 1%, 5%, 25%, 50% e 100%. Promover somente com crash-free, ANR, latência, freshness e entrega P0 dentro do SLO. Interromper e reverter na Play Console diante de regressão. Backends usam implantação blue/green e contratos retrocompatíveis N/N-1.

