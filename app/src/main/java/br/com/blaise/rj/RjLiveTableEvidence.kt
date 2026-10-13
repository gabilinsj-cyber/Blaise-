package br.com.blaise.rj

import br.com.blaise.rj.data.CityWeatherObservation
import br.com.blaise.rj.data.PublicRjMarine
import br.com.blaise.rj.data.PublicRjMarineWarning
import br.com.blaise.rj.data.PublicRjStatus
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** UI projection of actual validated observations; no independent network or invented forecasts. */
data class RjLiveEvidence(
    val state: String,
    val description: String,
    val source: String? = null,
    val observedAt: Instant? = null,
    val calculation: Boolean = false,
    val mayPublishAlert: Boolean = false,
)

object RjLiveTableEvidence {
    const val UNAVAILABLE = "Sem leitura atual validada para este município ou produto"
    private val brasilia = ZoneId.of("America/Sao_Paulo")
    private fun numeric(value: Double, unit: String) =
        String.format(Locale("pt", "BR"), "%.1f %s", value, unit)
    fun localTime(instant: Instant) =
        instant.atZone(brasilia).format(DateTimeFormatter.ofPattern("dd/MM HH:mm")) + " (Brasília)"

    fun calculationCriteria(phenomenon: String): String = when(phenomenon) {
        "TEMPERATURA","UMIDADE","VENTO","RAJADA","CHUVA_ATUAL",
        "CHUVA_ACUMULADA","PRESSAO_ATMOSFERICA" ->
            "Média: Σ(peso × medição)/Σ(pesos), apenas duas fontes independentes com mesma grandeza, janela e área; pesos comprovados. Senão, uma leitura pontual ou duas fontes identificadas."
        "SENSACAO_TERMICA" ->
            "Calcular sensação térmica com temperatura e umidade (Rothfusz no calor) ou temperatura e vento (vento-frio no frio), somente no domínio da fórmula. Nunca média de índices."
        "CICLONE_EXTRATROPICAL","MASSA_AR","FRENTE_FRIA","CHUVA_ATLANTICO" ->
            "Advecção x(t)=x₀+v×t, tendência da pressão e vento por grades/perfis temporais válidos; ETA é estimativa com incerteza e não afirma impacto."
        "ONDAS","SWELL","RESSACA" ->
            "Altura, período e direção com produto/boia compatível; velocidade/propagação por teoria de ondas somente com profundidade e período validados. Aviso CHM prevalece."
        "MARE","CORRENTES_MARINHAS","TEMPERATURA_MAR" ->
            "Produto marítimo espacial/temporal adequado; não misturar maré prevista, nível observado, corrente e temperatura do mar."
        "TSUNAMI","SISMO" ->
            "Não calcular média de magnitudes, alarmes ou avisos. Conferir autoridade marítima, rede sísmica e vigência oficial."
        else ->
            "Verificar fonte, município, área, horário e qualidade; cálculos físicos e alertas oficiais são processos separados."
    }

