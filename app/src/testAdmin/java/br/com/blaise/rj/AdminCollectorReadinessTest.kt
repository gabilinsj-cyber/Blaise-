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

    @Test fun meteoblueSevenBasic6hFieldsStayPrivateAndUnaudited() {
        val fields = AdminCollectorReadiness.meteoblueFieldAudit
        assertEquals(7, fields.size)
        assertEquals(setOf(
            "precipitation", "convective_precipitation", "precipitation_probability",
            "windspeed_mean", "windspeed_max", "relativehumidity_mean",
            "sealevelpressure_mean"
        ), fields.map { it.jsonKey }.toSet())
        assertTrue(fields.none { it.auditedLiveValue })
        assertTrue(fields.all { it.unit in setOf("mm", "%", "km/h", "hPa") })
        assertTrue(fields.single { it.jsonKey == "windspeed_max" }
            .meaning.contains("NÃO RAJADA OBSERVADA"))
        assertFalse(AdminCollectorReadiness.METEOBLUE_PRIVATE_COLLECTOR_ENABLED)
        assertFalse(AdminCollectorReadiness.METEOBLUE_PUBLISHED_TO_SUBSCRIBERS)
        assertEquals(null, AdminCollectorReadiness.meteoblueCurrentProviderCredits)
        assertEquals(null, AdminCollectorReadiness.meteoblueActualLocalCreditsReserved)
        assertEquals(24, AdminCollectorReadiness.METEOBLUE_MUNICIPAL_COOLDOWN_HOURS)
        assertEquals(6, AdminCollectorReadiness.METEOBLUE_CACHE_HOURS)
    }

    @Test fun meteoblueScreenshotDoesNotConfuseDailyCapWithRealBalance() {
        val x = AdminCollectorReadiness
        assertEquals(4_000, x.METEOBLUE_PROVIDER_USED_IN_SELECTED_PERIOD)
        assertEquals(10_000_000, x.METEOBLUE_KEY_DAILY_LIMIT_OBSERVED)
        assertEquals(4_000, x.METEOBLUE_KEY_CAP_FOR_SINGLE_PRIVATE_AUDIT)
        assertEquals(4_000, x.METEOBLUE_KEY_DAILY_LIMIT_OPERATOR_REPORTED_SAVED)
        assertFalse(x.METEOBLUE_KEY_CURRENT_LIMIT_VERIFIED_BY_API)
        assertTrue(x.METEOBLUE_KEY_EXPOSED_REQUIRES_ROTATION)
        assertEquals(null, x.meteoblueCurrentProviderCredits)
        assertEquals(null, x.meteoblueActualLocalCreditsReserved)
        assertFalse(x.METEOBLUE_PRIVATE_COLLECTOR_ENABLED)
        assertFalse(x.METEOBLUE_PUBLISHED_TO_SUBSCRIBERS)
    }

    @Test fun meteoblueLocalBudgetDoesNotPretendToKnowRealProviderBalance() {
        val x = AdminCollectorReadiness
        assertEquals(10_000_000, x.METEOBLUE_TOTAL_TRIAL_CREDITS)
        assertEquals(8_000_000, x.METEOBLUE_LOCAL_CEILING_CREDITS)
        assertEquals(4_000, x.METEOBLUE_COST_PER_BASIC_6H_REQUEST)
        assertEquals(1, x.METEOBLUE_MAX_REQUESTS_PER_UTC_DAY)
        val mb = x.integrations.single { it.id == "METEOBLUE_FREE_FORECAST" }
        assertTrue(mb.state.contains("SALDO DO FORNECEDOR NÃO CONSULTADO"))
        assertFalse(mb.publishingToSubscribers)
        assertTrue(mb.explanation.contains("sete campos numéricos"))
    }
}
