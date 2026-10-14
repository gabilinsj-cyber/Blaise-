package br.com.blaise.rj.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class InmetStationCatalogCacheTest {
    @Test fun sameCatalogIsReusedUntilTtlButNeverStationMeasurements() {
        val cache = InmetStationCatalogCache(ttlMillis = 60_000L)
        var calls = 0
        val get = {
            calls++
            "[{\"SG_ENTIDADE\":\"INMET\",\"CD_ESTACAO\":\"A652\"}]"
        }
        assertEquals(get(), cache.read(100_000L, get))
        assertEquals(2, calls)
        cache.read(120_000L, get)
        cache.read(159_000L, get)
        assertEquals(2, calls)
        cache.read(160_001L, get)
        assertEquals(3, calls)
    }

    @Test fun failuresAreNeverCachedAsValidCatalog() {
        val cache = InmetStationCatalogCache(ttlMillis = 60_000L)
        assertThrows(IllegalArgumentException::class.java) {
            cache.read(1_000L) { "" }
        }
        var calls = 0
        val response = cache.read(1_001L) { calls++; "[]" }
        assertEquals("[]", response)
        assertEquals(1, calls)
    }

    @Test fun simultaneousCallersShareSingleCatalogFetch() {
        val cache = InmetStationCatalogCache(ttlMillis = 60_000L)
        val count = java.util.concurrent.atomic.AtomicInteger(0)
        val threads = (1..10).map {
            Thread {
                cache.read(1_000L) {
                    count.incrementAndGet()
                    Thread.sleep(5L)
                    "[]"
                }
            }
        }
        threads.forEach(Thread::start)
        threads.forEach(Thread::join)
        assertEquals(1, count.get())
    }

    @Test fun staleCatalogNotReusedAfterTtlWhenSourceFails() {
        val cache = InmetStationCatalogCache(ttlMillis = 60_000L)
        cache.read(1_000L) { "[]" }
        assertThrows(IllegalStateException::class.java) {
            cache.read(70_000L) { error("network down") }
        }
        assertEquals("[]", cache.read(70_001L) { "[]" })
    }
}
