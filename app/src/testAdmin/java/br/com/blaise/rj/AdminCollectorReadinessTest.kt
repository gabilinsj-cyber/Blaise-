package br.com.blaise.rj

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdminCollectorReadinessTest {
    @Test fun integrationSnapshotIsPrivatePlanningNotLiveData() {
        val x = AdminCollectorReadiness
        assertEquals(92, x.RJ_MUNICIPALITIES)
        assertEquals(7, x.integrations.size)
        assertTrue(x.integrations.none { it.publishingToSubscribers })
        assertTrue(x.integrations.none { it.paidSubscriptionActive })
        assertTrue(x.integrations.all { it.state.isNotBlank() && it.explanation.isNotBlank() })
        assertFalse(x.integrations.any { it.title.contains("EUMETSAT", ignoreCase = true) })
    }

    @Test fun hgProWrittenPermissionDoesNotActivatePaidSubscription() {
        val x = AdminCollectorReadiness
        assertEquals(49.90, x.HG_PRO_ADVERTISED_PRICE_BRL, 0.0001)
        assertEquals(100, x.HG_PRO_CITY_LIMIT)
        assertEquals(20_000, x.HG_PRO_DAILY_LIMIT)
        assertEquals(2_208, x.HG_PLANNED_CALLS_PER_DAY)
        val hg = x.integrations.single { it.id == "HG_BRASIL_WEATHER_PRO" }
        assertTrue(hg.state.contains("SEM CONTRATAÇÃO"))
        assertFalse(hg.paidSubscriptionActive)
        assertFalse(hg.publishingToSubscribers)
        assertTrue(hg.explanation.contains("estação original"))
    }

    @Test fun meteoblueLocalBudgetDoesNotPretendToKnowRealProviderBalance() {
        val x = AdminCollectorReadiness
        assertEquals(10_000_000, x.METEOBLUE_TOTAL_TRIAL_CREDITS)
        assertEquals(8_000_000, x.METEOBLUE_LOCAL_CEILING_CREDITS)
        assertEquals(4_000, x.METEOBLUE_COST_PER_BASIC_6H_REQUEST)
        assertEquals(4, x.METEOBLUE_MAX_REQUESTS_PER_UTC_DAY)
        val mb = x.integrations.single { it.id == "METEOBLUE_FREE_FORECAST" }
        assertTrue(mb.state.contains("SALDO DO FORNECEDOR NÃO CONSULTADO"))
        assertFalse(mb.publishingToSubscribers)
        assertTrue(mb.explanation.contains("sete campos numéricos"))
    }
}
