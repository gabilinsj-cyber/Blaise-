/**
 * Blaise V6 RJ: registry of the TEN requested functional agents.
 *
 * Registry != ten running processes. Each entry states capabilities already in
 * the repo and tasks still needing real source integration, production IAM,
 * tests and approval. Numbers 1–8 preserve the historical approved names.
 * The names for 9 and 10 are functional labels recovered from earlier planning,
 * NOT independently confirmed historical proper names.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

export const RJ_AGENT_REGISTRY_VERSION = 'blaise-v6-rj-agents-2026-10-10-v1';
export const RJ_AGENT_PROJECT = 'Blaise V6 RJ';
const NOT_DEPLOYED = 'SPECIFIED_NOT_AUTONOMOUSLY_DEPLOYED';
const create = (number, name, responsibility, sourceKinds, components, blockers, historicalName = 'APPROVED') => Object.freeze({
  number,
  id: `blaise-rj-agent-${number}`,
  name,
  responsibility,
  sourceKinds: Object.freeze(sourceKinds),
  existingComponents: Object.freeze(components),
  blockers: Object.freeze(blockers),
  historicalName,
  runtimeStatus: NOT_DEPLOYED,
  geography: 'RJ_92_MUNICIPALITIES_AND_ADJACENT_ATLANTIC_ONLY',
});

export const BLAISE_RJ_AGENTS = Object.freeze([
  create(1, 'Blaise Sentinel RJ',
    'Verificação de fonte oficial, domínio, licença, localização, horário, frescor e falha segura; INEA aposentado.',
    ['ALERTA_RIO','DEFESA_CIVIL_RJ','CEMADEN','ANA','SGB_SACE','INMET','MARINHA','NOAA'],
    ['official-source-worker.mjs','source-contract.mjs','rj-phenomenon-source-policy.mjs'],
    ['Autorização e acesso à fonte','Cobertura/latência verificada para cada município']),
  create(2, 'Blaise Vector RJ',
    'Calculadora científica: física atmosférica, termodinâmica, radar autorizado, recálculo, limites de incerteza e vetos de dados.',
    ['OFFICIAL_MEASUREMENTS_ONLY_FOR_OBSERVED_DIAGNOSTICS'],
    ['blaise-scientific-kernels.mjs','blaise-scientific-jobs.mjs','rj-scientific-calculator.mjs'],
    ['Observações/perfis oficiais espacialmente comparáveis','Calibrações locais para parâmetros dependentes de radar']),
  create(3, 'Blaise Fusion RJ',
    'Fusão e média ponderada de medições comparáveis, verificação cruzada e rastreabilidade sem transformar modelos em medições.',
    ['INMET','DEFESA_CIVIL_RJ','CEMADEN','MARINHA','NOAA','WINDY_COMPARISON_ONLY'],
    ['rj-scientific-calculator.mjs','rj-weather-transition-estimator.mjs'],
    ['Pesos documentados e auditados','Fontes simultâneas compatíveis por município']),
  create(4, 'Blaise Track RJ',
    'Trajetória, velocidade, direção, área atingível e janela aproximada de chegada de fenômenos com incerteza explícita.',
    ['INMET','DEFESA_CIVIL_RJ','ALERTA_RIO_RIO_CITY_ONLY','MARINHA','NOAA'],
    ['blaise-marine-kernels.mjs','rj-weather-transition-estimator.mjs'],
    ['Vetores do mesmo fenômeno validados','Georreferenciamento e habilidade de nowcasting aferida']),
  create(5, 'Blaise Hydro RJ',
    'Chuva e acumulados, nível, cota, vazão, risco de cheia, inundação e deslizamento exclusivamente nas áreas de cobertura.',
    ['ANA_HIDROWEB','CEMADEN','SGB_SACE','DEFESA_CIVIL_RJ','ALERTA_RIO_RIO_CITY_ONLY'],
    ['cemaden-rj-source.mjs','official-source-worker.mjs'],
    ['Integrações ANA e SGB/SACE por estação','Medições hidrológicas atuais com licença']),
  create(6, 'Blaise Ocean RJ',
    'Mar, ondas, ventos marítimos, ressaca, ciclone extratropical e Atlântico adjacente, sem extrapolação indevida.',
    ['MARINHA_CHM','NOAA','INMET','WINDY_COMPARISON_ONLY'],
    ['chm-source.mjs','blaise-marine-kernels.mjs'],
    ['Frame/campo oceânico georreferenciado e vigente','Validação de produtos NOAA e condições de uso']),
  create(7, 'Blaise Seismo RJ',
    'Abalos recentes, Atlântico, avaliação de potencial impacto RJ e tsunami somente após avisos de autoridade competente.',
    ['USGS','NOAA','MARINHA_CHM','DEFESA_CIVIL_RJ'],
    ['MainActivity.kt_seismology_panel'],
    ['Integração sísmica oficial ao backend','Confirmação independente de risco de tsunami']),
  create(8, 'Blaise Audit RJ',
    'Auditoria científica de origem, fórmulas, alertas, escala 1–5, incerteza, revisões e ausência de alarmes falsos.',
    ['ALL_APPROVED_OFFICIAL_RJ_SOURCES'],
    ['blaise-scientific-jobs.mjs','rj-scientific-calculator.mjs','inmet-p0-policy.mjs'],
    ['Testes de campo cruzados','Auditoria de trilha de avisos oficiais e fontes']),
  create(9, 'Correção Horária RJ',
    'Verificação periódica de bugs, regressões, domínios, camadas, assinaturas e integridade; correção/reintegração só após CI e revisão.',
    ['INTERNAL_CI','APP_SECURITY','OFFICIAL_SOURCE_HEALTH'],
    ['android-ci.yml','rj-ui-review.yml','official-source-scheduler.mjs'],
    ['Agendamento de produção e permissões','Revisão humana para mudança disruptiva'],
    'FUNCTIONAL_LABEL_NOT_CONFIRMED_AS_ORIGINAL_PROPER_NAME'),
  create(10, 'Auditoria Profunda RJ',
    'Auditoria profunda 01:00; postura antiabuso/WAF/antibug; reforço e relatório a cada +500 mil assinantes; proposta de soluções pagas adequadas.',
    ['GCP_BILLING_METRICS','CLOUD_RUN','WAF','STORAGE','FIREBASE_AUTH','PLAY_BILLING'],
    ['android-ci.yml','cloudrun-preflight.sh','production-preflight.sh'],
    ['Contagem autenticada de assinantes','Cotações USD/EUR atuais e links oficiais','Compra/contratação e deploy exigem aprovação explícita'],
    'FUNCTIONAL_LABEL_NOT_CONFIRMED_AS_ORIGINAL_PROPER_NAME'),
]);

if (BLAISE_RJ_AGENTS.length !== 10 || new Set(BLAISE_RJ_AGENTS.map(a => a.number)).size !== 10) {
  throw new Error('rj_agent_registry_must_have_ten_unique_agents');
}

export const RJ_AGENT_CADENCE = Object.freeze({
  normalLevels123Ms: 300_000, // severe level 3 still never bypasses evidence requirements
  severeLevels45Ms: 60_000,
  criticalRecalculationOnlyMs: 25_000,
  officialSourceMinIntervalMs: 30_000,
  criticalRequiresTwoIndependentOfficialLevel5Alerts: true,
  criticalRequiresInternalDiagnostic: true,
  hourlyCorrection: 'EACH_HOUR_NOT_AUTONOMOUSLY_SCHEDULED',
  deepAuditLocalTime: '01:00',
  deepAuditTimezone: 'America/Sao_Paulo',
  releaseReviewDay: 20,
  audioOnlyOnLevel5: true,
});

export function agentByNumber(number) {
  if (!Number.isInteger(number) || number < 1 || number > 10) throw new RangeError('unknown_rj_agent');
  return BLAISE_RJ_AGENTS[number - 1];
}
export function rjCadenceForLevel(level, { independentOfficialLevel5Alerts = 0, scientificRevalidationLevel = null } = {}) {
  if (!Number.isInteger(level) || level < 1 || level > 5) throw new RangeError('invalid_rj_alert_level');
  const verifiedExtreme = level === 5 && independentOfficialLevel5Alerts >= 2 && scientificRevalidationLevel === 5;
  return Object.freeze({
    level,
    observationUpdateMs: level >= 4 ? RJ_AGENT_CADENCE.severeLevels45Ms : RJ_AGENT_CADENCE.normalLevels123Ms,
    calculationRecheckMs: verifiedExtreme ? RJ_AGENT_CADENCE.criticalRecalculationOnlyMs
      : level >= 4 ? RJ_AGENT_CADENCE.severeLevels45Ms : RJ_AGENT_CADENCE.normalLevels123Ms,
    independentOfficialExtremeVerified: verifiedExtreme,
    sourceMayBePolledEvery25s: false,
    runtimeSchedulingStatus: NOT_DEPLOYED,
  });
}

const AUTHORITIES = new Set(['INMET','DEFESA_CIVIL_RJ','CEMADEN','ALERTA_RIO','MARINHA_CHM','NOAA','SGB_SACE','ANA']);
const IBGE = new Set(RJ_MUNICIPALITIES.map(x => x.ibge));
export function evaluateExtremeAudioGate({ alerts, diagnostic, now = Date.now() } = {}) {
  const unavailable = reason => Object.freeze({ state: 'NOT_AUTHORIZED', reason,
    audio: false, voice: false, vibration: false, siren: false, publish: false });
  if (!Number.isFinite(now) || !Array.isArray(alerts) || alerts.length > 16) return unavailable('BAD_EVIDENCE');
  if (!diagnostic || !IBGE.has(String(diagnostic.ibge))
      || typeof diagnostic.phenomenon !== 'string' || !/^[A-Z_]{4,64}$/.test(diagnostic.phenomenon)
      || diagnostic.scale !== 5 || diagnostic.state !== 'VALIDATED_INTERNAL_DIAGNOSTIC'
      || diagnostic.independentInputValidation !== true || diagnostic.allowAutomaticWarning !== false) {
    return unavailable('SCIENTIFIC_CONSISTENCY_NOT_ESTABLISHED');
  }
  const age = now - Date.parse(diagnostic.calculatedAt);
  if (!Number.isFinite(age) || age < 0 || age > 60_000) return unavailable('DIAGNOSTIC_EXPIRED');
  const candidates = alerts.filter(a => {
    const from = Date.parse(a?.validFrom), until = Date.parse(a?.validUntil);
    return a && AUTHORITIES.has(a.authority) && a.type === 'OFFICIAL_WARNING'
      && a.validation === 'VERIFIED_LIVE' && a.severity === 5
      && a.ibge === diagnostic.ibge && a.phenomenon === diagnostic.phenomenon
      && typeof a.evidenceId === 'string' && a.evidenceId.length > 3
      && Number.isFinite(from) && Number.isFinite(until) && from <= now && now < until
      && from < until && until - from <= 7 * 86_400_000;
  });
  const distinctAuthorities = new Set(candidates.map(a => a.authority));
  if (distinctAuthorities.size < 2) return unavailable('TWO_INDEPENDENT_CURRENT_OFFICIAL_LEVEL5_WARNINGS_REQUIRED');
  // This gate is intentionally a readiness assessment. Delivering a public
  // alarm requires the independent notification publisher's policy/replay gate.
  return Object.freeze({
    state: 'ELIGIBLE_FOR_PUBLISHER_REVIEW',
    reason: 'TWO_OFFICIAL_WARNINGS_AND_MATCHING_INTERNAL_DIAGNOSTIC',
    sourceAuthorities: Object.freeze([...distinctAuthorities].sort()),
    audio: false, voice: false, vibration: false, siren: false, publish: false,
    requiresPublisherAuthorization: true,
  });
}

export const RJ_SCALE_MILESTONE = 500_000;
export function subscriberScaleReview({ verifiedActiveSubscribers, previousReportedMilestone = 0 } = {}) {
  if (!Number.isSafeInteger(verifiedActiveSubscribers) || verifiedActiveSubscribers < 0
      || !Number.isSafeInteger(previousReportedMilestone) || previousReportedMilestone < 0
      || previousReportedMilestone % RJ_SCALE_MILESTONE !== 0) {
    throw new TypeError('verified_subscriber_count_and_prior_milestone_required');
  }
  const current = Math.floor(verifiedActiveSubscribers / RJ_SCALE_MILESTONE) * RJ_SCALE_MILESTONE;
  const pendingMilestones = [];
  for (let level = previousReportedMilestone + RJ_SCALE_MILESTONE; level <= current; level += RJ_SCALE_MILESTONE) {
    pendingMilestones.push(level);
    if (pendingMilestones.length > 100) throw new RangeError('too_many_unreported_milestones');
  }
  return Object.freeze({
    agent: 10,
    currentVerifiedSubscribers: verifiedActiveSubscribers,
    milestonesNeedingReview: Object.freeze(pendingMilestones),
    recommendedReview: pendingMilestones.length > 0,
    controlsToReview: Object.freeze(['GOOGLE_CLOUD_ARMOR_WAF','CLOUD_RUN_CONCURRENCY_AUTOSCALING',
      'STORAGE_CAPACITY_RETENTION','RATE_LIMITS_BOT_ABUSE','SECURITY_MONITORING',
      'BACKUP_RECOVERY','IDENTITY_ENTITLEMENT_ACCESS_CONTROL']),
    procurementStatus: 'REQUIRES_HUMAN_APPROVAL',
    productLinksAndQuotes: 'REQUIRE_CURRENT_VENDOR_VERIFICATION',
    currency: Object.freeze(['USD','EUR']),
    purchasesExecuted: false,
  });
}
