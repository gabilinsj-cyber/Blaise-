# Blaise V6 RJ — Agente 13: supervisor de atualidade por minuto (22/11/2026)

## Decisão solicitada

O Agente 13 deve inspecionar os **dados já coletados e autorizados no backend a cada minuto** para identificar valores novos de cada município do RJ (92 IBGE) e, quando a origem for geograficamente validada, sub-regiões. Exemplo registrado pelo operador: dado HG com medição às **11h51**, publicado pelo fornecedor às **11h55**, lido no Blaise às **12h15** → idade real **24 minutos**. Nunca datar a medição como 12h15 nem mascarar 24 minutos de idade.

**Ação nesta PR #174 (DRAFT):** implementação de **política e executor privados**, não ativação em produção. Nenhuma fonte é consultada a cada minuto e o sistema ainda NÃO tem agendador de coleta nem fonte WeatherAPI instalada/validada no servidor.

## Três relógios obrigatórios

1. `measuredAt`: instante original de medição/validade (quando a fonte o fornece), decisivo para idade, cadência e prioridade.
2. `providerPublishedAt`: instante publicado pelo fornecedor, **se existir de fato no contrato**. Se ausente, exibir "não informado" e jamais inventá-lo a partir do tempo da chamada.
3. `ingestedAt`: instante em que um coletor autorizado recebeu a informação; não prova que houve nova medição.
4. A auditoria adiciona `auditAt`, somente "verificado pelo Blaise"; não muda `measuredAt`.

Nunca reutilizar o relógio da primeira leitura, nem permitir que escrita no Firestore renove artificialmente a validade.

## Código inserido

- `backend/src/rj-agent13-freshness-supervisor.mjs` — inspeção pura de 1 minuto, limite 92 municípios, região validada, data de medição, classe temporal, comparação de múltiplas fontes por campo, bloqueio de regressão e divergência, sem dados meteorológicos fictícios, sem inferir alertas nível 4/5.
- `backend/src/rj-agent13-freshness-worker.mjs` — gate OFF por padrão; exige autorização explícita, trava distribuída `agent13:minute:all92`, leitura do **cache central já preenchido**, leitura de metadados publicados e staging privado. Não faz HTTP de meteorologia, consulta saldo, leitura de segredo, disparo de coleta, assinaturas ou publicação no cliente. Um futuro único Cloud Scheduler deve chamar `tick` uma vez/min, depois de homologação/custo/segurança, **nunca um setInterval por instância**.
- Testes offline: `backend/test/rj-agent13-freshness-supervisor.test.mjs`, `backend/test/rj-agent13-freshness-worker.test.mjs`.

**A política requer comprovantes positivos por fonte:** `licensed`, `collectingAuthorized`, `clientReleaseAuthorized`, `serverVerified`, `verifiedByBackend`, `municipalityMappingVerified`, `originalProviderTimestampVerified`, `qualityPass`, `wasIngestedFromAuthorizedCollector`. Na ausência, bloqueia. Previsão DWD é P (`forecastTemperatureC`), não temperatura atual. Dados regionais sem geometria validada não podem se passar por medição local.

O supervisor pode comparar HG, Visual Crossing e WeatherAPI por campo no futuro. **Visual Crossing continua restrito à comparação privada até licença/QA de distribuição, WeatherAPI ainda sem segredo no Cloud Shell, HG sem contratação; nenhuma dessas fontes foi habilitada pelos testes simulados.** OpenWeather permanece contingência de temperatura e sensação, com somente 1 consulta mundial no projeto por dia UTC. Meteoblue basic-6h fica como previsão P no comparativo privado e não atua como termômetro.

**Política de conflito:** para leituras comparáveis de fontes independentes em intervalos de até 15 minutos, desvio de temperatura acima de 4°C, sensação acima de 6°C, umidade acima de 25 pontos ou condições incompatíveis de céu/"tempestade" → não publicar automaticamente, marcar revisão científica. Mesmo se a temperatura coincidir entre fontes, os horários e a natureza de cada campo permanecem distintos.

## Orçamento e viabilidade da meta de 25–35 minutos

A revisão de cache **a cada 60 segundos não consome franquia meteorológica** porque não chama provedores. Porém, pode gerar operações Firestore/Cloud Scheduler cobradas e, se for implantada, requer cron agendado e trava distribuída.

| Serviço | Limite registrado | Limite prático |
|---|---:|---|
| OpenWeather Free | **1 chamada/dia UTC global** confirmada pelo operador | No máximo uma cidade/consulta naquele dia; NÃO serve para 25–35min contínuos |
| Visual Crossing Free | 1.000 registros/dia | 92 cidades de hora em hora exigiriam 2.208 registros/dia; cidade selecionada depende de reserva/controle |
| WeatherAPI Free | 100.000 requisições/mês | 92 municípios a cada 30 min por 30 dias = **132.480/mês**, excede franquia; 92/hora ≈ 66.240/mês |
| HG Brasil Pro | contrato futuro, dados em até 60 min; referência plano de 20.000 req/dia | 92/hora = 2.208/dia; assinatura ainda inativa |
| DWD ICON | previsão de modelo | Temporalidade de ciclo P, não tem medida de estação a cada 25/35min |
| Climatempo Radar | sem contrato e API | Quando liberado, imagens de precipitação/nowcast independentes; NÃO cria temperatura/sensação |

**Meta operacional:** atualizar **valores elegíveis das duas cidades selecionadas em 25–35 min**, usando novas medições reais de cada fonte e orçamento central compartilhado; o restante pode ter até 60 min, e o estado do céu tem seu próprio horário. Isso é **objetivo, não SLA homologado**. Se o fornecedor não publica medição nova, a UI mostra a idade real ou "Indisponível". Nunca atualizar o carimbo da medição apenas porque a interface consultou o backend.

**Alertas oficiais:** agentes científicos só podem avaliar escala 4 ou 5 quando todas as entradas críticas estiverem efetivamente em tempo real e a ciência for recalculada a cada 20 s. A auditoria de um minuto NÃO satisfaz esse requisito nem emite alerta. Sem evidência real, 3 avisos no topo com frase curta, cor validada e link oficial; sem nível 4/5 deduzido.

## Achado do Cloud Shell às 11h53

`gcloud secrets describe blaise-weatherapi-free-api-key --project=blaise-v6-rj --format='value(name)'` → `NOT_FOUND` (captura enviada). Evidência de que **esse nome de segredo não foi encontrado nesse projeto**, não prova que a conta WeatherAPI não tenha chave válida. Não armazenar valor em Git, APK, screenshot, chat ou comandos com eco. Antes de qualquer primeira consulta real, validar projeto e segredo pelo Console, permissões mínimas do backend, saldo/plano, quadro de cotas Firestore, endpoint `current.json` com `last_updated_epoch` e consentimento da titular. Não realizar consultas reais nem criar segredo até autorização operacional segura.

## Restrições absolutas preservadas

PR #173 e PR #174 continuam DRAFT; não merge, não deploy Cloud Run, não alterar revisão/escala/tráfego 99%/1%, não contratualizar HG nem Climatempo, não mudar chave exposta, não reativar segredo OpenWeather v1, não usar chaves no Android. Coletores do cliente originais e backups preservados. **Sem integração real do worker ao runtime até testes e agendamento aprovados separadamente.**
