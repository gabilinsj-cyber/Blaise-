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
    const val VERSION = "2026-10-14.v5"
    const val STATUS = "Cadastro técnico • homologação operacional pendente"
    const val METHOD = "Duas medições oficiais compatíveis: média ponderada; se divergirem, INPE e depois Windy são referências de previsão, nunca segunda medição"
    const val NO_INEA = "INEA excluído"
    const val PHENOMENA_COUNT = 30
    const val ADDITIONAL_TIEBREAK_CHECKS = 5
    const val THIRD_COMPLEMENT = "OpenWeatherMap: terceira consulta complementar para as 10 variáveis, não alerta oficial"
    const val MARINE_COMPLEMENT = "Copernicus Marine: ondas, swell, marés, correntes e temperatura do mar"
    const val SATELLITE_COMPLEMENT = "EUMETSAT: satélite, nuvens e ciclones no Atlântico"
    const val LIVE_STATUS = "Cadastro técnico; ingestão ativa das novas fontes ainda não confirmada"
    val primaryTable1Sources = listOf(
        "Alerta Rio", "Defesa Civil RJ", "OpenWeatherMap (3ª consulta complementar)"
    )
    // The five main weather sources are an explicit PRIORITY SEQUENCE.
    // OpenWeatherMap is a separate third complementary consultation for
    // the ten Table 1 variables, NOT an official observer/alert issuer.
    // Alerta Rio is restricted to municipality IBGE 3304557.
    val disputeTable2FiveSources = listOf(
        "Alerta Rio", "Defesa Civil RJ", "INMET", "INPE/CPTEC", "Windy"
    )
    val primaryObservationalHierarchy = disputeTable2FiveSources.take(3)
    val modelTieBreakHierarchy = disputeTable2FiveSources.takeLast(2)

    // RJ denotes only city Rio coverage for Alerta Rio. INPE/CPTEC and Windy
    // are MODEL sources, never a second station for observational averages.
    val table1 = listOf(
        RjMeteoSourceRow("TEMPERATURA", "Temperatura", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil; 3ª consulta OpenWeatherMap; verificação INMET (3ª fonte oficial) → INPE (1º modelo de desempate) → Windy (se necessário)"),
        RjMeteoSourceRow("SENSACAO_TERMICA", "Sensação térmica", "92 municípios, com entradas válidas", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3º complemento; cálculo físico Blaise sobre entradas válidas, sem média de índices"),
        RjMeteoSourceRow("CHUVA_ATUAL", "Chuva atual", "RJ, estações com medição", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3ª consulta por produto; leituras de chuva: INMET (3ª oficial) → INPE → Windy (previsões separadas)"),
        RjMeteoSourceRow("CHUVA_ACUMULADA", "Chuva acumulada (janelas)", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil por igual janela; OpenWeatherMap 3ª consulta; INMET (3ª oficial) → INPE → Windy (se INPE inconclusivo)"),
        RjMeteoSourceRow("TEMPORAL", "Temporal e avisos", "92 municípios, área do evento", "P1 Alerta Rio + Defesa Civil por aviso vigente; OpenWeatherMap 3ª consulta complementar; INPE, INMET, CEMADEN, Windy, NOAA para evidências, não média de alertas"),
        RjMeteoSourceRow("VENTO", "Vento médio", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3ª consulta; verificação INMET (3ª fonte oficial) → INPE (1º modelo de desempate) → Windy (se necessário)"),
        RjMeteoSourceRow("RAJADA", "Rajadas de vento", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3ª consulta; verificação INMET (3ª fonte oficial) → INPE (1º modelo de desempate) → Windy (se necessário)"),
        RjMeteoSourceRow("PRESSAO_ATMOSFERICA", "Pressão / tendência", "92 municípios com estação", "P1 Alerta Rio + Defesa Civil com dados reais; OpenWeatherMap 3ª consulta; verificação INMET (3ª fonte oficial) → INPE (1º modelo de desempate) → Windy (se necessário)"),
        RjMeteoSourceRow("UMIDADE", "Umidade relativa", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3ª consulta; verificação INMET (3ª fonte oficial) → INPE (1º modelo de desempate) → Windy (se necessário)"),
        RjMeteoSourceRow("GRANIZO", "Granizo", "92 municípios, área do evento", "P1 Alerta Rio + Defesa Civil por aviso oficial; OpenWeatherMap 3ª consulta de contexto; desempate conforme fenômeno e produto, nunca média de avisos"),
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
        RjMeteoDisputeRow("01", "Prioridade P1 da Tabela 1", "Alerta Rio (somente cidade do Rio) + Defesa Civil P1 conjunta; OpenWeatherMap como 3ª consulta complementar, não como terceira medição oficial. Se duas observações independentes convergirem, calcular e parar."),
        RjMeteoDisputeRow("02", "Duas medições compatíveis", "Consultar Alerta Rio (onde atua), Defesa Civil e INMET nesta ordem. Duas medições oficiais independentes e comparáveis bastam; verificar origem, estação, período e qualidade; republicação não conta como segunda fonte."),
        RjMeteoDisputeRow("03", "Sem convergência oficial", "Se Alerta Rio e Defesa Civil discordarem, verificar INMET; após as fontes observacionais, consultar INPE/CPTEC como primeira previsão de desempate. Somente se INPE não orientar uma leitura, consultar Windy. Não misturar previsão com medição."),
        RjMeteoDisputeRow("04", "INMET antes de INPE", "INMET é a 3ª fonte observacional na hierarquia; INPE/CPTEC é o 1º desempate por previsão. Exibir sempre separadamente valor medido, valor previsto, fontes e horários."),
        RjMeteoDisputeRow("05", "Windy e fontes especializadas", "Windy só é consultado como desempate após INPE inconclusivo. CEMADEN (chuva e riscos), NOAA e Marinha (Atlântico e mar) entram conforme o fenômeno; modelos nunca substituem medições ou avisos."),
        RjMeteoDisputeRow("06", "Duas entradas identificadas", "Se o INPE ou Windy se aproximar mais de uma estação, destacar medição oficial + previsão do modelo, preservando as outras observações divergentes; nunca criar média mista de previsão e medição."),
        RjMeteoDisputeRow("07", "Dados faltantes", "Usar próximo canal autorizado ou cache recente; nunca criar valor numérico ou aviso sem evidência."),
        RjMeteoDisputeRow("08", "Exceções especializadas", "Avisos marítimos, rios, raios, sismo e tsunami usam fontes competentes; não fazer média de categorias de alerta."),
        RjMeteoDisputeRow("09", "P1 conjunta", "Alerta Rio e Defesa Civil são prioridade conjunta no Rio; dado republicado não equivale a duas medições independentes."),
        RjMeteoDisputeRow("10", "Terceira fonte complementar", "OpenWeatherMap auxilia as 10 variáveis da tabela, quando o produto existe; não substitui INMET, Alerta Rio ou avisos oficiais."),
        RjMeteoDisputeRow("11", "Compatibilidade antes de ponderar", "Média só entre unidades, janelas de tempo, localidades e tipos de dados equivalentes, com pesos verificáveis."),
        RjMeteoDisputeRow("12", "Exceções marítimas", "Marinha/NOAA/Copernicus/EUMETSAT conforme o evento; tsunami depende de aviso competente, nunca de imagens ou de média."),
        RjMeteoDisputeRow("13", "Licença e rastreabilidade", "Verificar produto, fonte, hora, autorização de uso comercial, atribuição e independência; sem evidência, não emitir alerta."),
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
        require(primaryObservationalHierarchy == listOf("Alerta Rio", "Defesa Civil RJ", "INMET"))
        require(modelTieBreakHierarchy == listOf("INPE/CPTEC", "Windy"))
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
