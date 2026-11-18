package br.com.blaise.rj

/**
 * Local, ADMIN-ONLY planning snapshot recovered on 18/11/2026 from the
 * HG Brasil conversation and reviewed code. Never represents a live provider
 * balance, successful production collection, or paid subscription.
 *
 * Runtime values must come only from server-authenticated, audited endpoints;
 * no third-party keys, credentials, client location or usage history here.
 */
data class AdminCollectorReadinessItem(
    val id: String,
    val title: String,
    val state: String,
    val explanation: String,
    val paidSubscriptionActive: Boolean = false,
    val publishingToSubscribers: Boolean = false,
)

/**
 * Audit checklist only: the Kotlin client does not retrieve the provider's
 * current balance, API response, key, Firestore account or backend secrets.
 * These fields correspond 1:1 to the STRICT private basic-6h parser.
 */
data class AdminMeteoblueForecastField(
    val jsonKey: String,
    val label: String,
    val unit: String,
    val meaning: String,
    val auditedLiveValue: Boolean = false,
)

object AdminCollectorReadiness {
    const val SNAPSHOT_DATE = "18/11/2026"
    const val RJ_MUNICIPALITIES = 92
    const val METEOBLUE_TOTAL_TRIAL_CREDITS = 10_000_000
    const val METEOBLUE_LOCAL_CEILING_CREDITS = 8_000_000
    const val METEOBLUE_COST_PER_BASIC_6H_REQUEST = 4_000
    const val METEOBLUE_MAX_REQUESTS_PER_UTC_DAY = 4
    const val METEOBLUE_MUNICIPAL_COOLDOWN_HOURS = 24
    const val METEOBLUE_CACHE_HOURS = 6
    const val METEOBLUE_EXPIRY_DATE = "18/11/2027"
    const val METEOBLUE_PRIVATE_COLLECTOR_ENABLED = false
    const val METEOBLUE_PUBLISHED_TO_SUBSCRIBERS = false
    // Null is deliberately distinct from zero: no provider dashboard or
    // Firestore read occurs in this Android-admin planning view.
    val meteoblueCurrentProviderCredits: Int? = null
    val meteoblueActualLocalCreditsReserved: Int? = null
    val meteoblueFieldAudit = listOf(
        AdminMeteoblueForecastField("precipitation", "Chuva prevista acumulada em 6h", "mm", "PREVISÃO 6H, NÃO CHUVA OBSERVADA"),
        AdminMeteoblueForecastField("convective_precipitation", "Chuva convectiva prevista em 6h", "mm", "PREVISÃO 6H, NÃO DETECÇÃO DE TEMPESTADE"),
        AdminMeteoblueForecastField("precipitation_probability", "Probabilidade de chuva em 6h", "%", "PROBABILIDADE DE PREVISÃO 6H"),
        AdminMeteoblueForecastField("windspeed_mean", "Vento médio previsto em 6h", "km/h", "MÉDIA PREVISTA, NÃO VENTO OBSERVADO"),
        AdminMeteoblueForecastField("windspeed_max", "Vento máximo previsto em 6h", "km/h", "MÁXIMO PREVISTO, NÃO RAJADA OBSERVADA"),
        AdminMeteoblueForecastField("relativehumidity_mean", "Umidade relativa média prevista em 6h", "%", "MÉDIA PREVISTA EM 6H"),
        AdminMeteoblueForecastField("sealevelpressure_mean", "Pressão média prevista ao nível do mar em 6h", "hPa", "MÉDIA PREVISTA AO NÍVEL DO MAR"),
    )
    const val HG_PRO_ADVERTISED_PRICE_BRL = 49.90
    const val HG_PRO_CITY_LIMIT = 100
    const val HG_PRO_DAILY_LIMIT = 20_000
    const val HG_PLANNED_CALLS_PER_DAY = 2_208

