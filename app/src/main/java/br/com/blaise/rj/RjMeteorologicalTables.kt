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

object RjMeteorologicalTables {
    const val ID = "BLAISE-RJ-METEO-HOMOLOG-01"
    const val VERSION = "2026-10-11.v1"
    const val STATUS = "Cadastro técnico • homologação operacional pendente"
    const val METHOD = "2 medições oficiais compatíveis ou medição + previsão separadas"
    const val NO_INEA = "INEA excluído"

    // RJ denotes only city Rio coverage for Alerta Rio. INPE/CPTEC and Windy
    // are MODEL sources, never a second station for observational averages.
    val table1 = listOf(
        RjMeteoSourceRow("TEMPERATURA", "Temperatura", "92 municípios, estações existentes", "Rio: Alerta Rio → Defesa Civil → INMET → INPE → Windy; demais: Defesa Civil → INMET → INPE → Windy"),
        RjMeteoSourceRow("SENSACAO_TERMICA", "Sensação térmica", "92 municípios, com entradas válidas", "Alerta Rio (cidade Rio) → Defesa Civil → INMET; cálculo físico Blaise; INPE → Windy como contexto"),
        RjMeteoSourceRow("UMIDADE", "Umidade relativa", "92 municípios, estações existentes", "Defesa Civil → INMET → INPE → Windy; Alerta Rio se produto aplicável à cidade Rio"),
        RjMeteoSourceRow("VENTO", "Vento médio", "92 municípios, estações existentes", "Rio: Alerta Rio → Defesa Civil → INMET → INPE → Windy; demais: Defesa Civil → INMET → INPE → Windy"),
        RjMeteoSourceRow("RAJADA", "Rajadas de vento", "92 municípios, estações existentes", "Rio: Alerta Rio → Defesa Civil → INMET → INPE → Windy; demais: Defesa Civil → INMET → INPE → Windy"),
        RjMeteoSourceRow("CHUVA_ACUMULADA", "Chuva acumulada (janelas)", "92 municípios, estações existentes", "Rio: Alerta Rio → Defesa Civil → INMET → INPE → Windy; CEMADEN por cobertura"),
        RjMeteoSourceRow("TEMPORAL", "Temporal e avisos", "92 municípios, área do evento", "Rio: Alerta Rio → Defesa Civil → INMET → INPE → Windy; CEMADEN conforme aviso"),
        RjMeteoSourceRow("TEMPESTADE", "Tempestade severa", "92 municípios, área do evento", "Rio: Alerta Rio → Defesa Civil → INMET → INPE → Windy; CEMADEN conforme produto"),
        RjMeteoSourceRow("RISCO_HIDROLOGICO", "Cheia e inundação", "Bacias e municípios com risco", "Defesa Civil → CEMADEN → SGB/SACE → ANA"),
        RjMeteoSourceRow("VAZAO_RIO", "Vazão dos rios", "Estações hidrológicas RJ", "ANA HidroWeb → SGB/SACE"),
        RjMeteoSourceRow("RESSACA", "Ressaca e ondas altas", "Litoral RJ", "Marinha/CHM → INMET → NOAA → INPE → Windy"),
        RjMeteoSourceRow("ONDAS", "Ondas, marés e mar", "Litoral e oceano próximo", "Marinha/CHM → NOAA → INPE → Windy"),
        RjMeteoSourceRow("CICLONE_EXTRATROPICAL", "Ciclone extratropical", "Atlântico com possível impacto RJ", "Marinha/CHM → INMET → Defesa Civil → NOAA → INPE → Windy"),
        RjMeteoSourceRow("CHUVA_ATLANTICO", "Chuva oceânica", "Atlântico próximo ao RJ", "Marinha/CHM → NOAA → INPE → Windy"),
        RjMeteoSourceRow("MASSA_AR", "Massa de ar polar ou quente", "RJ e divisas", "INMET → Marinha → NOAA → INPE → Windy"),
        RjMeteoSourceRow("RADAR", "Radar meteorológico próprio", "Cobertura geográfica real RJ", "Alerta Rio (cidade Rio) / CEMADEN → Defesa Civil; grade licenciada"),
        RjMeteoSourceRow("GRANIZO", "Granizo", "92 municípios, área do evento", "Defesa Civil → INMET → CEMADEN → INPE → Windy"),
        RjMeteoSourceRow("DESLIZAMENTO", "Deslizamentos", "Áreas susceptíveis RJ", "Defesa Civil → CEMADEN → SGB/SACE → ANA"),
        RjMeteoSourceRow("ALAGAMENTO", "Alagamento urbano", "Municípios / vias RJ", "Defesa Civil → CEMADEN → ANA → SGB/SACE; COR.Rio quando aplicável"),
        RjMeteoSourceRow("FRENTE_FRIA", "Frentes frias", "RJ, divisas e Atlântico", "INMET → Defesa Civil → Marinha/CHM → NOAA → INPE → Windy"),
        RjMeteoSourceRow("EL_NINO_LA_NINA", "El Niño / La Niña", "Escala climática e impactos no RJ", "INMET → NOAA → INPE → Windy"),
        RjMeteoSourceRow("SISMO", "Sismos e terremotos", "RJ/Atlântico e seção global", "USGS → Defesa Civil → Marinha/CHM → NOAA"),
        RjMeteoSourceRow("TSUNAMI", "Tsunami, maremoto e meteotsunami", "Costa RJ e Atlântico", "Marinha/CHM + NOAA + autoridades brasileiras; USGS para origem sísmica"),
        RjMeteoSourceRow("PRESSAO_ATMOSFERICA", "Pressão / tendência", "92 municípios com estação", "INMET → INPE → Windy; Alerta Rio apenas se produto compatível"),
        RjMeteoSourceRow("RAIOS", "Raios e descargas elétricas", "RJ, conforme rede", "NOAA/GOES GLM + rede terrestre autorizada → Defesa Civil"),
    )
    val table2 = listOf(
        RjMeteoDisputeRow("01", "Primeiras fontes", "Alerta Rio somente na cidade do Rio, depois Defesa Civil regional e INMET; selecionar por fenômeno e local."),
        RjMeteoDisputeRow("02", "Duas medições compatíveis", "Usar duas estações oficiais independentes; ponderação apenas com pesos, janela e unidade comprovados."),
        RjMeteoDisputeRow("03", "Valores divergentes", "Conferir horários, distâncias, sensores e consultar a terceira fonte oficial."),
        RjMeteoDisputeRow("04", "Desempate INPE/CPTEC", "Consultar previsão INPE primeiro; destacar a leitura oficial mais próxima somente quando defensável. Manter as medições originais."),
        RjMeteoDisputeRow("05", "Desempate Windy", "Somente se INPE inconclusivo: usar modelo autorizado e identificado, sem tratá-lo como sensor."),
        RjMeteoDisputeRow("06", "Duas fontes apresentadas", "Mostrar leituras reais e/ou uma medição oficial + uma previsão identificada; nunca média mista de modelo e sensor."),
        RjMeteoDisputeRow("07", "Dados faltantes", "Usar próximo canal autorizado ou cache recente; nunca criar valor numérico ou aviso sem evidência."),
        RjMeteoDisputeRow("08", "Exceções especializadas", "Avisos marítimos, rios, raios, sismo e tsunami usam fontes competentes; não fazer média de categorias de alerta."),
    )
    init {
        require(table1.size == 25 && table1.map { it.code }.distinct().size == 25)
        require(table2.size == 8)
        require(table1.none { it.code.contains("INEA") || it.priority.contains("INEA") })
    }
}
