package br.com.blaise.rj

import br.com.blaise.rj.science.RjScientificCalculations
import org.junit.Assert.*
import org.junit.Test

class RjScientificIntegrationTest {

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


}
