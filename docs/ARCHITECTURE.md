# Arquitetura Blaise V6 RJ

O aplicativo usa uma arquitetura em camadas: `core` contém políticas fail-closed, freshness e failover; `data` define contratos para clima, alertas, radar, risco, marinha, trânsito, notícias, assinatura, voz e observabilidade; `domain` coordena casos de uso; a UI Compose apenas apresenta estado.

Os adaptadores de produção devem preservar fonte, instante de coleta, validade e estado operacional. Fontes oficiais locais vencem fontes secundárias. Cache segue stale-while-revalidate; conteúdo expirado nunca é apresentado como atual. P0 oficial ignora entitlement por decisão explícita e testada. Os demais conteúdos exigem assinatura ativa.

Privacidade: não reter áudio, localização precisa ou histórico de consultas por padrão. Persistir somente seleção de até duas cidades, entitlement opaco, cache necessário e telemetria agregada sem identificadores pessoais.

