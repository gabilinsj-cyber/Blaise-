# Capacidades locais e bloqueios externos

## Voz Android

`AndroidTextToSpeechVoiceService` implementa o contrato `VoiceService` sem reter texto ou áudio. A seleção de idioma é fail-closed: tenta somente português (`pt-BR`, `pt-PT`, `pt`) e retorna falha se o dispositivo não tiver dados de voz compatíveis. O mecanismo Android local é fallback de capacidade; a voz editorial de produção (masculina jovem-adulta e parâmetros definidos pelo produto) depende da integração externa de TTS configurada para produção.

## Saúde de fontes

`SourceHealthMonitor` registra apenas identificador técnico da fonte, instante da checagem, última confirmação bem-sucedida e contagem de falhas consecutivas. `SourceHealthPolicy` nunca transforma ausência de sucesso em estado saudável: sem sucesso comprovado = `UNAVAILABLE`; sucesso vencido = `STALE`; falha após sucesso ainda válido = `DEGRADED`.

## Observabilidade e privacidade

`AggregatingObservability` aceita somente componentes e métricas explicitamente allowlisted e guarda contadores agregados. Mensagens de exceção, payloads, voz, localização precisa, consultas e identificadores pessoais não são persistidos por essa implementação.

## Limite de evidência

Estas capacidades podem ser testadas localmente e no Android Runtime. Elas não provam disponibilidade de fontes LIVE, backend de entitlement, Google Play Console, FCM, assinatura de produção, Google Cloud TTS, infraestrutura/carga 3M–9M ou credenciais externas. Os gates RC/Release permanecem fail-closed até existirem evidências reais desses sistemas.
