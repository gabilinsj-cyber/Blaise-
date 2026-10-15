package br.com.blaise.rj.assistant

import br.com.blaise.rj.data.NewsSnapshot
import br.com.blaise.rj.data.PublicRjStatus
import br.com.blaise.rj.data.SeismicSnapshot
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Answers use the same clock and acquisitions as visible panels, independent of Billing. */
fun liveInformationAnswer(status: PublicRjStatus?, news: NewsSnapshot?, seismic: SeismicSnapshot?,
    request: WeatherRequest, now: Instant): String? {
    val q = normalizedSpeech(request.question)
    val pieces = mutableListOf<String>()
    val zone = ZoneId.of("America/Sao_Paulo")
    fun time(value: Instant) = value.atZone(zone).format(DateTimeFormatter.ofPattern("dd/MM HH:mm")) + " (Brasília)"
    val current = status?.takeIf { it.current(now) }
    if (listOf("alerta", "aviso", "risco", "alagamento", "inundacao", "cheia", "deslizamento", "onda", "ressaca", "tsunami", "mare", "transito").any(q::contains)
        && request.date != now.atZone(zone).toLocalDate())
        return "Não há previsão validada destes riscos para ${request.city.name} em ${request.date}. Os avisos atuais não substituem previsão."
    if (listOf("alerta", "aviso", "risco", "alagamento", "inundacao", "cheia").any(q::contains)) {
        val city = current?.municipality(request.city.ibgeCode, now)
        if (city == null) pieces += "Avisos e risco de ${request.city.name}: fonte atual indisponível. Isso não significa ausência de risco."
        else {
            if (listOf("risco", "alagamento", "inundacao", "cheia").any(q::contains)) {
                val risk = city.risk?.takeIf { it.current(now) }
                pieces += risk?.let { "${request.city.name}: risco hidrológico ${it.label}, nível ${it.level}. ${it.sourceName}, ${time(it.observedAt)}." }
                    ?: "Risco hidrológico de ${request.city.name} indisponível ou desatualizado."
            }
            if (listOf("alerta", "aviso").any(q::contains)) {
                val warnings = current?.warningsFor(request.city.ibgeCode, now).orEmpty()
                pieces += if (warnings.isEmpty()) "Nenhum aviso vigente foi confirmado para ${request.city.name} nesta consulta; isso não confirma ausência de risco."
                    else warnings.joinToString(" ") { "INMET: ${it.event}, ${it.severity}; emitido ${time(it.sent)}, válido até ${time(it.expires)}. ${it.sourceUrl}" }
            }
        }
    }
    if (q.contains("deslizamento")) pieces += "Risco de deslizamento sem produto validado nesta consulta; não é deduzido do risco hidrológico."
    if (listOf("onda", "ressaca", "swell", "mare").any(q::contains)) {
        pieces += "Sem produto marítimo atual validado nesta consulta; isso não confirma ausência de risco. Base: NOAA, Copernicus Marine e EUMETSAT por produto; CPTEC/INPE como previsão complementar em validação."
    }
    if (listOf("abalo", "sismo", "terremoto").any(q::contains)) {
        val events = seismic?.largestRecent(now).orEmpty()
        pieces += if (events.isEmpty()) "Feed USGS atual indisponível nesta consulta."
            else "Dois maiores abalos do feed global das últimas 24 horas: " + events.joinToString(" ") {
                "Magnitude ${it.magnitude}, ${it.place}, profundidade ${it.depthKm} km, ${time(it.occurredAt)}. USGS: ${it.url}."
            } + " Isso não confirma impacto no RJ nem tsunami."
    }
    if (q.contains("tsunami") || q.contains("maremoto")) pieces += "Tsunami ou maremoto só pode ser confirmado por aviso vigente da autoridade competente; magnitude de abalo não basta."
    if (q.contains("noticia")) {
        val scope = if (q.contains("internacional")) "Internacional" else if (q.contains("nacional")) "Nacional" else request.city.name.let {
            if (it in listOf("Niterói", "São Gonçalo")) it else "RJ"
        }
        val items = news?.forScope(scope, now).orEmpty()
        pieces += if (items.isEmpty()) "Sem manchetes recentes confirmadas para $scope."
            else items.joinToString(" ") { "Agência Brasil: ${it.title}. Publicação ${time(it.publishedAt)}. ${it.url}" }
    }
    if (q.contains("transito")) pieces += "O mapa de ocorrências de trânsito ainda não tem feed georreferenciado validado. Consulte COR.Rio/CET-Rio: https://cor.rio/."
    if (pieces.isEmpty()) return null
    if (request.localScope != null && current != null) pieces += "Avisos municipais não são medições específicas de ${request.localScope}."
    return pieces.joinToString(" ")
}
