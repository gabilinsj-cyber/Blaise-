package br.com.blaise.rj.core

object AccessPolicy {
    fun canReadAlert(alert: OfficialAlert, entitlement: Entitlement): Boolean =
        alert.severity == Severity.P0 || entitlement.active
}

data class SourceEndpoint(val name: String, val priority: Int, val official: Boolean)

object FailoverPolicy {
    fun ordered(sources: Collection<SourceEndpoint>): List<SourceEndpoint> =
        sources.sortedWith(compareByDescending<SourceEndpoint> { it.official }.thenBy { it.priority })
}

