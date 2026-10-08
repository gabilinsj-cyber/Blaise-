package br.com.blaise.rj.assistant

import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.City
import java.text.Normalizer
import java.time.LocalDate
import java.time.ZoneId

fun normalizedSpeech(value: String): String = Normalizer.normalize(value.lowercase(), Normalizer.Form.NFD)
    .replace(Regex("\\p{M}+"), "").replace(Regex("[^a-z0-9 ]"), " ").replace(Regex(" +"), " ").trim()

data class WeatherRequest(val city: City, val question: String, val date: LocalDate, val localScope: String?)
sealed interface ConversationAction {
    data class Query(val request: WeatherRequest) : ConversationAction
    data class Reply(val text: String) : ConversationAction
}

/** Holds only confirmed conversation context; never assumes an unspoken city. */
class WeatherConversation {
    private var city: City? = null
    private var pending: String? = null
    private var confirmedScope: String? = null
    fun accept(raw: String, selectedCity: City, today: LocalDate = LocalDate.now(ZoneId.of("America/Sao_Paulo"))): ConversationAction {
        val text = normalizedSpeech(raw)
        if (text.isBlank()) return ConversationAction.Reply("Não consegui ouvir a pergunta. Pode repetir?")
        if (listOf("nao consigo respirar", "ar nao entra no peito", "dor no peito", "desmaio", "confusao mental").any(text::contains))
            return ConversationAction.Reply("Se você está com falta de ar intensa, dor no peito, desmaio ou confusão, procure atendimento urgente ou ligue 192. Não posso atribuir esses sintomas ao tempo.")
        val station = br.com.blaise.rj.data.AlertaRioObservationParser.stations.firstOrNull {
            Regex("(^| )${Regex.escape(normalizedSpeech(it))}( |$)").containsMatchIn(text)
        }
        val neighbourhood = listOf("Bangu", "Campo Grande", "Copacabana", "Ipanema", "Leme", "Barra da Tijuca", "Recreio dos Bandeirantes", "Madureira", "Rocinha", "Tijuca", "Botafogo", "Flamengo").firstOrNull {
            Regex("(^| )${Regex.escape(normalizedSpeech(it))}( |$)").containsMatchIn(text)
        }
        val namedCity = RioMunicipalities.all.sortedByDescending { it.name.length }.firstOrNull {
            Regex("(^| )${Regex.escape(normalizedSpeech(it.name))}( |$)").containsMatchIn(text)
        }
        if ((station != null || neighbourhood != null) && namedCity != null && namedCity.ibgeCode != 3304557)
            return ConversationAction.Reply("Você mencionou ${namedCity.name} e ${station ?: neighbourhood}, no município do Rio. Qual dessas localidades deseja consultar?")
        val explicit = namedCity ?: if (station != null || neighbourhood != null || Regex("(^| )rio( |$)").containsMatchIn(text) && !text.contains("estado do rio"))
            RioMunicipalities.all.first { it.ibgeCode == 3304557 } else null
        val region = listOf("baixada", "regiao serrana", "regiao metropolitana", "zona norte", "zona sul", "zona oeste", "estado do rio").firstOrNull(text::contains)
        if (explicit == null && region != null) return ConversationAction.Reply("Você pediu um panorama de $region. Ainda não tenho cobertura regional validada para essa consulta. Qual município deseja consultar agora?")
        val resolved = explicit ?: if (text.contains("minha cidade")) selectedCity else city
        if (resolved == null) {
            pending = raw
            return ConversationAction.Reply("Para qual cidade ou região você deseja saber?")
        }
        if (explicit != null || text.contains("minha cidade")) {
            confirmedScope = station ?: neighbourhood ?: if (resolved.ibgeCode == 3304557) "Centro do Rio" else null
        }
        city = resolved
        val question = pending?.let { "$it. $raw" } ?: raw
        pending = null
        val all = normalizedSpeech(question)
        if (all.contains("fim de semana") || all.contains("final de semana") || all.contains("semana que vem"))
            return ConversationAction.Reply("Entendi a consulta para ${resolved.name}. Ainda não tenho previsão validada para esse período; não vou usar as condições atuais como previsão.")
        val supported = listOf("temperatura", "termica", "sensacao", "umidade", "vento", "tempo", "calor", "friaca", "mormaco", "frio", "chuva", "chover", "alerta", "aviso", "risco", "alagamento", "inundacao", "cheia", "deslizamento")
        if (supported.none(all::contains))
            return ConversationAction.Reply("Entendi a pergunta para ${resolved.name}, mas ainda não tenho dados oficiais validados para esse assunto. Não posso confirmar condições ou riscos agora.")
        val date = if (all.contains("amanha")) today.plusDays(1) else today
        val scope = confirmedScope
        return ConversationAction.Query(WeatherRequest(resolved, question, date, scope))
    }
}
