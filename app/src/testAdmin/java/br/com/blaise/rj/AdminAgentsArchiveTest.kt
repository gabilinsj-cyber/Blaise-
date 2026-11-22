package br.com.blaise.rj

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdminAgentsArchiveTest {
    @Test fun historicalFourteenRolesAreUniqueAndNotDeployedByCatalog() {
        val roster = AdminRjAgentsArchive.entries
        assertEquals(14, roster.size)
        assertEquals((1..14).toList(), roster.map { it.number })
        assertEquals(14, roster.map { it.title }.toSet().size)
        assertTrue(AdminRjAgentsArchive.NO_AUTOMATIC_DEPLOYMENT)
        assertTrue(roster.none { it.autonomouslyRunningVerified })
        assertTrue(roster.all { it.evidenceState.isNotBlank() })
    }

    @Test fun newestRolesStayConditionalAndExcludeDomesticPublicReadings() {
        val list = AdminRjAgentsArchive.entries
        assertTrue(list.single { it.number == 13 }.responsibility.contains("quota"))
        assertTrue(list.single { it.number == 14 }.responsibility.contains("INMET só como comparação interna"))
        assertTrue(list.single { it.number == 12 }.responsibility.contains("92 municípios"))
        assertFalse(list.any { it.autonomouslyRunningVerified })
    }

    @Test fun scientificMethodCatalogIsPreservedInProtectedAdminBuild() {
        assertEquals(19, ScientificMemoryPolicy.BACKEND_REGISTERED_METHOD_COUNT)
        assertEquals(19, ScientificMemoryPolicy.backendGroups.sumOf { it.methods.size })
        assertEquals(5, ScientificMemoryPolicy.androidDerivedMethods.size)
    }
}
