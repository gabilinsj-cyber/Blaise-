package br.com.blaise.rj.science

import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Fórmulas auditáveis para RESUMO, nunca classificação de perigo ou aviso oficial.
 * Todas as saídas são nullable: medições ausentes/fora do domínio NÃO geram estimativas.
 * O chamador DEVE validar fonte, IBGE, qualidade e timestamp antes destas fórmulas.
 */
object RjScientificCalculations {
    private fun valid(t: Double, rh: Double): Boolean =
        t.isFinite() && rh.isFinite() && t in -40.0..60.0 && rh > 0.0 && rh <= 100.0

    /** Magnus (água líquida), válido de forma aproximada no domínio declarado. */
    fun dewPointC(temperatureC: Double, humidityPercent: Double): Double? {
        if (!valid(temperatureC, humidityPercent) || temperatureC < 0.0 || temperatureC > 50.0) return null
        val gamma = ln(humidityPercent / 100.0) + (17.625 * temperatureC) / (243.04 + temperatureC)
        val result = 243.04 * gamma / (17.625 - gamma)
        return result.takeIf { it.isFinite() && it <= temperatureC + 1e-6 }
    }

    /** Tetens; déficit positivo em kPa, depende de T e UR da mesma observação. */
    fun vaporPressureDeficitKpa(temperatureC: Double, humidityPercent: Double): Double? {
        if (!valid(temperatureC, humidityPercent)) return null
        val saturationKpa = 0.6108 * exp(17.27 * temperatureC / (temperatureC + 237.3))
        return (saturationKpa * (1.0 - humidityPercent / 100.0)).takeIf { it.isFinite() && it >= 0.0 }
    }

    /** Rothfusz / NWS; retorna null se fora do domínio (T >= 26,7 ºC). */
    fun heatIndexC(temperatureC: Double, humidityPercent: Double): Double? {
        if (!valid(temperatureC, humidityPercent) || temperatureC < 26.7 || temperatureC > 50.0) return null
        val t = temperatureC * 9.0 / 5.0 + 32.0
        val r = humidityPercent
        var f = -42.379 + 2.04901523 * t + 10.14333127 * r -
            0.22475541 * t * r - 0.00683783 * t * t - 0.05481717 * r * r +
            0.00122874 * t * t * r + 0.00085282 * t * r * r -
            0.00000199 * t * t * r * r
        if (r < 13.0 && t in 80.0..112.0) {
            f -= (13.0 - r) / 4.0 * sqrt((17.0 - kotlin.math.abs(t - 95.0)) / 17.0)
        } else if (r > 85.0 && t in 80.0..87.0) {
            f += (r - 85.0) / 10.0 * (87.0 - t) / 5.0
        }
        return ((f - 32.0) * 5.0 / 9.0).takeIf { it.isFinite() && it >= temperatureC - 8.0 }
    }

    /** Índice de frio canadense: T <= 10 ºC, 4.8 < vento <= 150 km/h. */
    fun windChillC(temperatureC: Double, windKmh: Double): Double? {
        if (!temperatureC.isFinite() || !windKmh.isFinite() ||
            temperatureC !in -50.0..10.0 || windKmh <= 4.8 || windKmh > 150.0) return null
        val p = windKmh.pow(0.16)
        return (13.12 + 0.6215 * temperatureC - 11.37 * p + 0.3965 * temperatureC * p)
            .takeIf { it.isFinite() }
    }

    /** Stull 2011: APROXIMAÇÃO de bulbo úmido, não substitui psicrômetro. */
    fun wetBulbApproxC(temperatureC: Double, humidityPercent: Double): Double? {
        if (!valid(temperatureC, humidityPercent) ||
            temperatureC !in 0.0..50.0 || humidityPercent !in 5.0..99.0) return null
        val rh = humidityPercent
        val t = temperatureC
        val result = t * kotlin.math.atan(0.151977 * sqrt(rh + 8.313659)) +
            kotlin.math.atan(t + rh) - kotlin.math.atan(rh - 1.676331) +
            0.00391838 * rh.pow(1.5) * kotlin.math.atan(0.023101 * rh) - 4.686035
        return result.takeIf { it.isFinite() && it <= temperatureC + 1.0 }
    }
}
