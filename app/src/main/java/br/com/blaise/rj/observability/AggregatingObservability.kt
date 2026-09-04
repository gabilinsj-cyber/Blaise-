package br.com.blaise.rj.observability

import br.com.blaise.rj.data.Observability
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.LongAdder

class AggregatingObservability(
    private val allowedComponents: Set<String>,
    private val allowedMetrics: Set<String>,
) : Observability {
    private val counters = ConcurrentHashMap<String, LongAdder>()

    override fun metric(name: String, value: Number) {
        if (name !in allowedMetrics) return
        counters.computeIfAbsent("metric.$name") { LongAdder() }.add(value.toLong())
    }

    override fun error(component: String, cause: Throwable) {
        if (component !in allowedComponents) return
        counters.computeIfAbsent("error.$component") { LongAdder() }.increment()
    }

    fun snapshot(): Map<String, Long> = counters.entries.associate { (key, value) -> key to value.sum() }
}
