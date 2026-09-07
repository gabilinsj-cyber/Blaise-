# Gate de Fontes Oficiais

## Alerta Rio — inventário de estações

O primeiro contrato LIVE verificável de fonte oficial é o inventário público de estações do Sistema Alerta Rio / Fundação Geo-Rio / Prefeitura do Rio. A camada oficial `Estacoes_AlertaRio/FeatureServer/0` declara a localização de **33 estações pluviométricas e meteorológicas ativas** e suporta consulta JSON.

O Blaise consulta apenas o mínimo necessário ao gate de contrato: `cod` e `est`, sem geometria e sem endereço. O adaptador fixa HTTPS e o host `pgeo3.rio.rj.gov.br`, rejeita redirecionamentos, credenciais embutidas, porta não padrão, conteúdo não JSON, respostas excessivas e mudanças inesperadas no catálogo. O resultado válido exige exatamente 33 códigos e nomes únicos e produz SHA-256 determinístico do catálogo sanitizado.

Endpoint de contrato:

`https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geotecnia/Estacoes_AlertaRio/FeatureServer/0`

A execução externa permanece **manual-only** em `.github/workflows/official-source-probe.yml`. Por padrão `execute_live_probe=false`, portanto nenhum acesso externo ocorre. Quando explicitamente habilitado, a evidência contém somente identificador/host da fonte, contagem, digest do catálogo, horário da checagem e status; nomes/endereço/coordenadas não são gravados no artefato.

## Limite atual

Este gate prova somente a estrutura e disponibilidade do **inventário de estações**. Ele **não** prova ingestão de chuva, temperatura, vento, radar ou ausência de alertas. A documentação pública do COR informa que dados de chuva do Alerta Rio podem ser disponibilizados em tempo real em JSON, porém o Blaise não conecta esse fluxo até que o endpoint/contrato público atual seja verificado separadamente.

Consequentemente, `rainfallLiveIngestion` permanece `NOT_IMPLEMENTED` e a UI continua fail-closed. Nenhum resultado deste gate pode ser convertido em “tempo estável”, “sem chuva” ou “sem alerta”.

## Próximos contratos

Cada integração LIVE seguinte deve repetir o mesmo padrão: origem oficial verificada, contrato mínimo, allowlist, limites de transporte, freshness/validade/cobertura, testes determinísticos, evidência sanitizada e execução externa explícita antes de qualquer uso em produção.
