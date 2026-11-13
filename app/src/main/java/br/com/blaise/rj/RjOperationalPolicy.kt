package br.com.blaise.rj

import java.time.Duration
import java.time.Instant

/**
 * Regras operacionais do Blaise V6 RJ. Este catálogo NÃO é um coletor,
 * NÃO certifica que uma fonte esteja conectada e NÃO substitui alertas oficiais.
 */
object RjOperationalPolicy {
    const val STATE_IBGE_PREFIX = "33"
    const val MUNICIPALITY_COUNT = 92
    const val RADAR_HISTORY_MINUTES = 30
    const val MONTHLY_PRICE_BRL = "3,93"
    const val ANNUAL_PRICE_BRL = "35,00"

    private val allowedSources = setOf(
        "Alerta Rio", "COR.Rio", "CET-Rio", "Geo-Rio", "Defesa Civil RJ",
        "Defesa Civil Municipal RJ", "INMET", "INPE/CPTEC", "CEMADEN",
        "NOAA", "EUMETSAT", "JAXA/GSMaP", "USGS"
    )

    /** Identificadores de fontes legadas permanecem somente para REJEIÇÃO. */
    private val forbidden = setOf("INEA", "Marinha do Brasil", "CHM", "Windy", "Copernicus")

    fun mayUseSource(source: String): Boolean =
        source in allowedSources && forbidden.none { source.contains(it, ignoreCase = true) }

    fun mayShowObservation(source: String, observedAt: Instant?, now: Instant, ttl: Duration): Boolean {
        if (!mayUseSource(source) || observedAt == null || ttl.isNegative || ttl.isZero) return false
        val age = Duration.between(observedAt, now)
        return !age.isNegative && age <= ttl
    }

    fun suggestedRefreshMs(alertLevel: Int, doubleRed: Boolean = false): Long = when {
        doubleRed -> 25_000L
        alertLevel >= 5 -> 30_000L
        alertLevel >= 3 -> 60_000L
        else -> 300_000L
    }

    enum class LocalAlertState { ACTIVE, EXPIRED_IN_REVIEW, LOCAL_DOWNGRADE, REMOVE }

    /** A retirada pela fonte tem precedência; regras locais não alteram a gravidade oficial. */
    fun localAlertState(
        firstObservedAt: Instant,
        now: Instant,
        withdrawnBySource: Boolean,
    ): LocalAlertState {
        if (withdrawnBySource || now.isBefore(firstObservedAt)) return LocalAlertState.REMOVE
        val age = Duration.between(firstObservedAt, now)
        return when {
            age >= Duration.ofHours(12) -> LocalAlertState.REMOVE
            age >= Duration.ofHours(4) -> LocalAlertState.LOCAL_DOWNGRADE
            age >= Duration.ofHours(3) -> LocalAlertState.EXPIRED_IN_REVIEW
            else -> LocalAlertState.ACTIVE
        }
    }

    fun localDowngradedLevel(originalLevel: Int): Int = when (originalLevel) {
        5 -> 3
        4 -> 2
        else -> originalLevel
    }

    /** Nenhum paywall pode impedir avisos oficiais prioritários P0. */
    fun mayDeliverOfficialP0(subscribed: Boolean): Boolean = true
    fun mayDeliverPremium(subscribed: Boolean): Boolean = subscribed
}
