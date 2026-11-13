package br.com.blaise.rj

/**
 * Regras aprovadas do produto Blaise V6 RJ, consolidadas em 13/11/2026.
 *
 * Isto e memoria de REQUISITOS, nao memoria de conversa, e nunca substitui
 * dados oficiais, autenticacao, validacao de fontes ou testes operacionais.
 * A implementacao de cada requisito deve ser verificada separadamente.
 */
object RjProductMemory {
    const val PRODUCT = "Blaise V6 RJ"
    const val GEOGRAPHY = "Estado do Rio de Janeiro"
    const val TIME_ZONE = "America/Sao_Paulo"
    const val MUNICIPALITIES = 92
    const val DEFAULT_POWER_STATE = "LIGADO"
    const val ASSISTANT_QUESTION = "Como posso ajudar?"
    const val UNAVAILABLE = "INDISPONÍVEL NO MOMENTO"

    const val NORMAL_REFRESH_SECONDS = 300
    const val SEVERE_REFRESH_SECONDS = 60
    const val EXTREME_REFRESH_SECONDS = 30
    const val RADAR_WINDOW_MINUTES = 30
    const val RADAR_EXPECTED_FRAME_SECONDS = 120

    const val ALERT_REVIEW_AFTER_HOURS = 3
    const val ALERT_DOWNGRADE_AFTER_HOURS = 4
    const val ALERT_HISTORY_HOURS = 12
    const val SCIENTIFIC_REPORT_RETENTION_HOURS = 24

    // Valores de assinatura definidos para o Rio de Janeiro, nao produtos ativos da loja.
    const val MONTHLY_PRICE_BRL = "3.93"
    const val ANNUAL_PRICE_BRL = "35.00"
    const val OFFICIAL_P0_ALERTS_REACH_NON_SUBSCRIBERS = true

    val approvedSources = listOf(
        "Alerta Rio", "COR.Rio", "Defesa Civil RJ", "CET-Rio", "Geo-Rio",
        "INMET", "INPE/CPTEC", "CEMADEN", "NOAA", "EUMETSAT",
        "JAXA/GSMaP", "USGS"
    )

    // Lista tecnica de bloqueio: jamais apresentar como fontes ativas.
    val excludedSources = setOf(
        "INEA", "Marinha do Brasil", "CHM", "Windy", "Copernicus"
    )

    val interfaceModules = listOf(
        "Cabeçalho com LIGADO e assistente",
        "Faixa de alertas oficiais",
        "Cidade 1",
        "Mapa meteorológico próprio do RJ",
        "Cidade 2",
        "Radar Sumaré: quadros oficiais, sem interpolação",
        "Gráficos e previsões com fonte e validade",
        "Trânsito e ocorrências",
        "Mar, ondas e Atlântico adjacente",
        "Qualidade do ar",
        "Risco de deslizamento",
        "Notícias locais e internacional",
        "Dois sismos recentes",
        "Histórico e configurações"
    )

    val scientificMethodsRequired = listOf(
        "Advecção", "Extrapolação de radar", "Balanço térmico",
        "Gradiente e tendência de pressão", "Vorticidade e divergência",
        "Ponto de orvalho e bulbo úmido", "Índices de calor e frio",
        "CAPE", "CIN", "LI", "Lapse rate",
        "Shear 0-1 km", "Shear 0-6 km", "SRH",
        "PWAT", "LCL", "LFC", "EL",
        "Precipitação por radar calibrado", "MSLP",
        "Convergência de umidade", "Swell e propagação oceânica"
    )

    val operationalAgentsRequired = listOf(
        "Correção contínua",
        "Checagem de fontes",
        "Rotina diária",
        "Auditoria e limpeza",
        "Cálculo de eventos severos",
        "Trânsito",
        "Marítimo",
        "Voz e perguntas",
        "Fiscalização de fontes e domínios",
        "Segurança e escala de assinantes"
    )

    enum class Nature { OBSERVADO, PREVISAO, MODELO, HISTORICO, CALCULO_BLAISE, ALERTA_OFICIAL }

    /** Regra de interface: revalidar o horário da MEDIÇÃO, não o da atualização da página. */
    fun isCurrentReading(
        observedAtEpochMs: Long?,
        nowEpochMs: Long,
        maxAgeMs: Long,
        validatedSource: Boolean
    ): Boolean {
        if (!validatedSource || observedAtEpochMs == null || maxAgeMs <= 0L) return false
        if (observedAtEpochMs > nowEpochMs) return false
        return nowEpochMs - observedAtEpochMs <= maxAgeMs
    }

    fun refreshTargetSeconds(level: Int): Int = when {
        level >= 5 -> EXTREME_REFRESH_SECONDS
        level >= 4 -> SEVERE_REFRESH_SECONDS
        else -> NORMAL_REFRESH_SECONDS
    }

    /** Falha de consulta nao equivale a retirada oficial de alerta. */
    fun alertWithdrawalCanRemoveImmediately(explicitWithdrawalBySource: Boolean): Boolean =
        explicitWithdrawalBySource
}
