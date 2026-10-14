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
    const val VERSION = "2026-10-14.v1"
    const val STATUS = "Cadastro técnico • homologação operacional pendente"
    const val METHOD = "Alerta Rio (Rio) → Defesa Civil → INMET; dupla oficial válida basta. Desempate: INPE/CPTEC → Windy. Observação e modelo separados."
    const val NO_INEA = "INEA excluído"
    const val PHENOMENA_COUNT = 30
    const val ADDITIONAL_TIEBREAK_CHECKS = 5
    const val THIRD_COMPLEMENT = "OpenWeatherMap: terceira consulta complementar para as 10 variáveis, não alerta oficial"
    const val MARINE_COMPLEMENT = "Copernicus Marine: ondas, swell, marés, correntes e temperatura do mar"
    const val SATELLITE_COMPLEMENT = "EUMETSAT: satélite, nuvens e ciclones no Atlântico"
    const val LIVE_STATUS = "Cadastro técnico; ingestão ativa das novas fontes ainda não confirmada"
    val primaryTable1Sources = listOf(
        "Alerta Rio (somente cidade do Rio)", "Defesa Civil RJ", "INMET"
    )
    val disputeTable2FiveSources = listOf(
        "Alerta Rio (Rio)", "Defesa Civil RJ", "INMET", "INPE/CPTEC", "Windy"
    )

    // RJ denotes only city Rio coverage for Alerta Rio. INPE/CPTEC and Windy
    // are MODEL sources, never a second station for observational averages.
    val table1 = listOf(
        RjMeteoSourceRow("TEMPERATURA", "Temperatura", "92 municípios, estações existentes", "P1 Alerta Rio (Rio) + Defesa Civil; depois INMET. INPE/CPTEC → Windy só no desempate; OpenWeatherMap é complemento separado das 10 variáveis."),
        RjMeteoSourceRow("SENSACAO_TERMICA", "Sensação térmica", "92 municípios, com entradas válidas", "P1 Alerta Rio (Rio) + Defesa Civil; INMET para T/UR/vento; sensação calculada com entradas da mesma estação. INPE → Windy para previsões; OpenWeatherMap complementar."),
        RjMeteoSourceRow("CHUVA_ATUAL", "Chuva atual", "RJ, estações com medição", "P1 Alerta Rio (Rio) + Defesa Civil; depois INMET para leitura pontual válida. INPE → Windy para contexto; OpenWeatherMap complementar, não confirma chuva neste instante."),
        RjMeteoSourceRow("CHUVA_ACUMULADA", "Chuva acumulada (janelas)", "92 municípios, estações existentes", "P1 Alerta Rio (Rio) + Defesa Civil; depois INMET com igual janela (5/10/15/30/60 min ou 24h). INPE → Windy para previsões; OpenWeatherMap complementar por produto."),
        RjMeteoSourceRow("TEMPORAL", "Temporal e avisos", "92 municípios, área do evento", "Avisos Alerta Rio (Rio) + Defesa Civil P1; verificar INMET antes de INPE → Windy. CEMADEN especializado; OpenWeatherMap complementar, nunca média de níveis de alerta."),
        RjMeteoSourceRow("VENTO", "Vento médio", "92 municípios, estações existentes", "P1 Alerta Rio (Rio) + Defesa Civil; INMET para vento médio da mesma região/hora. INPE → Windy no desempate; OpenWeatherMap complementar."),
        RjMeteoSourceRow("RAJADA", "Rajadas de vento", "92 municípios, estações existentes", "P1 Alerta Rio (Rio) + Defesa Civil; INMET para rajadas registradas com janela. INPE → Windy no desempate; OpenWeatherMap complementar."),
        RjMeteoSourceRow("PRESSAO_ATMOSFERICA", "Pressão / tendência", "92 municípios com estação", "P1 Alerta Rio (Rio) + Defesa Civil se houver pressão medida; INMET para estação. INPE → Windy no desempate; OpenWeatherMap complementar."),
        RjMeteoSourceRow("UMIDADE", "Umidade relativa", "92 municípios, estações existentes", "P1 Alerta Rio (Rio) + Defesa Civil; INMET para umidade medida. INPE → Windy no desempate; OpenWeatherMap complementar."),
        RjMeteoSourceRow("GRANIZO", "Granizo", "92 municípios, área do evento", "P1 avisos Alerta Rio (Rio) + Defesa Civil; INMET para aviso aplicável. INPE → Windy só como previsão; OpenWeatherMap complementar, nunca média de granizo."),
        RjMeteoSourceRow("TEMPESTADE", "Tempestade severa", "92 municípios, área do evento", "Alerta Rio + Defesa Civil P1 na cidade do Rio; INMET/CEMADEN; OpenWeatherMap complementar; EUMETSAT satélite; INPE → Windy"),
        RjMeteoSourceRow("RISCO_HIDROLOGICO", "Cheia e inundação", "Bacias e municípios com risco", "Defesa Civil → CEMADEN → SGB/SACE → ANA"),
        RjMeteoSourceRow("VAZAO_RIO", "Vazão dos rios", "Estações hidrológicas RJ", "ANA HidroWeb → SGB/SACE"),
        RjMeteoSourceRow("RESSACA", "Ressaca e ondas altas", "Litoral RJ", "Marinha/CHM + boias + NOAA + Copernicus Marine; alerta Marinha prevalece"),
        RjMeteoSourceRow("ONDAS", "Ondas, marés e mar", "Litoral e oceano próximo", "Marinha/CHM + NOAA + Copernicus Marine; altura, período e direção"),
        RjMeteoSourceRow("CICLONE_EXTRATROPICAL", "Ciclone extratropical", "Atlântico com possível impacto RJ", "Marinha/CHM + INMET + NOAA + EUMETSAT + Copernicus Marine; INPE → Windy como comparação"),
        RjMeteoSourceRow("CHUVA_ATLANTICO", "Chuva oceânica", "Atlântico próximo ao RJ", "Marinha/CHM + NOAA + EUMETSAT para nuvens e sistemas; INPE → Windy"),
        RjMeteoSourceRow("MASSA_AR", "Massa de ar polar ou quente", "RJ e divisas", "INMET + Marinha + NOAA + EUMETSAT; INPE → Windy"),
        RjMeteoSourceRow("RADAR", "Radar meteorológico próprio", "Cobertura geográfica real RJ", "Alerta Rio (cidade Rio) / CEMADEN → Defesa Civil; grade licenciada"),
        RjMeteoSourceRow("DESLIZAMENTO", "Deslizamentos", "Áreas susceptíveis RJ", "Defesa Civil → CEMADEN → SGB/SACE → ANA"),
        RjMeteoSourceRow("ALAGAMENTO", "Alagamento urbano", "Municípios / vias RJ", "Defesa Civil → CEMADEN → ANA → SGB/SACE; COR.Rio quando aplicável"),
        RjMeteoSourceRow("FRENTE_FRIA", "Frentes frias", "RJ, divisas e Atlântico", "INMET + Marinha + NOAA + EUMETSAT; INPE → Windy"),
        RjMeteoSourceRow("EL_NINO_LA_NINA", "El Niño / La Niña", "Escala climática e impactos no RJ", "INMET → NOAA → INPE → Windy"),
        RjMeteoSourceRow("SISMO", "Sismos e terremotos", "RJ/Atlântico e seção global", "USGS → Defesa Civil → Marinha/CHM → NOAA"),
        RjMeteoSourceRow("TSUNAMI", "Tsunami, maremoto e meteotsunami", "Costa RJ e Atlântico", "Marinha/CHM + NOAA + autoridades brasileiras; USGS para origem sísmica"),
        RjMeteoSourceRow("RAIOS", "Raios e descargas elétricas", "RJ, conforme rede", "NOAA/GOES GLM + rede terrestre autorizada → Defesa Civil"),
        RjMeteoSourceRow("MARE", "Marés e nível do mar", "Litoral RJ", "Marinha/CHM → Copernicus Marine → NOAA; distinguir previsão e nível observado"),
        RjMeteoSourceRow("SWELL", "Swell e ondulações", "Litoral e Atlântico próximo", "Marinha/CHM + NOAA + Copernicus Marine; altura, período e direção"),
        RjMeteoSourceRow("CORRENTES_MARINHAS", "Correntes oceânicas", "Litoral e Atlântico próximo", "Marinha/CHM + Copernicus Marine + NOAA por produto"),
        RjMeteoSourceRow("TEMPERATURA_MAR", "Temperatura da superfície do mar", "Litoral e Atlântico próximo", "Marinha/CHM + Copernicus Marine + NOAA; medição e modelo identificados"),
    )
    val table2 = listOf(
        RjMeteoDisputeRow("01", "Fontes primárias", "Alerta Rio (Rio) e Defesa Civil são P1 conjunta por competência; INMET é a terceira fonte observacional. OpenWeatherMap é complemento separado das dez variáveis."),
        RjMeteoDisputeRow("02", "Duas oficiais compatíveis", "Duas medições independentes e atuais entre Alerta Rio, Defesa Civil e INMET bastam. Comparar unidade, janela, local, estação e pesos; parar se convergirem."),
        RjMeteoDisputeRow("03", "Persistência de divergência", "Após tentar a terceira medição oficial INMET, consultar INPE/CPTEC e somente se inconclusivo Windy. Não misturar medição e modelo numa média."),
        RjMeteoDisputeRow("04", "INPE no primeiro desempate", "INPE/CPTEC é a primeira referência de previsão após as três primárias. Destacar leitura oficial mais próxima somente com horário, localização, modelo e qualidade verificados."),
        RjMeteoDisputeRow("05", "Windy em segundo desempate", "Windy só entra se o INPE não permitir comparação válida. CEMADEN, NOAA e outros órgãos são fontes especializadas por fenômeno, não etapas fixas obrigatórias."),
        RjMeteoDisputeRow("06", "Exibir duas fontes", "Mostrar duas medições oficiais compatíveis ou uma medição pontual mais previsão INPE/Windy, com tipos e horários distintos; preservar todas as leituras divergentes."),
        RjMeteoDisputeRow("07", "Dados faltantes", "Consultar próxima fonte autorizada e cache recente válido. Não inventar medição nem concluir ausência de alerta se não houver evidência."),
        RjMeteoDisputeRow("08", "Fenômenos especializados", "Marinha/NOAA/Copernicus/EUMETSAT por produto; rios ANA/CEMADEN/SGB; sismos USGS e tsunami autoridades competentes. Não ponderar avisos."),
        RjMeteoDisputeRow("09", "P1 conjunta e território", "Alerta Rio e Defesa Civil têm prioridade conjunta onde aplicável, exclusivamente na cidade do Rio para Alerta Rio; republicação não conta como segunda medição."),
        RjMeteoDisputeRow("10", "OpenWeatherMap complementar", "Terceira consulta complementar das 10 variáveis conforme produto e licença, sem contar automaticamente como estação independente nem substituir INMET."),
        RjMeteoDisputeRow("11", "Cálculos verificados", "Ponderação somente de medições compatíveis e independentes com pesos justificados; sensação térmica deriva de entradas válidas, não de média de índices."),
        RjMeteoDisputeRow("12", "Mar e Atlântico", "Marinha/CHM para avisos e marés; NOAA + Copernicus para ondas, swell, correntes e temperatura do mar; EUMETSAT para satélite. Tsunami requer autoridade."),
        RjMeteoDisputeRow("13", "Licença, data e origem", "Verificar autoria, produto, licença/uso comercial, data de observação, validade do aviso, município, autonomia de fontes e atualização antes de apresentar."),
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
            "Marinha + NOAA + EUMETSAT + Copernicus",
            "Evolução atmosférica, deslocamento e efeitos no mar",
            listOf("CICLONE_EXTRATROPICAL")),
        RjMeteoMarineRow("TEMPESTADES_ATLANTICO", "Tempestades no Atlântico",
            "Marinha + NOAA + EUMETSAT",
            "Nuvens e sistemas intensos; satélite não substitui radar",
            listOf("TEMPESTADE", "CHUVA_ATLANTICO")),
        RjMeteoMarineRow("ONDAS_SWELL", "Ondas e swell",
            "Marinha + NOAA + Copernicus",
            "Altura, período, direção e propagação das ondas",
            listOf("ONDAS", "SWELL")),
        RjMeteoMarineRow("RESSACA_LITORAL", "Ressaca no litoral RJ",
            "Marinha + boias + Copernicus + NOAA",
            "Previsão e avaliação do risco costeiro por aviso competente",
            listOf("RESSACA")),
        RjMeteoMarineRow("TSUNAMI", "Tsunami / maremoto",
            "NOAA + Marinha + autoridades brasileiras",
            "Avisos oficiais, nível do mar e avaliação de ameaça",
            listOf("TSUNAMI")),
    )

    init {
        require(primaryTable1Sources.size == 3 && disputeTable2FiveSources.size == 5)
        require(disputeTable2FiveSources.take(2) == listOf("INPE/CPTEC", "INMET"))
        require(disputeTable2FiveSources.last() == "NOAA")
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
