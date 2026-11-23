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


## INMET — desempate apenas em conflito entre fontes do Blaise (22/11/2026)

**Determinação do operador:** INMET deve ser consultado no **painel público oficial** **somente quando** duas fontes meteorológicas já autorizadas do Blaise divergirem significativamente. A referência INMET serve **exclusivamente para desempate interno**: a informação publicada aos clientes, se um release posterior for autorizado, pertence **somente à fonte do Blaise mais próxima do valor observado no INMET**, com o horário e o nome original dessa fonte; nunca exibir no cliente ou registrar no payload público o valor, a estação, o texto ou a origem INMET.

**Referência pública oficial para revisão autorizada**: https://mapas.inmet.gov.br/ ; o INMET informa que estações automáticas disponibilizam observações aproximadamente de hora em hora, não de minuto em minuto. Na fase atual **não existe coletor INMET automatizado nem consulta ao painel a cada minuto**; revisão é humana/autorizada e o backend aceita apenas um comprovante interno já auditado. Sem interface documental própria/legalmente autorizada, não raspar painel, copiar resultados para o cliente nem criar chave/endpoint apócrifo.

**Regras implementadas em modo privado/sem deploy:**
- Primeiro confirmar conflito real de **duas fontes Blaise distintas, da mesma variável e categoria** com timestamps de medição separados em até 15 minutos. Confirmação atual: diferenças de temperatura acima de 4°C ou de umidade acima de 25 pontos percentuais. Conflitos em sensação térmica, céu ou previsão P **não podem** ser comparados automaticamente com termômetro/higrômetro observado do INMET; continuam retidos para revisão adequada.
- Só então buscar a evidência previamente revisada do painel **no cache interno autorizado**. Exigir ID de estação oficial, local realmente representativo do município/região, distância até 30 km **mais checagem humana de altitude/relevo e exposição**, mesmo parâmetro e unidade, horário original da leitura, revisão atual (≤15 minutos) e leitura INMET ainda válida (≤90 minutos, produto horário). Leituras das fontes Blaise devem ter horários a até 45 minutos da referência, e ambas devem continuar dentro da janela própria.
- Escolher a **fonte Blaise com a menor diferença absoluta** em relação à medição INMET. Se todas as fontes estiverem muito distantes da referência (temperatura: mais de 5°C; umidade: mais de 20 pontos), se houver empate prático (temperatura: diferença entre distâncias <0,25°C; umidade: <2 pontos), se o painel estiver indisponível, se a estação não representar a região ou se não houver autorização/revisão: **manter conflito bloqueado**, sem inventar ou substituir.
- O resultado de desempate só propõe/encaminha à fila **privada** a leitura da fonte Blaise escolhida, com seu valor e hora original. O resultado **nunca contém** o valor/ID/horário da referência INMET, nem autoriza publicação automática. A implantação para os clientes exige homologação separada do sistema de distribuição e seus contratos.
- As fontes nacionais INMET e CEMADEN continuam apenas para comparação/auditoria nos casos autorizados. O INMET não é novo provedor de dados publicados do app. Alertas e escala 4/5 continuam separados, sujeitos a evidências em tempo real/autoridades competentes; esse desempate não autoriza nível de alerta nem recalcula a cada 20 segundos.

**Arquivos:** `backend/src/rj-agent13-inmet-private-tiebreak.mjs` (desempate puro, sem rede), `backend/src/rj-agent13-freshness-supervisor.mjs` (chama desempate só quando conflito), `backend/src/rj-agent13-freshness-worker.mjs` (lê revisão privada, se disponível, só depois de detectar conflito); testes isolados correspondentes.

**Estado hoje:** política implementada apenas na PR #174 em draft. Ainda faltam interface administrativa para registrar revisão humana, evidência de estação por região, agendamento seguro do supervisor, conectores reais homologados, teste operacional e gate de publicação. Não existe coleta automatizada INMET, nenhum valor de estação foi obtido nesta implementação, nenhum provedor meteorológico foi chamado e o tráfego de clientes foi preservado.


