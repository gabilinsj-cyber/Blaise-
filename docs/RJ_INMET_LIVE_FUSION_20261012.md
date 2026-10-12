# Blaise V6 RJ — integração direta INMET para calculadora de fontes

**Estado (2026-10-12):** implementação do adaptador e testes automatizados. Não significa ativação em produção, homologação de licença ou cobertura de 92 estações. PR separada da interface já integrada e aprovada.

## O que realmente foi implementado

O módulo `backend/src/rj-inmet-live-hierarchy-adapter.mjs` usa a consulta HTTPS oficial:
- Catálogo de estações automáticas **INMET** `https://apitempo.inmet.gov.br/estacoes/T`;
- Observações **da estação concreta** `https://apitempo.inmet.gov.br/estacao/<dia-UTC-inicial>/<dia-UTC-final>/<codigo-da-estacao>`.
- A estação precisa ter `SG_ESTADO=RJ`, `SG_ENTIDADE=INMET`, `CD_SITUACAO=Operante`, nome municipal idêntico ao nome canônico do município IBGE do catálogo RJ, código automático `A###` ou `B###` válido e coordenadas plausíveis no RJ.
- Temperatura (`TEM_INS`, °C), umidade (`UMD_INS`, %), vento médio (`VEN_VEL`, m/s convertido a km/h), rajada (`VEN_RAJ`, m/s convertido a km/h), chuva acumulada em 1h (`CHUVA`, mm).
- A leitura precisa ser atual (até 2h), com horário em UTC compatível, valor dentro da faixa física, unidade preservada e URL institucional. Só produz `origin='OFFICIAL_OBSERVATION'` e `sourceId='INMET_STATION'` quando a medição passou no filtro.
- A rede nunca é interpretada como uma medição municipal média. Se não houver estação nomeada da cidade selecionada, **não utilizar estação vizinha como se fosse a cidade**. Todas as 92 cidades são selecionáveis; não se presume que haja 92 estações INMET.
- HTTPS estrito e host permitido `apitempo.inmet.gov.br`, redirecionamentos rejeitados, limites de download, validação estrutural, relógio, e cache curto em memória; não repassar mensagens de erro brutas, dados pessoais ou credenciais.

## Ligação com a calculadora

`createRjInmetLiveAdapters({enabled:true, usageApproved:true, fetchImpl})` devolve a função `INMET_STATION`, utilizável em `consultRjSourcesUntilTwo({ibge,variable,adapters})` ou `reconcileRjWeatherCase`.

**Ligação operacional ao coordenador dos agentes:** `createRjWeatherSourceExecutor({inmetLive,sourceAdapters,clock})` em `backend/src/rj-agent-orchestration.mjs` instancia o conector INMET uma vez, preserva o cache e o combina com os outros adaptadores de fontes independentes. Retorna uma função de consulta sob demanda `({ibge,variable,level})`, com a ordem de prioridade, medição ponderada e apresentação de proveniência mantidas. A função **não está registrada como serviço público no Cloud Run**, não agenda coleta e não emite alertas.

A ordem para fenômenos municipais continua:
**Alerta Rio (somente município Rio) → Defesa Civil competente → INMET (agora tem adaptador real preparado) → INPE/CPTEC (previsão comparativa) → Windy (previsão subsidiária)**.

A dupla oficial só gera média ponderada entre medições independentes, comparáveis no local, unidade, intervalo e horário. O modelo INPE/Windy nunca é apresentado como medição de estação. Avisos oficiais, sismos, ondas, ressaca, tsunami e risco geológico seguem seus canais especializados. **INEA excluído**.

## Não autorizar publicação automaticamente

O adaptador **vem desligado** e precisa de **dois controles verdadeiros, separados** (`enabled` e `usageApproved`). Isso não é prova por si só de direito comercial sobre um produto; o responsável deverá registrar a confirmação específica das condições de uso do INMET para o aplicativo e, em seguida, executar a homologação com respostas reais da API. A PR não altera variáveis do Cloud Run nem publica dados a assinantes.

**Não confundir CI verde com coleta viva:** os testes usam respostas JSON de teste no formato INMET para validar o código e sua segurança. A leitura real de produção, permissão/licença, latência, disponibilidade, cobertura de cada município e continuidade ainda exigem evidências externas de execução autenticada. Nenhum APK deve ser baixado para essa etapa.

## Testes incluídos

`backend/test/rj-inmet-live-hierarchy-adapter.test.mjs`: confirma gates (sem chamadas se bloqueado), estação real por município, conversões físicas, chuva horária, recusa de cidades de outro estado, timestamps vencidos/futuros, falhas de rede/HTTP e integração com duas fontes independentes no resolvedor. Fonte Defesa Civil do teste é **fixture declarada**, não conexão real.
