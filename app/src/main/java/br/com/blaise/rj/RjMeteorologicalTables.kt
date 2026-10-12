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
    const val VERSION = "2026-10-12.v2"
    const val STATUS = "Cadastro técnico • homologação operacional pendente"
    const val METHOD = "2 medições oficiais compatíveis ou medição + previsão separadas"
    const val NO_INEA = "INEA excluído"
    const val PHENOMENA_COUNT = 30
    const val ADDITIONAL_TIEBREAK_CHECKS = 5
    const val THIRD_COMPLEMENT = "OpenWeatherMap: terceira consulta complementar para as 10 variáveis, não alerta oficial"
    const val MARINE_COMPLEMENT = "Copernicus Marine: ondas, swell, marés, correntes e temperatura do mar"
    const val SATELLITE_COMPLEMENT = "EUMETSAT: satélite, nuvens e ciclones no Atlântico"
    const val LIVE_STATUS = "Cadastro técnico; ingestão ativa das novas fontes ainda não confirmada"

    // RJ denotes only city Rio coverage for Alerta Rio. INPE/CPTEC and Windy
    // are MODEL sources, never a second station for observational averages.
    val table1 = listOf(
        RjMeteoSourceRow("TEMPERATURA", "Temperatura", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil se existir medição; INMET 3ª fonte oficial; OpenWeatherMap 3º complemento; INPE → Windy para divergência"),
        RjMeteoSourceRow("SENSACAO_TERMICA", "Sensação térmica", "92 municípios, com entradas válidas", "P1 Alerta Rio + Defesa Civil com entradas reais; fórmula Blaise; INMET; OpenWeatherMap complementar; INPE → Windy"),
        RjMeteoSourceRow("CHUVA_ATUAL", "Chuva atual", "RJ, estações com medição", "Alerta Rio + Defesa Civil (P1 na cidade do Rio) → INMET; OpenWeatherMap como 3º complemento; INPE → Windy"),
        RjMeteoSourceRow("CHUVA_ACUMULADA", "Chuva acumulada (janelas)", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil para períodos iguais; INMET/CEMADEN; OpenWeatherMap 3º complemento por janela; INPE → Windy"),
        RjMeteoSourceRow("TEMPORAL", "Temporal e avisos", "92 municípios, área do evento", "P1 Alerta Rio + Defesa Civil para avisos oficiais; INMET/CEMADEN; OpenWeatherMap como complemento; INPE → Windy"),
        RjMeteoSourceRow("VENTO", "Vento médio", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil se houver medição; INMET; OpenWeatherMap complementar; INPE → Windy"),
        RjMeteoSourceRow("RAJADA", "Rajadas de vento", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil se houver medição; INMET; OpenWeatherMap complementar; INPE → Windy"),
        RjMeteoSourceRow("PRESSAO_ATMOSFERICA", "Pressão / tendência", "92 municípios com estação", "P1 Alerta Rio + Defesa Civil se houver produto; INMET; OpenWeatherMap complementar; INPE → Windy"),
        RjMeteoSourceRow("UMIDADE", "Umidade relativa", "92 municípios, estações existentes", "P1 Alerta Rio + Defesa Civil se houver medição; INMET; OpenWeatherMap complementar; INPE → Windy"),
        RjMeteoSourceRow("GRANIZO", "Granizo", "92 municípios, área do evento", "P1 Alerta Rio + Defesa Civil por aviso competente; INMET/CEMADEN; OpenWeatherMap complementar conforme produto; INPE → Windy"),
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
    /** Five explicitly ordered audit checks, not five substitute measurements. */
    val fiveDisputeChecks = listOf(
        RjMeteoDisputeRow("01", "INPE/CPTEC • primeira análise",
            "Comparar previsão válida, local e modelo com os dados oficiais; não é leitura de estação."),
        RjMeteoDisputeRow("02", "INMET • medição independente",
            "Verificar estação e horário do município fluminense; nunca usar estação de outro estado como medição local."),
        RjMeteoDisputeRow("03", "OpenWeatherMap • terceira consulta",
            "Produto meteorológico complementar com chave/licença verificadas; não é nova autoridade de alerta nem estação necessariamente independente."),
        RjMeteoDisputeRow("04", "Windy • modelo subsidiário",
            "Usar como contexto se INPE não conseguir resolver comparação; identificar o modelo e seu horário."),
        RjMeteoDisputeRow("05", "Marinha/NOAA/Copernicus/EUMETSAT",
            "Para ondas, swell, ciclones e satélite escolher especialistas; tsunami só com aviso das autoridades competentes."),
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
        RjMeteoDisputeRow("09", "P1 conjunta", "Alerta Rio e Defesa Civil são prioridade conjunta no Rio; dado republicado não equivale a duas medições independentes."),
        RjMeteoDisputeRow("10", "Terceira fonte complementar", "OpenWeatherMap auxilia as 10 variáveis da tabela, quando o produto existe; não substitui INMET, Alerta Rio ou avisos oficiais."),
        RjMeteoDisputeRow("11", "Compatibilidade antes de ponderar", "Média só entre unidades, janelas de tempo, localidades e tipos de dados equivalentes, com pesos verificáveis."),
        RjMeteoDisputeRow("12", "Exceções marítimas", "Marinha/NOAA/Copernicus/EUMETSAT conforme o evento; tsunami depende de aviso competente, nunca de imagens ou de média."),
        RjMeteoDisputeRow("13", "Licença e rastreabilidade", "Verificar produto, fonte, hora, autorização de uso comercial, atribuição e independência; sem evidência, não emitir alerta."),
    )
    init {
        require(table1.size == PHENOMENA_COUNT && table1.map { it.code }.distinct().size == PHENOMENA_COUNT)
        require(table2.size == 8 + ADDITIONAL_TIEBREAK_CHECKS)
        require(fiveDisputeChecks.size == 5)
        require(fiveDisputeChecks.first().title.startsWith("INPE"))
        require(fiveDisputeChecks[1].title.startsWith("INMET"))
        require(table1.none { it.code.contains("INEA") || it.priority.contains("INEA") })
    }
}
