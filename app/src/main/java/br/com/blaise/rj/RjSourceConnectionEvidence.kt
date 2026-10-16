package br.com.blaise.rj

import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.data.CityWeatherObservation
import br.com.blaise.rj.data.PublicRjStatus
import java.time.Instant
import java.net.URI

/**
 * Read-only display of WHICH actual data product arrived for the RJ dashboard.
 * "Real time" refers to periodic rechecking, not a guarantee that the source
 * itself has published new data or that all 92 municipalities are instrumented.
 */
data class RjSourceConnectionRow(
    val source: String,
    val product: String,
    val status: String,
    val updatedAt: Instant? = null,
    val verifiedCurrentProduct: Boolean = false,
)

object RjSourceConnectionEvidence {
    private const val OFFLINE = "Sem integração ao vivo comprovada"
    const val MODEL_ONLY = "Previsão/modelo • não equivale a uma estação oficial"
    const val SNAPSHOT_NOTICE = "Reconsulta da interface não altera o horário da medição na fonte"
    private val inmetSource = "INMET"
    private val rioSource = "Alerta Rio"

    private fun verifiedEndpoint(url: String, expectedHost: String): Boolean =
        runCatching {
            val uri=URI(url)
            uri.scheme=="https" && uri.host==expectedHost &&
                uri.userInfo==null && uri.port==-1
        }.getOrDefault(false)

    fun rows(
        municipalityIbge: Int,
        observation: CityWeatherObservation?,
        rioStations: List<CityWeatherObservation> = emptyList(),
        status: PublicRjStatus?,
        now: Instant,
    ): List<RjSourceConnectionRow> {
        require(RioMunicipalities.byIbgeCode(municipalityIbge) != null)
        val freshStatus = status?.takeIf { it.current(now) }
        val station = observation?.takeIf {
            it.municipalityIbge == municipalityIbge &&
                it.source == inmetSource && it.current(now) &&
                verifiedEndpoint(it.sourceUrl,"apitempo.inmet.gov.br")
        }
        val validRio = if (municipalityIbge == 3304557) {
            (rioStations + listOfNotNull(observation)).filter {
                it.municipalityIbge == 3304557 &&
                    it.source == rioSource && it.current(now) &&
                    verifiedEndpoint(it.sourceUrl,"websempre.rio.rj.gov.br")
            }
        } else emptyList()
        val newestRio=validRio.maxByOrNull { it.observedAt }
        val inmetInventory = freshStatus?.warningInventories?.firstOrNull { it.sourceId == "inmet" && it.current(now) }
        val inmetWorker = freshStatus?.sourceProducts
            ?.firstOrNull { it.id == "inmet" && it.currentlyConnected() && inmetInventory != null }
        val hydroWorker = freshStatus?.sourceProducts
            ?.firstOrNull { it.id == "cemaden-rj" && it.currentlyConnected() }
        val localRisk = freshStatus?.municipality(municipalityIbge, now)?.risk
            ?.takeIf { it.current(now) }

        val national = freshStatus?.nationalAlerts?.takeIf { it.current(now) }
        val aerodromes = freshStatus?.aerodromeObservations?.takeIf { it.current(now) }
        val points = aerodromes?.observations.orEmpty().filter {
            it.ibge == municipalityIbge && it.current(now)
        }
        val items = listOf(
            RjSourceConnectionRow("CEMADEN nacional", "Inventário de alertas abertos por município",
                if (national != null) "Painel consultado; ${national.alerts.count { it.ibge == municipalityIbge }} alerta(s) aberto(s). Não comprova ausência de risco."
                else OFFLINE, national?.sourceUpdatedAt, national != null),
            RjSourceConnectionRow("REDEMET / DECEA", "Boletins dos aeródromos; não média municipal",
                if (points.isNotEmpty()) "${points.size} boletim(ns) válido(s); ciclo horário e SPECI eventual"
                else OFFLINE, points.minOfOrNull { it.observedAt }, points.isNotEmpty()),
            RjSourceConnectionRow("Alerta Rio", "Estação meteorológica • somente cidade do Rio",
                when {
                    newestRio != null -> "Leitura pontual recente de estação fluminense"
                    municipalityIbge != 3304557 -> "Sem cobertura municipal Alerta Rio fora da cidade do Rio"
                    else -> OFFLINE
                },newestRio?.observedAt,newestRio != null),
            RjSourceConnectionRow("Defesa Civil RJ", "Avisos e boletins locais",
                "Canal próprio de avisos não comprovado neste painel; " +
                    "boletim CEMADEN/Defesa Civil não é segunda medição independente"),
            RjSourceConnectionRow("INMET", "Medição de estação no município selecionado",
                if(station != null) "Leitura pontual oficial recente" else OFFLINE,
                station?.observedAt,station != null),
            RjSourceConnectionRow("INMET", "Avisos CAP por município",
                if(inmetWorker != null) "Produto de avisos oficial consultado; cobertura por IBGE"
                else OFFLINE, inmetInventory?.checkedAt,inmetWorker != null),
            RjSourceConnectionRow("CEMADEN-RJ / Defesa Civil", "Risco hidrológico e cheias",
                if(localRisk != null && hydroWorker != null)
                    "Boletim municipal validado; não equivale a chuva pontual"
                else if(hydroWorker != null)
                    "Produto do servidor consultado; sem boletim atual para esta cidade"
                else OFFLINE,
                localRisk?.observedAt,
                localRisk != null && hydroWorker != null),
            RjSourceConnectionRow("OpenWeatherMap", "Terceiro complemento das 10 variáveis",
                OFFLINE),
            RjSourceConnectionRow("INPE / CPTEC", "Produtos meteorológicos de previsão",
                "$OFFLINE • $MODEL_ONLY"),
            RjSourceConnectionRow("Windy", "Comparação de modelos e desempate",
                "$OFFLINE • $MODEL_ONLY"),
            RjSourceConnectionRow("NOAA", "Atlântico, modelos e monitoramento especializado",
                OFFLINE),
            RjSourceConnectionRow("Copernicus Marine", "Ondas, swell, correntes e temperatura do mar",
                OFFLINE),
            RjSourceConnectionRow("EUMETSAT", "Nuvens, ciclones e tempestades no Atlântico",
                OFFLINE),
            RjSourceConnectionRow("ANA / SGB-SACE", "Níveis, vazões e risco de cheia",
                OFFLINE),
        )
        // A refreshed JSON wrapper is not proof of a refreshed source feed.
        return items
    }
}
