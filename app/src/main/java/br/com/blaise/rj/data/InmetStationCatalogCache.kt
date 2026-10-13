package br.com.blaise.rj.data

/**
 * Shared in-memory cache for the INMET station CATALOG, not weather values.
 * Current municipal cards and observed hourly graphs use one bounded catalog.
 * Synchronization also prevents three parallel city-card refreshes from
 * requesting the same catalog simultaneously. A failed refresh never claims
 * stale metadata to be fresh, and measurement readings are never cached here.
 */
internal class InmetStationCatalogCache(
    private val ttlMillis: Long = 15 * 60 * 1000L,
) {
    init { require(ttlMillis in 60_000L..3_600_000L) }
    private var cachedJson: String? = null
    private var fetchedAtMillis: Long = Long.MIN_VALUE

    @Synchronized
    fun read(nowMillis: Long, fetch: () -> String): String {
        val value = cachedJson
        if (value != null && nowMillis >= fetchedAtMillis &&
            nowMillis - fetchedAtMillis <= ttlMillis) return value
        // Do not cache HTTP failures/empty responses. Parsing still validates
        // catalog shape and source ownership at each use site.
        val fresh = fetch()
        require(fresh.isNotBlank() && fresh.length <= 2 * 1024 * 1024)
        cachedJson = fresh
        fetchedAtMillis = nowMillis
        return fresh
    }
}
