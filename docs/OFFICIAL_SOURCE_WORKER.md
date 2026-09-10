# Worker operacional de fontes oficiais

O runtime do backend do Blaise V6 RJ possui uma integração opt-in do scheduler de fontes oficiais. O worker permanece **desabilitado por padrão** e não faz acesso externo enquanto `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED` não for exatamente `true`.

Quando habilitado, a primeira tarefa concreta consulta a chuva ao vivo do Alerta Rio por meio do adapter oficial existente, valida o contrato completo de 33 estações e só então grava o snapshot no cache imutável em memória. Uma estação hidrometeorológica do INEA pode ser acrescentada somente por uma URL oficial explícita no formato `https://alertadecheias.inea.rj.gov.br/alertadecheias/<ID>.html`; a URL é validada antes da ativação da tarefa.

O worker reutiliza o mesmo scheduler limitado: 15 minutos em modo normal e 1 minuto em modo severo, conjunto estático de tarefas, concorrência limitada e sem sobreposição por fonte. Erros são registrados apenas por código sanitizado. O status operacional nunca inclui os valores meteorológicos ou o payload de estação; os snapshots completos permanecem somente no cache em memória e são acessíveis apenas pela API interna `readSource()` para futura composição do backend meteorológico.

## Variáveis de ativação

- `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED`: `true` ou `false`; padrão `false`.
- `BLAISE_OFFICIAL_SOURCE_SEVERE`: `true` ou `false`; padrão `false`. Quando `true`, a cadência inicial é de 1 minuto.
- `BLAISE_INEA_STATION_URL`: opcional. Se presente, deve apontar exatamente para uma página numérica oficial de estação no host `alertadecheias.inea.rj.gov.br`.

Qualquer valor booleano diferente de `true`/`false` ou URL de estação fora do contrato faz a configuração falhar fechada antes de iniciar polling.

## Lifecycle

O worker é criado junto com o runtime HTTP, porém só inicia se a ativação explícita estiver presente. Em `SIGTERM` ou `SIGINT`, o runtime primeiro impede novas atualizações do worker e depois inicia o draining do servidor HTTP. Uma tarefa de fonte que já esteja em andamento não é duplicada nem substituída; seus próprios timeouts de transporte continuam limitando a duração.

## Limites de prova

A integração desta camada prova composição, cadência, cache, lifecycle e comportamento fail-closed em testes determinísticos. Ela **não prova disponibilidade LIVE de Alerta Rio/INEA**, não publica P0 e não torna os snapshots automaticamente visíveis ao aplicativo. A promoção de uma fonte para LIVE continua dependendo de execução externa explícita, freshness válida e evidência do mesmo SHA.
