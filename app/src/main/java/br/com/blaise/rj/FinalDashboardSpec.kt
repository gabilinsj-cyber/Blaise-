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
    const val WEATHER_MAX_AGE_MINUTES = 30
    const val HIGH_SEVERITY_RECALC_SECONDS = 20
    const val MAX_TOP_OFFICIAL_ALERTS = 3
    const val METEOBLUE_FREE_CLIENT_PUBLICATION = false
    val weatherLayers = listOf("Radar", "Temp. e Térmica", "Chuva e Acumulado", "Tempestades", "Ondas de Calor", "Qualidade do Ar", "Ventos / Ciclone")
    val trafficStatusLabels = listOf("Trânsito estável", "Atenção", "Muito cuidado")
    const val MAX_INLINE_ALERTS_PER_CITY = 4
    const val HOME_LOCAL_NEWS_COUNT = 2
    const val HOME_INTERNATIONAL_NEWS_COUNT = 1
    const val HOME_SEISMIC_EVENT_COUNT = 3
    const val SEISMIC_NOTIFICATION_MIN_MAGNITUDE = 7.0

    val primaryNavigation = listOf(
        "Início", "Cidades", "Mapa", "Alertas", "Trânsito",
        "Mar e Ondas", "Qualidade do Ar", "Notícias", "Histórico", "Mais"
    )

    val trafficEvents = listOf(
        "Interdições", "Acidentes", "Bolsões d’água", "Alagamentos",
        "Queda de árvore/poste", "Túneis fechados", "Deslizamentos", "Obras", "Rotas alternativas"
    )

    // Approved source/reference catalog only. A name here is NOT proof
    // that a live connector, a local station or a commercial licence exists.
    // NASA/JAXA/Zoom Earth/Marinha/Windy/INEA are excluded.
    val officialSources = listOf(
        "NOAA", "NOAA GOES-19", "NOAA GFS-Wave",
        "ECMWF/IFS", "DWD/ICON Global", "meteoblue Free • mLM 6h",
        "Visual Crossing Free",
        "RAMMB/CIRA SLIDER",
        "OpenWeather", "INPE/CPTEC",
        "ANA/Hidroweb", "SGB/SACE", "USGS"
    )

    // Admin-only thermal comparison order; never render this inventory,
    // agent identities, intermediary measurements, discrepancies or calculations
    // in the subscriber UI. Clients only see validated thermal values, the
    // specific displayed value's source/time, or 'Indisponível'.
    // The list is an integration target, not a claim of live coverage.
    val thermalSourcePriority = listOf("HG Brasil Pro (não contratado)", "OpenWeather/Agente 13", "DWD/ICON Global")
    const val THERMAL_VISUAL_CROSSCHECK = "Meteologix/Kachelmannwetter"
    const val THERMAL_LAST_RESORT = "OpenWeather/Agente 13"
    const val THERMAL_FALLBACK_INTERVAL_MINUTES = 35
    const val THERMAL_DAILY_PROVIDER_BUDGET = 900

    // Until backend-verified source inventories, licensed model ingestion and
    // authenticated thermal-only response exist, the app cannot trigger any
    // automatic or manual paid OpenWeather fallback through the city panel.
    const val THERMAL_FALLBACK_INTEGRATED = false
    const val THERMAL_DIAGNOSTICS_ADMIN_ONLY = true
    // Source audits and package-credit details belong in the protected ADM APK,
    // not in public subscriber screens.
    const val PROVIDER_DIAGNOSTICS_ADMIN_ONLY = true
    fun shouldShowProviderDiagnostics(applicationId: String): Boolean =
        applicationId == "br.com.blaise.rj.admin"
    // Domestic meteorological references are for private comparison only.
    // An existing client-side INMET station collector is disabled in this branch
    // until an approved international/paid signed weather feed replaces it.
    const val DOMESTIC_STATION_COLLECTION_IN_SUBSCRIBER = false
    // PUBLIC LINK-ONLY exception (17/11): INMET and INPE/CPTEC warning portals
    // can be linked from the header. Their bulletin content is not ingested here.
    // This does not authorize INMET weather inputs or CEMADEN public output.
    val officialAlertReferralIds = listOf(
        "alerta-rio", "defesa-civil-rj", "inmet-avisos", "inpe-cptec-avisos"
    )
    // INMET / CEMADEN are domestic comparison inputs only. Never published.
    const val BRAZIL_DOMESTIC_REFERENCES_ADMIN_ONLY = true
    const val THERMAL_UNAVAILABLE_LABEL = "Indisponível"

    // The Blaise 1..5 risk palette is separate from INMET's 3 official colors
    // and CEMADEN-RJ's risk labels. Never infer a Blaise level from a portal
    // link or unlicensed upstream content. Server-validated original Blaise
    // evidence is mandatory. A null result renders NO colored active warning.
    fun validatedBlaiseNoticeColorArgb(level: Int?, backendValidated: Boolean): Int? =
        if (!backendValidated) null else when (level) {
            1 -> 0xFF16803D.toInt() // verde
            2 -> 0xFFEAB308.toInt() // amarelo
            3 -> 0xFFEA580C.toInt() // laranja
            4 -> 0xFFDC2626.toInt() // vermelho
            5 -> 0xFF7E22CE.toInt() // roxo extremo
            else -> null
        }

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
