package br.com.blaise.rj

/**
 * Canonical product/UI contract for the approved Blaise V6 RJ dashboard.
 * This file deliberately contains no sample weather values: production UI must
 * render only timestamped source data supplied by the runtime adapters.
 */
object FinalDashboardSpec {
    const val STORE_GOOGLE_PLAY = "GOOGLE_PLAY"
    const val STORE_SAMSUNG = "SAMSUNG_GALAXY_STORE"
    const val STORE_AMAZON = "AMAZON_APPSTORE"
    const val PRODUCT = "Blaise V6 RJ"
    const val TAGLINE = "Clima e Tempo"
    const val DEFAULT_POWER_STATE = "LIGADO"
    const val ASSISTANT_PROMPT = "Como posso ajudar?"
    const val RADAR_WINDOW_MINUTES = 30
    const val MAX_INLINE_ALERTS_PER_CITY = 3
    const val HOME_LOCAL_NEWS_COUNT = 2
    const val HOME_INTERNATIONAL_NEWS_COUNT = 1
    const val HOME_SEISMIC_EVENT_COUNT = 2
    const val SEISMIC_NOTIFICATION_MIN_MAGNITUDE = 7.0

    val primaryNavigation = listOf(
        "Início", "Cidades", "Mapa", "Alertas", "Trânsito",
        "Mar e Ondas", "Qualidade do Ar", "Notícias", "Histórico", "Mais"
    )

    val trafficEvents = listOf(
        "Interdições", "Acidentes", "Bolsões d’água", "Alagamentos",
        "Queda de árvore/poste", "Túneis fechados", "Deslizamentos", "Obras", "Rotas alternativas"
    )

    val officialSources = listOf(
        "COR.Rio", "CET-Rio", "Alerta Rio", "Geo-Rio",
        "Defesa Civil Municipal", "Defesa Civil Estadual", "CEMADEN", "ANA/Hidroweb", "SGB/SACE",
        "Marinha do Brasil/CHM", "INMET", "CPTEC/INPE", "USGS"
    )

    // Five situational weather channels; Windy and INPE/CPTEC provide
    // forecast context, not interchangeable measured station reports.
    val fiveSituationalWeatherSources = listOf(
        "INPE/CPTEC", "INMET", "Windy", "CEMADEN", "NOAA"
    )

    // Supplementary provider catalog: visible configuration, NOT live status.
    // The OpenWeatherMap "third source" in the reference image means third
    // complementary CONSULTATION, not the third official alert authority.
    val tenVariableOpenWeatherMap = listOf(
        "Temperatura", "Sensação térmica", "Chuva atual", "Chuva acumulada",
        "Temporais", "Vento sustentado", "Rajadas", "Pressão atmosférica",
        "Umidade relativa", "Granizo"
    )
    val oceanSatelliteSources = listOf(
        "Marinha do Brasil/CHM", "NOAA", "Copernicus Marine",
        "EUMETSAT", "INMET", "INPE/CPTEC", "Windy"
    )
    const val EXPANDED_METEO_PHENOMENA_COUNT = 30
    const val EXTRA_DISPUTE_CHECKS = 5
    const val SUPPLEMENTAL_SOURCE_STATUS = "Cadastrada • ingestão de dados ainda não validada"

    val newsScopes = listOf("RJ", "Niterói", "São Gonçalo", "Região", "Nacional", "Internacional")

    fun shouldOpenAdditionalAlertsPage(alertCount: Int): Boolean =
        alertCount > MAX_INLINE_ALERTS_PER_CITY

    fun shouldNotifySeismicEvent(magnitude: Double, feltInBrazil: Boolean): Boolean =
        magnitude >= SEISMIC_NOTIFICATION_MIN_MAGNITUDE && feltInBrazil

    fun storeDisplayName(channel: String): String = when (channel) {
        STORE_SAMSUNG -> "Samsung Galaxy Store"
        STORE_AMAZON -> "Amazon Appstore"
        else -> "Google Play"
    }
}


## Verificação operacional — 15/10/2026 19:55 BRT

Consulta direta à candidata validacao-rj: HTTP 200, generatedAt 2026-10-15T22:55:17.490Z, workerActive true, 92 municípios, zero avisos municipais elegíveis. INMET CURRENT_DEGRADED (produto avisos); CEMADEN nacional, CEMADEN-RJ e REDEMET ausentes da publicação. Ausência de avisos não é garantia de segurança; cadastro de 92 cidades não comprova medições para todas. CI 965 backend aprovado e Android ainda em andamento no momento da consulta. Corrigida ligação dos critérios 14/15 à seleção de fenômenos numéricos no Android; não disponibilizar AccuWeather como critério de tsunami.


