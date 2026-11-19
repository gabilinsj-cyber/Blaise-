package br.com.blaise.rj

import java.time.Instant
import org.junit.Assert.*
import org.junit.Test

class AdminMeteorologicalMemoryClientTest {
    @Test fun backendEndpointDerivationRejectsOtherHostsProtocolsAndTokens() {
        assertEquals("https://rj.example.org/v1/admin/meteorological-memory",
            AdminMeteorologicalMemoryClient.endpointFromVerifier(
                "https://rj.example.org/v1/entitlements/verify"))
        for (bad in listOf(
            "", "http://rj.example.org/v1/entitlements/verify",
            "https://rj.example.org/v1/entitlements/verify?apikey=secret",
            "https://someone@rj.example.org/v1/entitlements/verify",
            "https://rj.example.org/v1/admin/meteorological-memory",
            "https://rj.example.org/v1/entitlements/verify#fragment"
        )) assertNull(AdminMeteorologicalMemoryClient.endpointFromVerifier(bad))
    }

    @Test fun adminMemoryValuesOnlyReadWhenFreshAndAllSevenArePresent() {
        val now = Instant.parse("2026-11-19T13:00:00Z")
        val basic = AdminMeteorologicalMemorySnapshot(
            evaluatedAt=now.minusSeconds(20),
            cacheState="PRIVATE_CACHE_VALID",
            forecastValidAt=now.plusSeconds(3600),
            modelRun=now.minusSeconds(1800),
            fields=(1..7).map{index->
                AdminMeteorologicalMemoryField("f$index", "Campo $index", index.toDouble(), "%")
            },
            sourceStates=listOf("meteoblue" to "PRIVATE_CACHE_VALID"),
            localCreditsReserved=4000,
            reservedCallsToday=1,
        )
        assertTrue(basic.readable(now))
        assertFalse(basic.copy(evaluatedAt=now.minusSeconds(200)).readable(now))
        assertFalse(basic.copy(forecastValidAt=now.minusSeconds(1)).readable(now))
        assertFalse(basic.copy(forecastValidAt=now.plusSeconds(25_000)).readable(now))
        assertFalse(basic.copy(fields=basic.fields.drop(1)).readable(now))
        assertFalse(basic.copy(cacheState="INDISPONIVEL").readable(now))
        assertFalse(basic.providerCreditBalanceVerified)
        val wave=basic.copy(
            noaaWaveHeightM=1.35,
            noaaWaveValidAt=now.minusSeconds(900)
        )
        assertTrue(wave.noaaWaveReadable(now))
        assertFalse(wave.copy(noaaWaveValidAt=now.minusSeconds(4000)).noaaWaveReadable(now))
        assertFalse(wave.copy(noaaWaveHeightM=null).noaaWaveReadable(now))
        assertFalse(wave.copy(evaluatedAt=now.minusSeconds(300)).noaaWaveReadable(now))
    }
}
