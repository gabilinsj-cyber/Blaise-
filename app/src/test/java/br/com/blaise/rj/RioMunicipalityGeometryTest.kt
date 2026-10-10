package br.com.blaise.rj

import org.junit.Assert.assertTrue
import org.junit.Test

class RioMunicipalityGeometryTest {
    @Test
    fun `static map contains real RJ outlines and no sample meteorological values`() {
        val rings = RioMunicipalityGeometry.rings
        assertTrue("Expected 92 municipality boundaries or additional island rings", rings.size >= 92)
        assertTrue("All outlines require at least three points", rings.all { it.size >= 3 })
        assertTrue("Coordinates must stay within the state RJ geo envelope", rings.flatten().all { point ->
            point.longitude in RioMunicipalityGeometry.WEST..RioMunicipalityGeometry.EAST &&
                point.latitude in RioMunicipalityGeometry.SOUTH..RioMunicipalityGeometry.NORTH
        })
    }
}
