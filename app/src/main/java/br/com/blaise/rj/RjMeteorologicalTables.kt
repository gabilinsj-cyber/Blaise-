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
    const val VERSION = "2026-10-15.v9"
    const val STATUS = "Cadastro técnico • homologação operacional pendente"
    const val METHOD = "Duas das três primárias convergentes: média ponderada somente com pesos verificados; senão cinco referências de desempate"
    const val NO_INEA = "INEA excluído"
    const val PHENOMENA_COUNT = 30
    const val ADDITIONAL_TIEBREAK_CHECKS = 5
    const val THIRD_COMPLEMENT = "OpenWeatherMap: terceira consulta complementar para as 10 variáveis, não alerta oficial"
    const val MARINE_COMPLEMENT = "Base marítima: NOAA + Copernicus Marine + EUMETSAT por produto; CPTEC/INPE como previsão complementar"
    const val MARINE_PRIORITY = "NOAA → Copernicus Marine → EUMETSAT conforme produto; CPTEC/INPE complementar, conforme disponibilidade e licença"
    const val MARINE_AUTHORITY = "Avisos de tsunami/ressaca exigem órgão competente e cobertura validada; prioridade de dados não altera autoridade"
    const val CPTEC_MARINE_URL = "https://servicos.cptec.inpe.br/XML/"
    const val CPTEC_MARINE_STATUS = "CPTEC/INPE: previsão de ondas e vento documentada; serviço indisponível na verificação. Sem dados atuais validados. Não fornece maré local nem confirmação de tsunami."
    const val REDEMET_URL = "https://redemet.decea.mil.br/"
    const val REDEMET_STATUS = "REDEMET/DECEA • alternativa da Tabela 2 para temperatura, vento, rajadas e QNH de aeródromos. Coleta exige chave no servidor, autorização e validação do horário. Não fornece risco hidrológico nem média municipal."
    const val SIMCOSTA_URL = "https://www.simcosta.furg.br/"
    const val SIMCOSTA_STATUS = "SiMCosta/FURG • complemento marítimo observacional por estação e sensor. Validar atividade, horário, acesso e termos; ainda sem ingestão automática. Não substitui aviso de ressaca ou tsunami."
    const val STORMSURF_URL = "https://www.stormsurf.com/page2/links/satla72hr.shtml"
    const val STORMSURF_DESCRIPTION = "Stormsurf • Atlântico Sul: consulta complementar de previsão de ondas, swell e vento. Produtos derivados da NOAA não contam como fonte independente. Não confirma maré local nem aviso oficial de ressaca."
    const val SATELLITE_COMPLEMENT = "EUMETSAT: satélite, nuvens e ciclones no Atlântico"
    const val LIVE_STATUS = "Cadastro técnico; ingestão ativa das novas fontes ainda não confirmada"
    val primaryTable1Sources = listOf(
        "Alerta Rio", "Defesa Civil RJ", "OpenWeatherMap (3ª consulta complementar)"
    )
    val disputeTable2FiveSources = listOf(
        "INPE/CPTEC", "INMET", "CEMADEN", "Windy", "NOAA"
    )

    // RJ denotes only city Rio coverage for Alerta Rio. INPE/CPTEC and Windy
    // are MODEL sources, never a second station for observational averages.
    val table1 = listOf(
        RjMeteoSourceRow("TEMPERATURA", "Temperatura", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil; 3ª consulta OpenWeatherMap; desempate INPE → INMET → CEMADEN → Windy → NOAA"),
        RjMeteoSourceRow("SENSACAO_TERMICA", "Sensação térmica", "92 municípios, com entradas válidas", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3º complemento; cálculo físico Blaise sobre entradas válidas, sem média de índices"),
        RjMeteoSourceRow("CHUVA_ATUAL", "Chuva atual", "RJ, estações com medição", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3ª consulta por produto; desempate de leituras de chuva INPE → INMET → CEMADEN → Windy → NOAA"),
        RjMeteoSourceRow("CHUVA_ACUMULADA", "Chuva acumulada (janelas)", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil por igual janela; OpenWeatherMap 3ª consulta; INPE → INMET → CEMADEN → Windy → NOAA"),
        RjMeteoSourceRow("TEMPORAL", "Temporal e avisos", "92 municípios, área do evento", "P1 Alerta Rio + Defesa Civil por aviso vigente; OpenWeatherMap 3ª consulta complementar; INPE, INMET, CEMADEN, Windy, NOAA para evidências, não média de alertas"),
        RjMeteoSourceRow("VENTO", "Vento médio", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3ª consulta; desempate INPE → INMET → CEMADEN → Windy → NOAA"),
        RjMeteoSourceRow("RAJADA", "Rajadas de vento", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3ª consulta; desempate INPE → INMET → CEMADEN → Windy → NOAA"),
        RjMeteoSourceRow("PRESSAO_ATMOSFERICA", "Pressão / tendência", "92 municípios com estação", "P1 Alerta Rio + Defesa Civil com dados reais; OpenWeatherMap 3ª consulta; desempate INPE → INMET → CEMADEN → Windy → NOAA"),
        RjMeteoSourceRow("UMIDADE", "Umidade relativa", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3ª consulta; desempate INPE → INMET → CEMADEN → Windy → NOAA"),
        RjMeteoSourceRow("GRANIZO", "Granizo", "92 municípios, área do evento", "P1 Alerta Rio + Defesa Civil por aviso oficial; OpenWeatherMap 3ª consulta de contexto; desempate conforme fenômeno e produto, nunca média de avisos"),
        RjMeteoSourceRow("TEMPESTADE", "Tempestade severa", "92 municípios, área do evento", "Alerta Rio + Defesa Civil P1 na cidade do Rio; INMET/CEMADEN; OpenWeatherMap complementar; EUMETSAT satélite; INPE → Windy"),
        RjMeteoSourceRow("RISCO_HIDROLOGICO", "Cheia e inundação", "Bacias e municípios com risco", "Defesa Civil → CEMADEN → SGB/SACE → ANA"),
        RjMeteoSourceRow("VAZAO_RIO", "Vazão dos rios", "Estações hidrológicas RJ", "ANA HidroWeb → SGB/SACE"),
        RjMeteoSourceRow("RESSACA", "Ressaca e ondas altas", "Litoral RJ", "NOAA + Copernicus Marine; EUMETSAT para contexto; CPTEC/INPE para previsão; aviso competente separado"),
        RjMeteoSourceRow("ONDAS", "Ondas, marés e mar", "Litoral e oceano próximo", "NOAA + Copernicus Marine; CPTEC/INPE para previsão; altura, período e direção"),
        RjMeteoSourceRow("CICLONE_EXTRATROPICAL", "Ciclone extratropical", "Atlântico com possível impacto RJ", "NOAA + Copernicus Marine + EUMETSAT; INMET/INPE para contexto atmosférico; CPTEC/INPE para previsão"),
        RjMeteoSourceRow("CHUVA_ATLANTICO", "Chuva oceânica", "Atlântico próximo ao RJ", "NOAA + EUMETSAT para nuvens e sistemas; Copernicus por produto; CPTEC/INPE para previsão"),
        RjMeteoSourceRow("MASSA_AR", "Massa de ar polar ou quente", "RJ e divisas", "INMET + NOAA + EUMETSAT; Copernicus conforme produto; CPTEC/INPE como previsão complementar; INPE → Windy"),
        RjMeteoSourceRow("RADAR", "Radar meteorológico próprio", "Cobertura geográfica real RJ", "Alerta Rio (cidade Rio) / CEMADEN → Defesa Civil; grade licenciada"),
        RjMeteoSourceRow("DESLIZAMENTO", "Deslizamentos", "Áreas susceptíveis RJ", "Defesa Civil → CEMADEN → SGB/SACE → ANA"),
        RjMeteoSourceRow("ALAGAMENTO", "Alagamento urbano", "Municípios / vias RJ", "Defesa Civil → CEMADEN → ANA → SGB/SACE; COR.Rio quando aplicável"),
        RjMeteoSourceRow("FRENTE_FRIA", "Frentes frias", "RJ, divisas e Atlântico", "INMET + NOAA + EUMETSAT; Copernicus conforme produto; CPTEC/INPE como previsão complementar; INPE → Windy"),
        RjMeteoSourceRow("EL_NINO_LA_NINA", "El Niño / La Niña", "Escala climática e impactos no RJ", "INMET → NOAA → INPE → Windy"),
        RjMeteoSourceRow("SISMO", "Sismos e terremotos", "RJ/Atlântico e seção global", "USGS → Defesa Civil → NOAA"),
        RjMeteoSourceRow("TSUNAMI", "Tsunami, maremoto e meteotsunami", "Costa RJ e Atlântico", "NOAA conforme jurisdição + autoridades brasileiras; USGS para origem sísmica"),
        RjMeteoSourceRow("RAIOS", "Raios e descargas elétricas", "RJ, conforme rede", "NOAA/GOES GLM + rede terrestre autorizada → Defesa Civil"),
        RjMeteoSourceRow("MARE", "Marés e nível do mar", "Litoral RJ", "NOAA/Copernicus Marine com produto de maré local validado; não confundir nível modelado com alta/baixa"),
        RjMeteoSourceRow("SWELL", "Swell e ondulações", "Litoral e Atlântico próximo", "NOAA + Copernicus Marine; CPTEC/INPE para previsão; altura, período e direção"),
        RjMeteoSourceRow("CORRENTES_MARINHAS", "Correntes oceânicas", "Litoral e Atlântico próximo", "NOAA + Copernicus Marine"),
        RjMeteoSourceRow("TEMPERATURA_MAR", "Temperatura da superfície do mar", "Litoral e Atlântico próximo", "NOAA + Copernicus Marine; medição e modelo identificados"),
    )
    val table2 = listOf(
        RjMeteoDisputeRow("01", "Três fontes da Tabela 1", "Alerta Rio e Defesa Civil P1; OpenWeatherMap como 3ª consulta complementar. Se duas leituras independentes convergirem, parar e calcular média ponderada somente com pesos verificados."),
        RjMeteoDisputeRow("02", "Convergência 2 de 3", "Duas observações independentes e comparáveis entre as três primeiras bastam; verificar origem, estação, janela e qualidade; jamais duplicar medição republicada."),
        RjMeteoDisputeRow("03", "Se não houver convergência", "Consultar CINCO fontes de desempate em ordem: INPE/CPTEC → INMET → CEMADEN → Windy → NOAA; basta uma confirmar aproximadamente uma leitura primária."),
        RjMeteoDisputeRow("04", "INPE e INMET", "INPE/CPTEC é a 1ª consulta; INMET é a 2ª. Se o INPE oferecer apenas previsão, apresentar previsão e medição separadas; uma estação INMET pode validar uma medição existente."),
        RjMeteoDisputeRow("05", "CEMADEN, Windy e NOAA", "Se necessário, CEMADEN é a 3ª referência, Windy a 4ª e NOAA a 5ª. Aplicar somente produtos compatíveis por fenômeno; modelos não substituem medições."),
        RjMeteoDisputeRow("06", "Duas fontes apresentadas", "Mostrar leituras reais e/ou uma medição oficial + uma previsão identificada; nunca média mista de modelo e sensor."),
        RjMeteoDisputeRow("07", "Dados faltantes", "Fonte atrasada ou indisponível: consultar a próxima fonte autorizada e compatível. REDEMET é alternativa ao INMET para temperatura, vento, rajadas e QNH de aeródromos validados; não substitui risco CEMADEN, chuva acumulada ou dados marítimos. Medições com mais de 5 min não entram no cálculo; sem fonte atual, mostrar dados indisponíveis. Exibir fonte e horário de origem."),
        RjMeteoDisputeRow("08", "Exceções especializadas", "Avisos marítimos, rios, raios, sismo e tsunami usam fontes competentes; não fazer média de categorias de alerta."),
        RjMeteoDisputeRow("09", "P1 conjunta", "Alerta Rio e Defesa Civil são prioridade conjunta no Rio; dado republicado não equivale a duas medições independentes."),
        RjMeteoDisputeRow("10", "Terceira fonte complementar", "OpenWeatherMap auxilia as 10 variáveis da tabela, quando o produto existe; não substitui INMET, Alerta Rio ou avisos oficiais."),
        RjMeteoDisputeRow("11", "Compatibilidade antes de ponderar", "Média ponderada somente entre duas medições atuais, independentes e similares, com unidades, janelas, localidades e tipos equivalentes e pesos verificáveis. Sem pesos válidos, mostrar as leituras sem calcular. Previsão não é medição."),
        RjMeteoDisputeRow("12", "Exceções marítimas", "NOAA/Copernicus/EUMETSAT por produto; CPTEC/INPE como previsão complementar; tsunami depende de aviso competente, nunca de imagens ou de média."),
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

    // Maritime rows updated to the data priority approved on 2026-10-15.
    // These are SOURCE ELIGIBILITY, not live observations or warnings.
    val marineTable = listOf(
        RjMeteoMarineRow("CICLONES_OCEANICOS", "Ciclones oceânicos",
            "NOAA + Copernicus Marine + EUMETSAT; CPTEC/INPE como previsão complementar",
            "Evolução atmosférica, deslocamento e efeitos no mar",
            listOf("CICLONE_EXTRATROPICAL")),
        RjMeteoMarineRow("TEMPESTADES_ATLANTICO", "Tempestades no Atlântico",
            "NOAA + EUMETSAT; Copernicus conforme produto; CPTEC/INPE como previsão complementar",
            "Nuvens e sistemas intensos; satélite não substitui radar",
            listOf("TEMPESTADE", "CHUVA_ATLANTICO")),
        RjMeteoMarineRow("ONDAS_SWELL", "Ondas e swell",
            "NOAA + Copernicus Marine; CPTEC/INPE como previsão; SiMCosta para observações validadas",
            "Altura, período, direção e propagação das ondas",
            listOf("ONDAS", "SWELL")),
        RjMeteoMarineRow("RESSACA_LITORAL", "Ressaca no litoral RJ",
            "NOAA + Copernicus Marine; EUMETSAT para contexto; CPTEC/INPE como previsão complementar",
            "Previsão e avaliação do risco costeiro por aviso competente",
            listOf("RESSACA")),
        RjMeteoMarineRow("TSUNAMI", "Tsunami / maremoto",
            "NOAA conforme competência + autoridades brasileiras",
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