    fun municipality(
        phenomenon: String,
        municipalityIbge: Int,
        observation: CityWeatherObservation?,
        public: PublicRjStatus?,
        now: Instant,
    ): RjLiveEvidence {
        require(RjMeteorologicalTables.table1.any { it.code == phenomenon })
        val valid = observation?.takeIf {
            it.municipalityIbge == municipalityIbge && it.current(now) &&
                (it.source == "INMET" || it.source == "Alerta Rio") &&
                (it.source != "Alerta Rio" || municipalityIbge == 3304557)
        }
        fun station(value: Double?, units: String, detail: String): RjLiveEvidence? =
            value?.takeIf { it.isFinite() }?.let {
                RjLiveEvidence("OBSERVACAO_PONTUAL",
                    "${numeric(it, units)} • ${detail} • estação ${valid!!.station}",
                    valid.source,valid.observedAt)
            }
        val weather = when(phenomenon) {
            "TEMPERATURA" -> station(valid?.temperatureC, "°C", "temperatura medida")
            "UMIDADE" -> station(valid?.humidityPercent, "%", "umidade medida")
            "VENTO" -> station(valid?.windKmh, "km/h", "vento médio medido")
            "RAJADA" -> station(valid?.windGustKmh, "km/h", "rajada medida")
            "CHUVA_ACUMULADA" -> station(valid?.hourlyRainMm, "mm", "acumulado da última hora, não 24 h")
            "CHUVA_ATUAL" -> station(valid?.hourlyRainMm, "mm", "última hora; não comprova chuva neste instante")
            "SENSACAO_TERMICA" -> {
                val computed=ScientificDashboardPolicy.derive(valid,now)
                    .firstOrNull { it.title == "Sensação térmica" }
                computed?.let {
                    RjLiveEvidence("CALCULO_EXPERIMENTAL_BLAISE",
                        "${it.value} • ${it.method} • entradas da estação ${it.station}",
                        it.source,it.observedAt,calculation=true)
                }
            }
            else -> null
        }
        if (weather != null) return weather
        val currentPublic=public?.takeIf { it.current(now) }
        if (phenomenon in setOf("TEMPORAL","TEMPESTADE","GRANIZO")) {
            val relevant=currentPublic?.warningsFor(municipalityIbge,now)
                ?.firstOrNull { warning ->
                    val term=warning.event.lowercase(Locale.ROOT)
                    when(phenomenon) {
                        "GRANIZO" -> "granizo" in term
                        else -> listOf("chuva","tempestade","temporal","vento").any { it in term }
                    }
                }
            if(relevant != null) return RjLiveEvidence(
                "AVISO_OFICIAL_ATRIBUIDO",
                "${relevant.event} • severidade ${relevant.severity} • até ${localTime(relevant.expires)}",
                "INMET / aviso municipal", relevant.sent)
        }
        if (phenomenon == "RISCO_HIDROLOGICO") {
            val risk=currentPublic?.municipality(municipalityIbge,now)?.risk
                ?.takeIf { it.current(now) }
            if(risk != null) return RjLiveEvidence("BOLETIM_OFICIAL_MUNICIPAL",
                "${risk.label} • nível ${risk.level}/5 • risco hidrológico, não chuva medida",
                risk.sourceName,risk.observedAt)
        }
        return RjLiveEvidence("SEM_PRODUTO_VALIDADO",UNAVAILABLE)
    }

    fun marine(
        phenomenon: String,
        snapshot: PublicRjMarine?,
        now: Instant,
    ): RjLiveEvidence {
        val fresh=snapshot?.takeIf { it.current(now) }
            ?:return RjLiveEvidence("SEM_AVISO_MARITIMO_VALIDADO",
                "Inventário regional CHM não disponível ou vencido; não confirma mar seguro")
        val relevant=fresh.warnings.firstOrNull { it.current(now) &&
            when(phenomenon) {
                "RESSACA" -> it.officialRessacaLabel
                "ONDAS","SWELL" -> it.waveMaxMeters!=null
                "CICLONE_EXTRATROPICAL" -> it.warningType.contains("CICLONE",ignoreCase=true)
                "TEMPESTADE","CHUVA_ATLANTICO" -> it.warningType.contains("TEMPESTADE",ignoreCase=true)
                "TSUNAMI" -> it.warningType.contains("TSUNAMI",ignoreCase=true)
                else -> false
            }
        }
        return relevant?.let { warning ->
            val waves=if (warning.waveMinMeters != null && warning.waveMaxMeters != null)
                " • ondas no aviso: ${numeric(warning.waveMinMeters,"m")}–${numeric(warning.waveMaxMeters,"m")}" else ""
            RjLiveEvidence("AVISO_CHM_REGIONAL",
                "${warning.warningType} • zonas ${warning.areas.joinToString(", ")}${waves} • válido até ${localTime(warning.validUntil)}. Região METAREA V, não alerta municipal.",
                "Marinha / CHM",warning.issuedAt)
        } ?:RjLiveEvidence("SEM_AVISO_APLICAVEL_CONFIRMADO",
            "Inventário CHM consultado em ${localTime(fresh.fetchedAt)}; sem evento regional vigente validado para esta categoria. Não significa ausência de risco.",
            "Marinha / CHM",fresh.fetchedAt)
    }
}