    val integrations = listOf(
        AdminCollectorReadinessItem(
            "HG_BRASIL_WEATHER_PRO", "HG Brasil Pro",
            "AUTORIZAÇÃO ESCRITA • SEM CONTRATAÇÃO",
            "Aplicativo com assinantes e cache autorizados. 92 de 100 cidades, 2.208 de 20.000 consultas/dia; R$ 49,90/mês anunciado. A HG não identifica a estação original de cada campo. Compra somente perto do lançamento."
        ),
        AdminCollectorReadinessItem(
            "CLIMATEMPO_ADVISOR", "Climatempo Advisor",
            "ORÇAMENTO SOLICITADO • SEM CONTRATO",
            "Proposta pedida em 18/11/2026 para previsões, observações, radar, raios, mar e hidrologia; disponibilidade, licença, SLA e preço ainda não homologados."
        ),
        AdminCollectorReadinessItem(
            "DWD_ICON_GLOBAL", "DWD ICON Global",
            "LOTE DE TESTE 92/92 • SEM PUBLICAÇÃO",
            "Previsão de temperatura do ar a 2 m para pontos IBGE. Migrar endpoint DWD v1 e fixar pesos CDO oficiais com SHA-256 antes de operação contínua."
        ),
        AdminCollectorReadinessItem(
            "OPENWEATHER_AGENT13", "Agente 13 / OpenWeather",
            "CONTINGÊNCIA TÉRMICA CONDICIONAL",
            "Temperatura e sensação estimadas apenas quando houver dados válidos, licença e backend verificados. Limite interno de 900 chamadas/dia; nenhuma publicação nova foi homologada."
        ),
        AdminCollectorReadinessItem(
            "METEOBLUE_FREE_FORECAST", "meteoblue Free API • mLM basic-6h",
            "COLETOR PRIVADO OFF • SALDO DO FORNECEDOR NÃO CONSULTADO",
            "Créditos iniciais 10 milhões até 18/11/2027; teto local 8 milhões; 4.000 créditos/consulta e até 4/dia UTC. HTTP 200 com 29 horários em teste anterior; sete campos numéricos ainda carecem de auditoria real. Sem scheduler ou fonte de temperatura atual."
        ),
        AdminCollectorReadinessItem(
            "NOAA_RJ_MARINE", "NOAA • ondas / SST / raios",
            "COLETORES DE STAGING • NÃO PUBLICADOS",
            "Produtos GFS Wave, CoastWatch SST e GOES-19 GLM exigem arquivo real, licença, qualidade, hora e localização; ausência deve permanecer indisponível."
        ),
        AdminCollectorReadinessItem(
            "OFFICIAL_LINKS", "Avisos oficiais",
            "LINKS • NÃO SÃO MEDIÇÕES DO BLAISE",
            "Alerta Rio e Defesa Civil RJ são encaminhamentos para páginas oficiais. INMET e CEMADEN apenas para comparação administrativa."
        ),
    )

    init {
        require(RJ_MUNICIPALITIES == 92)
        require(HG_PLANNED_CALLS_PER_DAY <= HG_PRO_DAILY_LIMIT)
        require(HG_PRO_CITY_LIMIT >= RJ_MUNICIPALITIES)
        require(METEOBLUE_LOCAL_CEILING_CREDITS < METEOBLUE_TOTAL_TRIAL_CREDITS)
        require(meteoblueFieldAudit.size == 7)
        require(meteoblueFieldAudit.map { it.jsonKey }.distinct().size == 7)
        require(meteoblueFieldAudit.none { it.auditedLiveValue })
        require(meteoblueCurrentProviderCredits == null && meteoblueActualLocalCreditsReserved == null)
        require(!METEOBLUE_PRIVATE_COLLECTOR_ENABLED && !METEOBLUE_PUBLISHED_TO_SUBSCRIBERS)
        require(integrations.map { it.id }.distinct().size == integrations.size)
        require(integrations.none { it.paidSubscriptionActive || it.publishingToSubscribers })
    }
}
