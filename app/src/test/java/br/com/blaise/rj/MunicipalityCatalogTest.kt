package br.com.blaise.rj

import br.com.blaise.rj.cities.RioMunicipalities
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MunicipalityCatalogTest {
    @Test fun catalogContainsExactly92UniqueOfficialMunicipalities() {
        assertEquals(92, RioMunicipalities.all.size)
        assertEquals(92, RioMunicipalities.all.map { it.name }.toSet().size)
        assertEquals(92, RioMunicipalities.all.map { it.ibgeCode }.toSet().size)
    }

    @Test fun keyMunicipalitiesUseOfficialIbgeCodes() {
        assertEquals("Rio de Janeiro", RioMunicipalities.byIbgeCode(3304557)?.name)
        assertEquals("Niterói", RioMunicipalities.byIbgeCode(3303302)?.name)
        assertEquals("São Gonçalo", RioMunicipalities.byIbgeCode(3304904)?.name)
    }

    @Test fun searchIsAccentInsensitive() {
        val result = RioMunicipalities.search("sao goncalo")
        assertTrue(result.any { it.ibgeCode == 3304904 && it.name == "São Gonçalo" })
    }
}
