package br.com.blaise.rj

/**
 * Human-readable versioned index shown INSIDE the existing Blaise V6 RJ
 * interface. This is a routing SPECIFICATION, not evidence of live feeds.
 * Backend policy and source verification remain server authoritative.
 */
data class RjMeteoSourceRow(
    val code: String,
    val phenomenon: String,
    val coverage: String,
    val priority: String,
)

data class RjMeteoDisputeRow(
    val code: String,
    val title: String,
    val decision: String,
)

data class RjMeteoMarineRow(
    val code: String,
    val phenomenon: String,
    val sources: String,
    val function: String,
    val linkedPhenomena: List<String>,
)

object RjMeteorologicalTables {
    const val ID = "BLAISE-RJ-METEO-HOMOLOG-01"
    const val VERSION = "2026-11-13.v6"
    const val STATUS = "Cadastro técnico • homologação operacional pendente"
    const val METHOD = "Prioridade Alerta Rio e Defesa Civil RJ por produto; INMET, INPE/CPTEC, NOAA, CEMADEN, JAXA/GSMaP e EUMETSAT para checagem compatível"
    const val NO_INEA = "INEA excluído"
    const val PHENOMENA_COUNT = 30
    const val ADDITIONAL_TIEBREAK_CHECKS = 5
    const val THIRD_COMPLEMENT = "INMET: consulta de desempate com estação, hora e município compatíveis"
    const val MARINE_COMPLEMENT = "NOAA e INPE/CPTEC: ondas e swell; EUMETSAT: satélite e temperatura do mar"
    const val SATELLITE_COMPLEMENT = "EUMETSAT: satélite, nuvens e ciclones no Atlântico"
    const val LIVE_STATUS = "Cadastro técnico; ingestão ativa das novas fontes ainda não confirmada"
    val primaryTable1Sources = listOf(
        "Alerta Rio", "Defesa Civil RJ", "INMET (desempate por produto)"
    )
    val disputeTable2Sources = listOf(
        "INMET", "INPE/CPTEC", "NOAA", "CEMADEN", "JAXA/GSMaP", "EUMETSAT"
    )
    // Kept only for compatibility with historical five-row UI contracts.
    val disputeTable2FiveSources = disputeTable2Sources.take(5)

