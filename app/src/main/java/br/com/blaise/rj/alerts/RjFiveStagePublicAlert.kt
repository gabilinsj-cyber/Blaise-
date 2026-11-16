package br.com.blaise.rj.alerts

import java.net.URI
import java.time.Duration
import java.time.Instant

/** Blaise-specific presentation stages, NOT a claim that an official publisher
 * uses an equivalent five-level scale. Stages are displayed only after
 * authentic, locally relevant, time-valid official evidence is mapped through
 * a reviewed and authorized source-specific mapping. */
enum class RjBlaiseStage(
    val number: Int,
    val backgroundArgb: Long,
    val shortPhrase: String,
) {
    ONE(1, 0xFF4ADE80, "Atenção baixa: consulte a orientação oficial."),
    TWO(2, 0xFFA3E635, "Atenção preventiva: consulte a orientação oficial."),
    THREE(3, 0xFFFACC15, "Atenção meteorológica: consulte a orientação oficial."),
    FOUR(4, 0xFFFB923C, "Alerta elevado: consulte a orientação oficial."),
    FIVE(5, 0xFFF87171, "Alerta extremo: consulte imediatamente a orientação oficial.");

    companion object {
        fun from(number: Int): RjBlaiseStage? = entries.firstOrNull { it.number == number }
    }
}

/** Only a backend-verified stage is accepted for display or for sound.
 * Content/level from a scraped page is NOT sufficient to create this object. */
data class VerifiedBlaisePublicStage(
    val alertId: String,
    val sourceId: String,
    val municipalityIbge: Int,
    val stage: RjBlaiseStage,
    val officialUrl: String,
    val issuedAt: Instant,
    val checkedAt: Instant,
    val expiresAt: Instant,
    val sourceAuthenticationVerified: Boolean,
    val stageMappingReviewedAndVerified: Boolean,
    val authorizedToDisplayShortMetadata: Boolean,
) {
    fun isCurrent(now: Instant): Boolean {
        if (!sourceAuthenticationVerified || !stageMappingReviewedAndVerified ||
            !authorizedToDisplayShortMetadata || alertId.isBlank() ||
            municipalityIbge !in 3300000..3399999 ||
            issuedAt > now || expiresAt <= now || expiresAt <= issuedAt ||
            checkedAt > now || Duration.between(checkedAt, now).seconds !in 0..300
        ) return false
        val allowedHosts = when (sourceId) {
            "INMET" -> setOf("avisos.inmet.gov.br", "portal.inmet.gov.br")
            "ALERTA_RIO" -> setOf("sistema-alerta-rio.com.br", "www.sistema-alerta-rio.com.br")
            "COR_RIO" -> setOf("cor.rio", "www.cor.rio")
            "DEFESA_CIVIL_RJ" -> setOf("defesacivil.rj.gov.br", "www.defesacivil.rj.gov.br")
            else -> return false
        }
        return try {
            val url = URI(officialUrl)
            url.scheme == "https" && url.host in allowedHosts &&
                url.userInfo == null && url.port == -1
        } catch (_: Exception) { false }
    }
}

/** Pure rule used both by UI and future signed push path.
 * Persisted per-alert previous stage prevents duplicate level-5 alarms. */
object RjStageFiveTransition {
    fun shouldDispatch(previous: RjBlaiseStage?, current: RjBlaiseStage): Boolean =
        current == RjBlaiseStage.FIVE && previous != RjBlaiseStage.FIVE
}
