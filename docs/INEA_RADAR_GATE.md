# Gate INEA Radar

## Objetivo

Este gate avança a integração do radar oficial do INEA sem fabricar ingestão de frames. Ele valida a **proveniência oficial** a partir da página pública de Monitoramento Hidrometeorológico do INEA, confirma o link público canônico do radar e a cadência declarada de cinco minutos, valida o **gateway público Radar Tool**, resolve o `iframe` oficial incorporado, descobre candidatos de mídia sob o domínio oficial do INEA e, em execução LIVE explícita, valida de forma limitada o envelope binário desses candidatos.

Páginas/entradas fixadas:

- `https://www.inea.rj.gov.br/ar-agua-e-solo/monitoramento-hidrometeorologico/`
- `https://alertadecheias.inea.rj.gov.br/radar.php`
- `https://alertadecheias.inea.rj.gov.br/radartool.php`

## Contrato de proveniência oficial

O backend exige que a página oficial de Monitoramento Hidrometeorológico permaneça em HTTPS sob `inea.rj.gov.br`, preserve os marcadores `Monitoramento Hidrometeorológico` e `rede de radares meteorológicos`, declare explicitamente `a cada cinco minutos` e exponha o link público canônico `https://alertadecheias.inea.rj.gov.br/radar.php`.

Links HTTP, externos, com credenciais, porta não padrão, host spoofado ou caminho diferente do radar canônico não satisfazem o contrato. A evidência não persiste a URL pública bruta: registra apenas host, cadência, SHA-256 da URL canônica e SHA-256 do contrato sanitizado.

Este contrato prova apenas que a página oficial do INEA continua apontando para o produto radar e declarando a cadência de cinco minutos. Ele **não** transforma nenhum arquivo em frame meteorológico, não prova identidade Guaratiba/Macaé e não prova timestamp/freshness de um frame individual.

## Contrato do gateway/viewer

O backend usa HTTPS, redirect manual, timeout de 8 segundos e corpo textual máximo de 1,5 MiB. O gateway exige os marcadores `Sistema de Alerta de Cheias` e `Ferramenta Radar Tool`, aceita no máximo quatro `iframe`s e resolve exatamente um viewer HTTPS sob `inea.rj.gov.br` ou subdomínio oficial.

O viewer resolvido é consultado somente no probe LIVE. O parser de descoberta aceita apenas elementos `img`/`source`, atributos `src`, `data-src` ou `data-url`, extensões `png`, `jpg`, `jpeg`, `gif` ou `webp`, HTTPS, porta padrão, sem credenciais e host sob o domínio oficial do INEA. O conjunto é limitado a 64 candidatos e deduplicado.

A etapa binária é ainda mais restrita: um probe só prossegue quando o conjunto deduplicado contém no máximo 8 candidatos. Cada candidato é buscado sequencialmente, sem redirects, com timeout de 8 segundos e limite de 2 MiB. O `Content-Type` precisa ser um tipo de imagem permitido e precisa coincidir com a assinatura/framing binária reconhecida de PNG, JPEG, GIF ou WebP. HTML disfarçado de imagem, MIME incompatível, corpo vazio/truncado, redirect e tamanho acima do limite falham fechado.

A validação binária é de **envelope/framing**, não é um decodificador meteorológico da imagem. Ela não transforma um candidato em “frame de radar” por si só.

Nenhuma URL bruta do viewer ou dos candidatos e nenhum byte de imagem são persistidos em evidência. A evidência contém apenas host, contagens, tipos de imagem, tamanho total validado, contagem de conteúdo duplicado e SHA-256 determinísticos dos metadados sanitizados. O conteúdo binário tem retenção `NONE` após a validação em memória.

## Execução

`.github/workflows/inea-radar-probe.yml` é **manual-only**. Por padrão `execute_live_probe=false`; nesse modo nenhum acesso externo ocorre e o artefato registra:

- `BLOCKED_EXTERNAL_EXECUTION_NOT_REQUESTED`
- `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`
- `officialProvenance=NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`
- `frameBinaryValidation=NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`
- `radarIdentityValidation=NOT_IMPLEMENTED`
- `frameTimestampValidation=NOT_IMPLEMENTED`
- `frameFreshnessValidation=NOT_IMPLEMENTED`
- `liveRadarFrameIngestion=NOT_IMPLEMENTED`

Quando `execute_live_probe=true`, o workflow usa Node 24.20.0, valida sintaxe, consulta primeiro a página pública oficial de Monitoramento Hidrometeorológico, depois o gateway público fixado, o viewer oficial resolvido e, somente dentro dos limites defensivos, os candidatos binários oficiais. Nenhuma credencial Google Cloud, service account ou Workload Identity Federation é necessária para esse probe público.

## O que um PASS significa

Um PASS LIVE deste gate significa que:

1. a página oficial do INEA preservou a proveniência do produto radar, o link canônico e a cadência declarada de cinco minutos;
2. o gateway oficial preservou o contrato de identidade;
3. um único viewer HTTPS oficial foi resolvido;
4. o HTML do viewer expôs pelo menos um candidato de mídia de imagem sob domínio oficial do INEA; e
5. todos os candidatos do conjunto aceito pelo limite binário passaram por transporte bounded, MIME permitido e assinatura/framing compatível com PNG/JPEG/GIF/WebP.

Isso **ainda não prova** que os candidatos são frames meteorológicos operacionais, que pertencem a Guaratiba ou Macaé, que o timestamp corresponde ao instante da varredura, que a imagem está dentro da cadência de 5 minutos, que conteúdo binário repetido representa duplicata temporal, nem que existe uma janela móvel real de 30 minutos.

Os nomes `guaratiba-...` e `macae-...` usados nos testes unitários são fixtures sintéticos e não devem ser tratados como prova do padrão de nomes do sistema real do INEA.

## Próximo fechamento

A etapa seguinte depende de evidência LIVE dos candidatos reais no mesmo SHA. A partir dela, o parser deve identificar de forma verificável radar/estação e timestamp por frame, rejeitar frames futuros e duplicatas temporais, aplicar freshness compatível com a cadência oficial de 5 minutos e manter somente a janela operacional necessária de 30 minutos. Até esses gates passarem com evidência LIVE, a UI deve permanecer fail-closed para animação de radar INEA.