    // Rio city coverage for Alerta Rio; forecasts/satellite estimates are
    // never a second station in any observation average.
    val table1 = listOf(
        RjMeteoSourceRow("TEMPERATURA", "Temperatura", "92 municípios, estações existentes", "Alerta Rio (somente capital) e Defesa Civil RJ por seus produtos; medição INMET, previsão INPE/CPTEC/NOAA e satélite somente quando produto, horário e área forem comprovados."),
        RjMeteoSourceRow("SENSACAO_TERMICA", "Sensação térmica", "92 municípios, com entradas válidas", "Alerta Rio (somente capital) e Defesa Civil RJ por seus produtos; medição INMET, previsão INPE/CPTEC/NOAA e satélite somente quando produto, horário e área forem comprovados."),
        RjMeteoSourceRow("CHUVA_ATUAL", "Chuva atual", "RJ, estações com medição", "Alerta Rio (capital) e Defesa Civil RJ; INMET e CEMADEN por produto; JAXA/GSMaP para estimativa por satélite, NOAA para modelo; não misturar medição e previsão."),
        RjMeteoSourceRow("CHUVA_ACUMULADA", "Chuva acumulada (janelas)", "92 municípios, estações existentes", "Alerta Rio (capital) e Defesa Civil RJ; INMET e CEMADEN por produto; JAXA/GSMaP para estimativa por satélite, NOAA para modelo; não misturar medição e previsão."),
        RjMeteoSourceRow("TEMPORAL", "Temporal e avisos", "92 municípios, área do evento", "Defesa Civil RJ e INMET (aviso oficial), Alerta Rio (capital); INPE/CPTEC e NOAA como contexto, sem transformar modelos em avisos."),
        RjMeteoSourceRow("VENTO", "Vento médio", "92 municípios, estações existentes", "Alerta Rio (somente capital) e Defesa Civil RJ por seus produtos; medição INMET, previsão INPE/CPTEC/NOAA e satélite somente quando produto, horário e área forem comprovados."),
        RjMeteoSourceRow("RAJADA", "Rajadas de vento", "92 municípios, estações existentes", "Alerta Rio (somente capital) e Defesa Civil RJ por seus produtos; medição INMET, previsão INPE/CPTEC/NOAA e satélite somente quando produto, horário e área forem comprovados."),
        RjMeteoSourceRow("PRESSAO_ATMOSFERICA", "Pressão / tendência", "92 municípios com estação", "Alerta Rio (somente capital) e Defesa Civil RJ por seus produtos; medição INMET, previsão INPE/CPTEC/NOAA e satélite somente quando produto, horário e área forem comprovados."),
        RjMeteoSourceRow("UMIDADE", "Umidade relativa", "92 municípios, estações existentes", "Alerta Rio (somente capital) e Defesa Civil RJ por seus produtos; medição INMET, previsão INPE/CPTEC/NOAA e satélite somente quando produto, horário e área forem comprovados."),
        RjMeteoSourceRow("GRANIZO", "Granizo", "92 municípios, área do evento", "Defesa Civil RJ e INMET (aviso oficial), Alerta Rio (capital); INPE/CPTEC e NOAA como contexto, sem transformar modelos em avisos."),
        RjMeteoSourceRow("TEMPESTADE", "Tempestade severa", "92 municípios, área do evento", "Defesa Civil RJ e INMET (aviso oficial), Alerta Rio (capital); INPE/CPTEC e NOAA como contexto, sem transformar modelos em avisos."),
        RjMeteoSourceRow("RISCO_HIDROLOGICO", "Cheia e inundação", "Bacias e municípios com risco", "Defesa Civil RJ → CEMADEN (risco/chuva) → ANA/Hidroweb → SGB/SACE; fonte, geografia e horário por produto."),
        RjMeteoSourceRow("VAZAO_RIO", "Vazão dos rios", "Estações hidrológicas RJ", "Defesa Civil RJ → CEMADEN (risco/chuva) → ANA/Hidroweb → SGB/SACE; fonte, geografia e horário por produto."),
        RjMeteoSourceRow("RESSACA", "Ressaca e ondas altas", "Litoral RJ", "INPE/CPTEC e NOAA (ondas, swell e modelos), EUMETSAT (vento, SST e satélite), JAXA/GSMaP (chuva oceânica); alertas apenas de autoridades brasileiras competentes."),
        RjMeteoSourceRow("ONDAS", "Ondas, marés e mar", "Litoral e oceano próximo", "INPE/CPTEC e NOAA (ondas, swell e modelos), EUMETSAT (vento, SST e satélite), JAXA/GSMaP (chuva oceânica); alertas apenas de autoridades brasileiras competentes."),
        RjMeteoSourceRow("CICLONE_EXTRATROPICAL", "Ciclone extratropical", "Atlântico com possível impacto RJ", "INPE/CPTEC e NOAA (ondas, swell e modelos), EUMETSAT (vento, SST e satélite), JAXA/GSMaP (chuva oceânica); alertas apenas de autoridades brasileiras competentes."),
        RjMeteoSourceRow("CHUVA_ATLANTICO", "Chuva oceânica", "Atlântico próximo ao RJ", "JAXA/GSMaP para precipitação satelital, EUMETSAT para nuvens, NOAA e INPE/CPTEC para modelos; Defesa Civil RJ somente para aviso oficial pertinente; não misturar medição e previsão."),
        RjMeteoSourceRow("MASSA_AR", "Massa de ar polar ou quente", "RJ e divisas", "Alerta Rio (somente capital) e Defesa Civil RJ por seus produtos; medição INMET, previsão INPE/CPTEC/NOAA e satélite somente quando produto, horário e área forem comprovados."),
        RjMeteoSourceRow("RADAR", "Radar meteorológico próprio", "Cobertura geográfica real RJ", "Alerta Rio/COR.Rio para quadros reais do radar Sumaré; janela de 30 min sem interpolação, com hora e autorização de uso."),
        RjMeteoSourceRow("DESLIZAMENTO", "Deslizamentos", "Áreas susceptíveis RJ", "Defesa Civil RJ → CEMADEN (risco/chuva) → ANA/Hidroweb → SGB/SACE; fonte, geografia e horário por produto."),
        RjMeteoSourceRow("ALAGAMENTO", "Alagamento urbano", "Municípios / vias RJ", "Defesa Civil RJ → CEMADEN (risco/chuva) → ANA/Hidroweb → SGB/SACE; fonte, geografia e horário por produto."),
        RjMeteoSourceRow("FRENTE_FRIA", "Frentes frias", "RJ, divisas e Atlântico", "Alerta Rio (somente capital) e Defesa Civil RJ por seus produtos; medição INMET, previsão INPE/CPTEC/NOAA e satélite somente quando produto, horário e área forem comprovados."),
        RjMeteoSourceRow("EL_NINO_LA_NINA", "El Niño / La Niña", "Escala climática e impactos no RJ", "Alerta Rio (somente capital) e Defesa Civil RJ por seus produtos; medição INMET, previsão INPE/CPTEC/NOAA e satélite somente quando produto, horário e área forem comprovados."),
        RjMeteoSourceRow("SISMO", "Sismos e terremotos", "RJ/Atlântico e seção global", "USGS e redes sísmicas oficiais; avisos à população somente de autoridades competentes, sem média de magnitudes."),
        RjMeteoSourceRow("TSUNAMI", "Tsunami, maremoto e meteotsunami", "Costa RJ e Atlântico", "Autoridades brasileiras competentes e NOAA por seus produtos oficiais; USGS para origem sísmica. Tempo por batimetria é cálculo condicional, nunca aviso de tsunami."),
        RjMeteoSourceRow("RAIOS", "Raios e descargas elétricas", "RJ, conforme rede", "INPE/CPTEC e satélites validados; redes autorizadas e Defesa Civil RJ para avisos."),
        RjMeteoSourceRow("MARE", "Marés e nível do mar", "Litoral RJ", "INPE/CPTEC e NOAA (ondas, swell e modelos), EUMETSAT (vento, SST e satélite), JAXA/GSMaP (chuva oceânica); alertas apenas de autoridades brasileiras competentes."),
        RjMeteoSourceRow("SWELL", "Swell e ondulações", "Litoral e Atlântico próximo", "INPE/CPTEC e NOAA (ondas, swell e modelos), EUMETSAT (vento, SST e satélite), JAXA/GSMaP (chuva oceânica); alertas apenas de autoridades brasileiras competentes."),
        RjMeteoSourceRow("CORRENTES_MARINHAS", "Correntes oceânicas", "Litoral e Atlântico próximo", "INPE/CPTEC e NOAA (ondas, swell e modelos), EUMETSAT (vento, SST e satélite), JAXA/GSMaP (chuva oceânica); alertas apenas de autoridades brasileiras competentes."),
        RjMeteoSourceRow("TEMPERATURA_MAR", "Temperatura da superfície do mar", "Litoral e Atlântico próximo", "INPE/CPTEC e NOAA (ondas, swell e modelos), EUMETSAT (vento, SST e satélite), JAXA/GSMaP (chuva oceânica); alertas apenas de autoridades brasileiras competentes."),
    )
    val table2 = listOf(
        RjMeteoDisputeRow("01", "Prioridade oficial", "Alerta Rio e Defesa Civil RJ fornecem produtos oficiais no âmbito de sua competência. INMET é a primeira referência de medição na checagem complementar."),
        RjMeteoDisputeRow("02", "Medições independentes", "Comparar apenas duas observações independentes da mesma variável, área e janela; não confundir avisos com medições."),
        RjMeteoDisputeRow("03", "Se faltar comprovação", "Consultar uma fonte autorizada por vez: INMET → INPE/CPTEC → NOAA → CEMADEN → JAXA/GSMaP → EUMETSAT, respeitando o produto."),
        RjMeteoDisputeRow("04", "INMET e INPE/CPTEC", "INMET: observação por estação do município. INPE/CPTEC: previsão ou análise; apresentar natureza e horários separados."),
        RjMeteoDisputeRow("05", "NOAA e satélites", "NOAA para modelo/Atlântico; CEMADEN para chuva e risco; JAXA/GSMaP para precipitação satelital; EUMETSAT para produto adequado."),
        RjMeteoDisputeRow("06", "Duas fontes apresentadas", "Medição independente e previsão podem aparecer lado a lado, nunca receber média mista."),
        RjMeteoDisputeRow("07", "Dados desatualizados", "Usar validade de cada produto. Sem entrada atual, mostrar indisponibilidade; atualização visual não altera horário da medição."),
        RjMeteoDisputeRow("08", "Fenômenos especializados", "Avisos, rios, raios, sismo e tsunami seguem autoridades competentes e não são média de categorias."),
        RjMeteoDisputeRow("09", "Prioridade P1", "Alerta Rio e Defesa Civil RJ têm precedência pelos seus avisos/produtos. Republicação não conta como fonte independente."),
        RjMeteoDisputeRow("10", "Complementos condicionados", "Weather.com apenas como complemento horário quando houver licença; não substitui avisos oficiais nem estação INMET."),
        RjMeteoDisputeRow("11", "Antes da ponderação", "Permitir pesos apenas para observações independentes e comparáveis. Sem pesos, mostrar as leituras individualmente."),
        RjMeteoDisputeRow("12", "Oceano e litoral", "INPE/CPTEC, NOAA, EUMETSAT e JAXA por produto; tsunami e ressaca exigem aviso de autoridade competente."),
        RjMeteoDisputeRow("13", "Licença e rastreabilidade", "Verificar produto, fonte, horário, autorização comercial, município, independência e aviso; sem evidência não emitir alerta."),
    )
    // Map one selected Table 1 item to ONLY the Table 2 checks that
    // apply. Distinct checks for measurements, formulas, warning categories
    // and maritime events prevent unsafe weighted averages.
    private val weightableCodes = setOf(
        "TEMPERATURA", "UMIDADE", "VENTO", "RAJADA", "CHUVA_ATUAL",
        "CHUVA_ACUMULADA", "PRESSAO_ATMOSFERICA",
    )
    private val marineCodes = setOf(
        "RESSACA", "ONDAS", "SWELL", "MARE", "CORRENTES_MARINHAS",
        "TEMPERATURA_MAR", "CICLONE_EXTRATROPICAL", "CHUVA_ATLANTICO", "TSUNAMI",
    )
    private val baseChecks = setOf("01", "07", "09", "13")
    fun table2ForPhenomenon(phenomenonCode: String): List<RjMeteoDisputeRow> {
        require(table1.any { it.code == phenomenonCode }) { "RJ phenomenon not registered" }
        val checks = baseChecks.toMutableSet()
        when {
            phenomenonCode in weightableCodes ->
                checks.addAll(listOf("02", "03", "04", "05", "06", "10", "11"))
            phenomenonCode == "SENSACAO_TERMICA" ->
                checks.addAll(listOf("03", "04", "05", "06", "10", "11"))
            phenomenonCode in marineCodes ->
                checks.addAll(listOf("06", "08", "12"))
            else -> {
                checks.addAll(listOf("03", "06", "08"))
                if (phenomenonCode in setOf("TEMPORAL", "TEMPESTADE", "GRANIZO"))
                    checks.add("10")
            }
        }
        return table2.filter { it.code in checks }
    }
    fun canWeightOfficialObservations(phenomenonCode: String): Boolean =
        phenomenonCode in weightableCodes

