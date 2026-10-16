# Scheduler de atualização das fontes oficiais

O backend possui um coordenador determinístico e limitado para a futura execução contínua das fontes oficiais. Ele usa exatamente as mesmas cadências já definidas pela camada de freshness/cache: **15 minutos em modo normal** e **1 minuto em modo severo**.

O contrato do scheduler é `OFFICIAL_SOURCE_BOUNDED_REFRESH_SCHEDULER` e foi desenhado para não criar fila ilimitada nem sobreposição da mesma tarefa. O conjunto de tarefas é estático e limitado, a concorrência total é configurável entre 1 e 8, e uma tarefa em andamento não pode ser iniciada novamente até terminar. Uma falha não gera retry em loop apertado: o próximo ciclo volta a obedecer à cadência operacional vigente.

A troca de `normal` para `severe` puxa para frente qualquer próxima execução que estivesse mais distante que um minuto. A troca inversa não adia uma execução já programada para ocorrer antes do novo limite, evitando perder uma checagem já devida.

O scheduler não retém payloads de fontes, respostas HTTP, valores meteorológicos, localização de usuário ou detalhes livres de exceção. O estado observável registra somente identificador fixo da tarefa, horários, contagem de execuções, resultado `SUCCESS`/`FAILURE` e um código de erro sanitizado. O callback de observabilidade é isolado para que uma falha de telemetria nunca interrompa a atualização meteorológica.

## Integração operacional

Esta camada é um **motor de coordenação**, não uma alegação de execução LIVE. Ela pode ser conectada aos adapters já existentes de Alerta Rio, INEA, INMET, CHM e CEMADEN, ou executada por um worker/serviço dedicado. O processo HTTP principal não inicia consultas externas automaticamente apenas por importar o módulo.

Isso preserva o gate fail-closed atual: nenhuma fonte ganha estado LIVE, nenhum P0 é publicado e nenhum custo externo é disparado apenas porque o scheduler foi adicionado ao código. A ativação em produção continua exigindo configuração explícita, identidade de serviço apropriada, evidência de execução e os gates de infraestrutura correspondentes.

## Garantias testadas

Os testes determinísticos verificam paridade das cadências com o cache oficial, validação de configuração, avanço para 1 minuto no modo severo, limite de concorrência, proibição de sobreposição, contenção/sanitização de falhas e bloqueio de novas execuções após `stop()`.

O próximo fechamento operacional é ligar tarefas concretas a esse motor em um worker de produção com readiness/draining e observabilidade, mantendo os adapters oficiais e seus contratos de freshness como autoridade para decidir se um snapshot pode ou não ser servido ao app.
