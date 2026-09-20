# Production Scale Readiness

Este gate separa três níveis de evidência para impedir que um teste pequeno seja confundido com prova de escala.

1. **CI local**: o backend já executa smoke de concorrência e backpressure em ambiente efêmero.
2. **Probe bounded de produção**: o workflow manual `.github/workflows/scale-readiness.yml` pode executar, somente após aprovação explícita, até 500 requisições **GET** contra `/healthz` e `/readyz`, com concorrência máxima 32. Ele não envia POST/PUT/PATCH/DELETE, não usa corpo de requisição e não mede capacidade de negócio.
3. **Carga 3M/9M**: continua `NOT_RUN` até existir ambiente/plataforma de carga autorizado, orçamento de tráfego, limites definidos, observabilidade real e janela operacional aprovada.

## Política fail-closed

- O workflow é `workflow_dispatch` apenas.
- `execute_probe` inicia em `false`.
- O alvo deve ser uma origem HTTPS sem caminho, query, fragmento, credenciais embutidas ou porta não padrão.
- O probe Node bloqueia mais de 500 requisições, concorrência acima de 32, redirecionamentos e endpoints diferentes de `/healthz` ou `/readyz`.
- O resultado `PASS_BOUNDED_PROBE` significa somente que esse probe limitado passou. Nunca equivale a `SCALE_3M_9M=PASS`.
- Falhas antes do fechamento do gate geram evidência `BLOCKED`.

## Próxima evidência de escala real

Quando o backend produtivo e a observabilidade estiverem implantados, o teste de escala deve usar um ambiente isolado ou capacidade explicitamente reservada, dados sintéticos, ramp-up progressivo, limites de custo, abort thresholds e rollback. A execução deve registrar taxa, p50/p95/p99, erros, 429/503, saturação, CPU/memória, instâncias, fila/backpressure, quotas externas e comportamento de recuperação. P0 e fontes oficiais não devem ser usados como gerador de tráfego de teste.
