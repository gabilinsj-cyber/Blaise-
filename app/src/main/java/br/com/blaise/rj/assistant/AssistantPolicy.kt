package br.com.blaise.rj.assistant

data class AssistantAnswer(
    val text: String,
    val destination: String? = null,
)

/**
 * Local, deterministic routing for the dashboard assistant.
 * It never fabricates live conditions; questions that require current data are
 * sent to the relevant fail-closed screen where source and timestamp are shown.
 */
object AssistantPolicy {
    fun answer(rawQuestion: String): AssistantAnswer {
        val question = rawQuestion.trim().lowercase()
        if (question.isEmpty()) {
            return AssistantAnswer("Digite ou fale uma pergunta para o Blaise.")
        }

        return when {
            listOf("trânsito", "transito", "alagamento", "acidente", "interdição", "interdicao", "rota").any(question::contains) ->
                AssistantAnswer("Abrindo Trânsito. Ocorrências só são exibidas com fonte oficial e horário.", "Trânsito")
            listOf("mar", "onda", "ressaca", "pesca", "surf", "maré", "mare", "tsunami").any(question::contains) ->
                AssistantAnswer("Abrindo Mar e Ondas. Os dados dependem de fonte oficial, especialmente Marinha/CHM.", "Mar e Ondas")
            listOf("qualidade do ar", "iqar", "umidade", "uv").any(question::contains) ->
                AssistantAnswer("Abrindo Qualidade do Ar para consultar IQAr, umidade e UV com fonte e horário.", "Qualidade do Ar")
            listOf("alerta", "temporal", "tempestade", "ciclone", "tornado", "deslizamento", "sismo", "terremoto").any(question::contains) ->
                AssistantAnswer("Abrindo Alertas. O Blaise não presume segurança nem ocorrência sem evidência oficial válida.", "Alertas")
            listOf("mapa", "radar", "chuva", "chover", "chove", "nuvem", "vento").any(question::contains) ->
                AssistantAnswer("Abrindo o Mapa. Camadas em tempo real aparecem somente quando a ingestão oficial estiver válida.", "Mapa")
            listOf("cidade", "município", "municipio", "temperatura", "sensação", "sensacao", "previsão", "previsao").any(question::contains) ->
                AssistantAnswer("Abrindo Cidades para comparar os dois municípios selecionados sem misturar os dados.", "Cidades")
            listOf("notícia", "noticia", "boletim").any(question::contains) ->
                AssistantAnswer("Abrindo Notícias. Cada item deve preservar autoria, fonte e horário.", "Notícias")
            listOf("histórico", "historico", "evolução", "evolucao", "gráfico", "grafico").any(question::contains) ->
                AssistantAnswer("Abrindo Histórico para consultar a evolução meteorológica disponível.", "Histórico")
            else -> AssistantAnswer(
                "Posso abrir clima por cidade, mapa, alertas, trânsito, mar e ondas, qualidade do ar, notícias ou histórico."
            )
        }
    }
}
