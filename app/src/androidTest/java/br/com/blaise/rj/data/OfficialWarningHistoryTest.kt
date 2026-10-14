package br.com.blaise.rj.data

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test

class OfficialWarningHistoryTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val issued = Instant.parse("2026-10-14T12:00:00Z")
    private val expires = issued.plusSeconds(6 * 3600)
    private fun warning(id: String = "test-rj", sent: Instant = issued, ibge: Int = 3301900) =
        PublicRjWarning(id, "Chuva intensa", "Severe", sent, issued, expires,
            listOf(ibge), "https://apiprevmet3.inmet.gov.br/avisos/rss")

    @Before @After fun clear() {
        context.getSharedPreferences("rj_official_warning_history_v1", Context.MODE_PRIVATE)
            .edit().clear().commit()
    }

    @Test fun reopeningPreservesOfficialSeverityAndExpiryButDoesNotRenewEmission() {
        OfficialWarningHistory(context).write(listOf(warning()))
        val loaded = OfficialWarningHistory(context).read(issued.plusSeconds(4 * 3600))
        assertEquals(listOf(warning()), loaded)
        assertEquals("Severe", loaded.single().severity)
        assertEquals(issued, loaded.single().sent)
    }

    @Test fun historyDisappearsTwelveHoursAfterExpiry() {
        val store = OfficialWarningHistory(context)
        store.write(listOf(warning()))
        assertEquals(1, store.read(expires.plusSeconds(43199)).size)
        assertTrue(store.read(expires.plusSeconds(43200)).isEmpty())
        assertEquals("[]", context.getSharedPreferences("rj_official_warning_history_v1", Context.MODE_PRIVATE)
            .getString("warnings", null))
    }

    @Test fun longOfficialValidityCannotKeepOldWarningBeyondLocalTwelvePlusTwelveHours() {
        val store = OfficialWarningHistory(context)
        val long = warning().copy(expires = issued.plusSeconds(7 * 86400))
        store.write(listOf(long))
        assertEquals(listOf(long), store.read(issued.plusSeconds(86399)))
        assertTrue(store.read(issued.plusSeconds(86400)).isEmpty())
        assertTrue(store.merge(emptyList(), listOf(long), issued.plusSeconds(86400)).isEmpty())
    }

    @Test fun olderSourceResponsesCannotOverwriteNewOfficialEmission() {
        val store = OfficialWarningHistory(context)
        val renewed = warning(sent = issued.plusSeconds(3600))
        assertEquals(listOf(renewed), store.merge(listOf(renewed), listOf(warning()),
            issued.plusSeconds(4 * 3600)))
    }

    @Test fun municipalityIdentityRemainsSeparateAndInvalidRecordsAreRejected() {
        val store = OfficialWarningHistory(context)
        val rio = warning(id = "rio", ibge = 3304557)
        val itaborai = warning()
        val invalid = warning(id = "invalid", ibge = 1)
        val future = warning(id = "future", sent = issued.plusSeconds(10))
        val merged = store.merge(emptyList(), listOf(rio, itaborai, invalid, future), issued)
        assertEquals(setOf("rio", "test-rj"), merged.map { it.id }.toSet())
        assertEquals(listOf(3304557), merged.first { it.id == "rio" }.municipalityIbges)
        assertEquals(listOf(3301900), merged.first { it.id == "test-rj" }.municipalityIbges)
    }
}
