package br.com.blaise.rj

import java.time.Duration
import java.time.Instant

/** The traffic screen only forwards to official sources; it never copies lists. */
data class OfficialTrafficLink(val label: String, val url: String)
enum class TrafficBand(val label: String, val colorArgb: Long) {
    STABLE("Trânsito estável", 0xFF16803DL),
    ATTENTION("Atenção", 0xFFEAB308L),
    VERY_CAREFUL("Muito cuidado", 0xFFDC2626L),
}
data class VerifiedTrafficCondition(
    val band: TrafficBand,
    val sourceId: String,
    val sourceUpdatedAt: Instant,
    val checkedAt: Instant,
    val verifiedByBackend: Boolean,
)

object TrafficReferralPolicy {
    const val MAX_AGE_MINUTES = 30L
    val officialLinks = listOf(
        OfficialTrafficLink("CET-Rio", "https://cetrio.prefeitura.rio/"),
        OfficialTrafficLink("Ponte Rio-Niterói", "https://www.ecoviasponte.com.br/condicoes-da-via"),
        OfficialTrafficLink("Outras regiões • DER-RJ", "https://www.der.rj.gov.br/"),
    )
    const val COPYING_EXTERNAL_INCIDENT_LISTS = false
    const val DIRECT_TRAFFIC_OVERLAY_ON_WEATHER_MAP = false

    fun current(source: VerifiedTrafficCondition?, now: Instant): TrafficBand? {
        if (source == null || !source.verifiedByBackend ||
            source.sourceId !in setOf("cet-rio", "ecovias-ponte", "der-rj")) return null
        val sourceAge = Duration.between(source.sourceUpdatedAt, now).seconds
        val checkedAge = Duration.between(source.checkedAt, now).seconds
        return if (sourceAge in 0L..1800L && checkedAge in 0L..1800L)
            source.band else null
    }
}
