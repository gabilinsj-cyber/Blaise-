package br.com.blaise.rj

import androidx.test.ext.junit.runners.AndroidJUnit4
import br.com.blaise.rj.core.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant

@RunWith(AndroidJUnit4::class)
class RuntimePolicyInstrumentedTest {
    private val now = Instant.parse("2026-09-03T12:00:00Z")

    @Test fun p0AndPremiumEntitlementRulesRunOnDevice() {
        val inactive = Entitlement(false)
        assertTrue(EntitlementPolicy.canAccess(ContentKind.P0_ALERT, inactive))
        assertFalse(EntitlementPolicy.canAccess(ContentKind.WEATHER, inactive))
        assertFalse(EntitlementPolicy.canAccess(ContentKind.NEWS, inactive))
    }

    @Test fun offlineRecoveryPolicyRunsOnDevice() {
        val cache = CacheEntry("cached-weather", now.minusSeconds(90), 60)
        val resolved = OfflineRecoveryPolicy.resolve(
            Result.failure<String>(IllegalStateException("network unavailable")),
            cache,
            now,
        )
        assertTrue(resolved is ResolvedData.Cached<*>)
        assertEquals(Freshness.STALE, (resolved as ResolvedData.Cached<String>).freshness)
    }

    @Test fun expiredCacheFailsClosedOnDevice() {
        val cache = CacheEntry("old", now.minusSeconds(500), 60)
        val resolved = OfflineRecoveryPolicy.resolve(
            Result.failure<String>(IllegalStateException("network unavailable")),
            cache,
            now,
        )
        assertTrue(resolved is ResolvedData.Unavailable)
    }

    @Test fun p0NotificationBypassesEntitlementOnDevice() {
        val alert = OfficialAlert(
            "p0-device", null, "Emergência", "Defesa Civil", Severity.P0,
            now, now.plusSeconds(600),
        )
        val decision = AlertNotificationPolicy.decide(alert, Entitlement(false))
        assertTrue(decision.deliver)
        assertTrue(decision.bypassEntitlement)
        assertEquals(
            setOf(AlertDeliveryChannel.PUSH, AlertDeliveryChannel.VIBRATION, AlertDeliveryChannel.SOUND),
            decision.channels,
        )
    }

    @Test fun operationalCadencesRunOnDevice() {
        assertEquals(60L, RefreshCadencePolicy.intervalSeconds(Severity.RED))
        assertEquals(900L, RefreshCadencePolicy.intervalSeconds(null))
        assertTrue(BulletinPolicy.isScheduledHour(6))
        assertTrue(BulletinPolicy.isScheduledHour(12))
        assertTrue(BulletinPolicy.isScheduledHour(16))
    }
}
