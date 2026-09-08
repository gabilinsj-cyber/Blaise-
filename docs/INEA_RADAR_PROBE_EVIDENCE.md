# Evidência por estágio do probe INEA Radar

O probe LIVE do radar do INEA é fail-closed e deve registrar a verdade de cada estágio já concluído, mesmo quando um estágio posterior falha.

## Regra

A proveniência oficial da página de Monitoramento Hidrometeorológico é um gate independente do gateway Radar Tool. Depois que a proveniência foi validada, uma falha posterior de transporte, viewer, descoberta de mídia ou envelope binário **não pode reescrever a proveniência como FAIL**.

O artefato passa a ser construído incrementalmente:

1. `officialProvenance` começa como `NOT_RUN` e muda para `PASS` somente após a validação da página oficial, link canônico e cadência declarada;
2. gateway, viewer, candidatos e binários permanecem `NOT_RUN` até o pipeline correspondente ser executado;
3. uma exceção marca como `FAIL` somente os estágios ainda não comprovados, preservando qualquer estágio já em `PASS`;
4. identidade Guaratiba/Macaé, timestamp, freshness e ingestão continuam `NOT_IMPLEMENTED` até evidência LIVE específica permitir um binding verificável.

URLs públicas brutas e bytes de imagem continuam fora da evidência. O conteúdo binário permanece com retenção `NONE`.

## Evidência operacional que motivou a correção

O probe LIVE explicitamente autorizado no run `34240219998`, SHA `45675d06719b1273b6aac1ac259e90a24d87a6d6`, falhou na primeira execução e no rerun em regiões distintas do runner com `inea_radar_source_timeout` ao tentar o Radar Tool. O artefato anterior propagava esse erro também para estágios anteriores, embora o modelo atual de proveniência seja independente.

Esse resultado não torna o `main` vermelho e não prova indisponibilidade global do INEA; prova apenas que o endpoint Radar Tool não respondeu dentro do limite do probe nessas execuções. A animação INEA permanece bloqueada até que identidade, timestamp e freshness passem com evidência LIVE suficiente.
