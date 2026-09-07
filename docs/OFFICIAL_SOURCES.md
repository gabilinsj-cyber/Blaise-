# Gate de Fontes Oficiais

## Alerta Rio — inventário de estações

O primeiro contrato LIVE verificável de fonte oficial é o inventário público de estações do Sistema Alerta Rio / Fundação Geo-Rio / Prefeitura do Rio. A camada oficial `Estacoes_AlertaRio/FeatureServer/0` declara a localização de **33 estações pluviométricas e meteorológicas ativas** e suporta consulta JSON.

O Blaise consulta apenas o mínimo necessário ao gate de contrato: `cod` e `est`, sem geometria e sem endereço. O adaptador fixa HTTPS e o host `pgeo3.rio.rj.gov.br`, rejeita redirecionamentos, credenciais embutidas, porta não padrão, conteúdo não JSON, respostas excessivas e mudanças inesperadas no catálogo. O resultado válido exige exatamente 33 códigos e nomes únicos e produz SHA-256 determinístico do catálogo sanitizado.

Endpoint de contrato:

`https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geotecnia/Estacoes_AlertaRio/FeatureServer/0`

## Alerta Rio — chuva ao vivo

O segundo contrato conecta a página pública atual de **Dados Pluviométricos** do Sistema Alerta Rio:

`https://websempre.rio.rj.gov.br/estacoes/`

O adaptador usa somente HTTPS e allowlist do host `websempre.rio.rj.gov.br`, rejeita redirects, resposta não HTML, corpo acima do limite e falhas de transporte. O parser é deliberadamente fail-closed: exige os marcadores do contrato, exatamente **33 linhas de estação**, 18 colunas por linha (`N°`, estação, localização, hora e 14 campos pluviométricos), código/nome únicos, timestamp válido e valores numéricos não negativos dentro de limites defensivos.

Os campos normalizados são: 5 min, 10 min, 15 min, 30 min, 1 h, 2 h, 3 h, 4 h, 6 h, 12 h, 24 h, 96 h, acumulado do mês e `TX-15`. O snapshot produz SHA-256 determinístico e preserva o horário oficial de leitura normalizado. Mudança de estrutura, coluna, quantidade de estações ou valor inválido faz o gate falhar; o Blaise não converte erro de fonte em “sem chuva”.

## Execução e evidência

A execução externa permanece **manual-only** em `.github/workflows/official-source-probe.yml`. Por padrão `execute_live_probe=false`, portanto nenhum acesso externo ocorre. Quando explicitamente habilitado, o workflow verifica o inventário e a chuva ao vivo no mesmo ciclo.

A evidência persistida contém somente status, hosts, contagens, digests, horário da checagem e janela de horários observados. Nomes de estação e valores individuais de chuva não são gravados no artefato do gate.

## Limite atual

A implementação de ingestão da chuva ao vivo está presente e coberta por testes determinísticos, mas **não deve ser tratada como prova LIVE até existir uma execução manual bem-sucedida do workflow no mesmo SHA**. Além disso, este contrato ainda não publica dados para o app nem implementa cache/freshness operacional de 15 min/1 min.

Temperatura, vento, radar, estágio operacional, alertas P0 originados de fonte oficial e reconciliação multi-fonte continuam contratos separados. Até serem validados, a UI permanece fail-closed para esses campos.

## Próximos contratos

Cada integração LIVE seguinte deve repetir o mesmo padrão: origem oficial verificada, contrato mínimo, allowlist, limites de transporte, freshness/validade/cobertura, testes determinísticos, evidência sanitizada e execução externa explícita antes de qualquer uso em produção.
