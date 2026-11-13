package br.com.blaise.rj

import org.junit.Assert.*
import org.junit.Test

class RjAgentInventoryTest {
    @Test fun tenAgentDefinitionsMatchEstablishedRjContract() {
        val agents = RjAgentInventory.declared
        assertEquals(10, agents.size)
        assertEquals((1..10).toList(), agents.map { it.number })
        assertEquals(10, agents.map { it.title }.distinct().size)
        assertTrue(agents.all { it.responsibility.isNotBlank() && it.cadence.isNotBlank() })
    }
}
