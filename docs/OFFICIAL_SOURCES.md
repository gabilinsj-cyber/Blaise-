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

Os campos normalizados são: 5 min, 10 min, 15 min, 30 min, 1 h, 2 h, 3 h, 4 h, 6 h, 12 h, 24 h, 96 h, acumulado do mês e `TX-15`. O valor oficial `ND` significa dado não disponível e é preservado como `null`; ele nunca é convertido em zero. A evidência registra apenas a contagem total desses valores ausentes, sem expor a série por estação. Qualquer outro marcador textual desconhecido continua falhando fechado.

O snapshot produz SHA-256 determinístico e preserva o horário oficial de leitura normalizado. Mudança de estrutura, coluna, quantidade de estações ou valor inválido faz o gate falhar; o Blaise não converte erro, atraso ou dado ausente em “sem chuva”.

## Cache e freshness operacional

O backend possui uma camada de cache operacional **somente em memória**, limitada a um snapshot imutável do contrato de chuva do Alerta Rio. O snapshot aceito continua exigindo 33 estações, digest SHA-256 válido, janela temporal coerente e payload limitado a 256 KiB. Nenhum snapshot de chuva é persistido em disco por essa camada.

Um snapshot só é `CURRENT` quando tanto a idade do fetch quanto a observação mais antiga entre as 33 estações permanecem dentro da janela operacional de **15 minutos**. Observações ou fetches com desvio futuro superior a 2 minutos são rejeitados. Quando a janela expira, o estado passa para `STALE` e o cache deixa de fornecer o payload, preservando o comportamento fail-closed.

A cadência de **rechecagem** é separada da validade do dado: em modo normal, nova consulta fica devida em 15 minutos; em modo severo, em 1 minuto. O modo severo não exige que a fonte oficial publique dados a cada minuto — ele apenas aumenta a frequência de rechecagem. Se uma nova tentativa falhar enquanto o snapshot anterior ainda está dentro dos 15 minutos, o estado vira `CURRENT_DEGRADED`; após expirar, nenhum dado é servido como atual.

## Execução e evidência

A execução externa permanece **manual-only** em `.github/workflows/official-source-probe.yml`. Por padrão `execute_live_probe=false`, portanto nenhum acesso externo ocorre. Quando explicitamente habilitado, o workflow verifica o inventário e a chuva ao vivo no mesmo ciclo e também aplica o gate de freshness operacional ao snapshot recebido.

A evidência persistida contém somente status, hosts, contagens, digests, horário da checagem, contagem de valores ausentes, janela de horários observados e resumo do estado de freshness/cadência. Nomes de estação e valores individuais de chuva não são gravados no artefato do gate.

## Limite atual

A implementação de ingestão da chuva ao vivo e o cache/freshness operacional estão presentes e cobertos por testes determinísticos, mas **não devem ser tratados como prova LIVE até existir uma execução manual bem-sucedida do workflow no mesmo SHA**. Ainda não existe um scheduler de longa duração publicando automaticamente esses snapshots para o app; a camada atual apenas torna explícitos validade, cadência, degradação e expiração sem fabricar disponibilidade.

Temperatura, vento, radar, estágio operacional, alertas P0 originados de fonte oficial e reconciliação multi-fonte continuam contratos separados. Até serem validados, a UI permanece fail-closed para esses campos.

## Próximos contratos

Cada integração LIVE seguinte deve repetir o mesmo padrão: origem oficial verificada, contrato mínimo, allowlist, limites de transporte, freshness/validade/cobertura, testes determinísticos, evidência sanitizada e execução externa explícita antes de qualquer uso em produção.
