package br.com.blaise.rj.assistant

import br.com.blaise.rj.data.StatewideSnapshot
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Municipal source scope is kept explicit; no hydrological risk is relabelled as landslide risk. */
fun statewideAnswer(snapshot: StatewideSnapshot?, request: WeatherRequest, now: Instant): String? {
    val q = normalizedSpeech(request.question)
    val alerts = q.contains("alerta") || q.contains("aviso")
    val hydro = listOf("risco", "alagamento", "inundacao", "cheia").any(q::contains)
    val slope = q.contains("deslizamento")
    if (!alerts && !hydro && !slope) return null
    val city = request.city.name
    if (request.date != now.atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate())
        return "Não tenho uma previsão de risco validada para $city nesse período. Os dados atuais não substituem previsão."
    if (snapshot == null || !snapshot.current(now) || !snapshot.workerActive)
        return "Os avisos e riscos oficiais de $city estão indisponíveis nesta consulta. Isso não significa ausência de risco."
    val row = snapshot.municipalities.firstOrNull { it.ibge == request.city.ibgeCode }
        ?: return "Não consegui confirmar a cobertura oficial de $city."
    val stamp = DateTimeFormatter.ofPattern("dd/MM HH:mm")
    val pieces = mutableListOf("Consulta para o município de $city.")
    if (hydro) {
        val risk = row.risk
        if (risk.current(now)) pieces += "Risco hidrológico ${risk.label}. Fonte CEMADEN-RJ, ${risk.observedAt?.atZone(ZoneId.of("America/Sao_Paulo"))?.format(stamp)}, horário de Brasília."
        else pieces += "Risco hidrológico indisponível ou desatualizado."
    }
    if (slope) pieces += "Risco de deslizamento não integrado nesta consulta; não é deduzido do risco hidrológico."
    if (alerts) {
        val warnings = snapshot.warnings.filter { it.id in row.warningIds && it.current(now) }
        if (warnings.isEmpty()) pieces += if (row.warningCoverage == "EXACT_IBGE_ONLY")
            "Nenhum aviso INMET foi atribuído ao município nesta consulta. Isso não confirma ausência de risco."
            else "Avisos municipais indisponíveis ou com cobertura parcial."
        warnings.forEach { warning -> pieces += "INMET: ${warning.event}, severidade oficial ${when(warning.severity) {
            "Extreme" -> "extrema"; "Severe" -> "severa"; "Moderate" -> "moderada"; "Minor" -> "menor"; else -> "não determinada"
        }}, emitido ${warning.sent.atZone(ZoneId.of("America/Sao_Paulo")).format(stamp)}, válido até ${warning.expires.atZone(ZoneId.of("America/Sao_Paulo")).format(stamp)}, horário de Brasília." }
        if (row.warningCoverage == "PARTIAL_UNRESOLVED_AREAS") pieces += "Há avisos estaduais cuja abrangência municipal ainda não foi confirmada."
    }
    if (request.localScope != null) pieces += "A cobertura acima é municipal, não uma avaliação específica de ${request.localScope}."
    return pieces.joinToString(" ")
}
