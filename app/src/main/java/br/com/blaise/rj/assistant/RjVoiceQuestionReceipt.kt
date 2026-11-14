package br.com.blaise.rj.assistant

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Identifies the question and independently datestamped retrieval; never labels sources as live by itself. */
object RjVoiceQuestionReceipt {
    private val zone = ZoneId.of("America/Sao_Paulo")
    private val format = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm", Locale.forLanguageTag("pt-BR"))

    fun questionTime(requestedAt: Instant): String =
        "Pergunta registrada em ${format.format(requestedAt.atZone(zone))} (horário de Brasília). " +
            "A hora e a fonte de cada medição devem ser verificadas separadamente."

    fun format(requestedAt: Instant, asOf: Instant): String {
        require(!asOf.isBefore(requestedAt.minusSeconds(300))) { "invalid_answer_clock" }
        require(!asOf.isAfter(requestedAt.plusSeconds(600))) { "answer_not_current_to_request" }
        val question = format.format(requestedAt.atZone(zone))
        val answer = format.format(asOf.atZone(zone))
        return "Pergunta registrada em $question (horário de Brasília). " +
            "Consulta verificada em $answer (horário de Brasília). " +
            "Horários individuais das fontes aparecem abaixo."
    }
}