## REDEMET: ciclo horário solicitado e proteção da chave — 15/10/2026

Consulta autenticada às 19:59:48 BRT: HTTP 200, SBGL e SBRJ com METAR válido das 19h BRT. CEMADEN nacional retornou atualizado 19:59:02 BRT, zero alertas abertos RJ; não significa ausência de risco. Chave não foi gravada nem exibida. Adaptador passa a enviar X-Api-Key, removendo segredo da URL.

REDEMET exibe boletim de até 60 minutos com horário original e descrição de ciclo horário/SPECI eventual. Consulta do cache continua limitada a 5 minutos; boletim com observação acima de 5 minutos é CURRENT_DEGRADED, nunca apresentado como medição minuto a minuto. Após 60 minutos, remove valores mesmo havendo nova consulta. Não entra automaticamente na média observacional que exige 5 minutos. Credencial, configuração Cloud Run e autorização de publicação continuam pendentes; teste de acesso não equivale a autorização comercial.


## Configuração segura da candidata — 16/10/2026

backend/scripts/configure-redemet-candidate.sh solicita chave em terminal oculto, grava por stdin no Secret Manager, fixa a versão exata e concede acesso somente à conta do serviço no segredo. Implanta candidata com --no-traffic e tag validacao-rj, ativando coleta REDEMET autorizada pelo operador sem habilitar publicação pública. Nenhuma chave é gravada no repositório ou impressa. Execução requer a sessão Cloud Shell do operador; ainda não executado pela assistência.


## Estado comprovado e pendências — 16/10/2026

A candidata 00050 publicou separadamente os avisos INMET, alertas CEMADEN nacional e boletins REDEMET, conforme liberação do operador. Consulta direta em 16/10/2026 às 11:03:28 BRT confirmou REDEMET CURRENT (SBGL/SBRJ, observações 11h), CEMADEN nacional CURRENT (painel 11:02:01 BRT), INMET CURRENT_DEGRADED (avisos, inventário parcial). Isso é evidência daquele horário, não disponibilidade permanente. CEMADEN-RJ hidrológico permanece sem registros atuais validados; 92 códigos municipais não significam 92 sensores.

Android CI 969 e 970 aprovados. APK debug usa candidata validacao-rj; release mantém produção. CI 970 disponibiliza artefato separado blaise-v6-rj-validacao-apk, aproximadamente 400 MB; não confundir com pacote completo de evidências de 1,18 GB. Instalação e teste no aparelho ainda não comprovados.

Tabelas 1/2: catálogo e seletor existem; seletor ainda não ligado ao fluxo de múltiplas observações reais. Não publicar média até existir par independente compatível, mesma variável/unidade/janela/localidade, pesos justificados e timestamps originais. Sem Tabela 1, aplicar Tabela 2 somente com dados comparáveis válidos; uma fonte isolada é leitura identificada, não média. Não converter previsão em observação, aviso em sensor, dado ausente em zero ou republicação em fonte independente.

Produtos NOAA/Copernicus/EUMETSAT/CPTEC, Windy, OpenWeatherMap e AccuWeather não foram comprovados como coletores completos nesta auditoria. Fontes marítimas permanecem pendentes de adaptadores/produtos e validação de cobertura e horários. Não declarar todas as fontes ativas nem todas as cidades cobertas. Chaves permanecem no servidor.


## Correções Android — 16/10/2026, revisão de voz e fontes

Painel dos agentes removido da navegação do cliente (não cria autenticação administrativa). Evidência de conexão passa a incluir CEMADEN nacional e REDEMET com município e horários validados; contador de fontes dinâmico. Dora usa PCM 16 bits e volume de mídia para compatibilidade; a reprodução no aparelho ainda precisa ser comprovada. Nenhuma fonte marítima ou média passa a ser considerada ativa por essa alteração.


## Configuração operacional restrita — 16/10/2026

Diretriz do operador: configurações de operação, agentes, critérios internos de desempate e homologação são exclusivos da administração. Removidas da navegação do cliente; preservados controles pessoais, resultados, origem e horário. Não foi criado login administrativo nem atalho secreto: enquanto não existir autenticação administrativa validada, esses controles não são expostos pelo aplicativo. Essa mudança de navegação não altera autorização do servidor nem habilita fontes.