## Ponte privada auditável de revisão INMET — 22/11/2026

**Estado:** implementado exclusivamente em código da PR #174, sem Cloud Run/Firestore implantado, sem IAM ou chaves alteradas, sem publicação e sem chamada a nenhuma fonte meteorológica. As estações e medições usadas nos testes são **sintéticas**.

Novo adaptador `backend/src/rj-agent13-inmet-private-review-store.mjs`:

- Usa Firestore **somente quando receber** um `db` de conta de serviço e verificadores externos e autenticados `authorizeReviewer` / `authorizeWorker`; ambos os modos de leitura/gravação são **OFF por padrão**. O código não confia em `role=admin` ou booleans fornecidos pelo Android/HTTP.
- Um revisor humano autorizado confere a leitura no **Mapa de Estações do INMET** (`https://mapas.inmet.gov.br/`): estação, variável, unidade, marca temporal UTC, distância, relevo/altitude e qualidade. Ao registrar uma revisão, valida o conflito atual e a compatibilidade da referência com ambos os provedores Blaise, rejeitando discrepâncias irredutíveis.
- Revisão armazenada apenas na coleção privada `blaise_rj_agent13_inmet_private_reviews`, com ID hash do conflito, horário de vencimento e texto/valores restritos ao backend. A operação cria atomicamente um recibo sem leitura bruta em `blaise_rj_agent13_inmet_review_audit`, identificado por digest e revisor ofuscado. **Não há API pública de leitura, nem acesso pelo Android.**
- Revisão vinculada por SHA-256 (`fingerprintRjInmetDispute`) **ao conjunto exato de fontes, valores e horários**. Qualquer mudança nos valores/horário das fontes exige **nova verificação humana**; decisão antiga não pode se reaplicar por engano.
- Registro só aceita revisão ainda recente (até 2 min desde a afirmação do revisor), respeita prazo máximo de 15 min de revisão e janela observacional do produto horário; vencido = sem desempate. Não recriar observação recente a partir do horário de recepção.
- `createWorkerReader({actorContext})` requer autenticação **por consulta**, entrega internamente a evidência somente para as chaves de conflitos existentes, e alimenta o callback `readPrivateInmetConflictReviews` que o Agente 13 **já consulta apenas quando há divergência**. O valor/identificador da estação INMET nunca entra em `proposedUpdates`, na projeção do dashboard nem no alerta.
- A trilha de auditoria é um recibo por revisão. Ainda requer política de retenção/limpeza, orçamento Firestore, controles IAM e auditoria de permissões antes de ativação. A autenticidade dos revisores depende dos verificadores **externos** injetados; autenticação real de sessão e interface interna de submissão **não estão conectadas nesta PR**.
- INMET publica dados horários de estações automáticas; segundo o próprio INMET os dados de estação podem ser **brutos e não submetidos a controle de consistência**. Por isso a referência é auxílio para comparação, não "verdade absoluta", nem representa automaticamente um bairro a 30 km. Conferir referência e contexto geográfico antes de decidir.

**Testes adicionados:** `backend/test/rj-agent13-inmet-private-review-store.test.mjs`, além de cobertura de fingerprint nos testes de desempate/worker. Cenários: revisor não autenticado; evidência privada com recibo; negação de consulta pública; revisão vencida; tentativa de reutilização com outros valores; escolha de fonte Blaise quando revisão válida; zero acesso INMET automatizado e zero dados INMET em proposta de cliente.

**Condições para uma ativação separada e segura (NÃO autorizada agora):** revisão de IAM da conta de serviço, identidade do revisor emitida/verificada pelo backend, UI administrativa interna, regras de Firestore e retenção limitada, mapeamento de estações próximas aos 92 municípios, auditoria de QA/horários, integração do worker com cache/trava central sob relógio confiável, controle de custos e aprovação do canário sem tráfego. Até então, revisão offline = documentação, não demonstra atendimento ao público.
