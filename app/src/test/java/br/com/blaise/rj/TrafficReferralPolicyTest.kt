package br.com.blaise.rj

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class TrafficReferralPolicyTest {
    private val now=Instant.parse("2026-11-22T12:00:00Z")
    @Test fun missingSourceNeverClaimsTrafficIsStable() {
        assertNull(TrafficReferralPolicy.current(null,now))
        assertFalse(TrafficReferralPolicy.DIRECT_TRAFFIC_OVERLAY_ON_WEATHER_MAP)
        assertFalse(TrafficReferralPolicy.COPYING_EXTERNAL_INCIDENT_LISTS)
        assertEquals(3,TrafficReferralPolicy.officialLinks.size)
        assertTrue(TrafficReferralPolicy.officialLinks.all { it.url.startsWith("https://") })
    }
    @Test fun greenYellowRedOnlyWithFreshVerifiedBackendEvidence() {
        for(band in TrafficBand.entries){
            val reading=VerifiedTrafficCondition(
                band,"cet-rio",now.minusSeconds(60),now.minusSeconds(10),true)
            assertEquals(band,TrafficReferralPolicy.current(reading,now))
            assertNull(TrafficReferralPolicy.current(reading.copy(
                checkedAt=now.minusSeconds(1801)),now))
            assertNull(TrafficReferralPolicy.current(reading.copy(
                sourceUpdatedAt=now.minusSeconds(1801)),now))
            assertNull(TrafficReferralPolicy.current(reading.copy(
                verifiedByBackend=false),now))
            assertNull(TrafficReferralPolicy.current(reading.copy(
                sourceId="unknown"),now))
        }
        assertEquals(listOf("Trânsito estável","Atenção","Muito cuidado"),
            TrafficBand.entries.map { it.label })
    }
}
