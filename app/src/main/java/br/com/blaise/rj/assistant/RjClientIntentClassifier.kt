package br.com.blaise.rj.assistant

/**
 * Lightweight RJ client-side intent recognition: NOT a copy of the owner's
 * 800-answer knowledge base and NEVER a source of weather observations.
 * It only classifies the question so validated live providers can be queried.
 */
data class RjQuestionIntent(val topics: Set<String>) {
    val recognized: Boolean get() = topics.isNotEmpty()
    val requiresLiveEvidence: Boolean get() = recognized
    fun unavailableExplanation(city: String): String {
        val names = topics.take(4).joinToString(", ")
        return "Entendi a consulta sobre $names em $city, mas ainda não tenho " +
            "fonte atual, horário e cobertura verificados para responder esse assunto. " +
            "Não vou substituir dados ausentes por medições de outro local."
    }
}

object RjClientIntentClassifier {
    private val definitions = linkedMapOf(
        "temperatura e sensação térmica" to listOf(
            "temperatura", "termica", "sensacao", "calor", "friaca", "mormaco",
            "frio", "abafado", "bafo", "maçarico", "macarico", "ar quente",
            "maxima", "minima", "quente", "mais quente", "mais frio", "fria", "quentes"),
        "chuva" to listOf("chuva", "chover", "chove", "chovendo", "pancada",
            "precipitacao", "acumulado", "pluviometro", "temporal", "pancadas",
            "choveu", "chuvoso", "chuvosos", "pluviometrica", "piscinoes"),
        "vento" to listOf("vento", "ventania", "ventando", "rajada", "vendaval",
            "ciclone", "furacao", "tornado", "frente fria", "frentes frias",
            "ventos", "rajadas", "brisa"),
        "umidade e ar" to listOf("umidade", "ponto de orvalho", "ar seco", "ar pesado",
            "qualidade do ar", "poluicao", "pm2", "ozonio"),
        "previsão meteorológica" to listOf("previsao", "amanha", "depois de amanha",
            "fim de semana", "semana que vem", "vai dar praia", "quando chega",
            "quando termina", "horario previsto", "proximos dias",
            "feriado", "prevista", "previstas", "previsto", "tempo"),
        "alertas" to listOf("alerta", "aviso", "risco", "defesa civil", "estagio",
            "sirenes", "alarme", "evacuacao", "abrigo", "emergencia",
            "estagios", "contingencia", "desastre"),
        "alagamento e deslizamento" to listOf("alagamento", "inundacao", "enchente",
            "cheia", "deslizamento", "transbordamento", "rio subindo", "bueiro",
            "bolsao de agua", "piscinao", "piscinoes", "escoamento"),
        "radar e satélite" to listOf("radar", "satelite", "sumare", "nuvem",
            "nublado", "cobertura do radar", "imagem da chuva"),
        "mar e ondas" to listOf("mare", "ressaca", "swell", "onda", "mar agitado",
            "pescaria", "pesca", "surf", "praia", "praias", "barcas",
            "corrente marinha", "ondas", "mares", "ressacas", "ressurgencia",
            "maritima", "agua fria", "agua do leme"),
        "tsunami e sismos" to listOf("tsunami", "maremoto", "sismo", "terremoto",
            "abalo", "tremor", "epicentro"),
        "sol e radiação UV" to listOf("uv", "ultravioleta", "protetor solar",
            "nascer do sol", "por do sol", "arco iris"),
        "trânsito e mobilidade" to listOf("transito", "engarrafamento", "interdicao",
            "via fechada", "ponte rio niteroi", "avenida brasil", "rota alternativa",
            "brt", "vlt", "metro", "aeroporto", "voo", "atraso"),
        "energia e infraestrutura" to listOf("energia", "apagao", "luz caiu",
            "poste", "fiacao", "tuneis", "drenagem", "sem energia", "queda de arvore"),
        "climatologia e tendências" to listOf("el nino", "la nina", "climatologia",
            "recorde", "historico", "mudanca climatica", "2050", "inverno",
            "primavera", "outono", "verao", "media", "mes mais", "historicamente",
            "clima", "climatica", "estacao", "estacoes", "neve", "geada",
            "microclima", "microclimas", "topografia", "asfalto", "predios",
            "floresta da tijuca", "restinga", "macico", "regulador termico",
            "baia", "diferencas", "seco", "seca"),
        "tempestade e fenômenos severos" to listOf("granizo", "raio", "descarga eletrica",
            "tempestade", "trovoada", "relampago", "microexplosao"),
        "visibilidade e nevoeiro" to listOf("nevoeiro", "neblina", "cerração",
            "cerração", "visibilidade", "serracao", "nevoa", "teto baixo"),
        "pressão e ciência atmosférica" to listOf("pressao atmosferica",
            "cape", "cin", "cisalhamento", "helicidade", "vorticidade", "bulbo umido"),
        "notícias e eventos" to listOf("noticia", "evento", "show", "jogo",
            "maratona", "estadio", "boletim", "jogos", "instabilidade"),
        "saúde e bem-estar" to listOf("saude", "asma", "rinite", "dor de cabeca",
            "tontura", "sufoco", "idosos", "criancas", "insolacao")
    )
    fun identify(raw: String): RjQuestionIntent {
        val text = " " + normalizedSpeech(raw) + " "
        val topics = definitions.filterValues { fragments ->
            fragments.any { word -> text.contains(" " + normalizedSpeech(word) + " ") }
        }.keys
        return RjQuestionIntent(topics.toSet())
    }
}
