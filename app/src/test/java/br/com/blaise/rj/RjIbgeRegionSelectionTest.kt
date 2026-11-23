package br.com.blaise.rj

import br.com.blaise.rj.data.RjIbgeRegionIndex
import br.com.blaise.rj.data.RjIbgeRegions
import br.com.blaise.rj.cities.RioMunicipalities
import org.junit.Assert.*
import org.junit.Test

class RjIbgeRegionSelectionTest {
    @Test fun all92MunicipalitiesAreListedAndRegionIndexUsesOfficialEndpoint() {
        assertEquals(92,RioMunicipalities.all.size)
        assertEquals(92,RioMunicipalities.all.map { it.ibgeCode }.toSet().size)
        assertEquals("https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios",
            RjIbgeRegions.URL_IBGE)
    }
    @Test fun regionMembershipDoesNotInventCodes() {
        val data=RjIbgeRegionIndex(mapOf(3304557 to "Rio de Janeiro",
            3303302 to "Rio de Janeiro",3303906 to "Petrópolis"))
        assertEquals(setOf(3304557,3303302),data.municipalitiesIn("Rio de Janeiro"))
        assertEquals(setOf(3303906),data.municipalitiesIn("Petrópolis"))
        assertTrue(data.municipalitiesIn("Não cadastrada").isEmpty())
    }
}
