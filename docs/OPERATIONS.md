# Operação, escala e recuperação

## Capacidade planejada

A arquitetura alvo considera aproximadamente 3 milhões de instalações e picos de 9 milhões de consultas. Esses números são metas de dimensionamento, não resultados de carga. A validação real exige ambiente backend, dados representativos e ferramenta de carga autorizada.

- CDN/cache de borda para respostas públicas e snapshots assinados.
- Agregação server-side das fontes; dispositivos não devem multiplicar chamadas às fontes oficiais.
- Jitter, backoff exponencial, circuit breaker e orçamento por fonte.
- Em pico, priorizar P0, alerta, temperatura, chuva, vento e freshness; conteúdo pesado depois.
- RTO de 15 minutos e RPO de 5 minutos para estado agregado; P0 usa distribuição redundante.

## Armazenamento local e cache

O dispositivo mantém estado persistente apenas quando necessário para funcionamento, preferências e segurança. Cache de rede, imagens, radar, notícias e mídia temporária é descartável e não deve crescer sem limite.

- Limite alto combinado do cache interno/externo: 32 MiB.
- Ao ultrapassar o limite, remover os itens mais antigos até 16 MiB.
- Itens de cache com mais de 24 horas são removidos independentemente do tamanho total.
- A limpeza roda em thread de baixa prioridade na inicialização e não cria polling ou serviço periódico, reduzindo impacto de bateria.
- A rotina atua somente em `cacheDir`/`externalCacheDir`; banco, SharedPreferences, seleção de cidades, entitlement, configuração e demais arquivos persistentes ficam fora do alcance.
- Links simbólicos são ignorados e falhas de exclusão são toleradas; o uso final é recalculado do disco.
- Radar deve continuar usando janela móvel de 30 minutos e mídia oficial incorporada não deve ser baixada para armazenamento permanente.

## Canary e rollback

Distribuir por trilhas internas, 1%, 5%, 25%, 50% e 100%. Promover somente com crash-free, ANR, latência, freshness e entrega P0 dentro do SLO. Interromper e reverter na Play Console diante de regressão. Backends usam implantação blue/green e contratos retrocompatíveis N/N-1.
