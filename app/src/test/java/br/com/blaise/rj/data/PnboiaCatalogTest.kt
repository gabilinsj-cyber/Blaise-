package br.com.blaise.rj.data

import org.junit.Assert.*
import org.junit.Test

class PnboiaCatalogTest {
    private val caboFrio = PnboiaStation(48, "WATCHKEEPER CABO FRIO", "Cabo Frio, RJ",
        "FUNDEADA", "REMOBS", -23.582, -42.1711, null)

    @Test fun `catalog includes RJ offshore station without claiming sensor readings`() {
        assertTrue(caboFrio.eligibleForRjCatalog())
        assertTrue(caboFrio.statusLabel().contains("sensores ainda não validados"))
        assertNull(caboFrio.lastRecordAt)
    }
    @Test fun `test benches and other states never enter RJ catalog`() {
        assertFalse(caboFrio.copy(id = 101).eligibleForRjCatalog())
        assertFalse(caboFrio.copy(mode = "TESTES").eligibleForRjCatalog())
        assertFalse(caboFrio.copy(local = "Santos, SP").eligibleForRjCatalog())
        assertFalse(caboFrio.copy(latitude = Double.NaN).eligibleForRjCatalog())
        assertFalse(caboFrio.copy(longitude = -10.0).eligibleForRjCatalog())
        assertFalse(caboFrio.copy(project = "OTHER").eligibleForRjCatalog())
    }
    @Test fun `inactive and unknown status do not become active sea conditions`() {
        assertEquals("Em manutenção", caboFrio.copy(mode = "MANUTENCAO").statusLabel())
        assertEquals("Inoperante", caboFrio.copy(mode = "INOPERANTE").statusLabel())
        assertEquals("Situação não confirmada", caboFrio.copy(mode = "NEW").statusLabel())
    }
}
