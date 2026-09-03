package br.com.blaise.rj.core

import java.time.Instant

enum class Severity { GREEN, YELLOW, FLASHING_YELLOW, RED, P0 }
enum class Freshness { FRESH, STALE, EXPIRED }

data class City(val name: String, val ibgeCode: Int)
data class OfficialAlert(
    val id: String,
    val city: City?,
    val title: String,
    val source: String,
    val severity: Severity,
    val issuedAt: Instant,
    val expiresAt: Instant,
)
data class Entitlement(val active: Boolean)
data class CacheEntry<T>(val value: T, val fetchedAt: Instant, val maxAgeSeconds: Long) {
    fun freshness(now: Instant): Freshness {
        val age = now.epochSecond - fetchedAt.epochSecond
        return when {
            age <= maxAgeSeconds -> Freshness.FRESH
            age <= maxAgeSeconds * 3 -> Freshness.STALE
            else -> Freshness.EXPIRED
        }
    }
}

