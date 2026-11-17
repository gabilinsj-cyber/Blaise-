package br.com.blaise.rj

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class ScientificMemoryPolicyTest {
    private val now = Instant.parse("2026-11-17T16:00:00Z")
    private fun source(sourceId: String = "ECMWF_IFS", verified: Boolean = true) =
        BlaiseScientificInput(
            municipalityIbge = "3304557", sourceId = sourceId,
            sourceUrl = "https://www.ecmwf.int/",
            nature = "P", temperatureC = 30.0, humidityPercent = 70.0,
            windKmh = 10.0, validAt = Instant.parse("2026-11-17T15:58:00Z"),
            checkedAt = Instant.parse("2026-11-17T15:59:00Z"),
            verifiedByBackend = verified, licensedForCommercialUse = true,
            municipalityGeoVerified = true,
        )

    @Test fun nineteenRegisteredKernelsAreUniqueAndNoDataIsInvented() {
        val methods = ScientificMemoryPolicy.backendGroups.flatMap { it.methods }
        assertEquals(19, methods.size)
        assertEquals(19, methods.toSet().size)
        assertTrue(ScientificMemoryPolicy.calculate(null, now).isEmpty())
    }

    @Test fun calculationUsesOnlyTimestampedInternationalInputs() {
        val values = ScientificMemoryPolicy.calculate(source(), now)
        assertEquals(4, values.size)
        assertEquals("Magnus", values.first().method)
        assertTrue(values.first().value in 8.0..30.0)
        assertTrue(values.any { it.method == "VPD" })
        assertTrue(values.any { it.method == "Rothfusz" })
        assertTrue(values.all { !it.officialMeasurement && !it.officialAlert && !it.mayTriggerAlert })
    }

    @Test fun domesticStaleOrUnauditedSourceFailsClosed() {
        assertTrue(ScientificMemoryPolicy.calculate(source("INMET"), now).isEmpty())
        assertTrue(ScientificMemoryPolicy.calculate(source(verified = false), now).isEmpty())
        assertTrue(ScientificMemoryPolicy.calculate(source(),
            Instant.parse("2026-11-18T16:00:00Z")).isEmpty())
    }
    @Test fun manualInputsRemainNonOfficialAndRejectInvalidNumbers() {
        assertTrue(ScientificMemoryPolicy.calculateManualInputs(null, 70.0, null).isEmpty())
        assertTrue(ScientificMemoryPolicy.calculateManualInputs(30.0, Double.NaN, null).isEmpty())
        assertTrue(ScientificMemoryPolicy.calculateManualInputs(30.0, 70.0, -1.0).isEmpty())
        val values = ScientificMemoryPolicy.calculateManualInputs(30.0, 70.0, 10.0)
        assertTrue(values.any { it.method == "Magnus" })
        assertTrue(values.any { it.method == "VPD" })
        assertTrue(values.any { it.method == "Stull" })
        assertTrue(values.any { it.method == "Rothfusz" })
        assertTrue(values.all { !it.officialMeasurement && !it.officialAlert && !it.mayTriggerAlert })
        assertTrue(values.all { it.nature.contains("MANUAL") })
    }

    @Test fun coldManualInputsRespectWindChillDomain() {
        val cold = ScientificMemoryPolicy.calculateManualInputs(5.0, 60.0, 16.0)
        assertTrue(cold.any { it.method == "Wind chill" })
        val mild = ScientificMemoryPolicy.calculateManualInputs(19.0, 50.0, null)
        assertFalse(mild.any { it.method == "Wind chill" || it.method == "Rothfusz" })
    }

}
