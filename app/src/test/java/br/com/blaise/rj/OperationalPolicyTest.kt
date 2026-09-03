package br.com.blaise.rj

import br.com.blaise.rj.core.*
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class OperationalPolicyTest {
    private val now = Instant.parse("2026-09-03T12:00:00Z")

    private fun alert(severity: Severity) = OfficialAlert(
        id = severity.name,
        city = null,
        title = "Teste",
        source = "Defesa Civil",
        severity = severity,
        issuedAt = now,
        expiresAt = now.plusSeconds(600),
    )

    @Test fun `P0 bypasses entitlement while premium content fails closed`() {
        val inactive = Entitlement(false)
        assertTrue(EntitlementPolicy.canAccess(ContentKind.P0_ALERT, inactive))
        assertFalse(EntitlementPolicy.canAccess(ContentKind.WEATHER, inactive))
        assertFalse(EntitlementPolicy.canAccess(ContentKind.VOICE, inactive))
    }

    @Test fun `offline recovery uses valid cache and rejects expired cache`() {
        val stale = CacheEntry("cached", now.minusSeconds(100), 60)
        val expired = CacheEntry("expired", now.minusSeconds(400), 60)

        val staleResult = OfflineRecoveryPolicy.resolve(Result.failure<String>(IllegalStateException("offline")), stale, now)
        assertTrue(staleResult is ResolvedData.Cached<*>)
        assertEquals(Freshness.STALE, (staleResult as ResolvedData.Cached<String>).freshness)

        val expiredResult = OfflineRecoveryPolicy.resolve(Result.failure<String>(IllegalStateException("offline")), expired, now)
        assertTrue(expiredResult is ResolvedData.Unavailable)
    }

    @Test fun `network data wins over cache`() {
        val cache = CacheEntry("cached", now, 60)
        val resolved = OfflineRecoveryPolicy.resolve(Result.success("network"), cache, now)
        assertEquals("network", (resolved as ResolvedData.Network<String>).value)
    }

    @Test fun `severe cadence is one minute and normal cadence is fifteen minutes`() {
        assertEquals(60L, RefreshCadencePolicy.intervalSeconds(Severity.P0))
        assertEquals(60L, RefreshCadencePolicy.intervalSeconds(Severity.RED))
        assertEquals(900L, RefreshCadencePolicy.intervalSeconds(Severity.GREEN))
    }

    @Test fun `P0 notification delivers without entitlement and regular alert does not`() {
        val inactive = Entitlement(false)
        val p0 = AlertNotificationPolicy.decide(alert(Severity.P0), inactive)
        assertTrue(p0.deliver)
        assertTrue(p0.bypassEntitlement)
        assertTrue(AlertDeliveryChannel.SOUND in p0.channels)

        val regular = AlertNotificationPolicy.decide(alert(Severity.YELLOW), inactive)
        assertFalse(regular.deliver)
    }

    @Test fun `bulletin city selection and retention invariants are enforced`() {
        assertEquals(setOf(6, 12, 16), BulletinPolicy.scheduledHours)
        assertTrue(CitySelectionPolicy.isValid(listOf(City("Rio de Janeiro", 3304557), City("Niterói", 3303302))))
        assertFalse(CitySelectionPolicy.isValid(listOf(City("Rio", 3304557), City("Rio", 3304557))))
        assertTrue(RetentionPolicy.withinSevereEventLimit(86_400))
        assertFalse(RetentionPolicy.withinSevereEventLimit(86_401))
    }
}
