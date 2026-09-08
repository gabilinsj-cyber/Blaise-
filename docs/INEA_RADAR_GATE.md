# Gate INEA Radar

## Objetivo

Este gate avança a integração do radar oficial do INEA sem fabricar ingestão de frames. Ele valida apenas o **gateway público Radar Tool** do Sistema de Alerta de Cheias e mantém a ingestão de imagens explicitamente bloqueada até existir contrato verificável de frame, timestamp e freshness.

Endpoint fixado:

`https://alertadecheias.inea.rj.gov.br/radartool.php`

## Contrato

O backend usa HTTPS, host exato `alertadecheias.inea.rj.gov.br`, redirect manual, timeout de 8 segundos e corpo máximo de 1,5 MiB. O parser exige os marcadores de identidade `Sistema de Alerta de Cheias` e `Ferramenta Radar Tool` e exige pelo menos um `iframe` incorporado, limitado defensivamente a no máximo quatro.

O contrato não segue nem persiste o `src` do iframe nesta etapa. A evidência contém somente host, cadência oficial de radar já declarada na descoberta do INEA (5 minutos), presença/contagem de viewers incorporados e SHA-256 determinístico dos metadados sanitizados.

## Execução

`.github/workflows/inea-radar-probe.yml` é **manual-only**. Por padrão `execute_live_probe=false`; nesse modo nenhum acesso externo ocorre e o artefato registra:

- `BLOCKED_EXTERNAL_EXECUTION_NOT_REQUESTED`
- `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`
- `liveRadarFrameIngestion=NOT_IMPLEMENTED`

Quando `execute_live_probe=true`, o workflow usa Node 24.20.0, valida sintaxe e consulta apenas o endpoint público fixado. Nenhuma credencial Google Cloud, service account ou Workload Identity Federation é necessária para esse probe público.

## Limite atual

Um `PASS` do gateway significa apenas que a página oficial esperada respondeu e preservou o contrato estrutural mínimo. **Não significa que frames de radar foram ingeridos, que o timestamp da imagem foi validado, que Guaratiba/Macaé foram distinguidos ou que existe uma janela operacional móvel de 30 minutos.**

A próxima etapa é descobrir e fixar, com evidência LIVE no mesmo SHA, os endpoints oficiais efetivos dos frames ou do viewer, definir allowlist explícita, formato de imagem, timestamp por frame, rejeição de duplicatas/frames futuros, freshness de 5 minutos e retenção somente da janela operacional necessária. Até isso ocorrer, a UI deve permanecer fail-closed para animação de radar INEA.
