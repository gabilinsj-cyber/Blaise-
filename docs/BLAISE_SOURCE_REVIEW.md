# Checagem de fontes e integração do Vector RJ

Implementado nesta revisão: dados numéricos inválidos/vencidos excluídos do cálculo; dois provedores de origem independente, mesma variável/unidade/cobertura/natureza e horários comparáveis podem colocar um valor discrepante em quarentena para revisão. Limites de tolerância, recência e sincronismo precisam ser fornecidos por política validada. Discordância não prova erro da fonte.

Níveis de alertas são ordinais, não são calculados por média aritmética/ponderada. Um alerta oficial vigente nível5 permanece identificado e visível junto à análise Blaise nível4 e à divergência. Não foi implementada supressão de fala de nível5 por discordância. Regras atuais de autorização, pertinência geográfica e modalidade permanecem responsáveis pela entrega sonora. Um alerta vencido, revogado ou com contrato inválido tem tratamento específico, sem confundir ausência com ausência de risco.

O Vector recebe evidências do chamador para revisão conjunta e preserva observação, análise e alerta oficial. O runtime inicia e encerra o agente quando a coleta oficial está habilitada, com a mesma modalidade inicial. Isso não integra automaticamente escala dinâmica, todos os outros agentes, dados de radar/perfis CAPE/hidrologia/tsunami ou aplicativo Android. Nenhuma alteração foi implantada no Cloud Run nesta revisão. Execução contínua em Cloud Run exige instância/CPU disponíveis entre requisições; configuração de produção e observabilidade ainda não foram verificadas.

Fusão escalar segue restrita a política calibrada e dados comparáveis, não se aplica a alertas categóricos nem a origens dependentes. Os demais módulos científicos e fornecedores pendentes continuam listados em BLAISE_VECTOR_RJ_SCIENTIFIC_ENGINE.md. Não há evidência de precisão de previsão/latência operacional de produção.

## Correção mais recente de entrega —06/10/2026

Por decisão do usuário, nível5 oficial permanece visível. Alarme/voz/sirene/vibração automáticos exigem convergência de pelo menos duas agências oficiais de origem independente, nível5, mesmo fenômeno/cobertura/período vigente, mais análise Blaise nível5. Sem convergência, somente exibição silenciosa. Isso substitui a descrição anterior de não supressão de fala por discordância. Não promedia escala. A função category5DeliveryGate está implementada/testada; ainda precisa ser chamada na distribuição FCM/Android e demais emissores antes de a regra operar no aplicativo. Perguntas por voz solicitadas pelo cliente seguem outra política.
