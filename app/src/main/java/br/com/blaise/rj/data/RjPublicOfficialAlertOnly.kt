package br.com.blaise.rj.data

import java.time.Instant

/**
 * Safety alerts are an independent channel from meteorological measurements.
 *
 * This adapter is intended ONLY for an explicitly authorized INMET warning
 * relay from the existing public backend. Existing CEMADEN risk readings,
 * meteorological stations, CHM marine reports and products lacking rights to
 * republication are never passed into the public alert UI.
 *
 * COR.Rio, Alerta Rio and Defesa Civil RJ are provided as links to official
 * publications until dedicated licensed, authenticated alert-only feeds exist.
 */
object RjPublicOfficialAlertOnly {
    const val INMET_ALERT_ORIGIN = "https://apiprevmet3.inmet.gov.br/avisos/rss"

    fun sanitize(snapshot: PublicRjStatus, now: Instant): PublicRjStatus? {
        if (!snapshot.current(now)) return null
        val authorizedWarnings = snapshot.warnings.filter {
            it.sourceUrl == INMET_ALERT_ORIGIN && it.current(now)
        }.map { warning ->
            // Only an existence pointer survives the trust boundary. The
            // issuer's original text, level and severity are never passed to
            // UI, news, voice, map or customer-facing calculation modules.
            warning.copy(
                event = "Consulte o aviso na fonte oficial.",
                severity = "Detalhes no portal",
            )
        }
        val ids = authorizedWarnings.map { it.id }.toSet()
        return snapshot.copy(
            warnings = authorizedWarnings,
            municipalities = snapshot.municipalities.map { row ->
                row.copy(risk = null, warningIds = row.warningIds.filter(ids::contains))
            },
            marine = null,
            sourceProducts = snapshot.sourceProducts.filter { it.id == "inmet" },
            warningInventories = snapshot.warningInventories.filter { it.sourceId == "inmet" },
        )
    }
}

data class RjOfficialPublicAlertLink(val issuer: String, val page: String)

object RjOfficialPublicAlertLinks {
    val entries = listOf(
        RjOfficialPublicAlertLink("INMET • avisos meteorológicos", "https://avisos.inmet.gov.br/"),
        RjOfficialPublicAlertLink("Sistema Alerta Rio • avisos", "https://www.sistema-alerta-rio.com.br/alertas/"),
        RjOfficialPublicAlertLink("COR.Rio • avisos à população", "https://cor.rio/"),
        RjOfficialPublicAlertLink("Defesa Civil RJ • alertas e orientações", "https://defesacivil.rj.gov.br/"),
    )
}