    // The five exact maritime rows supplied in the approved screenshot.
    // These are SOURCE ELIGIBILITY, not live observations or warnings.
    val marineTable = listOf(
        RjMeteoMarineRow("CICLONES_OCEANICOS", "Ciclones oceânicos",
            "INPE/CPTEC + NOAA + EUMETSAT",
            "Evolução atmosférica, deslocamento e efeitos no mar",
            listOf("CICLONE_EXTRATROPICAL")),
        RjMeteoMarineRow("TEMPESTADES_ATLANTICO", "Tempestades no Atlântico",
            "INPE/CPTEC + NOAA + EUMETSAT + JAXA/GSMaP",
            "Nuvens e sistemas intensos; satélite não substitui radar",
            listOf("TEMPESTADE", "CHUVA_ATLANTICO")),
        RjMeteoMarineRow("ONDAS_SWELL", "Ondas e swell",
            "INPE/CPTEC + NOAA + EUMETSAT",
            "Altura, período, direção e propagação das ondas",
            listOf("ONDAS", "SWELL")),
        RjMeteoMarineRow("RESSACA_LITORAL", "Ressaca no litoral RJ",
            "INPE/CPTEC + NOAA + Defesa Civil RJ (avisos)",
            "Previsão e avaliação do risco costeiro por aviso competente",
            listOf("RESSACA")),
        RjMeteoMarineRow("TSUNAMI", "Tsunami / maremoto",
            "Autoridades brasileiras competentes + NOAA + USGS",
            "Avisos oficiais, nível do mar e avaliação de ameaça",
            listOf("TSUNAMI")),
    )

    init {
        require(primaryTable1Sources.size == 3 && disputeTable2FiveSources.size == 5)
        require(disputeTable2Sources.take(2) == listOf("INMET", "INPE/CPTEC"))
        require(disputeTable2Sources.last() == "EUMETSAT")
        require(table1.size == PHENOMENA_COUNT && table1.map { it.code }.distinct().size == PHENOMENA_COUNT)
        require(table2.size == 8 + ADDITIONAL_TIEBREAK_CHECKS)
        require(marineTable.size == 5 && marineTable.map { it.code }.distinct().size == 5)
        require(table1.all { table2ForPhenomenon(it.code).isNotEmpty() })
        require(listOf("TEMPORAL", "GRANIZO", "SISMO", "TSUNAMI").all {
            !canWeightOfficialObservations(it)
        })
        require(table1.none { it.code.contains("INEA") || it.priority.contains("INEA") })
    }
}
