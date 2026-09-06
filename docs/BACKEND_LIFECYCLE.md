# Backend lifecycle — Blaise V6 RJ

O runtime de produção do backend usa `backend/src/runtime.mjs` como entrypoint. Ele mantém a lógica de negócio em `server.mjs`, mas adiciona comportamento explícito de draining para rollout, rollback e encerramento do container.

## Readiness e liveness

- `/healthz` continua respondendo durante draining enquanto o processo ainda está vivo.
- `/readyz` responde `200 {"status":"ready"}` em operação normal.
- Ao iniciar draining, `/readyz` passa a responder `503 {"status":"draining"}`.
- Novas requisições de trabalho durante draining recebem `503`, `Retry-After: 1` e `{"error":"service_draining"}`.
- Requisições que já estavam em andamento não são canceladas pelo wrapper de draining.

## SIGTERM/SIGINT

Ao receber `SIGTERM` ou `SIGINT`, o runtime:

1. marca a instância como não pronta;
2. para de aceitar novo trabalho;
3. solicita fechamento do servidor e encerra conexões ociosas;
4. aguarda as requisições em andamento por até 8 segundos;
5. se o limite expirar, força o fechamento das conexões restantes e marca o encerramento como não gracioso.

O gatilho é idempotente: sinais repetidos não iniciam múltiplos ciclos de shutdown.

## Evidência

`backend/test/runtime.test.mjs` prova que o estado de readiness muda para draining, liveness permanece acessível, trabalho novo é rejeitado com retry explícito e o shutdown gracioso é idempotente. O CI também constrói e executa o container de produção, portanto o entrypoint real do Docker é exercitado no smoke do backend.

Isso melhora a segurança de rollout e rollback, mas não equivale a failover multi-região real. Canary, balanceamento, failover e rollback em infraestrutura continuam dependentes do ambiente de produção autorizado e permanecem `NOT_RUN/BLOCKED_EXTERNAL` até execução com evidência.
