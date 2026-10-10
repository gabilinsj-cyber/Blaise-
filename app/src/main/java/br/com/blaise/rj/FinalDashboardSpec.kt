package br.com.blaise.rj

/**
 * Canonical product/UI contract for the approved Blaise V6 RJ dashboard.
 * This file deliberately contains no sample weather values: production UI must
 * render only timestamped source data supplied by the runtime adapters.
 */
object FinalDashboardSpec {
    const val STORE_GOOGLE_PLAY = "GOOGLE_PLAY"
    const val STORE_SAMSUNG = "SAMSUNG_GALAXY_STORE"
    const val STORE_AMAZON = "AMAZON_APPSTORE"
    const val PRODUCT = "Blaise V6 RJ"
    const val TAGLINE = "Clima e Tempo"
    const val DEFAULT_POWER_STATE = "LIGADO"
    const val ASSISTANT_PROMPT = "Como posso ajudar?"
    const val RADAR_WINDOW_MINUTES = 30
    const val MAX_INLINE_ALERTS_PER_CITY = 3
    const val HOME_LOCAL_NEWS_COUNT = 2
    const val HOME_INTERNATIONAL_NEWS_COUNT = 1
    const val HOME_SEISMIC_EVENT_COUNT = 2
    const val SEISMIC_NOTIFICATION_MIN_MAGNITUDE = 7.0

    val primaryNavigation = listOf(
        "Início", "Cidades", "Mapa", "Alertas", "Trânsito",
        "Mar e Ondas", "Qualidade do Ar", "Notícias", "Histórico", "Mais"
    )

    val trafficEvents = listOf(
        "Interdições", "Acidentes", "Bolsões d’água", "Alagamentos",
        "Queda de árvore/poste", "Túneis fechados", "Deslizamentos", "Obras", "Rotas alternativas"
    )

    val officialSources = listOf(
        "COR.Rio", "CET-Rio", "Alerta Rio", "Geo-Rio",
        "Defesa Civil Municipal", "Defesa Civil Estadual", "CEMADEN", "ANA/Hidroweb", "SGB/SACE",
        "Marinha do Brasil/CHM", "INMET", "CPTEC/INPE", "USGS"
    )

    // Five situational weather channels; Windy and INPE/CPTEC provide
    // forecast context, not interchangeable measured station reports.
    val fiveSituationalWeatherSources = listOf(
        "Alerta Rio", "Defesa Civil", "INMET", "Windy (modelos)", "INPE/CPTEC (previsões)"
    )

    val newsScopes = listOf("RJ", "Niterói", "São Gonçalo", "Região", "Internacional")

    fun shouldOpenAdditionalAlertsPage(alertCount: Int): Boolean =
        alertCount > MAX_INLINE_ALERTS_PER_CITY

    fun shouldNotifySeismicEvent(magnitude: Double, feltInBrazil: Boolean): Boolean =
        magnitude >= SEISMIC_NOTIFICATION_MIN_MAGNITUDE && feltInBrazil

    fun storeDisplayName(channel: String): String = when (channel) {
        STORE_SAMSUNG -> "Samsung Galaxy Store"
        STORE_AMAZON -> "Amazon Appstore"
        else -> "Google Play"
    }
}
