package br.com.blaise.rj

import java.time.Duration
import java.time.Instant

/**
 * Official portals are links, not evidence that an alert is active.
 * The official alert metadata is ephemeral during rendering; this class
 * performs no disk/database/cache write and never owns a copied bulletin.
 * No scraping, no copied bulletins and no conversion from provider colors.
 * The five Blaise bands may only be rendered from backend-verified risk evidence.
 */
data class OfficialAlertPortal(val id: String, val name: String, val message: String, val url: String)
data class VerifiedBlaiseAlertEvidence(
    val portalId: String,
    val warningId: String,
    val level: Int,
    val checkedAt: Instant,
    val validFrom: Instant,
    val validUntil: Instant,
    val rjCoverageValidated: Boolean,
    val verifiedByBackend: Boolean,
)
data class OfficialAlertRibbonPresentation(
    val activeValidatedAlert: Boolean,
    val level: Int?,
    val backgroundArgb: Int,
    val message: String,
)

data class OfficialAlertRibbonItem(
    val portal: OfficialAlertPortal,
    val warningId: String?,
    val presentation: OfficialAlertRibbonPresentation,
)

data class OfficialAlertRibbonPage(
    val visible: List<OfficialAlertRibbonItem>,
    val additional: List<OfficialAlertRibbonItem>,
)

object OfficialAlertRibbonPolicy {
    const val MAX_TOP_ALERTS = 4
    // No SharedPreferences, Room, SQLite, Firestore or local files for notices.
    // UI receives only ephemeral, backend-verified metadata; nothing is
    // written by this pure presentation policy. Never copy a source bulletin.
    const val PERSIST_OFFICIAL_NOTICES = false
    const val PERSIST_OFFICIAL_NOTICE_HISTORY = false
    const val DISPLAY_PROVIDER_ALERT_BODY = false
    const val ACCEPT_OPENWEATHER_AS_OFFICIAL_WARNING_SOURCE = false
    val portals: List<OfficialAlertPortal> = listOf(
        OfficialAlertPortal("alerta-rio", "Alerta Rio",
            "Veja os avisos oficiais para o município do Rio de Janeiro.",
            "https://www.sistema-alerta-rio.com.br/alertas/"),
        OfficialAlertPortal("defesa-civil-rj", "Defesa Civil RJ",
            "Veja as orientações oficiais de proteção e emergências no estado.",
            "https://defesacivil.rj.gov.br/"),
        OfficialAlertPortal("inmet-avisos", "INMET",
            "Veja os avisos meteorológicos no portal oficial.",
            "https://avisos.inmet.gov.br/"),
        OfficialAlertPortal("inpe-cptec-avisos", "INPE / CPTEC",
            "Veja os avisos e a previsão de tempo severo na página oficial.",
            "https://www.cptec.inpe.br/"),
    )

    // Black bold text remains legible on these intentionally LIGHT surfaces.
    private val colors = listOf(0xFFD8F5E2, 0xFFFFF2AE, 0xFFFFDEBC, 0xFFFFCBCB, 0xFFFFB8B8)
    private val messages = listOf(
        "NÍVEL 1 — Atenção: acompanhe as orientações oficiais.",
        "NÍVEL 2 — Atenção reforçada: acompanhe a situação e evite exposição desnecessária.",
        "NÍVEL 3 — Perigo: evite áreas de risco e consulte as orientações oficiais.",
        "NÍVEL 4 — Perigo elevado: siga as recomendações das autoridades.",
        "NÍVEL 5 — Perigo extremo: siga imediatamente as orientações das autoridades.",
    )

    /**
     * The four MAIN SOURCES stay visible at the top, in their approved order,
     * even if one agency publishes multiple verified warnings. Each source
     * shows its strongest current warning. Every remaining verified warning
     * appears under Mais, always with the same validated-source official link.
     * A link alone is never evidence of a current danger level.
     */
    fun layout(evidence: List<VerifiedBlaiseAlertEvidence>, now: Instant): OfficialAlertRibbonPage {
        if (evidence.size > 128) return layout(emptyList(), now)
        val verified = evidence.mapNotNull { record ->
            val portal = portals.firstOrNull { it.id == record.portalId } ?: return@mapNotNull null
            val presentation = present(portal.id, record, now)
            if (!presentation.activeValidatedAlert) null
            else OfficialAlertRibbonItem(portal, record.warningId, presentation)
        }.distinctBy { it.portal.id to it.warningId }
            .sortedWith(
                compareByDescending<OfficialAlertRibbonItem> { it.presentation.level ?: 0 }
                    .thenBy { it.portal.id }
                    .thenBy { it.warningId }
            )
        val top = portals.map { portal ->
            verified.firstOrNull { it.portal.id == portal.id }
                ?: OfficialAlertRibbonItem(portal, null, present(portal.id, null, now))
        }
        val selected = top.filter { it.presentation.activeValidatedAlert }
            .map { it.portal.id to it.warningId }.toSet()
        val additional = verified.filterNot { (it.portal.id to it.warningId) in selected }
        return OfficialAlertRibbonPage(top, additional)
    }

    fun legend(): List<OfficialAlertRibbonPresentation> = (1..5).map { level ->
        OfficialAlertRibbonPresentation(
            activeValidatedAlert = false,
            level = level,
            backgroundArgb = colors[level - 1].toInt(),
            message = "Referência de cor • nível $level (não é alerta ativo)",
        )
    }

    fun present(portalId: String, evidence: VerifiedBlaiseAlertEvidence?, now: Instant):
        OfficialAlertRibbonPresentation {
        val fallback = OfficialAlertRibbonPresentation(false, null, 0xFFEBF0F5.toInt(),
            "ALERTAS NÃO VERIFICADOS — consulte a página oficial.")
        if (portals.none { it.id == portalId } || evidence == null) return fallback
        if (evidence.portalId != portalId || !evidence.verifiedByBackend ||
            !evidence.rjCoverageValidated || evidence.warningId.length !in 4..160 ||
            evidence.level !in 1..5 ||
            evidence.checkedAt.isAfter(now) || evidence.validFrom.isAfter(now) ||
            !evidence.validUntil.isAfter(now) ||
            Duration.between(evidence.checkedAt, now).seconds !in 0L..720L ||
            Duration.between(evidence.validFrom, evidence.validUntil).seconds > 7L * 24L * 3600L ||
            !evidence.validUntil.isAfter(evidence.validFrom)) return fallback
        return OfficialAlertRibbonPresentation(
            activeValidatedAlert = true,
            level = evidence.level,
            backgroundArgb = colors[evidence.level - 1].toInt(),
            message = messages[evidence.level - 1],
        )
    }
}
