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
        "INPE/CPTEC", "INMET", "Windy", "CEMADEN", "NOAA"
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

    val newsScopes = listOf("RJ", "Niterói", "São Gonçalo", "Região", "Nacional", "Internacional")

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


## Verificação operacional — 15/10/2026 19:55 BRT

Consulta direta à candidata validacao-rj: HTTP 200, generatedAt 2026-10-15T22:55:17.490Z, workerActive true, 92 municípios, zero avisos municipais elegíveis. INMET CURRENT_DEGRADED (produto avisos); CEMADEN nacional, CEMADEN-RJ e REDEMET ausentes da publicação. Ausência de avisos não é garantia de segurança; cadastro de 92 cidades não comprova medições para todas. CI 965 backend aprovado e Android ainda em andamento no momento da consulta. Corrigida ligação dos critérios 14/15 à seleção de fenômenos numéricos no Android; não disponibilizar AccuWeather como critério de tsunami.


## REDEMET: ciclo horário solicitado e proteção da chave — 15/10/2026

Consulta autenticada às 19:59:48 BRT: HTTP 200, SBGL e SBRJ com METAR válido das 19h BRT. CEMADEN nacional retornou atualizado 19:59:02 BRT, zero alertas abertos RJ; não significa ausência de risco. Chave não foi gravada nem exibida. Adaptador passa a enviar X-Api-Key, removendo segredo da URL.

REDEMET exibe boletim de até 60 minutos com horário original e descrição de ciclo horário/SPECI eventual. Consulta do cache continua limitada a 5 minutos; boletim com observação acima de 5 minutos é CURRENT_DEGRADED, nunca apresentado como medição minuto a minuto. Após 60 minutos, remove valores mesmo havendo nova consulta. Não entra automaticamente na média observacional que exige 5 minutos. Credencial, configuração Cloud Run e autorização de publicação continuam pendentes; teste de acesso não equivale a autorização comercial.


## Configuração segura da candidata — 16/10/2026

backend/scripts/configure-redemet-candidate.sh solicita chave em terminal oculto, grava por stdin no Secret Manager, fixa a versão exata e concede acesso somente à conta do serviço no segredo. Implanta candidata com --no-traffic e tag validacao-rj, ativando coleta REDEMET autorizada pelo operador sem habilitar publicação pública. Nenhuma chave é gravada no repositório ou impressa. Execução requer a sessão Cloud Shell do operador; ainda não executado pela assistência.
