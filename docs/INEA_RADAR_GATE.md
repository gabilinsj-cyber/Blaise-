# Gate INEA Radar

## Objetivo

Este gate avança a integração do radar oficial do INEA sem fabricar ingestão de frames. Ele valida o **gateway público Radar Tool**, resolve o `iframe` oficial incorporado e, em execução LIVE explícita, consulta o viewer resolvido para descobrir candidatos de mídia de radar sob o domínio oficial do INEA.

Endpoint raiz fixado:

`https://alertadecheias.inea.rj.gov.br/radartool.php`

## Contrato atual

O backend usa HTTPS, redirect manual, timeout de 8 segundos e corpo máximo de 1,5 MiB. O gateway exige os marcadores `Sistema de Alerta de Cheias` e `Ferramenta Radar Tool`, aceita no máximo quatro `iframe`s e resolve exatamente um viewer HTTPS sob `inea.rj.gov.br` ou subdomínio oficial.

O viewer resolvido é consultado somente no probe LIVE. O parser de descoberta aceita apenas elementos `img`/`source`, atributos `src`, `data-src` ou `data-url`, extensões `png`, `jpg`, `jpeg`, `gif` ou `webp`, HTTPS, porta padrão, sem credenciais e host sob o domínio oficial do INEA. O conjunto é limitado a 64 candidatos e deduplicado.

Nenhuma URL bruta do viewer ou dos candidatos é escrita em evidência. A evidência contém apenas host, contagem e SHA-256 determinísticos dos metadados sanitizados.

## Execução

`.github/workflows/inea-radar-probe.yml` é **manual-only**. Por padrão `execute_live_probe=false`; nesse modo nenhum acesso externo ocorre e o artefato registra:

- `BLOCKED_EXTERNAL_EXECUTION_NOT_REQUESTED`
- `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`
- `frameTimestampValidation=NOT_IMPLEMENTED`
- `frameFreshnessValidation=NOT_IMPLEMENTED`
- `liveRadarFrameIngestion=NOT_IMPLEMENTED`

Quando `execute_live_probe=true`, o workflow usa Node 24.20.0, valida sintaxe, consulta o gateway público fixado e depois apenas o viewer oficial que o próprio gateway resolveu. Nenhuma credencial Google Cloud, service account ou Workload Identity Federation é necessária para esse probe público.

## O que um PASS significa

Um PASS LIVE deste gate significa que:

1. o gateway oficial preservou o contrato de identidade;
2. um único viewer HTTPS oficial foi resolvido; e
3. o HTML do viewer expôs pelo menos um candidato de mídia de imagem também hospedado sob o domínio oficial do INEA.

Isso **ainda não prova** que cada candidato é um frame meteorológico operacional, que o timestamp corresponde ao instante da varredura, que a imagem está dentro da cadência de 5 minutos, que Guaratiba e Macaé foram distinguidos, nem que existe uma janela móvel real de 30 minutos.

## Próximo fechamento

A etapa seguinte é validar o conteúdo binário dos candidatos, identificar radar/estação, extrair timestamp verificável por frame, rejeitar duplicatas/frames futuros, aplicar freshness compatível com a cadência oficial de 5 minutos e manter somente a janela operacional necessária de 30 minutos. Até esses gates passarem com evidência LIVE no mesmo SHA, a UI deve permanecer fail-closed para animação de radar INEA.
