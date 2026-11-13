package br.com.blaise.rj

import br.com.blaise.rj.science.RjScientificCalculations
import java.time.Duration
import java.time.Instant
import org.junit.Assert.*
import org.junit.Test

class RjScientificIntegrationTest {
    private val now = Instant.parse("2026-11-13T12:00:00Z")

    @Test fun excludedSourcesNeverValidate() {
        listOf("INEA", "Marinha do Brasil", "CHM", "Windy", "Copernicus").forEach {
            assertFalse(it, RjOperationalPolicy.mayUseSource(it))
            assertFalse(it, RjOperationalPolicy.mayShowObservation(it, now, now, Duration.ofMinutes(15)))
        }
        assertTrue(RjOperationalPolicy.mayShowObservation("INMET", now.minusSeconds(60), now, Duration.ofMinutes(15)))
    }

    @Test fun rejectsFutureStaleAndUnidentifiedSource() {
        assertFalse(RjOperationalPolicy.mayShowObservation("INMET", now.plusSeconds(5), now, Duration.ofMinutes(15)))
        assertFalse(RjOperationalPolicy.mayShowObservation("INMET", now.minusSeconds(901), now, Duration.ofMinutes(15)))
        assertFalse(RjOperationalPolicy.mayShowObservation("INMET", null, now, Duration.ofMinutes(15)))
        assertFalse(RjOperationalPolicy.mayUseSource("Fonte desconhecida"))
    }

    @Test fun calculationsFailClosedOnInvalidInputs() {
        assertNull(RjScientificCalculations.dewPointC(Double.NaN, 80.0))
        assertNull(RjScientificCalculations.dewPointC(20.0, 0.0))
        assertNull(RjScientificCalculations.heatIndexC(10.0, 70.0))
        assertNull(RjScientificCalculations.windChillC(25.0, 12.0))
        assertNull(RjScientificCalculations.wetBulbApproxC(30.0, 0.0))
    }

    @Test fun formulaReferenceSanityChecks() {
        assertEquals(30.0, RjScientificCalculations.dewPointC(30.0, 100.0)!!, 0.001)
        assertTrue(RjScientificCalculations.heatIndexC(32.0, 70.0)!! > 32.0)
        assertTrue(RjScientificCalculations.windChillC(5.0, 20.0)!! < 5.0)
        assertEquals(0.0, RjScientificCalculations.vaporPressureDeficitKpa(30.0, 100.0)!!, 1e-9)
        assertTrue(RjScientificCalculations.wetBulbApproxC(30.0, 70.0)!! < 30.0)
    }

    @Test fun priorityPreservesP0AndLocalExpiration() {
        assertTrue(RjOperationalPolicy.mayDeliverOfficialP0(false))
        assertFalse(RjOperationalPolicy.mayDeliverPremium(false))
        assertEquals(25_000L, RjOperationalPolicy.suggestedRefreshMs(5, doubleRed = true))
        assertEquals(RjOperationalPolicy.LocalAlertState.REMOVE,
            RjOperationalPolicy.localAlertState(now.minus(Duration.ofHours(12)), now, false))
        assertEquals(RjOperationalPolicy.LocalAlertState.EXPIRED_IN_REVIEW,
            RjOperationalPolicy.localAlertState(now.minus(Duration.ofHours(3)), now, false))
    }
}
