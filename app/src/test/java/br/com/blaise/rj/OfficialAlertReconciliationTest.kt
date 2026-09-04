package br.com.blaise.rj

import br.com.blaise.rj.core.City
import br.com.blaise.rj.core.OfficialAlert
import br.com.blaise.rj.core.OfficialAlertReconciliationPolicy
import br.com.blaise.rj.core.OfficialFeedState
import br.com.blaise.rj.core.OfficialFeedStatusPolicy
import br.com.blaise.rj.core.OfficialSourceSnapshot
import br.com.blaise.rj.core.Severity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test
import java.time.Instant

class OfficialAlertReconciliationTest {
    private val now = Instant.parse("2026-09-04T12:00:00Z")

    private fun alert(
        id: String,
        source: String,
        severity: Severity = Severity.P0,
        expiresAt: Instant = now.plusSeconds(600),
    ) = OfficialAlert(
        id = id,
        city = City("Rio de Janeiro", 3304557),
        title = "Alerta oficial",
        source = source,
        severity = severity,
        issuedAt = now.minusSeconds(30),
        expiresAt = expiresAt,
    )

    private fun snapshot(
        source: String,
        alerts: List<OfficialAlert> = emptyList(),
        checkedAt: Instant = now.minusSeconds(20),
        operational: Boolean = true,
        coverageComplete: Boolean = true,
    ) = OfficialSourceSnapshot(
        source = source,
        checkedAt = checkedAt,
        alerts = alerts,
        operational = operational,
        coverageComplete = coverageComplete,
    )

    @Test fun `clear is never asserted when a required official source is missing`() {
        val evidence = OfficialAlertReconciliationPolicy.reconcile(
            requiredSources = setOf("Defesa Civil RJ", "COR.Rio"),
            snapshots = listOf(snapshot("Defesa Civil RJ")),
            now = now,
        )
        assertNull(evidence)
    }

    @Test fun `all required current complete sources may assert clear`() {
        val evidence = OfficialAlertReconciliationPolicy.reconcile(
            requiredSources = setOf("Defesa Civil RJ", "COR.Rio"),
            snapshots = listOf(snapshot("Defesa Civil RJ"), snapshot("COR.Rio")),
            now = now,
        )
        assertNotNull(evidence)
        assertEquals(0, evidence!!.activeP0Count)
        assertEquals(OfficialFeedState.CURRENT_CLEAR, OfficialFeedStatusPolicy.state(evidence, now))
    }

    @Test fun `current P0 propagates even while another required source is unavailable`() {
        val p0 = snapshot("Defesa Civil RJ", alerts = listOf(alert("p0-1", "Defesa Civil RJ")))
        val evidence = OfficialAlertReconciliationPolicy.reconcile(
            requiredSources = setOf("Defesa Civil RJ", "COR.Rio"),
            snapshots = listOf(p0),
            now = now,
        )
        assertNotNull(evidence)
        assertEquals(1, evidence!!.activeP0Count)
        assertEquals(OfficialFeedState.CURRENT_P0, OfficialFeedStatusPolicy.state(evidence, now))
    }

    @Test fun `expired P0 cannot create an active alert and cannot substitute missing coverage`() {
        val expired = snapshot(
            "Defesa Civil RJ",
            alerts = listOf(alert("p0-expired", "Defesa Civil RJ", expiresAt = now.minusSeconds(1))),
        )
        val evidence = OfficialAlertReconciliationPolicy.reconcile(
            requiredSources = setOf("Defesa Civil RJ", "COR.Rio"),
            snapshots = listOf(expired),
            now = now,
        )
        assertNull(evidence)
    }

    @Test fun `stale or non operational snapshots cannot assert clear`() {
        val stale = snapshot("Defesa Civil RJ", checkedAt = now.minusSeconds(120))
        val down = snapshot("COR.Rio", operational = false)
        val evidence = OfficialAlertReconciliationPolicy.reconcile(
            requiredSources = setOf("Defesa Civil RJ", "COR.Rio"),
            snapshots = listOf(stale, down),
            now = now,
        )
        assertNull(evidence)
    }
}
