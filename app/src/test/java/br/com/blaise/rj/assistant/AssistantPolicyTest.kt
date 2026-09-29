package br.com.blaise.rj.assistant

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AssistantPolicyTest {
    @Test fun `routes severe weather to alerts without claiming a live event`() {
        val answer = AssistantPolicy.answer("Tem tornado no Rio?")
        assertEquals("Alertas", answer.destination)
        assertTrue(answer.text.contains("não presume"))
    }

    @Test fun `routes rain to official map`() {
        assertEquals("Mapa", AssistantPolicy.answer("Vai chover hoje?").destination)
    }

    @Test fun `empty question stays local`() {
        val answer = AssistantPolicy.answer("   ")
        assertNull(answer.destination)
        assertTrue(answer.text.contains("Digite ou fale"))
    }
}
