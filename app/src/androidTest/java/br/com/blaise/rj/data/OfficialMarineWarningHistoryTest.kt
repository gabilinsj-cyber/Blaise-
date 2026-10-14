package br.com.blaise.rj.data

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test

class OfficialMarineWarningHistoryTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val issued = Instant.parse("2026-10-14T12:00:00Z")
    private val warning = PublicRjMarineWarning("321/2026", "AVISO DE VENTO FORTE", issued,
        issued.plusSeconds(48 * 3600), listOf("ALFA"), null, null, null, false)
    @Before @After fun clear() {
        context.getSharedPreferences("rj_marine_warning_history_v1", Context.MODE_PRIVATE)
            .edit().clear().commit()
    }
    @Test fun archiveSurvivesReopeningAndIsDeletedExactlyAtTwentyFourHours() {
        OfficialMarineWarningHistory(context).write(listOf(warning))
        val reopened = OfficialMarineWarningHistory(context)
        assertEquals(listOf(warning), reopened.read(issued.plusSeconds(12 * 3600)))
        assertEquals(listOf(warning), reopened.read(issued.plusSeconds(86399)))
        assertTrue(reopened.read(issued.plusSeconds(86400)).isEmpty())
        assertEquals("[]", context.getSharedPreferences("rj_marine_warning_history_v1", Context.MODE_PRIVATE)
            .getString("warnings", null))
    }
    @Test fun unchangedMarineNoticeCannotReviveAfterExpiryButNewEmissionCan() {
        val store = OfficialMarineWarningHistory(context)
        val now = issued.plusSeconds(86400)
        assertTrue(store.merge(emptyList(), listOf(warning), now).isEmpty())
        val update = warning.copy(issuedAt = now)
        assertEquals(listOf(update), store.merge(listOf(warning), listOf(update), now))
    }
    @Test fun earlierOfficialExpiryStartsTheTwelveHourHistoryEarlier() {
        val early = warning.copy(validUntil = issued.plusSeconds(3600))
        val store = OfficialMarineWarningHistory(context)
        store.write(listOf(early))
        assertEquals(listOf(early), store.read(issued.plusSeconds(13 * 3600 - 1)))
        assertTrue(store.read(issued.plusSeconds(13 * 3600)).isEmpty())
    }
}
