# CEMADEN-RJ — contrato de risco hidrológico municipal

## Origem oficial

O Blaise usa como contrato inicial o painel público do **CEMADEN-RJ / Defesa Civil do Estado do Rio de Janeiro** para o status hidrológico atual dos municípios:

`https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/municipio/?action=hidro`

O endpoint é tratado como fonte oficial pública. O adaptador fixa HTTPS, host exato `painelcemadenrj.defesacivil.rj.gov.br`, porta padrão, rejeita redirects e limita timeout/corpo antes do parsing.

## Cobertura e estrutura

O contrato só recebe `PASS_SOURCE_CONTRACT` quando a página contém os marcadores de **Risco Hidrológico** e **Status atual dos Municípios** e cobre exatamente os **92 municípios canônicos do Estado do Rio de Janeiro** já usados pelo Android/backend do Blaise.

Para cada município o parser normaliza somente:

- município canônico + código IBGE interno já conhecido pelo Blaise;
- REDEC;
- risco atual;
- prioridade;
- data/hora oficial de última atualização.

O histórico/link da página não é ingerido. A página HTML bruta não é retida.

## Validação fail-closed

REDECs permitidas: `CAPITAL`, `METROPOLITANA`, `BAIXADA FLUMINENSE`, `COSTA VERDE`, `BAIXADA LITORÂNEA`, `NORTE`, `NOROESTE`, `SERRANA I`, `SERRANA II`, `SUL I`, `SUL II`.

A prioridade deve corresponder exatamente ao nível publicado:

| Risco | Prioridade |
| --- | ---: |
| MUITO BAIXO | 1 |
| BAIXO | 2 |
| MODERADO | 3 |
| ALTO | 4 |
| MUITO ALTO | 5 |

Município desconhecido, duplicado, cobertura diferente de 92, REDEC desconhecida, nível desconhecido, prioridade divergente, timestamp inválido ou mudança estrutural relevante bloqueiam o contrato. `ND`, ausência de linha ou erro de transporte nunca são convertidos em risco baixo.

A data/hora oficial no formato `DD/MM/YYYY HH:MM:SS` é normalizada para o instante correspondente do Rio de Janeiro no período operacional atual (`UTC-03:00`). O parser valida formato/coerência temporal, mas não declara freshness por si só. A camada operacional separada `cemaden-rj-cache.mjs` exige cobertura completa, digest íntegro, observações sem desvio futuro relevante e idade máxima de **30 minutos**; snapshots vencidos deixam de ser servidos. A cadência de rechecagem é **15 minutos** em modo normal e **1 minuto** em modo severo.

## Evidência

O probe persiste somente evidência sanitizada:

- host;
- contagem/cobertura municipal;
- contagem por nível de risco;
- maior prioridade/nível observado;
- timestamps mínimo/máximo da publicação;
- SHA-256 determinístico do inventário normalizado.

Não persiste HTML bruto nem a tabela completa por município no artefato do gate.

## Execução LIVE

`.github/workflows/cemaden-rj-source-probe.yml` é **manual-only**. O padrão é `execute_live_probe=false`, registrando `NOT_RUN_EXTERNAL_EXECUTION_NOT_REQUESTED`. Somente uma execução manual com `execute_live_probe=true` consulta a página pública e pode produzir `PASS_SOURCE_CONTRACT` no mesmo SHA.

O probe LIVE agora só registra `PASS_SOURCE_CONTRACT_AND_FRESHNESS` quando, no mesmo instante da checagem, o snapshot também entra como `CURRENT` nas leituras operacionais normal e severa do cache. A evidência guarda apenas estados/idades/cadências e nunca o payload municipal. Esse PASS prova freshness naquele instante; não prova continuidade futura, reconciliação multi-fonte, promoção P0, entrega FCM ou exibição no app.

## Próximo fechamento

O fechamento seguinte é a reconciliação determinística com INMET/INEA/Defesa Civil/Alerta Rio conforme o tipo de risco e uma política explícita de promoção para alerta do aplicativo. A freshness/recheck já está implementada e testada, mas só recebe PASS LIVE quando o workflow manual comprova um snapshot `CURRENT` no mesmo SHA. `p0PromotionPolicy=NOT_IMPLEMENTED` permanece fail-closed.
