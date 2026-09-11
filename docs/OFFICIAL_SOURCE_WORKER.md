# Worker operacional de fontes oficiais

O runtime do backend do Blaise V6 RJ possui uma integração opt-in do scheduler de fontes oficiais. O worker permanece **desabilitado por padrão** e não faz acesso externo enquanto `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED` não for exatamente `true`.

Quando habilitado, o worker consulta somente adapters oficiais explicitamente configurados. Alerta Rio é a tarefa base; INEA, CEMADEN-RJ, CHM/Marinha, INMET CAP e o inventário cartográfico da Defesa Civil Rio são opcionais e continuam fail-closed. Cada adapter valida o contrato da fonte antes de gravar um snapshot no cache imutável em memória.

O worker reutiliza o scheduler limitado: 15 minutos em modo normal e 1 minuto em modo severo, conjunto estático de tarefas, concorrência limitada e sem sobreposição por fonte. Erros são registrados apenas por código sanitizado. O status operacional nunca inclui valores meteorológicos, texto de avisos, identificadores municipais, geometrias ou payloads de origem; os snapshots completos permanecem somente no cache em memória e são acessíveis apenas pela API interna `readSource()` para futura composição do backend meteorológico.

## Variáveis de ativação

- `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED`: `true` ou `false`; padrão `false`.
- `BLAISE_OFFICIAL_SOURCE_SEVERE`: `true` ou `false`; padrão `false`. Quando `true`, a cadência inicial é de 1 minuto.
- `BLAISE_INEA_STATION_URL`: opcional; deve apontar para uma página numérica oficial no host `alertadecheias.inea.rj.gov.br`.
- `BLAISE_CEMADEN_RJ_ENABLED`: ativa o adapter de risco hidrológico CEMADEN-RJ.
- `BLAISE_CHM_WARNINGS_ENABLED`: ativa o inventário de avisos CHM/Marinha.
- `BLAISE_INMET_WARNINGS_ENABLED`: ativa o feed CAP oficial do INMET e a avaliação contínua, local e não publicadora da política P0.
- `BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED`: ativa o inventário oficial de sirenes/pontos de apoio, sem inferir estado operacional.

Qualquer booleano diferente de `true`/`false` ou URL fora do contrato faz a configuração falhar fechada antes do polling correspondente.

## Avaliação contínua INMET → P0

Quando o INMET está habilitado e um snapshot CAP passa pelo contrato da fonte e pelo cache, o worker executa imediatamente `stageInmetP0Batch()` com o instante da própria atualização. Essa etapa reaplica a política `inmet-cap-to-p0-v1`, o escopo canônico dos 92 municípios e o contrato comum `validateP0Alert`.

O lote completo de candidatos não é retido no status do worker. Depois da avaliação, somente uma projeção sanitizada permanece: estado da avaliação, horário, contagens de candidatos/bloqueados/inelegíveis, SHA-256 do lote e `delivery=STAGED_NOT_PUBLISHED`. Títulos, CAP identifiers, IBGEs, áreas e payloads não são expostos e a retenção do lote candidato é `NONE_AFTER_STATUS_PROJECTION`.

Falha de política/staging **não transforma um snapshot INMET válido em falha de fonte**. O cache da fonte continua `CURRENT`, enquanto `inmetP0Evaluation.status` passa a `BLOCKED_POLICY_OR_STAGING_CONTRACT`. Se a própria leitura/validação INMET falhar, a fonte fica indisponível e a avaliação P0 é marcada separadamente como `BLOCKED_SOURCE_UNAVAILABLE`.

Esta integração não publica automaticamente. `automaticPublication=DISABLED`, `publication=NOT_PERFORMED` e `fcmDelivery=NOT_PROVEN` permanecem explícitos no status. A única publicação real continua no gate manual `INMET P0 Publish Gate`, com live probe, confirmação textual, OIDC/WIF e backend P0 protegido.

## Lifecycle

O worker é criado junto com o runtime HTTP, porém só inicia se a ativação global explícita estiver presente. Em `SIGTERM` ou `SIGINT`, o runtime primeiro impede novas atualizações do worker e depois inicia o draining do servidor HTTP. Uma tarefa já em andamento não é duplicada nem substituída; seus próprios timeouts de transporte continuam limitando a duração.

## Limites de prova

Os testes determinísticos desta camada provam composição, cadência, cache, lifecycle, separação fonte/política, staging sanitizado e comportamento fail-closed. Eles **não provam disponibilidade LIVE das fontes**, não provam publicação FCM nem entrega Android. A promoção de qualquer capacidade para LIVE continua dependendo de execução externa explícita, freshness válida e evidência do mesmo SHA. Em particular, avaliação contínua INMET não equivale a alerta enviado ao usuário.
