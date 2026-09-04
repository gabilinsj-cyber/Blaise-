# Arquitetura Blaise V6 RJ

O aplicativo usa uma arquitetura em camadas: `core` contém políticas fail-closed, freshness, reconciliação de fontes oficiais e failover; `data` define contratos para clima, alertas, radar, risco, marinha, trânsito, notícias, assinatura, voz e observabilidade; `domain` coordena casos de uso; a UI Compose apenas apresenta estado.

Os adaptadores de produção devem preservar fonte, instante de coleta, validade, cobertura e estado operacional. Fontes oficiais locais vencem fontes secundárias. A ausência de P0 só pode ser afirmada quando todas as fontes oficiais marcadas como obrigatórias tiverem snapshots atuais, operacionais e com cobertura completa. Um P0 atual de qualquer fonte oficial válida é propagado imediatamente mesmo que outra fonte obrigatória esteja indisponível. Snapshot ausente, incompleto, futuro, expirado ou não operacional nunca é convertido em “sem alerta”.

Cache segue stale-while-revalidate; conteúdo expirado nunca é apresentado como atual. P0 oficial ignora entitlement por decisão explícita e testada. Os demais conteúdos exigem assinatura ativa. A camada de reconciliação é independente dos adaptadores HTTP para permitir testes determinísticos e impedir que uma indisponibilidade de integração seja confundida com ausência de risco.

Privacidade: não reter áudio, localização precisa ou histórico de consultas por padrão. Persistir somente seleção de até duas cidades, entitlement opaco, cache necessário e telemetria agregada sem identificadores pessoais.

As integrações LIVE ainda precisam ser conectadas individualmente a contratos públicos/validados. Até isso acontecer, a UI permanece fail-closed e não fabrica estado meteorológico nem ausência de alertas.
