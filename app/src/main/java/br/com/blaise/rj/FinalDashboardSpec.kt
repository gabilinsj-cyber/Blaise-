package br.com.blaise.rj

/**
 * Canonical product/UI contract for the approved Blaise V6 RJ dashboard.
 * This file deliberately contains no sample weather values: production UI must
 * render only timestamped source data supplied by the runtime adapters.
 */
/**
 * Official website/viewer navigational links, NOT data-ingestion adapters.
 * Never represent an opened provider portal as a verified live reading.
 */
data class RjSourceViewer(
    val sourceId: String,
    val title: String,
    val url: String,
    val purpose: String,
    val productStatus: String = "Consulta externa • integração de dados ao vivo não validada",
)


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
        "INPE/CPTEC", "INMET", "CEMADEN", "Windy", "NOAA"
    )

    // Supplementary provider catalog: visible configuration, NOT live status.
    // The OpenWeatherMap "third source" in the reference image means third
    // complementary CONSULTATION, not the third official alert authority.
    val tenVariableOpenWeatherMap = listOf(
        "Temperatura", "Sensação térmica", "Chuva atual", "Chuva acumulada",
        "Temporais", "Vento sustentado", "Rajadas", "Pressão atmosférica",
        "Umidade relativa", "Granizo"
    )
    val oceanSatelliteSources = listOf(
        "Marinha do Brasil/CHM", "NOAA", "Copernicus Marine",
        "EUMETSAT", "INMET", "INPE/CPTEC", "Windy"
    )
    const val EXPANDED_METEO_PHENOMENA_COUNT = 30
    const val EXTRA_DISPUTE_CHECKS = 5
    const val SUPPLEMENTAL_SOURCE_STATUS = "Cadastrada • ingestão de dados ainda não validada"

    // Tabela 1 and Tabela 2 remain two separate consultation stages.
    val table1PrincipalSources = listOf(
        "Alerta Rio (exclusivamente município do Rio)",
        "Defesa Civil RJ/local (conforme produto e município)",
        "OpenWeatherMap (terceira consulta complementar, NÃO autoridade de alerta)",
    )
    val table2DisputeSources = listOf(
        "INPE/CPTEC (primeiro desempate de previsão)",
        "INMET (medição oficial por estação e avisos)",
        "CEMADEN (chuva/hidrologia conforme estação)",
        "Windy (modelo de comparação, se necessário)",
        "NOAA (produtos pertinentes por fenômeno)",
    )

    // Click-through viewers supplement Blaise's own map; they do not copy
    // their meteorological images, claim verified licensing, or fetch data.
    val marineSourceViewers = listOf(
        RjSourceViewer("MARINHA_CHM", "Marinha do Brasil • CHM",
            "https://www.marinha.mil.br/chm",
            "Avisos de ressaca, ondas, marés, navegação e alertas competentes"),
        RjSourceViewer("NOAA", "NOAA • oceano e Atlântico",
            "https://www.noaa.gov/",
            "Dados oceanográficos e meteorológicos conforme produto"),
        RjSourceViewer("COPERNICUS_MY_OCEAN", "Copernicus Marine • MyOcean",
            "https://marine.copernicus.eu/access-data/myocean-viewer",
            "Ondas, swell, correntes, nível e temperatura do mar"),
        RjSourceViewer("COPERNICUS_PRO", "Copernicus Marine • Pro Viewer",
            "https://data.marine.copernicus.eu/viewer/expert?view=viewer",
            "Visualização detalhada dos modelos marítimos"),
        RjSourceViewer("EUMETSAT", "EUMETSAT • satélite Atlântico",
            "https://view.eumetsat.int/",
            "Nuvens, ciclones e tempestades pelo satélite"),
    )
    val meteorologicalSourceViewers = listOf(
        RjSourceViewer("OPENWEATHERMAP", "OpenWeatherMap • complemento",
            "https://openweathermap.org/",
            "Terceira fonte complementar às dez variáveis da Tabela 1"),
        RjSourceViewer("INPE_CPTEC", "INPE/CPTEC • previsões",
            "https://www.cptec.inpe.br/",
            "Produtos de previsão e consulta para divergências"),
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
