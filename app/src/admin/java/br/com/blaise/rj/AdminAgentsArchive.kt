package br.com.blaise.rj

/**
 * Historical 14-role roster for the protected ADM APK.
 *
 * Roles 1–10 originate in docs/BLAISE_V6_RJ_MASTER_SPEC_20261010.md
 * and backend/src/rj-agent-registry.mjs on the original main branch.
 * Roles 11–14 were specified in later RJ project conversations.
 *
 * This archive is a display-only catalog. It does not create services,
 * schedule collectors, contact providers, use credits, or authorize alerts.
 * The old ten-agent registry includes superseded sources; source use follows
 * only the latest approved RJ policy, not legacy role descriptions.
 */
data class AdminRjAgentArchiveEntry(
    val number: Int,
    val title: String,
    val responsibility: String,
    val evidenceState: String,
    val autonomouslyRunningVerified: Boolean = false,
)

object AdminRjAgentsArchive {
    const val ROSTER_SIZE = 14
    const val STATUS = "INVENTÁRIO HISTÓRICO • NÃO COMPROVA 14 AGENTES ATIVOS"
    const val NO_AUTOMATIC_DEPLOYMENT = true
    val entries = listOf(
        AdminRjAgentArchiveEntry(1, "Blaise Sentinel RJ",
            "Validação da origem, licença, cobertura geográfica, horário e integridade de fontes.",
            "Bibliotecas e políticas antigas; nenhuma operação autônoma comprovada."),
        AdminRjAgentArchiveEntry(2, "Blaise Vector RJ",
            "Memória científica, fórmulas, diagnósticos físicos e limites dos cálculos.",
            "19 métodos backend e calculadora administrativa recuperados; entradas reais pendentes."),
        AdminRjAgentArchiveEntry(3, "Blaise Fusion RJ",
            "Comparação de variáveis compatíveis, divergências, origem e fusão validada.",
            "Bibliotecas parciais; políticas antigas de fontes não devem ser reativadas."),
        AdminRjAgentArchiveEntry(4, "Blaise Track RJ",
            "Trajetória, direção, velocidade, advecção e ETA com incerteza.",
            "Cálculos condicionais; radar ao vivo e trajetória homologada não comprovados."),
        AdminRjAgentArchiveEntry(5, "Blaise Hydro RJ",
            "Chuva, rios, cheias, alagamentos e risco hidrológico no RJ.",
            "Catálogos/testes parciais; instrumentos operacionais pendentes."),
        AdminRjAgentArchiveEntry(6, "Blaise Ocean RJ",
            "Atlântico adjacente, ondas, swell, SST, ciclones e ressaca.",
            "Kernels e coletores NOAA de staging; publicação não comprovada."),
        AdminRjAgentArchiveEntry(7, "Blaise Seismo RJ",
            "Abalos recentes, contexto sísmico e triagem de risco de tsunami.",
            "Painel e regras existentes; avisos independentes e entrega real pendentes."),
        AdminRjAgentArchiveEntry(8, "Blaise Audit RJ",
            "Auditoria de fórmulas, proveniência, alertas, validade e prevenção de alarmes falsos.",
            "Testes e verificações pontuais; serviço autônomo não comprovado."),
        AdminRjAgentArchiveEntry(9, "Correção Horária RJ",
            "Revisão de regressões, fontes e falhas; não publica correções sem CI.",
            "Rótulo funcional histórico; agendamento autônomo não comprovado."),
        AdminRjAgentArchiveEntry(10, "Auditoria Profunda RJ",
            "Segurança, capacidade, contingência, custos e auditorias aprofundadas.",
            "Rótulo funcional histórico; sem compras ou automação comprovadas."),
        AdminRjAgentArchiveEntry(11, "IA Pesquisa RJ",
            "Pesquisa técnica e comparação de documentação para apoiar revisões humanas.",
            "Função solicitada em conversa posterior; executor desta branch não verificado."),
        AdminRjAgentArchiveEntry(12, "GeoFusion RJ",
            "Correspondência dos 92 municípios IBGE, estações, geometria e mapa próprio.",
            "Função planejada; validação geográfica depende de dados auditáveis."),
        AdminRjAgentArchiveEntry(13, "OpenWeather / Contingência Térmica",
            "Temperatura e sensação estimadas apenas quando elegíveis, sob cache e quota.",
            "Código condicional presente, mas execução real e licença não homologadas."),
        AdminRjAgentArchiveEntry(14, "Auditor Meteorológico Internacional RJ",
            "Auditoria independente de produtos internacionais; INMET só como comparação interna.",
            "Registro histórico posterior; executor autônomo não comprovado."),
    )

    init {
        require(entries.size == ROSTER_SIZE)
        require(entries.map { it.number } == (1..ROSTER_SIZE).toList())
        require(entries.none { it.autonomouslyRunningVerified })
        require(entries.all { it.title.isNotBlank() && it.responsibility.isNotBlank() })
    }
}
