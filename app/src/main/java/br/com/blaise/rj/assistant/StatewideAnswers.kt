package br.com.blaise.rj.assistant

import br.com.blaise.rj.data.StatewideSnapshot
import java.time.Instant
import java.time.ZoneId

/**
 * Customer voice replies never disclose or reuse INMET/CEMADEN comparison
 * observations, warnings or hydrological state. Only a future independent
 * international source may populate those fields through a new audited contract.
 */
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
        return "Avisos e riscos de $city indisponíveis nesta consulta. Isso não significa ausência de risco."
    if (snapshot.municipalities.none { it.ibge == request.city.ibgeCode })
        return "Não consegui confirmar a cobertura de $city."
    val pieces = mutableListOf("Consulta para o município de $city.")
    if (hydro) pieces += "Risco hidrológico indisponível sem fonte internacional validada."
    if (slope) pieces += "Risco de deslizamento não integrado nesta consulta; não é deduzido do risco hidrológico."
    if (alerts) pieces += "Avisos municipais indisponíveis nesta consulta. Consulte os links dos órgãos oficiais."
    if (request.localScope != null)
        pieces += "A cobertura informada é municipal, não uma avaliação específica de ${request.localScope}."
    return pieces.joinToString(" ")
}
