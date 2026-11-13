package br.com.blaise.rj.assistant

import java.time.Instant
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class RjVoiceQuestionReceiptTest {
    @Test fun usesBrasiliaCalendarNotDeviceTimezone() {
        val text = RjVoiceQuestionReceipt.format(
            Instant.parse("2026-11-13T18:36:00Z"),
            Instant.parse("2026-11-13T18:36:19Z")
        )
        assertTrue(text.contains("13/11/2026 às 15:36"))
        assertTrue(text.contains("horário de Brasília"))
        assertTrue(text.contains("fontes aparecem abaixo"))
    }
    @Test fun localWeatherQueriesShowQuestionTimeWithoutClaimingCurrentObservations() {
        val text = RjVoiceQuestionReceipt.questionTime(Instant.parse("2026-11-13T18:36:00Z"))
        assertTrue(text.contains("13/11/2026 às 15:36"))
        assertTrue(text.contains("medição devem ser verificadas"))
        assertTrue(!text.contains("Consulta verificada"))
    }
    @Test fun rejectsStaleAnswerRelativeToQuestion() {
        assertThrows(IllegalArgumentException::class.java) {
            RjVoiceQuestionReceipt.format(
                Instant.parse("2026-11-13T18:36:00Z"),
                Instant.parse("2026-11-13T18:50:00Z")
            )
        }
    }
    @Test fun rejectsQuestionClockAfterAnswerBeyondTolerance() {
        assertThrows(IllegalArgumentException::class.java) {
            RjVoiceQuestionReceipt.format(
                Instant.parse("2026-11-13T18:36:00Z"),
                Instant.parse("2026-11-13T18:30:00Z")
            )
        }
    }
}
