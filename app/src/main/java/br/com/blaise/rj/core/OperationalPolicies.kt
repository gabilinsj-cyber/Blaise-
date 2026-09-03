package br.com.blaise.rj.core

import java.time.Instant

enum class ContentKind { P0_ALERT, WEATHER, RADAR, RISK, MARINE, TRAFFIC, NEWS, VOICE, SETTINGS }

object EntitlementPolicy {
    fun canAccess(content: ContentKind, entitlement: Entitlement): Boolean =
        content == ContentKind.P0_ALERT || entitlement.active
}

sealed interface ResolvedData<out T> {
    data class Network<T>(val value: T) : ResolvedData<T>
    data class Cached<T>(val value: T, val freshness: Freshness) : ResolvedData<T>
    data object Unavailable : ResolvedData<Nothing>
}

object OfflineRecoveryPolicy {
    fun <T> resolve(network: Result<T>, cache: CacheEntry<T>?, now: Instant): ResolvedData<T> {
        network.getOrNull()?.let { return ResolvedData.Network(it) }
        val cached = cache ?: return ResolvedData.Unavailable
        return when (val freshness = cached.freshness(now)) {
            Freshness.FRESH, Freshness.STALE -> ResolvedData.Cached(cached.value, freshness)
            Freshness.EXPIRED -> ResolvedData.Unavailable
        }
    }
}

object RefreshCadencePolicy {
    const val NORMAL_SECONDS = 15L * 60L
    const val SEVERE_SECONDS = 60L

    fun intervalSeconds(severity: Severity?): Long = when (severity) {
        Severity.FLASHING_YELLOW, Severity.RED, Severity.P0 -> SEVERE_SECONDS
        else -> NORMAL_SECONDS
    }
}

enum class AlertDeliveryChannel { PUSH, VIBRATION, SOUND }

data class AlertDeliveryDecision(
    val deliver: Boolean,
    val bypassEntitlement: Boolean,
    val channels: Set<AlertDeliveryChannel>,
)

object AlertNotificationPolicy {
    fun decide(alert: OfficialAlert, entitlement: Entitlement): AlertDeliveryDecision {
        val allowed = AccessPolicy.canReadAlert(alert, entitlement)
        if (!allowed) return AlertDeliveryDecision(false, false, emptySet())

        val urgent = alert.severity == Severity.RED || alert.severity == Severity.P0
        val channels = buildSet {
            add(AlertDeliveryChannel.PUSH)
            if (urgent) {
                add(AlertDeliveryChannel.VIBRATION)
                add(AlertDeliveryChannel.SOUND)
            }
        }
        return AlertDeliveryDecision(
            deliver = true,
            bypassEntitlement = alert.severity == Severity.P0,
            channels = channels,
        )
    }
}

object BulletinPolicy {
    val scheduledHours: Set<Int> = setOf(6, 12, 16)
    fun isScheduledHour(hour: Int): Boolean = hour in scheduledHours
}

object CitySelectionPolicy {
    fun isValid(cities: List<City>): Boolean =
        cities.size in 1..2 && cities.map { it.ibgeCode }.distinct().size == cities.size
}

object RetentionPolicy {
    const val SEVERE_EVENT_MAX_SECONDS = 24L * 60L * 60L
    fun withinSevereEventLimit(retentionSeconds: Long): Boolean =
        retentionSeconds in 0..SEVERE_EVENT_MAX_SECONDS
}
